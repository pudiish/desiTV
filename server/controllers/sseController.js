/**
 * Server-Sent Events (SSE) Controller
 * 
 * Push-only broadcast - replaces HTTP polling entirely
 * 
 * Features:
 * - Single persistent connection per client
 * - Server pushes state every 5s
 * - Instant video change notifications
 * - Heartbeat for connection health
 * - Auto-reconnect support via Last-Event-ID
 */

const liveStateService = require('../services/liveStateService');

// Track active SSE connections per category
const categoryConnections = new Map(); // categoryId -> Set of response objects
let broadcastIntervalId = null;
let eventId = 0;

// Broadcast interval (same as WebSocket)
const BROADCAST_INTERVAL_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 30000;

/**
 * GET /api/live-state/stream?categoryId=xxx
 * SSE endpoint for live sync
 */
exports.streamLiveState = (req, res) => {
  const { categoryId } = req.query;

  if (!categoryId) {
    return res.status(400).json({ error: 'categoryId required' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.flushHeaders();

  console.log(`[SSE] Client connected for category: ${categoryId}`);

  // Add to category connections
  if (!categoryConnections.has(categoryId)) {
    categoryConnections.set(categoryId, new Set());
  }
  categoryConnections.get(categoryId).add(res);

  // Start broadcast if not running
  if (!broadcastIntervalId) {
    startBroadcast();
  }

  // Send initial state immediately
  sendInitialState(res, categoryId);

  // Setup heartbeat for this connection
  const heartbeatId = setInterval(() => {
    sendHeartbeat(res);
  }, HEARTBEAT_INTERVAL_MS);

  // Handle client disconnect
  req.on('close', () => {
    console.log(`[SSE] Client disconnected from category: ${categoryId}`);
    clearInterval(heartbeatId);
    
    const connections = categoryConnections.get(categoryId);
    if (connections) {
      connections.delete(res);
      if (connections.size === 0) {
        categoryConnections.delete(categoryId);
      }
    }

    // Stop broadcast if no connections
    if (categoryConnections.size === 0 && broadcastIntervalId) {
      clearInterval(broadcastIntervalId);
      broadcastIntervalId = null;
      console.log('[SSE] No connections - stopped broadcast');
    }
  });

  // Handle errors
  req.on('error', (err) => {
    console.error(`[SSE] Connection error for ${categoryId}:`, err.message);
  });
};

/**
 * Send initial state to new connection
 */
async function sendInitialState(res, categoryId) {
  try {
    const state = await liveStateService.getLiveState(categoryId, true);
    sendEvent(res, 'sync', state);
  } catch (error) {
    sendEvent(res, 'error', { message: error.message });
  }
}

/**
 * Start periodic broadcast to all connections
 */
function startBroadcast() {
  console.log('[SSE] Starting broadcast');
  
  broadcastIntervalId = setInterval(async () => {
    for (const [categoryId, connections] of categoryConnections.entries()) {
      if (connections.size === 0) continue;

      try {
        const state = await liveStateService.getLiveState(categoryId, true);
        
        // Broadcast to all connections for this category
        for (const res of connections) {
          try {
            sendEvent(res, 'sync', state);
          } catch (e) {
            // Connection probably dead - will be cleaned up on close
          }
        }

        // Check for video change
        const lastIndex = lastVideoIndices.get(categoryId);
        if (lastIndex !== undefined && lastIndex !== state.live.videoIndex) {
          // Video changed!
          for (const res of connections) {
            try {
              sendEvent(res, 'videoChange', {
                categoryId,
                videoIndex: state.live.videoIndex,
                videoId: state.live.videoId,
                videoTitle: state.live.videoTitle,
                position: state.live.position,
              });
            } catch (e) {
              // Ignore
            }
          }
        }
        lastVideoIndices.set(categoryId, state.live.videoIndex);

      } catch (error) {
        console.error(`[SSE] Broadcast error for ${categoryId}:`, error.message);
      }
    }
  }, BROADCAST_INTERVAL_MS);
}

// Track last video index per category (for change detection)
const lastVideoIndices = new Map();

/**
 * Send SSE event
 */
function sendEvent(res, event, data) {
  eventId++;
  const payload = [
    `id: ${eventId}`,
    `event: ${event}`,
    `data: ${JSON.stringify(data)}`,
    '', // Empty line to end event
  ].join('\n');

  res.write(payload + '\n');
}

/**
 * Send heartbeat
 */
function sendHeartbeat(res) {
  try {
    sendEvent(res, 'heartbeat', { timestamp: Date.now() });
  } catch (e) {
    // Connection probably dead
  }
}

/**
 * Get SSE stats
 */
exports.getSSEStats = (req, res) => {
  const stats = {
    totalConnections: 0,
    categories: {},
  };

  for (const [categoryId, connections] of categoryConnections.entries()) {
    stats.categories[categoryId] = connections.size;
    stats.totalConnections += connections.size;
  }

  res.json(stats);
};

/**
 * Broadcast to specific category (for external triggers)
 */
exports.broadcastToCategory = async (categoryId, event, data) => {
  const connections = categoryConnections.get(categoryId);
  if (!connections || connections.size === 0) return;

  for (const res of connections) {
    try {
      sendEvent(res, event, data);
    } catch (e) {
      // Ignore
    }
  }
};
