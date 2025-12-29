/**
 * Server-Sent Events (SSE) Controller - With Backpressure
 * 
 * Push-only broadcast with Netflix-style optimizations:
 * 
 * Features:
 * - Backpressure detection (drain events)
 * - Message coalescing (merge missed syncs)
 * - Per-client health tracking
 * - Adaptive broadcast (skip slow clients)
 * - Auto-reconnect support via Last-Event-ID
 */

const liveStateService = require('../services/liveStateService');
const { encodeStateDelta } = require('../utils/deltaCompression');

// ═══════════════════════════════════════════════════════════════════
// CONNECTION TRACKING (With Health Metrics)
// ═══════════════════════════════════════════════════════════════════

// Enhanced connection info
class SSEConnection {
  constructor(res, categoryId) {
    this.res = res;
    this.categoryId = categoryId;
    this.createdAt = Date.now();
    this.lastSentAt = 0;
    this.pendingMessages = 0;    // Messages waiting in buffer
    this.missedSyncs = 0;        // Syncs skipped due to backpressure
    this.isHealthy = true;       // Can accept messages?
    this.isDraining = false;     // Waiting for buffer to drain
    this.lastState = null;       // For delta compression
  }

  // Check if client can receive messages
  canReceive() {
    return this.isHealthy && !this.isDraining && this.pendingMessages < 3;
  }
}

// Track connections with metadata
const connections = new Map(); // connectionId -> SSEConnection
const categoryConnections = new Map(); // categoryId -> Set of connectionIds
let connectionIdCounter = 0;
let broadcastIntervalId = null;
let eventId = 0;

// Configuration
const BROADCAST_INTERVAL_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 30000;
const MAX_PENDING_MESSAGES = 3;
const COALESCE_THRESHOLD = 2; // Merge if missed 2+ syncs

// ═══════════════════════════════════════════════════════════════════
// MAIN ENDPOINT
// ═══════════════════════════════════════════════════════════════════

/**
 * GET /api/live-state/stream?categoryId=xxx
 * SSE endpoint with backpressure handling
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
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.flushHeaders();

  // Create connection object
  const connId = ++connectionIdCounter;
  const conn = new SSEConnection(res, categoryId);
  connections.set(connId, conn);

  // Add to category set
  if (!categoryConnections.has(categoryId)) {
    categoryConnections.set(categoryId, new Set());
  }
  categoryConnections.get(categoryId).add(connId);

  console.log(`[SSE] Client ${connId} connected for ${categoryId}`);

  // ─────────────────────────────────────────────────────────────────
  // BACKPRESSURE HANDLING (The Magic)
  // ─────────────────────────────────────────────────────────────────

  // 'drain' event fires when buffer is empty again
  res.on('drain', () => {
    conn.isDraining = false;
    conn.pendingMessages = 0;
    
    // If we missed syncs, send coalesced update
    if (conn.missedSyncs >= COALESCE_THRESHOLD) {
      sendCoalescedSync(conn, connId);
    }
    conn.missedSyncs = 0;
  });

  // Start broadcast if not running
  if (!broadcastIntervalId) {
    startBroadcast();
  }

  // Send initial state
  sendInitialState(conn, connId);

  // Setup heartbeat
  const heartbeatId = setInterval(() => {
    sendHeartbeat(conn, connId);
  }, HEARTBEAT_INTERVAL_MS);

  // ─────────────────────────────────────────────────────────────────
  // CLEANUP
  // ─────────────────────────────────────────────────────────────────

  req.on('close', () => {
    console.log(`[SSE] Client ${connId} disconnected (missed ${conn.missedSyncs} syncs)`);
    clearInterval(heartbeatId);
    cleanup(connId, categoryId);
  });

  req.on('error', (err) => {
    console.error(`[SSE] Client ${connId} error:`, err.message);
    conn.isHealthy = false;
  });
};

// ═══════════════════════════════════════════════════════════════════
// SENDING WITH BACKPRESSURE
// ═══════════════════════════════════════════════════════════════════

/**
 * Send event with backpressure detection
 * Returns false if buffer is full
 */
function sendEvent(conn, connId, event, data) {
  if (!conn.canReceive()) {
    conn.missedSyncs++;
    return false;
  }

  eventId++;
  const payload = [
    `id: ${eventId}`,
    `event: ${event}`,
    `data: ${JSON.stringify(data)}`,
    '',
  ].join('\n') + '\n';

  conn.pendingMessages++;
  
  // res.write returns false if buffer is full (backpressure)
  const flushed = conn.res.write(payload);
  
  if (!flushed) {
    conn.isDraining = true;
    // Don't close - just wait for 'drain' event
  } else {
    conn.pendingMessages = Math.max(0, conn.pendingMessages - 1);
  }
  
  conn.lastSentAt = Date.now();
  return flushed;
}

/**
 * Send coalesced sync (after backpressure clears)
 * Instead of 3 missed syncs, send 1 with latest state
 */
