/**
 * Playback Thresholds - All timing and retry parameters for video playback
 * 
 * Single source of truth for all playback-related thresholds
 * Modify these values to adjust playback behavior
 */

// Detect environment
const isProduction = typeof import.meta !== 'undefined' && import.meta.env?.PROD

export const PLAYBACK_THRESHOLDS = {
	// Video switching
	SWITCH_BEFORE_END: 2, // seconds - switch video 2 seconds before end

	// Buffering thresholds
	MAX_BUFFER_TIME: isProduction ? 10000 : 8000, // milliseconds - max buffering before retry
	BUFFERING_DETECTION_DELAY: 500, // milliseconds - delay before showing buffering UI
	BUFFERING_TIMEOUT: 8000, // milliseconds - timeout for buffering state

	// Retry thresholds
	MAX_RETRY_ATTEMPTS: isProduction ? 3 : 5, // max retry attempts before giving up
	MAX_SKIP_ATTEMPTS: 10, // max consecutive video skips
	RETRY_BACKOFF_BASE: 1000, // milliseconds - base retry backoff time
	RETRY_BACKOFF_MAX: 5000, // milliseconds - max retry backoff time
	RETRY_DELAY_MIN: 500, // milliseconds - minimum delay between retries

	// Error handling
	ERROR_SKIP_DELAY: 1500, // milliseconds - delay before auto-skip on error
	ERROR_RECOVERY_ATTEMPTS: 3, // max error recovery attempts
	ERROR_RECOVERY_DELAY: 2000, // milliseconds - delay between error recovery attempts

	// Playback recovery (unified system)
	RECOVERY_CHECK_INTERVAL: 1000, // milliseconds - how often to check playback state
	RECOVERY_DETECTION_DELAY: 500, // milliseconds - how long paused before recovery
	RECOVERY_MIN_INTERVAL: 1000, // milliseconds - minimum time between recovery attempts
	RECOVERY_MAX_ATTEMPTS: 3, // max recovery attempts before giving up
	RECOVERY_DEBOUNCE: 100, // milliseconds - debounce recovery attempts

	// Play attempt debouncing
	PLAY_ATTEMPT_DEBOUNCE: 500, // milliseconds - minimum time between play attempts
	PLAY_ATTEMPT_TIMEOUT: 1000, // milliseconds - timeout for play attempt flag

	// Progress monitoring
	PROGRESS_UPDATE_INTERVAL: 500, // milliseconds - how often to update progress
	POSITION_UPDATE_INTERVAL: 10000, // milliseconds - how often to update MediaSession position

	// Video loading
	VIDEO_LOAD_DELAY: 800, // milliseconds - delay before attempting playback after load
	VIDEO_LOAD_TIMEOUT: 5000, // milliseconds - timeout for video load attempts
	SEEK_DELAY: 50, // milliseconds - delay after seek before play
	VIDEO_BUFFER_WINDOW: 5, // seconds - if offset is within this window, don't reload (just seek)

	// Autoplay
	AUTOPLAY_DELAY: 300, // milliseconds - delay before autoplay attempt
	AUTOPLAY_RETRY_DELAY: 500, // milliseconds - delay between autoplay retries
	AUTOPLAY_MAX_ATTEMPTS: 2, // max autoplay attempts

	// YouTube API
	YOUTUBE_API_LOAD_DELAY: 2, // milliseconds - delay for YouTube API loading
	YOUTUBE_PLAYER_INIT_TIMEOUT: 100, // milliseconds - timeout for player initialization polling
}

export default PLAYBACK_THRESHOLDS

