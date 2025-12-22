/**
 * Application Constants
 * 
 * General app configuration, feature flags, UI states, etc.
 */

// ===== ERROR HANDLING =====
export const ERROR = {
  MAX_ERROR_LOG_SIZE: 100, // maximum errors to keep in memory
  ERROR_RECOVERY_ATTEMPTS: 3,
  ERROR_RECOVERY_DELAY: 2000, // milliseconds
}

// ===== CACHE =====
export const CACHE = {
  MAX_API_LOGS: 100, // maximum API logs to keep
  MAX_ERROR_LOGS: 100, // maximum error logs to keep
  CACHE_VERSION: 1, // increment when cache structure changes
}

// ===== MONITORING =====
export const MONITORING = {
  ENABLE_DETAILED_LOGGING: true,
  ENABLE_API_INTERCEPTION: true,
  ENABLE_PERFORMANCE_TRACKING: true,
  ENABLE_ERROR_TRACKING: true,
}

// ===== UI STATES =====
export const UI_STATES = {
  POWER_OFF: 'power-off',
  POWER_ON: 'power-on',
  BUFFERING: 'buffering',
  PLAYING: 'playing',
  ERROR: 'error',
}

// ===== BROADCAST STATE =====
export const BROADCAST_STATE_STATUS = {
  HEALTHY: 'healthy',
  BUFFERING: 'buffering',
  RETRYING: 'retrying',
  FAILED: 'failed',
}

// ===== ADMIN DASHBOARD =====
export const ADMIN = {
  REFRESH_INTERVAL: 5000, // milliseconds - admin dashboard refresh rate
  MAX_LOG_ENTRIES: 50, // maximum log entries to display
  AUTO_SCROLL_LOGS: true,
}

// ===== FEATURE FLAGS =====
export const FEATURES = {
  ENABLE_SESSION_PERSISTENCE: true,
  ENABLE_BROADCAST_STATE_SYNC: true,
  ENABLE_CACHE_CLEANUP: true,
  ENABLE_ADMIN_MONITORING: true,
  ENABLE_ERROR_RECOVERY: true,
}

