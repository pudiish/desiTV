/**
 * Sync Thresholds Configuration for LIVE broadcast
 * TIGHT SYNC MODE - Optimized for minimal drift across devices
 */

/** Debug logging - only in dev */
export const DEBUG_SYNC = import.meta.env?.DEV ?? false;

export const SYNC_THRESHOLDS = {
  // Polling - AGGRESSIVE for tight sync
  POLL_INTERVAL_MS: 2000,           // Poll every 2 seconds (was 5s)
  POLL_TIMEOUT_MS: 2000,            // Fail fast
  POLL_MIN_INTERVAL_MS: 500,        // Allow rapid re-polling

  // Drift thresholds (ms) - TIGHT tolerances
  DRIFT_IGNORE_MS: 200,             // Only 200ms tolerance (was 500ms)
  DRIFT_RATE_ADJUST_MAX_MS: 1000,   // Rate adjust up to 1s drift
  DRIFT_SEEK_MS: 1000,              // Seek if drift > 1s (was 2s)
  DRIFT_CRITICAL_MS: 5000,          // Critical at 5s (was 10s)

  // Playback rate - MORE AGGRESSIVE correction
  RATE_CATCHUP: 1.05,               // 5% faster (was 3%)
  RATE_SLOWDOWN: 0.95,              // 5% slower (was 3%)
  RATE_NORMAL: 1.0,
  RATE_CORRECTION_DURATION_MS: 1000, // Check more often

  // Buffer overlay
  BUFFER_MIN_SHOW_MS: 300,
  BUFFER_HIDE_DELAY_MS: 100,
  BUFFER_MESSAGES: {
    SYNCING: 'SYNCING...',
    CATCHING_UP: 'CATCHING UP TO LIVE...',
    CORRECTING: '⚡ ADJUSTING...',
    RECONNECTING: 'RECONNECTING...',
  },

  // Network - Lower expectations for faster response
  LATENCY_SAMPLE_COUNT: 3,          // Fewer samples, faster adaptation
  MAX_ACCEPTABLE_LATENCY_MS: 500,   // Stricter latency tolerance
  DEFAULT_LATENCY_MS: 50,           // Optimistic default

  // State machine
  MANUAL_MODE_GRACE_MS: 0,
  CHANNEL_CHANGE_DEBOUNCE_MS: 200,  // Faster debounce
  VIDEO_START_TIMEOUT_MS: 8000,

  // Retry
  MAX_SYNC_RETRIES: 3,
  RETRY_BACKOFF_BASE_MS: 500,       // Faster retry
  RETRY_BACKOFF_MAX_MS: 2000,

  // INITIAL SYNC - Force immediate correction on load
  INITIAL_SYNC_FORCE_SEEK: true,    // Always seek on first sync
  INITIAL_SYNC_DELAY_MS: 500,       // Wait for player ready
};

/** Returns: 'ignore' | 'rate' | 'seek' | 'critical' */
export function getDriftCorrectionType(driftMs) {
  const absDrift = Math.abs(driftMs);
  if (absDrift < SYNC_THRESHOLDS.DRIFT_IGNORE_MS) return 'ignore';
  if (absDrift < SYNC_THRESHOLDS.DRIFT_SEEK_MS) return 'rate';
  if (absDrift < SYNC_THRESHOLDS.DRIFT_CRITICAL_MS) return 'seek';
  return 'critical';
}

export function getCorrectionRate(driftMs) {
  // More aggressive rates based on drift amount
  const absDrift = Math.abs(driftMs);
  
  if (absDrift > 800) {
    // Large drift - very aggressive
    return driftMs > 0 ? 0.90 : 1.10; // 10% adjustment
  } else if (absDrift > 500) {
    // Medium drift - aggressive
    return driftMs > 0 ? 0.93 : 1.07; // 7% adjustment
  } else if (absDrift > SYNC_THRESHOLDS.DRIFT_IGNORE_MS) {
    // Small drift - normal
    return driftMs > 0 ? SYNC_THRESHOLDS.RATE_SLOWDOWN : SYNC_THRESHOLDS.RATE_CATCHUP;
  }
  
  return SYNC_THRESHOLDS.RATE_NORMAL;
}

export default SYNC_THRESHOLDS;
