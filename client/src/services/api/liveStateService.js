/**
 * Live State Service - Ultra-Optimized Hybrid Sync
 * 
 * Features:
 * 1. WebSocket primary, HTTP fallback
 * 2. Adaptive polling (30s synced → 1s critical)
 * 3. RTT-based clock sync
 * 4. Client-side position interpolation
 * 5. Stale-While-Revalidate cache
 * 6. ETag support for 304 responses
 * 7. Proportional rate correction
 */

import { dedupeFetch } from '../../utils/requestDeduplication';
import socketService from '../socket';

// API endpoint
const LIVE_STATE_ENDPOINT = '/api/live-state';

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

// Adaptive polling intervals (ms)
const POLL_INTERVALS = {
  SYNCED: 30000,       // 30s when perfectly synced
  SLIGHT_DRIFT: 10000, // 10s for small drift
  DRIFTING: 3000,      // 3s when drifting
  CRITICAL: 1000,      // 1s for critical drift
};

// Drift thresholds (ms)
const DRIFT_THRESHOLDS = {
  IGNORE: 200,    // < 200ms = synced
  SLIGHT: 1000,   // 200ms - 1s = slight
  MEDIUM: 5000,   // 1s - 5s = drifting
  // > 5s = critical → SEEK
};

// Rate correction (proportional)
const RATE_CORRECTIONS = {
  TINY: { threshold: 500, rate: 0.02 },      // 200-500ms: ±2%
  SMALL: { threshold: 1000, rate: 0.05 },    // 500ms-1s: ±5%
  MEDIUM: { threshold: 3000, rate: 0.10 },   // 1-3s: ±10%
  LARGE: { threshold: 5000, rate: 0.15 },    // 3-5s: ±15%
  // >5s: SEEK
};

// SWR Cache settings
const SWR_CACHE = {
  MAX_STALE_MS: 5000,     // Use cached data up to 5s old
  REVALIDATE_MS: 1000,    // Revalidate in background after 1s
};

// ═══════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════

let pollId = null;
let clockOffset = 0;
let rttSamples = [];
let lastState = null;
let lastETag = null;
let lastFetchTime = 0;
let useSocket = true;
let currentCategoryId = null;
let lastDriftMs = 0;

// Listeners
let stateListeners = [];
let correctionListeners = [];

// ═══════════════════════════════════════════════════════════════════
// CLOCK SYNC (RTT-Based)
// ═══════════════════════════════════════════════════════════════════

/**
 * Proper RTT-based clock offset calculation
 * Uses half RTT to estimate one-way delay
 */
function calculateClockOffset(requestStart, requestEnd, serverTimeMs) {
  const rtt = requestEnd - requestStart;
  const oneWayDelay = rtt / 2;
  
  // Server time + one-way delay = estimated server time NOW
  const estimatedServerNow = serverTimeMs + oneWayDelay;
  const offset = requestEnd - estimatedServerNow;
  
  // Rolling average of RTT samples (last 5)
  rttSamples.push(rtt);
  if (rttSamples.length > 5) rttSamples.shift();
  
  return { offset, rtt };
}

/**
 * Get average RTT
 */
