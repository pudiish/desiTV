/**
 * Sync Orchestrator - Netflix/Spotify Level Architecture
 * 
 * THE MASTER CONTROLLER: Orchestrates all sync strategies
 * 
 * Priority order:
 * 1. WebSocket (best latency, bidirectional)
 * 2. SSE (push-only, works through proxies)
 * 3. Predictive Engine (zero API calls)
 * 4. HTTP Polling (last resort fallback)
 * 
 * Features:
 * - Auto-failover between strategies
 * - NTP-style multi-sample clock sync
 * - Drift anomaly detection
 * - Delta compression
 * - Manifest caching for offline computation
 * - Visibility-based clock re-sync (Spotify approach)
 */

import { predictiveEngine } from './PredictiveEngine';
import { sseClient } from './SSEClient';
import socketService from '../socket';
import apiClientV2 from '../apiClientV2';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  // Strategy priorities
  STRATEGIES: ['websocket', 'sse', 'predictive', 'http'],
  
  // Clock sync
  CLOCK_SYNC_SAMPLES: 5,
  CLOCK_SYNC_INTERVAL_MS: 300000, // Re-sync clock every 5 min
  CLOCK_SYNC_ON_WAKE_DELAY_MS: 500, // Delay after tab becomes visible
  
  // Drift thresholds
  DRIFT_TOLERANCE_MS: 200,
  DRIFT_WARN_MS: 1000,
  DRIFT_CRITICAL_MS: 5000,
  
  // Anomaly detection
  ANOMALY_CONSECUTIVE_COUNT: 5,
  ANOMALY_THRESHOLD_MS: 500,
  
  // Server check intervals
  SERVER_CHECK_SYNCED_MS: 60000,    // When synced: check every 60s
  SERVER_CHECK_DRIFTING_MS: 10000,  // When drifting: check every 10s
  SERVER_CHECK_CRITICAL_MS: 2000,   // When critical: check every 2s
  
  // Manifest
  MANIFEST_TTL_MS: 300000, // Refresh manifest every 5 min
};

// ═══════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════

let currentStrategy = null;
let categoryId = null;
let isRunning = false;
let lastServerCheck = 0;
let serverCheckIntervalId = null;
let clockSyncIntervalId = null;
let visibilityListenerAttached = false;
let lastHiddenTime = 0;

// Listeners
const stateListeners = new Set();
const correctionListeners = new Set();

// Stats
const stats = {
  strategySwitches: 0,
  serverChecks: 0,
  clockSyncs: 0,
  visibilitySyncs: 0, // NEW: Track wake-up syncs
  anomaliesDetected: 0,
  seeks: 0,
  rateAdjustments: 0,
};

// ═══════════════════════════════════════════════════════════════════
// MAIN API
// ═══════════════════════════════════════════════════════════════════

/**
 * Start sync for a category
 */
export async function startSync(catId, options = {}) {
  if (isRunning && categoryId === catId) {
    console.log('[SyncOrchestrator] Already syncing this category');
    return;
  }

  // Stop any existing sync
  stopSync();

  categoryId = catId;
  isRunning = true;
  console.log(`[SyncOrchestrator] Starting sync for ${categoryId}`);

  // Step 1: Fetch manifest and initialize predictive engine
  try {
    const manifest = await fetchManifest(categoryId);
    await predictiveEngine.initialize(categoryId, manifest);
    console.log('[SyncOrchestrator] Predictive engine initialized');
  } catch (e) {
    console.warn('[SyncOrchestrator] Failed to initialize predictive engine:', e.message);
  }

  // Step 2: Perform multi-sample clock sync
  try {
    await performClockSync();
    console.log('[SyncOrchestrator] Clock sync complete');
  } catch (e) {
    console.warn('[SyncOrchestrator] Clock sync failed:', e.message);
  }

  // Step 3: Connect best available strategy
  await selectBestStrategy();

  // Step 4: Start periodic server checks (for anomaly detection)
  startServerCheckLoop();

  // Step 5: Start periodic clock re-sync
  startClockSyncLoop();

  // Step 6: Setup visibility change handler (Spotify approach)
  setupVisibilityHandler();

  // Emit initial state
  emitState();
}

