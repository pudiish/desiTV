/**
 * PseudoLiveCalculator.js
 * 
 * Calculates pseudo-live position in playlist
 * Moved from utils/pseudoLive.js for better organization
 */

import { BROADCAST_THRESHOLDS } from '../../config/thresholds/index.js'

/**
 * Calculate which item in a playlist should be playing at a given time
 * Simulates a continuous TV broadcast where time keeps moving regardless of viewer
 */
export function getPseudoLiveItem(playlist, startEpoch) {
	if (!playlist || playlist.length === 0) {
		return { 
			item: null, 
			offset: 0, 
			videoIndex: -1,
			totalElapsed: 0,
			cyclePosition: 0
		}
	}

	const durations = playlist.map(p => p.duration || BROADCAST_THRESHOLDS.DEFAULT_VIDEO_DURATION)
	const total = durations.reduce((a, b) => a + b, 0) || 1
	const start = new Date(startEpoch).getTime()
	const now = Date.now()
	
	const totalElapsed = Math.floor((now - start) / 1000)
	const cyclePosition = totalElapsed % total
	
	let cumulative = 0
	for (let i = 0; i < playlist.length; i++) {
		const d = durations[i]
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
 */
export function getNextVideoInSequence(playlist, currentIndex, cyclePosition) {
	if (!playlist || playlist.length === 0) {
		return {
			nextIndex: 0,
			nextOffset: 0,
			switchTime: 0
		}
	}

	const durations = playlist.map(p => p.duration || BROADCAST_THRESHOLDS.DEFAULT_VIDEO_DURATION)
	const total = durations.reduce((a, b) => a + b, 0) || 1
	
	const currentDuration = durations[currentIndex] || BROADCAST_THRESHOLDS.DEFAULT_VIDEO_DURATION
	
	let cumulative = 0
	let currentVideoStart = 0
	for (let i = 0; i <= currentIndex; i++) {
		if (i === currentIndex) {
			currentVideoStart = cumulative
			break
		}
		cumulative += durations[i]
	}
	
	const currentVideoEnd = currentVideoStart + currentDuration
	const timeUntilSwitch = currentVideoEnd - cyclePosition
	
	const nextIndex = (currentIndex + 1) % playlist.length
	
	return {
		nextIndex,
		nextOffset: 0,
		switchTime: timeUntilSwitch
	}
}

