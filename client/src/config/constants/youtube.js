/**
 * YouTube Player Constants
 * 
 * All YouTube API related constants
 */

export const YOUTUBE_STATES = {
	UNSTARTED: -1,
	ENDED: 0,
	PLAYING: 1,
	PAUSED: 2,
	BUFFERING: 3,
	VIDEO_CUED: 5,
}

export const YOUTUBE_ERROR_CODES = {
	INVALID_ID: 2,
	HTML5_ERROR: 5,
	NOT_FOUND: 100,
	NOT_EMBEDDABLE: 101,
	RESTRICTED: 150,
}

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

export const YOUTUBE_PERMANENT_ERRORS = [
	YOUTUBE_ERROR_CODES.NOT_FOUND,
	YOUTUBE_ERROR_CODES.NOT_EMBEDDABLE,
	// RESTRICTED (150) removed - will be handled by pre-validation and immediate skip
	2, // Invalid ID
	5, // HTML5 error
]

export default {
	YOUTUBE_STATES,
	YOUTUBE_ERROR_CODES,
	YOUTUBE_PLAYER,
	YOUTUBE_PERMANENT_ERRORS,
}