/**
 * Stop sync
 */
export function stopSync() {
  console.log('[SyncOrchestrator] Stopping sync');
  
  isRunning = false;
  categoryId = null;
  currentStrategy = null;

  // Stop intervals
  if (serverCheckIntervalId) {
    clearInterval(serverCheckIntervalId);
    serverCheckIntervalId = null;
  }
  if (clockSyncIntervalId) {
    clearInterval(clockSyncIntervalId);
    clockSyncIntervalId = null;
  }

  // Remove visibility listener
  removeVisibilityHandler();

  // Disconnect all strategies
  socketService.disconnect();
  sseClient.disconnect();
  predictiveEngine.reset();
}

/**
 * Get current expected state (from best source)
 */
export function getExpectedState() {
  // Primary: Predictive engine (zero latency)
  const predictedState = predictiveEngine.getExpectedState();
  if (predictedState && predictedState.confidence > 0.7) {
    return {
      ...predictedState,
      source: 'predictive',
    };
  }

  // Fallback: Last server state
  return null;
}

/**
 * Report player position (for drift detection)
 */
export function reportPosition(position, videoIndex) {
  if (!predictiveEngine.isInitialized) return null;

  const result = predictiveEngine.checkDrift(position, videoIndex);

  // Track stats
  if (result.action === 'seek') stats.seeks++;
  if (result.action === 'rate_adjust') stats.rateAdjustments++;
  if (result.needsServerSync && result.reason === 'anomaly_detected') {
    stats.anomaliesDetected++;
    triggerServerCheck('anomaly');
  }

  // Notify correction listeners
  if (result.action !== 'none') {
    correctionListeners.forEach(cb => {
      try { cb(result); } catch (e) {}
    });
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════
// STRATEGY SELECTION
// ═══════════════════════════════════════════════════════════════════

/**
 * Select and connect best available strategy
 */
async function selectBestStrategy() {
  for (const strategy of CONFIG.STRATEGIES) {
    const connected = await tryStrategy(strategy);
    if (connected) {
      currentStrategy = strategy;
      console.log(`[SyncOrchestrator] Using strategy: ${strategy}`);
      stats.strategySwitches++;
      return;
    }
  }

  console.error('[SyncOrchestrator] All strategies failed!');
  currentStrategy = 'predictive'; // Always have predictive as fallback
}

/**
 * Try to connect a specific strategy
 */
async function tryStrategy(strategy) {
  switch (strategy) {
    case 'websocket':
      return await tryWebSocket();
    case 'sse':
      return await trySSE();
    case 'predictive':
      return predictiveEngine.isInitialized;
    case 'http':
      return true; // HTTP always works (theoretically)
    default:
      return false;
  }
}

/**
 * Try WebSocket connection
 */
async function tryWebSocket() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socketService.disconnect();
      resolve(false);
    }, 5000);

    const cleanup = socketService.addListener('connected', () => {
      clearTimeout(timeout);
      cleanup();
      setupWebSocketListeners();
      resolve(true);
    });

    const failCleanup = socketService.addListener('fallback', () => {
      clearTimeout(timeout);
      cleanup();
      failCleanup();
      resolve(false);
    });

    socketService.connect();
    socketService.subscribeToCategory(categoryId);
  });
}

/**
 * Try SSE connection
 */
async function trySSE() {
  if (!sseClient.constructor.isSupported()) {
    return false;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      sseClient.disconnect();
      resolve(false);
    }, 5000);

    const cleanup = sseClient.addListener('connected', () => {
      clearTimeout(timeout);
      cleanup();
      setupSSEListeners();
      resolve(true);
    });

    const failCleanup = sseClient.addListener('fallback', () => {
      clearTimeout(timeout);
      cleanup();
      failCleanup();
      resolve(false);
    });

    sseClient.connect(categoryId);
  });
}

/**
 * Setup WebSocket event listeners
 */
