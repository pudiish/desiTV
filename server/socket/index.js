/**
 * Socket.io Server Setup - Chat + Real-Time Channel Updates
 * 
 * Features:
 * - Chat message handling
 * - Chat suggestions
 * - Real-time channel updates (pushed on data changes)
 */

const { Server } = require('socket.io');
const chatLogic = require('../services/chatLogic');

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

    // --- Channel Events ---
    
    // Client requests current data version
    socket.on('channels:getVersion', (callback) => {
      try {
        const ChannelDataService = require('../services/ChannelDataService');
        const version = ChannelDataService.getVersion();
        if (callback) callback({ success: true, version });
      } catch (error) {
        if (callback) callback({ success: false, error: error.message });
      }
    });

    // Client subscribes to channel updates
    socket.on('channels:subscribe', (callback) => {
      socket.join('channels');
      console.log(`[Socket] Client ${socket.id} subscribed to channel updates`);
      if (callback) callback({ success: true });
    });

    // Client unsubscribes from channel updates
    socket.on('channels:unsubscribe', (callback) => {
      socket.leave('channels');
      if (callback) callback({ success: true });
    });

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

    // Client disconnects
    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  // Expose io for external use (channel updates + chat)
  global.io = io;

  console.log('[Socket] WebSocket server initialized (chat + channel updates)');
  return io;
}

/**
 * Broadcast channel update to all subscribed clients
 * Called by ChannelDataService when data changes
 */
function broadcastChannelUpdate(eventType, data) {
  if (!global.io) return;
  
  // Emit to all clients in 'channels' room + all connected clients
  global.io.emit(eventType, data);
  console.log(`[Socket] Broadcasted ${eventType} to all clients`);
}

/**
 * Get socket stats
 */
function getSocketStats() {
  if (!global.io) {
    return { totalConnections: 0, message: 'Socket.io not initialized' };
  }
  
  // Count connected clients
  const sockets = global.io.sockets.sockets;
  return {
    totalConnections: sockets.size,
    channelSubscribers: global.io.sockets.adapter.rooms.get('channels')?.size || 0,
    message: 'Chat + channel updates active',
  };
}

/**
 * Shutdown
 */
function shutdown() {
  if (global.io) {
    global.io.close();
    global.io = null;
  }
}

module.exports = {
  initializeSocket,
  broadcastChannelUpdate,
  getSocketStats,
  shutdown,
};