function getAverageRtt() {
  if (rttSamples.length === 0) return 100;
  return rttSamples.reduce((a, b) => a + b, 0) / rttSamples.length;
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT-SIDE INTERPOLATION
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate expected position NOW using local interpolation
 * Uses: epochMs + totalDuration + clockOffset
 */
export function getExpectedPosition(state = lastState) {
  if (!state?.live || !state?.sync || !state?.playlist) return null;

  const epochMs = state.sync.epochMs;
  const totalDuration = state.playlist.totalDuration;
  const fetchedAt = state._fetchedAt || Date.now();
  
  // Time elapsed since state was fetched (with clock offset correction)
  const now = Date.now();
  const elapsedSinceEpoch = (now - clockOffset - epochMs) / 1000;
  
  // Calculate cycle position
  const cyclePosition = elapsedSinceEpoch % totalDuration;
  
  // Find video at this position (using pre-computed data if available)
  // For now, use the fetched state and interpolate
  const timeSinceFetch = (now - fetchedAt) / 1000;
  let position = state.live.position + timeSinceFetch;
  
  // Handle video boundary
  if (position >= state.live.duration) {
    // Video ended - need to check server for next video
    return null; // Signal that we need fresh data
  }
  
  return position;
}

/**
 * Full client-side position calculation (completely local)
 * Only works if we have playlist data
 */
export function interpolatePosition(state = lastState) {
  if (!state?.sync?.epochMs || !state?.playlist?.totalDuration) {
    return getExpectedPosition(state);
  }

  const epochMs = state.sync.epochMs;
  const totalDuration = state.playlist.totalDuration;
  
  // Calculate position from epoch (with clock offset)
  const now = Date.now();
  const elapsedSec = (now - clockOffset - epochMs) / 1000;
  const cyclePosition = elapsedSec % totalDuration;
  
  return {
    cyclePosition,
    videoIndex: state.live.videoIndex, // This may be stale
    elapsedSec,
  };
}

// ═══════════════════════════════════════════════════════════════════
// HTTP FETCH (with SWR + ETag)
// ═══════════════════════════════════════════════════════════════════

/**
 * Fetch LIVE state via HTTP
 * Supports: ETag/304, Stale-While-Revalidate
 */
export async function fetchLiveState(categoryId, includeNext = false) {
  if (!categoryId) throw new Error('categoryId required');

  const requestStart = Date.now();
  const url = `${LIVE_STATE_ENDPOINT}?categoryId=${encodeURIComponent(categoryId)}${includeNext ? '&includeNext=true' : ''}`;

  // Build headers with ETag if we have one
  const headers = {
    'Cache-Control': 'no-cache',
  };
  if (lastETag && currentCategoryId === categoryId) {
    headers['If-None-Match'] = lastETag;
  }

  const response = await dedupeFetch(url, {
    cache: 'no-store',
    headers,
  });

  const requestEnd = Date.now();

  // Handle 304 Not Modified
  if (response.status === 304) {
    // Use cached data, but update server time from header
    const serverTimeHeader = response.headers.get('X-Server-Time');
    if (serverTimeHeader && lastState) {
      const serverTimeMs = parseInt(serverTimeHeader, 10);
      const { offset, rtt } = calculateClockOffset(requestStart, requestEnd, serverTimeMs);
      clockOffset = offset;
      lastState._fetchedAt = requestEnd;
      lastState._rtt = rtt;
    }
    lastFetchTime = requestEnd;
    return lastState;
  }

  if (!response.ok) {
    throw new Error(`Server error: ${response.status}`);
  }

  const data = await response.json();

  // Store ETag for future requests
  const etag = response.headers.get('ETag');
  if (etag) lastETag = etag;

  // Calculate clock offset with RTT
  const serverTimeMs = data.sync?.serverTimeMs || Date.now();
  const { offset, rtt } = calculateClockOffset(requestStart, requestEnd, serverTimeMs);
  clockOffset = offset;

  lastState = {
    ...data,
    _rtt: rtt,
    _clockOffset: offset,
    _fetchedAt: requestEnd,
  };
  lastFetchTime = requestEnd;
  currentCategoryId = categoryId;

  return lastState;
}

/**
 * Stale-While-Revalidate fetch
 * Returns cached data immediately, fetches fresh in background
 */
export async function fetchWithSWR(categoryId, includeNext = false) {
  const now = Date.now();
  const cacheAge = now - lastFetchTime;
  
  // If cache is fresh enough, return it and maybe revalidate
  if (lastState && currentCategoryId === categoryId && cacheAge < SWR_CACHE.MAX_STALE_MS) {
    // Return stale data immediately
    const staleData = lastState;
    
    // Revalidate in background if cache is getting old
    if (cacheAge > SWR_CACHE.REVALIDATE_MS) {
      fetchLiveState(categoryId, includeNext).catch(() => {});
    }
    
    return staleData;
  }
  
  // Cache too old or wrong category - must fetch
  return fetchLiveState(categoryId, includeNext);
}

// ═══════════════════════════════════════════════════════════════════
// DRIFT CALCULATION (Proportional)
// ═══════════════════════════════════════════════════════════════════

/**
 * Calculate drift with proportional correction rates
 */
export function calculateDrift(serverState, localPosition, localVideoIndex) {
  if (!serverState?.live) {
    return { drift: 0, action: 'none', rate: 1.0 };
  }

  const serverVideo = serverState.live.videoIndex;
  const expectedPosition = getExpectedPosition(serverState);

  // Wrong video = hard switch
  if (localVideoIndex !== serverVideo) {
    return {
      drift: Infinity,
      action: 'switch_video',
      targetVideo: serverVideo,
      targetPosition: serverState.live.position,
      rate: 1.0,
    };
  }

  // Handle null expected position (video boundary)
  if (expectedPosition === null) {
    return {
      drift: 0,
      action: 'refresh',
      rate: 1.0,
    };
  }

  // Calculate drift in milliseconds
  const driftSec = localPosition - expectedPosition;
  const driftMs = driftSec * 1000;
  const absDriftMs = Math.abs(driftMs);
  
  // Store for adaptive polling
  lastDriftMs = driftMs;

  // Determine action and PROPORTIONAL rate
  let action = 'none';
  let rate = 1.0;

  if (absDriftMs < DRIFT_THRESHOLDS.IGNORE) {
    // Perfect sync
    action = 'none';
    rate = 1.0;
  } else if (absDriftMs < RATE_CORRECTIONS.TINY.threshold) {
    // Tiny drift: 2% correction
    action = 'rate_adjust';
    rate = driftMs > 0 ? (1 - RATE_CORRECTIONS.TINY.rate) : (1 + RATE_CORRECTIONS.TINY.rate);
  } else if (absDriftMs < RATE_CORRECTIONS.SMALL.threshold) {
    // Small drift: 5% correction
    action = 'rate_adjust';
    rate = driftMs > 0 ? (1 - RATE_CORRECTIONS.SMALL.rate) : (1 + RATE_CORRECTIONS.SMALL.rate);
  } else if (absDriftMs < RATE_CORRECTIONS.MEDIUM.threshold) {
    // Medium drift: 10% correction
    action = 'rate_adjust';
    rate = driftMs > 0 ? (1 - RATE_CORRECTIONS.MEDIUM.rate) : (1 + RATE_CORRECTIONS.MEDIUM.rate);
  } else if (absDriftMs < RATE_CORRECTIONS.LARGE.threshold) {
    // Large drift: 15% correction
    action = 'rate_adjust';
    rate = driftMs > 0 ? (1 - RATE_CORRECTIONS.LARGE.rate) : (1 + RATE_CORRECTIONS.LARGE.rate);
  } else {
    // Critical: SEEK (don't try to rate-correct >5s drift)
    action = 'seek';
    rate = 1.0;
  }

  return {
    drift: driftMs,
    absDrift: absDriftMs,
    action,
    rate,
    targetPosition: expectedPosition,
    direction: driftMs > 0 ? 'ahead' : 'behind',
  };
}

// ═══════════════════════════════════════════════════════════════════
// ADAPTIVE POLLING
// ═══════════════════════════════════════════════════════════════════

/**
 * Get adaptive poll interval based on current drift
 */
function getAdaptivePollInterval() {
  const absDrift = Math.abs(lastDriftMs);
  
  if (absDrift < DRIFT_THRESHOLDS.IGNORE) return POLL_INTERVALS.SYNCED;
  if (absDrift < DRIFT_THRESHOLDS.SLIGHT) return POLL_INTERVALS.SLIGHT_DRIFT;
  if (absDrift < DRIFT_THRESHOLDS.MEDIUM) return POLL_INTERVALS.DRIFTING;
  return POLL_INTERVALS.CRITICAL;
}

// ═══════════════════════════════════════════════════════════════════
// SYNC MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

/**
 * Start syncing - WebSocket primary, HTTP fallback
 */
export function startPolling(categoryId, onState, onCorrection) {
  stopPolling();
  currentCategoryId = categoryId;

  if (onState) stateListeners.push(onState);
  if (onCorrection) correctionListeners.push(onCorrection);

  if (useSocket) {
    startSocketSync(categoryId);
  } else {
    startHttpPolling(categoryId);
  }
}

/**
 * WebSocket-based sync
 */
function startSocketSync(categoryId) {
  const unsubSync = socketService.addListener('sync', (data) => {
    lastState = {
      ...data,
      _fetchedAt: Date.now(),
      _clockOffset: clockOffset,
    };
    lastFetchTime = Date.now();
    notifyStateListeners(lastState);
  });

  const unsubVideoChange = socketService.addListener('videoChange', (data) => {
    correctionListeners.forEach(cb => cb({
      type: 'video_change',
      ...data,
    }));
  });

  const unsubFallback = socketService.addListener('fallback', () => {
    console.warn('[Sync] Socket failed, falling back to HTTP polling');
    useSocket = false;
    socketService.disconnect();
    startHttpPolling(categoryId);
  });

  const unsubDisconnect = socketService.addListener('disconnected', () => {
    if (!pollId) startBackupPolling(categoryId);
  });

  const unsubConnect = socketService.addListener('connected', () => {
    if (pollId) {
      clearTimeout(pollId);
      pollId = null;
    }
  });

  socketService._cleanups = [unsubSync, unsubVideoChange, unsubFallback, unsubDisconnect, unsubConnect];
  socketService.connect();
  socketService.subscribeToCategory(categoryId);

  // Initial HTTP fetch for immediate state
  fetchAndNotify(categoryId);
}

/**
 * HTTP polling with adaptive intervals
 */
function startHttpPolling(categoryId) {
  const poll = async () => {
    try {
      // Use SWR for faster perceived response
      const state = await fetchWithSWR(categoryId, true);
      notifyStateListeners(state);
      
      // Schedule next poll based on drift
      const nextInterval = getAdaptivePollInterval();
      pollId = setTimeout(poll, nextInterval);
    } catch (e) {
      console.error('[Sync] Poll failed:', e.message);
      pollId = setTimeout(poll, POLL_INTERVALS.DRIFTING);
    }
  };

  poll();
}

/**
 * Backup polling while socket reconnecting
 */
function startBackupPolling(categoryId) {
  pollId = setTimeout(async () => {
    if (!socketService.isConnected()) {
      try {
        const state = await fetchLiveState(categoryId, true);
        notifyStateListeners(state);
      } catch (e) {
        console.error('[Sync] Backup poll failed:', e.message);
      }
      startBackupPolling(categoryId);
    }
  }, POLL_INTERVALS.DRIFTING);
}

/**
 * Fetch and notify
 */
async function fetchAndNotify(categoryId) {
  try {
    const state = await fetchLiveState(categoryId, true);
    notifyStateListeners(state);
  } catch (e) {
    console.error('[Sync] Initial fetch failed:', e.message);
  }
}

/**
 * Notify listeners
 */
function notifyStateListeners(state) {
  stateListeners.forEach(cb => {
    try { cb(state); } catch (e) { console.error('[Sync] Listener error:', e); }
  });
}

/**
 * Stop syncing
 */
export function stopPolling() {
  if (pollId) {
    clearTimeout(pollId);
    pollId = null;
  }
  if (socketService._cleanups) {
    socketService._cleanups.forEach(fn => fn());
    socketService._cleanups = null;
  }
  stateListeners = [];
  correctionListeners = [];
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

export function getClockOffset() { return clockOffset; }
export function isPolling() { return pollId !== null || socketService.isConnected(); }
export function getLastState() { return lastState; }
export function setUseSocket(value) { useSocket = value; }
export function getCurrentDrift() { return lastDriftMs; }

export const SYNC_CONFIG = {
  POLL_INTERVALS,
  DRIFT_THRESHOLDS,
  RATE_CORRECTIONS,
  SWR_CACHE,
};
