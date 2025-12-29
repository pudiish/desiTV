/**
 * Consolidated utilities index
 * Single entry point for all utility functions
 */

// YouTube utilities
export { loadYouTubeAPI } from './youtubeLoader'

// Request utilities
export { dedupeFetch, clearRequestCache } from './requestDeduplication'

// Checksum utilities
export { 
  validateAndRefreshChannels, 
  validateAndRefreshEpoch,
  generateChecksum 
} from './checksumValidator'

// Playlist utilities
export { getTransitionState, getTransitionMessage } from './playlistTransition'

// Time-based utilities
export { 
  getTimeSuggestion, 
  getTimeBasedGreeting,
  getTimeSlotName 
} from './timeBasedProgramming'

// Cache management
export { default as CacheManager } from './CacheManager'

