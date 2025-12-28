/**
 * playlistTransition.js
 * 
 * Smooth playlist transition system
 * Handles fading between playlists when time slots change
 */

/**
 * Calculate transition state
 * @param {number} secondsUntilNextSlot - Seconds until next time slot
 * @param {number} transitionDuration - Transition duration in seconds (default: 30)
 * @returns {Object} Transition state
 */
export function getTransitionState(secondsUntilNextSlot, transitionDuration = 30) {
	if (!secondsUntilNextSlot || secondsUntilNextSlot > transitionDuration) {
		return {
			isTransitioning: false,
			transitionProgress: 0,
			opacity: 1,
			shouldFade: false,
		}
	}
	
	// Calculate progress (0 to 1)
	const progress = 1 - (secondsUntilNextSlot / transitionDuration)
	
	// Smooth fade out curve (ease-in-out)
	const opacity = progress < 0.5
		? 1 - (progress * 2) * 0.3 // Fade out 30% in first half
		: 0.7 - ((progress - 0.5) * 2) * 0.7 // Fade out remaining 70% in second half
	
	return {
		isTransitioning: true,
		transitionProgress: progress,
		opacity: Math.max(0, Math.min(1, opacity)),
		shouldFade: progress > 0.3, // Start fading after 30% progress
		secondsRemaining: secondsUntilNextSlot,
	}
}

/**
 * Get transition message for display
 * @param {string} currentSlot - Current time slot name
 * @param {string} nextSlot - Next time slot name
 * @param {number} secondsRemaining - Seconds until transition
 * @returns {string} Transition message
 */
export function getTransitionMessage(currentSlot, nextSlot, secondsRemaining) {
	if (!secondsRemaining || secondsRemaining > 60) {
		return null
	}
	
	const minutes = Math.floor(secondsRemaining / 60)
	const seconds = Math.floor(secondsRemaining % 60)
	
	if (minutes > 0) {
		return `Transitioning to ${nextSlot} in ${minutes}m ${seconds}s...`
	}
	
	return `Transitioning to ${nextSlot} in ${seconds}s...`
}

/**
 * Should show transition overlay
 * @param {number} secondsUntilNextSlot - Seconds until next slot
 * @param {number} showThreshold - Show threshold in seconds (default: 60)
 * @returns {boolean} Whether to show overlay
 */
export function shouldShowTransitionOverlay(secondsUntilNextSlot, showThreshold = 60) {
	return secondsUntilNextSlot !== null && secondsUntilNextSlot <= showThreshold
}

