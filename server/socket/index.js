/**
 * Socket.io Server Setup
 * 
 * Real-time sync for LIVE broadcast
 * Replaces polling with push-based updates
 * 
 * Features:
 * - Delta compression (90% bandwidth reduction)
 * - Room-based categories
 * - Video change detection
 * - Heartbeat for connection health
 */

const { Server } = require('socket.io');
const liveStateService = require('../services/liveStateService');
const { encodeStateDelta } = require('../utils/deltaCompression');
const chatLogic = require('../services/chatLogic');

// Track connected clients per category
const categoryRooms = new Map(); // categoryId -> Set of socket ids
const socketCategories = new Map(); // socketId -> categoryId
const lastStates = new Map(); // categoryId -> last state (for delta)

// Broadcast interval (5 seconds for synced clients)
const SYNC_BROADCAST_INTERVAL_MS = 5000;
let broadcastIntervalId = null;

/**
 * Initialize Socket.io server
 * @param {http.Server} httpServer - HTTP server instance
 * @param {Object} corsOptions - CORS configuration
 */
function initializeSocket(httpServer, corsOptions) {
  const io = new Server(httpServer, {
    cors: {
      origin: corsOptions.origin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Optimize for free tier
    pingTimeout: 30000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'], // Prefer websocket
    maxHttpBufferSize: 1e6, // 1MB max
  });

  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // --- Chat Events ---

    // Handle chat message
    socket.on('chat:message', async (data, callback) => {
      try {
        const { message, sessionId, context } = data;
        const channelId = context?.currentChannelId;
        const userIp = socket.handshake.address;

        // Process message using shared logic
        const result = await chatLogic.processMessage({
          message,
          sessionId,
          userId: socket.id, // Use socket ID as user ID if not provided
          channelId,
          userIp
        });

        // Send response back via callback (acknowledgement)
        if (callback) {
          callback({ success: true, data: result });
        } else {
          // Or emit event if no callback provided
          socket.emit('chat:response', { success: true, data: result });
        }

      } catch (error) {
        console.error('[Socket] Chat error:', error.message);
        const errorResponse = { success: false, error: error.message };
        if (callback) {
          callback(errorResponse);
        } else {
          socket.emit('chat:error', errorResponse);
        }
      }
    });

    // Get chat suggestions
    socket.on('chat:suggestions', (callback) => {
      try {
        const suggestions = chatLogic.getSuggestions();
        if (callback) callback({ success: true, data: suggestions });
      } catch (error) {
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // --- Live State Events ---

    // Client subscribes to a category
    socket.on('subscribe', async (categoryId) => {
      if (!categoryId) {
        socket.emit('error', { message: 'categoryId required' });
        return;
      }

      // Leave previous room if any
      const prevCategory = socketCategories.get(socket.id);
      if (prevCategory) {
        socket.leave(`category:${prevCategory}`);
        const prevRoom = categoryRooms.get(prevCategory);
        if (prevRoom) {
          prevRoom.delete(socket.id);
          if (prevRoom.size === 0) categoryRooms.delete(prevCategory);
        }
      }

      // Join new room
      const roomName = `category:${categoryId}`;
      socket.join(roomName);
      socketCategories.set(socket.id, categoryId);

      if (!categoryRooms.has(categoryId)) {
        categoryRooms.set(categoryId, new Set());
      }
      categoryRooms.get(categoryId).add(socket.id);

      console.log(`[Socket] ${socket.id} subscribed to ${categoryId} (${categoryRooms.get(categoryId).size} viewers)`);

      // Send immediate sync state
      try {
        const state = await liveStateService.getLiveState(categoryId, true);
        socket.emit('sync', {
          ...state,
          type: 'SYNC',
          timestamp: Date.now(),
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Client requests immediate sync (manual)
    socket.on('requestSync', async () => {
      const categoryId = socketCategories.get(socket.id);
      if (!categoryId) {
        socket.emit('error', { message: 'Not subscribed to any category' });
        return;
      }

      try {
        const state = await liveStateService.getLiveState(categoryId, true);
        socket.emit('sync', {
          ...state,
          type: 'SYNC',
          timestamp: Date.now(),
        });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    // Client reports their drift (for analytics)
    socket.on('reportDrift', (data) => {
      // Could log to analytics service
      // console.log(`[Socket] Drift report from ${socket.id}:`, data);
    });

    // Client disconnects
    socket.on('disconnect', (reason) => {
      const categoryId = socketCategories.get(socket.id);
      if (categoryId) {
        const room = categoryRooms.get(categoryId);
        if (room) {
          room.delete(socket.id);
          if (room.size === 0) categoryRooms.delete(categoryId);
        }
        socketCategories.delete(socket.id);
      }
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  // Start periodic broadcast
  startBroadcast(io);

  // Expose io for external use
  global.io = io;

  console.log('[Socket] WebSocket server initialized');
  return io;
}

/**
 * Broadcast sync to all category rooms periodically
 * Uses delta compression for bandwidth efficiency
 */
function startBroadcast(io) {
  if (broadcastIntervalId) clearInterval(broadcastIntervalId);

  broadcastIntervalId = setInterval(async () => {
    // Broadcast to each active category room
    for (const [categoryId, sockets] of categoryRooms.entries()) {
      if (sockets.size === 0) continue;

      try {
        const state = await liveStateService.getLiveState(categoryId, true);
        const roomName = `category:${categoryId}`;
        
        // Get previous state for delta calculation
        const prevState = lastStates.get(categoryId);
        
        // Encode as delta (90% smaller if same video)
        const delta = encodeStateDelta(state, prevState);
        
        // Store current state for next delta
        lastStates.set(categoryId, state);
        
        // Send delta or full based on type
        if (delta.type === 'delta') {
          // Minimal delta: ~20-50 bytes
          io.to(roomName).emit('syncDelta', delta);
        } else {
          // Full state on video change or first sync
          io.to(roomName).emit('sync', {
            ...state,
            type: 'SYNC',
            timestamp: Date.now(),
          });
        }

        // Check for video change
        const lastVideoIndex = getLastVideoIndex(categoryId);
        if (lastVideoIndex !== null && lastVideoIndex !== state.live.videoIndex) {
          // Video changed! Broadcast immediately
          io.to(roomName).emit('videoChange', {
            type: 'VIDEO_CHANGE',
            categoryId,
            videoIndex: state.live.videoIndex,
            videoId: state.live.videoId,
            videoTitle: state.live.videoTitle,
            position: state.live.position,
            timestamp: Date.now(),
          });
        }
        setLastVideoIndex(categoryId, state.live.videoIndex);

      } catch (error) {
        console.error(`[Socket] Broadcast error for ${categoryId}:`, error.message);
      }
    }
  }, SYNC_BROADCAST_INTERVAL_MS);
}

// Track last video index per category (for change detection)
const lastVideoIndices = new Map();

function getLastVideoIndex(categoryId) {
  return lastVideoIndices.get(categoryId) ?? null;
}

function setLastVideoIndex(categoryId, index) {
  lastVideoIndices.set(categoryId, index);
}

/**
 * Broadcast to specific category (call from elsewhere)
 */
function broadcastToCategory(categoryId, event, data) {
  if (global.io) {
    global.io.to(`category:${categoryId}`).emit(event, data);
  }
}

/**
 * Get stats
 */
function getSocketStats() {
  const stats = {
    totalConnections: socketCategories.size,
    categories: {},
  };
  for (const [categoryId, sockets] of categoryRooms.entries()) {
    stats.categories[categoryId] = sockets.size;
  }
  return stats;
}

/**
 * Shutdown
 */
function shutdown() {
  if (broadcastIntervalId) {
    clearInterval(broadcastIntervalId);
    broadcastIntervalId = null;
  }
  if (global.io) {
    global.io.close();
    global.io = null;
  }
}

module.exports = {
  initializeSocket,
  broadcastToCategory,
  getSocketStats,
  shutdown,
};
