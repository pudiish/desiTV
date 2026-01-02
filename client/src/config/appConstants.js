/**
 * Application Constants
 * 
 * One place for all magic strings, numbers, and config
 * Makes it easy to tweak without hunting through code
 */

// ============= TIMING =============
export const TIMING = {
  CHANNEL_SWITCH_DELAY: 300, // ms
  MESSAGE_DISPLAY_DURATION: 3000, // ms
  BUFFER_TIMEOUT: 30000, // ms
  EASTER_EGG_DURATION: 3000, // ms
  REMOTE_AUTO_HIDE: 5000, // ms
  SURVEY_SHOW_AFTER: 5 * 60 * 1000, // 5 minutes
};

// ============= VOLUME =============
export const VOLUME = {
  MIN: 0,
  MAX: 1,
  DEFAULT: 0.5,
  STEP: 0.1,
};

// ============= UI =============
export const UI = {
  ANIMATION_DURATION: 300, // ms
  TOAST_DURATION: 3000, // ms
  LOADING_SPINNER_DELAY: 500, // ms
  FULLSCREEN_ICON_SIZE: 24,
};

// ============= QUALITY =============
export const VIDEO_QUALITY = {
  AUTO: 'auto',
  HD: '1080p',
  HQ: '720p',
  SD: '480p',
};

// ============= PLAYBACK =============
export const PLAYBACK = {
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000, // ms
  BUFFER_THRESHOLD: 10, // seconds of buffer ahead
  STALL_CHECK_INTERVAL: 1000, // ms
};

// ============= API =============
export const API = {
  TIMEOUT: 10000, // ms
  CACHE_TTL: {
    CHANNELS: 5 * 60 * 1000, // 5 minutes
    SUGGESTIONS: 2 * 60 * 1000, // 2 minutes
    METADATA: 60 * 1000, // 1 minute
  },
  MAX_RETRIES: 3,
  RETRY_BACKOFF: 2000, // ms
};

// ============= STORAGE =============
export const STORAGE_KEYS = {
  SESSION: 'desiTV_session',
  PREFERENCES: 'desiTV_prefs',
  WATCH_HISTORY: 'desiTV_history',
  BROADCAST_STATE: 'desiTV_broadcast',
  USER_PROFILE: 'desiTV_profile',
  CACHE: 'desiTV_cache',
};

// ============= VJ MESSAGES =============
export const VJ_MESSAGES = {
  GREETING: '🎧 Hey! I\'m DJ Desi. You\'re watching',
  POWER_OFF: 'POWER DABAO AUR SHURU KARO!',
  NO_CONTENT: 'Kuch nahi hai yahan! Try a different channel!',
  BUFFERING: 'Loading... please wait!',
  ERROR_GENERIC: 'Oops! Something went wrong 😅',
  YOUTUBE_NOT_FOUND: 'Video not found on YouTube! 🔍',
  YOUTUBE_QUOTA: 'YouTube quota hit! Try later! 📺',
};

// ============= VJ ACTIONS =============
export const VJ_ACTION_TYPES = {
  PLAY_VIDEO: 'PLAY_VIDEO',
  PLAY_EXTERNAL: 'PLAY_EXTERNAL',
  CHANGE_CHANNEL: 'CHANGE_CHANNEL',
  SHOW_INFO: 'SHOW_INFO',
  NONE: null,
};

// ============= ERROR CODES =============
export const ERROR_CODES = {
  NETWORK_TIMEOUT: 'E_001_TIMEOUT',
  NETWORK_FAILURE: 'E_002_NO_CONNECTION',
  INVALID_VIDEO_ID: 'E_003_INVALID_ID',
  YOUTUBE_BLOCKED: 'E_004_YOUTUBE_BLOCKED',
};

// ============= FEATURES =============
export const FEATURES = {
  ENABLE_GALAXY: true,
  ENABLE_SURVEY: true,
  ENABLE_EASTER_EGGS: true,
  ENABLE_ANALYTICS: true,
  ENABLE_OFFLINE_MODE: false, // Coming soon
};

// ============= ANALYTICS =============
export const ANALYTICS_EVENTS = {
  POWER_ON: 'tv_power_on',
  POWER_OFF: 'tv_power_off',
  CHANNEL_CHANGE: 'channel_changed',
  VIDEO_START: 'video_start',
  VIDEO_END: 'video_end',
  VIDEO_SEEK: 'video_seek',
  VJ_CHAT_OPENED: 'vj_chat_opened',
  VJ_CHAT_MESSAGE: 'vj_chat_message',
  YOUTUBE_SEARCH: 'youtube_search',
  FULLSCREEN_ENTERED: 'fullscreen_entered',
  FULLSCREEN_EXITED: 'fullscreen_exited',
  ERROR_OCCURRED: 'error_occurred',
};

// ============= BREAKPOINTS =============
export const BREAKPOINTS = {
  MOBILE: 480,
  TABLET: 768,
  DESKTOP: 1024,
  LARGE: 1440,
};

// ============= COLORS =============
export const COLORS = {
  PRIMARY: '#d4a574',
  PRIMARY_DARK: '#2a2520',
  PRIMARY_LIGHT: '#e5b685',
  ACCENT: '#ff6b6b',
  SUCCESS: '#51cf66',
  WARNING: '#ffd43b',
  ERROR: '#ff6b6b',
  BACKGROUND: '#1a1510',
  TEXT: '#f5f5f5',
  TEXT_SECONDARY: '#999',
};

// ============= FONTS =============
export const FONTS = {
  PRIMARY: "'Segoe UI', system-ui, sans-serif",
  MONO: "'Monaco', 'Courier New', monospace",
};

// ============= DEVELOPER SETTINGS =============
export const DEV_SETTINGS = {
  // Set to true in development to see verbose logs
  VERBOSE_LOGGING: process.env.NODE_ENV === 'development',
  // Show debug overlays
  DEBUG_OVERLAYS: false,
  // Simulate slow network (ms delay)
  NETWORK_THROTTLE: 0,
  // Log all API calls
  LOG_API_CALLS: false,
  // Log all state changes
  LOG_STATE_CHANGES: false,
};

export default {
  TIMING,
  VOLUME,
  UI,
  VIDEO_QUALITY,
  PLAYBACK,
  API,
  STORAGE_KEYS,
  VJ_MESSAGES,
  VJ_ACTION_TYPES,
  ERROR_CODES,
  FEATURES,
  ANALYTICS_EVENTS,
  BREAKPOINTS,
  COLORS,
  FONTS,
  DEV_SETTINGS,
};