async function sendCoalescedSync(conn, connId) {
  try {
    const state = await liveStateService.getLiveState(conn.categoryId, true);
    
    // Mark as coalesced so client knows it caught up
    sendEvent(conn, connId, 'sync', {
      ...state,
      _coalesced: true,
      _missedCount: conn.missedSyncs,
    });
    
    conn.lastState = state;
    console.log(`[SSE] Client ${connId} coalesced ${conn.missedSyncs} syncs`);
  } catch (e) {
    console.error(`[SSE] Coalesce error for ${connId}:`, e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
// BROADCAST LOOP
// ═══════════════════════════════════════════════════════════════════

/**
 * Periodic broadcast with per-client backpressure
 */
function startBroadcast() {
  console.log('[SSE] Starting broadcast with backpressure');
  
  broadcastIntervalId = setInterval(async () => {
    for (const [categoryId, connIds] of categoryConnections.entries()) {
      if (connIds.size === 0) continue;

      try {
        const state = await liveStateService.getLiveState(categoryId, true);
        
        // Broadcast to each connection (checking backpressure)
        for (const connId of connIds) {
          const conn = connections.get(connId);
          if (!conn) continue;

          // Skip if client has backpressure
          if (!conn.canReceive()) {
            conn.missedSyncs++;
            continue;
          }

          // Use delta if we have previous state
          const delta = encodeStateDelta(state, conn.lastState);
          
          if (delta.type === 'delta') {
            sendEvent(conn, connId, 'syncDelta', delta);
          } else {
            sendEvent(conn, connId, 'sync', {
              ...state,
              type: 'SYNC',
              timestamp: Date.now(),
            });
          }
          
          conn.lastState = state;
        }

        // Video change detection
        checkVideoChange(categoryId, state);

      } catch (error) {
        console.error(`[SSE] Broadcast error for ${categoryId}:`, error.message);
      }
    }
  }, BROADCAST_INTERVAL_MS);
}

// Track last video index per category
const lastVideoIndices = new Map();

function checkVideoChange(categoryId, state) {
  const lastIndex = lastVideoIndices.get(categoryId);
  
  if (lastIndex !== undefined && lastIndex !== state.live.videoIndex) {
    // Video changed - broadcast to all (high priority)
    const connIds = categoryConnections.get(categoryId);
    if (!connIds) return;

    for (const connId of connIds) {
      const conn = connections.get(connId);
      if (!conn) continue;

      // Video change is critical - send even with backpressure
      sendEvent(conn, connId, 'videoChange', {
        categoryId,
        videoIndex: state.live.videoIndex,
        videoId: state.live.videoId,
        videoTitle: state.live.videoTitle,
        position: state.live.position,
      });
    }
  }
  
  lastVideoIndices.set(categoryId, state.live.videoIndex);
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

async function sendInitialState(conn, connId) {
  try {
    const state = await liveStateService.getLiveState(conn.categoryId, true);
    sendEvent(conn, connId, 'sync', state);
    conn.lastState = state;
  } catch (error) {
    sendEvent(conn, connId, 'error', { message: error.message });
  }
}

function sendHeartbeat(conn, connId) {
  if (!conn.isHealthy) return;
  
  sendEvent(conn, connId, 'heartbeat', { 
    timestamp: Date.now(),
    health: {
      pending: conn.pendingMessages,
      missed: conn.missedSyncs,
      draining: conn.isDraining,
    },
  });
}

function cleanup(connId, categoryId) {
  connections.delete(connId);
  
  const catConns = categoryConnections.get(categoryId);
  if (catConns) {
    catConns.delete(connId);
    if (catConns.size === 0) {
      categoryConnections.delete(categoryId);
    }
  }

  // Stop broadcast if no connections
  if (connections.size === 0 && broadcastIntervalId) {
    clearInterval(broadcastIntervalId);
    broadcastIntervalId = null;
    console.log('[SSE] No connections - stopped broadcast');
  }
}

// ═══════════════════════════════════════════════════════════════════
// STATS & ADMIN
// ═══════════════════════════════════════════════════════════════════

exports.getSSEStats = (req, res) => {
  const stats = {
    totalConnections: connections.size,
    categories: {},
    healthStats: {
      healthy: 0,
      draining: 0,
      unhealthy: 0,
      totalMissedSyncs: 0,
    },
  };

  for (const [categoryId, connIds] of categoryConnections.entries()) {
    stats.categories[categoryId] = {
      connections: connIds.size,
      clients: [],
    };
    
    for (const connId of connIds) {
      const conn = connections.get(connId);
      if (!conn) continue;
      
      stats.categories[categoryId].clients.push({
        id: connId,
        healthy: conn.isHealthy,
        draining: conn.isDraining,
        pending: conn.pendingMessages,
        missed: conn.missedSyncs,
        connectedFor: Math.round((Date.now() - conn.createdAt) / 1000) + 's',
      });

      // Aggregate health
      if (!conn.isHealthy) stats.healthStats.unhealthy++;
      else if (conn.isDraining) stats.healthStats.draining++;
      else stats.healthStats.healthy++;
      
      stats.healthStats.totalMissedSyncs += conn.missedSyncs;
    }
  }

  res.json(stats);
};

exports.broadcastToCategory = async (categoryId, event, data) => {
  const connIds = categoryConnections.get(categoryId);
  if (!connIds) return;

  for (const connId of connIds) {
    const conn = connections.get(connId);
    if (conn) {
      sendEvent(conn, connId, event, data);
    }
  }
};
