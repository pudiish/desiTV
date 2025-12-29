/**
 * Live State Service - Fetches current playback position from server
 */

import { SYNC_THRESHOLDS, getDriftCorrectionType, getCorrectionRate, DEBUG_SYNC } from '../../config/thresholds';
import { dedupeFetch } from '../../utils/requestDeduplication';
import { playerStateMachine, PlayerEvent } from '../../logic/playback';

const log = (...args) => DEBUG_SYNC && console.log(...args);

// API endpoints
const LIVE_STATE_ENDPOINT = '/api/live-state';

// State
let pollIntervalId = null;
let lastFetchTime = null;
let consecutiveFailures = 0;
let listeners = [];

/**
 * Fetch live state from server
 */
export async function fetchLiveState(categoryId, includeNext = false) {
  if (!categoryId) {
    throw new Error('categoryId is required');
  }

  const requestStart = Date.now();

  try {
    const url = `${LIVE_STATE_ENDPOINT}?categoryId=${encodeURIComponent(categoryId)}${includeNext ? '&includeNext=true' : ''}`;
    
    // Use dedupeFetch to prevent duplicate concurrent requests
    const response = await dedupeFetch(url, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Record latency
    const rtt = Date.now() - requestStart;
    playerStateMachine.recordLatency(rtt);
    
    // Update last fetch time
    lastFetchTime = Date.now();
    consecutiveFailures = 0;

    // Log success (but not too verbose)
    if (Math.random() < 0.1) { // Log 10% of successful syncs
      log(`[LiveState] ✅ Synced: video ${data.live?.videoIndex} @ ${data.live?.position?.toFixed(1)}s (${rtt}ms RTT)`);
    }

    return {
      ...data,
      _meta: {
        fetchedAt: lastFetchTime,
        rttMs: rtt,
        latencyMs: rtt / 2,
      }
    };

  } catch (error) {
    consecutiveFailures++;
    console.error(`[LiveState] ❌ Fetch failed (attempt ${consecutiveFailures}):`, error.message);
    
    throw error;
  }
}

/**
 * Calculate drift between server and local position
 * @param {Object} serverState - State from server
 * @param {number} localPosition - Current local playback position
 * @param {number} localVideoIndex - Current local video index
 * @returns {Object} Drift analysis
 */
export function calculateDrift(serverState, localPosition, localVideoIndex) {
  if (!serverState?.live) {
    return { driftMs: 0, driftType: 'unknown', needsCorrection: false };
  }

  const serverPosition = serverState.live.position;
  const serverVideoIndex = serverState.live.videoIndex;
  const serverTime = new Date(serverState.sync.serverTime).getTime();
  
  // Estimate latency compensation
  const latency = playerStateMachine.getEstimatedLatency();
  
  // Calculate time elapsed since server generated this response
  const timeSinceServerResponse = Date.now() - serverTime;
  
  // Expected server position NOW (compensate for network delay)
  const expectedServerPosition = serverPosition + (timeSinceServerResponse / 1000);
  
  // Are we even on the same video?
  if (localVideoIndex !== serverVideoIndex) {
    // Different video = CRITICAL drift
    const videoDiff = localVideoIndex - serverVideoIndex;
    return {
      driftMs: videoDiff * 1000000, // Massive fake drift to trigger correction
      driftSec: videoDiff * 1000,
      driftType: 'video_mismatch',
      needsCorrection: true,
      correctionType: 'seek',
      details: {
        localVideo: localVideoIndex,
        serverVideo: serverVideoIndex,
        videoDiff,
      }
    };
  }

  // Same video - calculate position drift
  const driftSec = localPosition - expectedServerPosition;
  const driftMs = driftSec * 1000;
  
  // Determine correction type
  const correctionType = getDriftCorrectionType(Math.abs(driftMs));
  const needsCorrection = correctionType !== 'ignore';
  
  // Record for trend analysis
  playerStateMachine.recordDrift(driftMs, serverTime);
  
  return {
    driftMs,
    driftSec,
    driftType: correctionType,
    needsCorrection,
    correctionType,
    direction: driftSec > 0 ? 'ahead' : driftSec < 0 ? 'behind' : 'synced',
    expectedServerPosition,
    details: {
      serverPosition,
      localPosition,
      latencyMs: latency,
      timeSinceResponse: timeSinceServerResponse,
    }
  };
}

/**
 * Get the recommended playback rate for drift correction
 */
export function getRecommendedPlaybackRate(driftMs) {
  return getCorrectionRate(driftMs);
}

/**
 * Start polling for live state
 * @param {string} categoryId - Category to poll
 * @param {Function} onStateReceived - Callback when state is received
 * @param {Function} onDriftDetected - Callback when drift needs correction
 */
export function startPolling(categoryId, onStateReceived, onDriftDetected) {
  // Stop any existing polling
  stopPolling();
  
  log(`[LiveState] 🔄 Starting poll for category: ${categoryId}`);
  
  // Immediate first fetch
  fetchAndNotify(categoryId, onStateReceived, onDriftDetected);
  
  // Then poll at interval
  pollIntervalId = setInterval(() => {
    // Only poll if state machine says we should
    if (playerStateMachine.shouldPoll) {
      fetchAndNotify(categoryId, onStateReceived, onDriftDetected);
    }
  }, SYNC_THRESHOLDS.POLL_INTERVAL_MS);
}

/**
 * Stop polling
 */
export function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
    console.log('[LiveState] ⏹️ Polling stopped');
  }
}

