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
}

export default BROADCAST_THRESHOLDS

