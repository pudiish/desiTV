/**
 * Timing Constants
 * 
 * All timing-related constants (intervals, delays, timeouts)
 */

// Detect environment
const isProduction = typeof import.meta !== 'undefined' && import.meta.env?.PROD

export const TIMING = {
  // Player timing
  SWITCH_BEFORE_END: 2, // seconds - switch video 2 seconds before end
  MAX_BUFFER_TIME: isProduction ? 10000 : 8000, // milliseconds - slightly longer in production
  MAX_RETRY_ATTEMPTS: isProduction ? 3 : 5, // fewer retries in production (fail faster)
  RETRY_BACKOFF_BASE: 1000, // milliseconds - base retry backoff time
  PROGRESS_UPDATE_INTERVAL: 500, // milliseconds - how often to update progress

  // Session management - more aggressive saving in production
  SESSION_SAVE_DEBOUNCE: isProduction ? 1000 : 500, // milliseconds - debounce session saves
  SESSION_MIN_SAVE_INTERVAL: isProduction ? 2000 : 1000, // milliseconds - minimum interval between saves
  SESSION_SAVE_AUTO_INTERVAL: isProduction ? 5000 : 3000, // milliseconds - auto-save interval

  // Broadcast state sync - less frequent in production to reduce API calls
  BROADCAST_SYNC_INTERVAL: isProduction ? 10000 : 5000, // milliseconds - sync state to DB

  // Health monitoring - ADAPTIVE intervals to reduce costs
  // HealthMonitor now uses intelligent adaptive checking:
  // - Healthy state: 60s (95% cost reduction vs old 10s)
  // - Degraded state: 10s (2 failures detected)
  // - Critical state: 3s (3+ failures detected)
  // This drastically reduces API costs while maintaining visibility into issues
  HEALTH_CHECK_INTERVAL: isProduction ? 30000 : 10000, // LEGACY - now handled by HealthMonitor.checkIntervals
  API_HEALTH_TIMEOUT: isProduction ? 10000 : 5000, // milliseconds - API call timeout (longer for cold starts)

  // UI feedback
  STATUS_MESSAGE_DURATION: 5000, // milliseconds - status message duration
  NOTIFICATION_DURATION: 5000, // milliseconds - notification auto-dismiss
}

