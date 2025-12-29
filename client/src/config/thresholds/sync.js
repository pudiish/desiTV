/**
 * Sync Thresholds Configuration for LIVE broadcast
 */

/** Debug logging - only in dev */
export const DEBUG_SYNC = import.meta.env?.DEV ?? false;

export const SYNC_THRESHOLDS = {
  // Polling
  POLL_INTERVAL_MS: 5000,
  POLL_TIMEOUT_MS: 3000,
  POLL_MIN_INTERVAL_MS: 1000,

  // Drift thresholds (ms)
  DRIFT_IGNORE_MS: 500,
  DRIFT_RATE_ADJUST_MAX_MS: 2000,
  DRIFT_SEEK_MS: 2000,
  DRIFT_CRITICAL_MS: 10000,

  // Playback rate
  RATE_CATCHUP: 1.03,
  RATE_SLOWDOWN: 0.97,
  RATE_NORMAL: 1.0,
  RATE_CORRECTION_DURATION_MS: 2000,

  // Buffer overlay
  BUFFER_MIN_SHOW_MS: 500,
  BUFFER_HIDE_DELAY_MS: 200,
  BUFFER_MESSAGES: {
    SYNCING: 'SYNCING...',
    CATCHING_UP: 'CATCHING UP TO LIVE...',
    CORRECTING: '⚡ ADJUSTING...',
    RECONNECTING: 'RECONNECTING...',
  },

  // Network
  LATENCY_SAMPLE_COUNT: 5,
  MAX_ACCEPTABLE_LATENCY_MS: 1000,
  DEFAULT_LATENCY_MS: 100,

  // State machine
  MANUAL_MODE_GRACE_MS: 0,
  CHANNEL_CHANGE_DEBOUNCE_MS: 300,
  VIDEO_START_TIMEOUT_MS: 10000,

  // Retry
  MAX_SYNC_RETRIES: 3,
  RETRY_BACKOFF_BASE_MS: 1000,
  RETRY_BACKOFF_MAX_MS: 5000,
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
  if (driftMs > 0) return SYNC_THRESHOLDS.RATE_SLOWDOWN;
  if (driftMs < 0) return SYNC_THRESHOLDS.RATE_CATCHUP;
  return SYNC_THRESHOLDS.RATE_NORMAL;
}

export default SYNC_THRESHOLDS;
