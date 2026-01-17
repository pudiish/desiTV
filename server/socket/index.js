/**
 * Socket.io Server Setup - Chat Only
 * 
 * NOTE: Live state sync removed - clients calculate position locally.
 * Socket.io is now used ONLY for chat functionality.
 * 
 * Features:
 * - Chat message handling
 * - Chat suggestions
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

    // --- Chat Events Only ---

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

  // Expose io for external use (chat only)
  global.io = io;

  console.log('[Socket] WebSocket server initialized (chat only)');
  return io;
}

/**
 * Get socket stats (chat connections only)
 */
function getSocketStats() {
  if (!global.io) {
    return { totalConnections: 0, message: 'Socket.io not initialized' };
  }
  
  // Count connected clients
  const sockets = global.io.sockets.sockets;
  return {
    totalConnections: sockets.size,
    message: 'Chat connections only (sync removed)',
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
  getSocketStats,
  shutdown,
};
