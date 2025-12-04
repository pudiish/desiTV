/**
 * Calculate which item in a playlist should be playing at a given time
 * Simulates a continuous TV broadcast where time keeps moving regardless of viewer
 * @param {Array} playlist - Array of video items with duration property
 * @param {Date|number} startEpoch - When the playlist started broadcasting
 * @returns {Object} { item, offset, videoIndex, totalElapsed, cyclePosition }
 */
export function getPseudoLiveItem(playlist, startEpoch){
	if (!playlist || playlist.length === 0) return { 
		item: null, 
		offset: 0, 
		videoIndex: -1,
		totalElapsed: 0,
		cyclePosition: 0
	}

	const durations = playlist.map(p => p.duration || 30)
	const total = durations.reduce((a, b) => a + b, 0) || 1
	const start = new Date(startEpoch).getTime()
	const now = Date.now()
	
	// Total seconds elapsed since the broadcast started
	const totalElapsed = Math.floor((now - start) / 1000)
	
	// Position within the current cycle (repeating playlist)
	const cyclePosition = totalElapsed % total
	
	let cumulative = 0
	for (let i = 0; i < playlist.length; i++) {
		const d = playlist[i].duration || 30
		if (cumulative + d > cyclePosition) {
			return {
				item: playlist[i],
				offset: cyclePosition - cumulative,
				videoIndex: i,
				totalElapsed,
				cyclePosition
			}
		}
		cumulative += d
	}
	
	// Fallback to first item
	return {
		item: playlist[0],
		offset: 0,
		videoIndex: 0,
		totalElapsed,
		cyclePosition
	}
}

/**
 * Calculate next video to play based on current position
 * @param {Array} playlist - Array of video items
 * @param {number} currentIndex - Current video index
 * @param {number} cyclePosition - Current position in cycle
 * @returns {Object} { nextIndex, nextOffset, switchTime }
 */
export function getNextVideoInSequence(playlist, currentIndex, cyclePosition) {
	if (!playlist || playlist.length === 0) return {
		nextIndex: 0,
		nextOffset: 0,
		switchTime: 0
	}

	const durations = playlist.map(p => p.duration || 30)
	const total = durations.reduce((a, b) => a + b, 0) || 1
	
	// Get the duration of current video
	const currentDuration = durations[currentIndex] || 30
	
	// Get current offset in the video
	let cumulative = 0
	let currentVideoStart = 0
	for (let i = 0; i <= currentIndex; i++) {
		if (i === currentIndex) {
			currentVideoStart = cumulative
			break
		}
		cumulative += durations[i]
	}
	
	// Time until current video ends
	const currentVideoEnd = currentVideoStart + currentDuration
	const timeUntilSwitch = currentVideoEnd - cyclePosition
	
	// Next video index
	const nextIndex = (currentIndex + 1) % playlist.length
	
	return {
		nextIndex,
		nextOffset: 0,
		switchTime: timeUntilSwitch
	}
}
