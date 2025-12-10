/**
 * Broadcast Timeline Thresholds - All parameters for broadcast state management
 * 
 * Single source of truth for broadcast timeline configuration
 */

export const BROADCAST_THRESHOLDS = {
	// Timeline defaults
	DEFAULT_VIDEO_DURATION: 300, // seconds - default if video duration not specified
	DEFAULT_PLAYLIST_DURATION: 3600, // seconds - default playlist duration

	// State persistence
	AUTO_SAVE_INTERVAL: 5000, // milliseconds - how often to auto-save state
	SESSION_SAVE_DEBOUNCE: 500, // milliseconds - debounce session saves
	SESSION_MIN_SAVE_INTERVAL: 1000, // milliseconds - minimum interval between saves
	SESSION_SAVE_AUTO_INTERVAL: 3000, // milliseconds - auto-save interval

	// State sync
	BROADCAST_SYNC_INTERVAL: 5000, // milliseconds - sync state to server
	POSITION_REFRESH_INTERVAL: 1000, // milliseconds - how often to recalculate position

	// Storage
	MAX_CHANNEL_STATES: 10, // maximum channel states to keep in localStorage

	// Manual mode settings (hybrid pseudo-live + manual controls)
	MANUAL_MODE_AUTO_RETURN_DELAY: 30000, // milliseconds - 30 seconds before auto-return to timeline
	MANUAL_MODE_GRADUAL_RESET_DURATION: 5000, // milliseconds - 5 seconds for gradual reset
	MANUAL_MODE_GRADUAL_RESET_STEPS: 10, // Number of steps for gradual reset
	TIMELINE_AUTO_ADVANCE: true, // Auto-advance videos based on timeline
	TIMELINE_SYNC_ON_CATEGORY_SWITCH: true, // Sync to timeline on category change
}

export default BROADCAST_THRESHOLDS