function setupWebSocketListeners() {
  socketService.addListener('sync', handleServerSync);
  socketService.addListener('videoChange', handleVideoChange);
  socketService.addListener('disconnected', handleDisconnect);
}

/**
 * Setup SSE event listeners
 */
function setupSSEListeners() {
  sseClient.addListener('sync', handleServerSync);
  sseClient.addListener('videoChange', handleVideoChange);
  sseClient.addListener('fallback', handleDisconnect);
}

// ═══════════════════════════════════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Handle sync data from server
 */
function handleServerSync(data) {
  lastServerCheck = Date.now();
  stats.serverChecks++;

  // Update predictive engine with server data
  if (predictiveEngine.isInitialized) {
    predictiveEngine.applyServerCorrection(data);
  }

  // Emit to listeners
  emitState();
}

/**
 * Handle video change notification
 */
function handleVideoChange(data) {
  console.log('[SyncOrchestrator] Video changed:', data.videoTitle);
  
  correctionListeners.forEach(cb => {
    try {
      cb({
        action: 'switch_video',
        ...data,
      });
    } catch (e) {}
  });
}

/**
 * Handle strategy disconnect
 */
function handleDisconnect() {
  console.warn(`[SyncOrchestrator] Strategy ${currentStrategy} disconnected`);
  
  // Try next strategy
  if (isRunning) {
    selectBestStrategy();
  }
}

// ═══════════════════════════════════════════════════════════════════
// CLOCK SYNC (NTP-Style)
// ═══════════════════════════════════════════════════════════════════

/**
 * Perform multi-sample clock sync
 */
async function performClockSync() {
  stats.clockSyncs++;
  
  const fetchFn = async () => {
    // Use apiClientV2 for health check
    const result = await apiClientV2.trackEvent({ action: 'clock_sync' });
    return result.data || {};
  };

  return predictiveEngine.performClockSync(fetchFn);
}

/**
 * Start periodic clock re-sync
 */
function startClockSyncLoop() {
  if (clockSyncIntervalId) clearInterval(clockSyncIntervalId);
  
  clockSyncIntervalId = setInterval(() => {
    performClockSync().catch(e => {
      console.warn('[SyncOrchestrator] Clock sync failed:', e.message);
    });
  }, CONFIG.CLOCK_SYNC_INTERVAL_MS);
}

// ═══════════════════════════════════════════════════════════════════
// SERVER CHECKS (Anomaly Detection)
// ═══════════════════════════════════════════════════════════════════

/**
 * Start adaptive server check loop
 */
function startServerCheckLoop() {
  if (serverCheckIntervalId) clearInterval(serverCheckIntervalId);

  const check = async () => {
    // Only check if we're using predictive engine primarily
    if (currentStrategy !== 'predictive') return;

    await triggerServerCheck('periodic');

    // Reschedule based on drift status
    const interval = getServerCheckInterval();
    serverCheckIntervalId = setTimeout(check, interval);
  };

  serverCheckIntervalId = setTimeout(check, CONFIG.SERVER_CHECK_SYNCED_MS);
}

/**
 * Get adaptive server check interval
 */
function getServerCheckInterval() {
  const stats = predictiveEngine.getStats();
  const avgDrift = stats.recentDrifts.length > 0
    ? Math.abs(stats.recentDrifts.reduce((a, b) => a + b, 0) / stats.recentDrifts.length)
    : 0;

  if (avgDrift < CONFIG.DRIFT_TOLERANCE_MS) {
    return CONFIG.SERVER_CHECK_SYNCED_MS;
  } else if (avgDrift < CONFIG.DRIFT_WARN_MS) {
    return CONFIG.SERVER_CHECK_DRIFTING_MS;
  } else {
    return CONFIG.SERVER_CHECK_CRITICAL_MS;
  }
}

/**
 * Trigger server check
 */
