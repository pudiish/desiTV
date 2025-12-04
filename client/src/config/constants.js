/**
 * Global Constants - Single source of truth for all configuration values
 * These values are used throughout the application and should be modified here
 */

// ===== TIMING CONSTANTS =====
export const TIMING = {
  // Player timing
  SWITCH_BEFORE_END: 2, // seconds - switch video 2 seconds before end
  MAX_BUFFER_TIME: 8000, // milliseconds - max buffering time before retry
  MAX_RETRY_ATTEMPTS: 5, // maximum retry attempts before giving up
  RETRY_BACKOFF_BASE: 1000, // milliseconds - base retry backoff time
  PROGRESS_UPDATE_INTERVAL: 500, // milliseconds - how often to update progress

  // Session management
  SESSION_SAVE_DEBOUNCE: 500, // milliseconds - debounce session saves
  SESSION_MIN_SAVE_INTERVAL: 1000, // milliseconds - minimum interval between saves
  SESSION_SAVE_AUTO_INTERVAL: 3000, // milliseconds - auto-save interval

  // Broadcast state sync
  BROADCAST_SYNC_INTERVAL: 5000, // milliseconds - sync state to DB every 5 seconds

  // Health monitoring
  HEALTH_CHECK_INTERVAL: 10000, // milliseconds - check health every 10 seconds
  API_HEALTH_TIMEOUT: 5000, // milliseconds - API call timeout

  // UI feedback
  STATUS_MESSAGE_DURATION: 5000, // milliseconds - status message duration
  NOTIFICATION_DURATION: 5000, // milliseconds - notification auto-dismiss
}

// ===== PLAYBACK CONSTANTS =====
export const PLAYBACK = {
  DEFAULT_VIDEO_DURATION: 300, // seconds - default if not specified
  DEFAULT_VOLUME: 0.5, // default volume level (0-1)
  MIN_VOLUME: 0,
  MAX_VOLUME: 1,
  VOLUME_STEP: 0.1,
  DEFAULT_PLAYBACK_RATE: 1.0,
}

// ===== STORAGE CONSTANTS =====
export const STORAGE = {
  SESSION_ID_KEY: 'retro-tv-session-id',
  SELECTED_CHANNELS_KEY: 'retro-tv-selected-channels',
  CACHE_CLEANED_KEY: 'cache-cleaned',
  CACHE_CLEANUP_TIMESTAMP_KEY: 'cache-cleanup-timestamp',
  PLAYER_STATE_KEY: 'retro-tv-player-state',
  USER_PREFERENCES_KEY: 'retro-tv-preferences',
}

// ===== API ENDPOINTS =====
export const API_ENDPOINTS = {
  // Broadcast State
  BROADCAST_STATE: '/api/broadcast-state',
  BROADCAST_STATE_ALL: '/api/broadcast-state/all',
  
  // Session
  SESSION: '/api/session',
  
  // Channels
  CHANNELS: '/api/channels',
  CHANNEL: '/api/channels/:id',
  
  // Categories
  CATEGORIES: '/api/categories',
  
  // Auth
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_REGISTER: '/api/auth/register',
  
  // YouTube
  YOUTUBE_SEARCH: '/api/youtube/search',
  
  // Health
  HEALTH: '/health',
}

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

// ===== PLAYBACK STATES =====
export const PLAYBACK_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  PLAYING: 'playing',
  BUFFERING: 'buffering',
  ERROR: 'error',
  PAUSED: 'paused',
}

// ===== BROADCAST STATE =====
export const BROADCAST_STATE_STATUS = {
  HEALTHY: 'healthy',
  BUFFERING: 'buffering',
  RETRYING: 'retrying',
  FAILED: 'failed',
}

// ===== YOUTUBE PLAYER =====
export const YOUTUBE_PLAYER = {
  HOST: 'https://www.youtube-nocookie.com',
  PLAYER_VARS: {
    autoplay: 1,
    controls: 0,
    disablekb: 1,
    modestbranding: 1,
    rel: 0,
    iv_load_policy: 3,
    showinfo: 0,
    fs: 0,
    cc_load_policy: 0,
    playsinline: 1,
    enablejsapi: 1,
    autohide: 1,
    loop: 0,
  },
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

export default {
  TIMING,
  PLAYBACK,
  STORAGE,
  API_ENDPOINTS,
  ERROR,
  CACHE,
  MONITORING,
  UI_STATES,
  PLAYBACK_STATES,
  BROADCAST_STATE_STATUS,
  YOUTUBE_PLAYER,
  ADMIN,
  FEATURES,
}
