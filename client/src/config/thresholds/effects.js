/**
 * Effects Thresholds - All timing parameters for visual effects
 * 
 * Single source of truth for all effect-related thresholds
 */

export const EFFECTS_THRESHOLDS = {
	// Channel switching pipeline
	STATIC_DURATION: 200, // milliseconds - static overlay duration
	BLACK_SCREEN_DURATION: 75, // milliseconds - black screen duration
	FADE_IN_DURATION: 400, // milliseconds - CRT fade-in duration
	FADE_OUT_DURATION: 200, // milliseconds - fade-out duration

	// Static effect
	STATIC_DEFAULT_DURATION: 200, // milliseconds - default static effect duration
}

export default EFFECTS_THRESHOLDS