async function triggerServerCheck(reason) {
  try {
    // Use apiClientV2 for live state check
    const result = await apiClientV2.getChannels(); // Verify server connectivity
    if (result.success && result.data) {
      handleServerSync(result.data);
    }
  } catch (e) {
    console.warn(`[SyncOrchestrator] Server check failed (${reason}):`, e.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
// MANIFEST FETCHING
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch manifest for predictive engine
 */
async function fetchManifest(catId) {
  // Use apiClientV2 for manifest fetch
  const result = await apiClientV2.getChannels();
  if (!result.success) {
    throw new Error(`Manifest fetch failed: API error`);
  }
  return result.data || {};
}

// ═══════════════════════════════════════════════════════════════════
// LISTENERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Add state listener
 */
export function addStateListener(callback) {
  stateListeners.add(callback);
  return () => stateListeners.delete(callback);
}

/**
 * Add correction listener
 */
export function addCorrectionListener(callback) {
  correctionListeners.add(callback);
  return () => correctionListeners.delete(callback);
}

/**
 * Emit current state to all listeners
 */
function emitState() {
  const state = getExpectedState();
  stateListeners.forEach(cb => {
    try { cb(state); } catch (e) {}
  });
}

// ═══════════════════════════════════════════════════════════════════
// VISIBILITY-BASED CLOCK SYNC (Spotify Approach)
// ═══════════════════════════════════════════════════════════════════

/**
 * Handle visibility change (tab focus/blur, device sleep/wake)
 * 
 * Why this matters:
 * - Tab in background: JS timers throttled, clock can drift 500ms+
 * - Device sleep: Time passes but no sync
 * - Timezone change: Clock offset becomes invalid
 * 
 * Solution: Re-sync clock when tab becomes visible again
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // Tab became hidden - record when
    lastHiddenTime = Date.now();
    console.log('[SyncOrchestrator] Tab hidden');
  } else {
    // Tab became visible - check if we need to re-sync
    const hiddenDuration = Date.now() - lastHiddenTime;
    
    console.log(`[SyncOrchestrator] Tab visible (was hidden for ${Math.round(hiddenDuration / 1000)}s)`);
    
    // Re-sync if hidden for more than 10 seconds
    if (hiddenDuration > 10000 && isRunning) {
      stats.visibilitySyncs++;
      
      // Delay slightly to let network stabilize
      setTimeout(async () => {
        console.log('[SyncOrchestrator] Re-syncing clock after visibility change');
        
        try {
          // Re-sync clock
          await performClockSync();
          
          // Force server check to validate position
          await triggerServerCheck('visibility_change');
          
          // Reconnect WebSocket if it was disconnected during background
          if (currentStrategy === 'websocket' && !socketService.isConnected()) {
            console.log('[SyncOrchestrator] Reconnecting WebSocket after wake');
            socketService.connect();
            if (categoryId) {
              socketService.subscribeToCategory(categoryId);
            }
          }
          
          emitState();
        } catch (e) {
          console.warn('[SyncOrchestrator] Visibility sync failed:', e.message);
        }
      }, CONFIG.CLOCK_SYNC_ON_WAKE_DELAY_MS);
    }
  }
}

/**
 * Setup visibility change listener
 */
function setupVisibilityHandler() {
  if (visibilityListenerAttached) return;
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  visibilityListenerAttached = true;
  
  console.log('[SyncOrchestrator] Visibility handler attached');
}

/**
 * Remove visibility change listener
 */
function removeVisibilityHandler() {
  if (!visibilityListenerAttached) return;
  
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  visibilityListenerAttached = false;
}

// ═══════════════════════════════════════════════════════════════════
// STATS & DEBUG
// ═══════════════════════════════════════════════════════════════════

/**
 * Get orchestrator stats
 */
export function getStats() {
  return {
    ...stats,
    currentStrategy,
    categoryId,
    isRunning,
    predictiveEngineStats: predictiveEngine.getStats(),
    lastServerCheck,
    timeSinceServerCheck: Date.now() - lastServerCheck,
    visibilityListenerActive: visibilityListenerAttached,
  };
}

/**
 * Get current strategy
 */
export function getCurrentStrategy() {
  return currentStrategy;
}

// Export singleton-style
export default {
  startSync,
  stopSync,
  getExpectedState,
  reportPosition,
  addStateListener,
  addCorrectionListener,
  getStats,
  getCurrentStrategy,
};
