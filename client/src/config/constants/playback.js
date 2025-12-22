/**
 * Playback Constants
 * 
 * All playback-related constants (non-threshold values)
 */

export const PLAYBACK = {
	// Video duration
	DEFAULT_VIDEO_DURATION: 300, // seconds - default if not specified
	
	// Volume
	DEFAULT_VOLUME: 0.5, // default volume level (0-1)
	MIN_VOLUME: 0,
	MAX_VOLUME: 1,
	VOLUME_STEP: 0.1,
	
	// Playback rate
	DEFAULT_PLAYBACK_RATE: 1.0,
	
	// Seek offsets
	SEEK_BACKWARD_OFFSET: 10, // seconds
	SEEK_FORWARD_OFFSET: 10, // seconds
}

export const PLAYBACK_STATES = {
	IDLE: 'idle',
	LOADING: 'loading',
	PLAYING: 'playing',
	BUFFERING: 'buffering',
	ERROR: 'error',
	PAUSED: 'paused',
	TRANSITIONING: 'transitioning',
}

export const PLAYBACK_HEALTH = {
	HEALTHY: 'healthy',
	BUFFERING: 'buffering',
	RETRYING: 'retrying',
	FAILED: 'failed',
}

export default {
	PLAYBACK,
	PLAYBACK_STATES,
	PLAYBACK_HEALTH,
}