/**
 * Check if currently polling
 */
export function isPolling() {
  return pollIntervalId !== null;
}

/**
 * Internal: Fetch and notify callbacks
 */
async function fetchAndNotify(categoryId, onStateReceived, onDriftDetected) {
  try {
    const state = await fetchLiveState(categoryId, true);
    
    // Notify state received
    if (onStateReceived) {
      onStateReceived(state);
    }
    
    // Notify listeners
    notifyListeners('state', state);
    
  } catch (error) {
    // Notify error
    notifyListeners('error', error);
    
    // Check if we should retry
    if (consecutiveFailures < SYNC_THRESHOLDS.MAX_SYNC_RETRIES) {
      const backoff = Math.min(
        SYNC_THRESHOLDS.RETRY_BACKOFF_BASE_MS * Math.pow(2, consecutiveFailures - 1),
        SYNC_THRESHOLDS.RETRY_BACKOFF_MAX_MS
      );
      log(`[LiveState] Retrying in ${backoff}ms...`);
      setTimeout(() => fetchAndNotify(categoryId, onStateReceived, onDriftDetected), backoff);
    } else {
      console.error('[LiveState] Max retries reached, giving up');
      playerStateMachine.transition(PlayerEvent.SYNC_FAILED);
    }
  }
}

/**
 * Subscribe to live state updates
 * @param {Function} callback - Called with { type: 'state'|'error', data }
 * @returns {Function} Unsubscribe function
 */
export function subscribe(callback) {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
}

/**
 * Notify all listeners
 */
function notifyListeners(type, data) {
  listeners.forEach(callback => {
    try {
      callback({ type, data });
    } catch (err) {
      console.error('[LiveState] Listener error:', err);
    }
  });
}

/**
 * Get sync status info for debugging
 */
export function getSyncStatus() {
  return {
    isPolling: isPolling(),
    lastFetchTime,
    consecutiveFailures,
    machineState: playerStateMachine.state,
    machineDebug: playerStateMachine.getDebugInfo(),
  };
}

// Export as object too for convenience
export default {
  fetchLiveState,
  calculateDrift,
  getRecommendedPlaybackRate,
  startPolling,
  stopPolling,
  isPolling,
  subscribe,
  getSyncStatus,
};
