/**
 * BroadcastStateManager.js
 * 
 * Manages broadcast timeline state for channels
 * Extracted from LocalBroadcastStateManager for better organization
 */

import { BROADCAST_THRESHOLDS } from '../../config/thresholds/index.js'

class BroadcastStateManager {
	constructor() {
		this.state = {} // { channelId: channelState }
		this.globalEpoch = null // Single global timeline epoch (IMMUTABLE after initialization)
		this.globalEpochLocked = false // Lock flag to prevent modification after initialization
		this.listeners = []
		this.saveInterval = null
		this.storageKey = 'desitv-broadcast-state'
		this.globalEpochKey = 'desitv-global-epoch'
		
		// Configuration from thresholds
		this.config = {
			saveInterval: BROADCAST_THRESHOLDS.AUTO_SAVE_INTERVAL,
			defaultVideoDuration: BROADCAST_THRESHOLDS.DEFAULT_VIDEO_DURATION,
			defaultPlaylistDuration: BROADCAST_THRESHOLDS.DEFAULT_PLAYLIST_DURATION,
			maxChannelStates: BROADCAST_THRESHOLDS.MAX_CHANNEL_STATES,
		}
	}

	/**
	 * Load state from localStorage
	 */
	loadFromStorage() {
		try {
			// Load global epoch
			const epochStored = localStorage.getItem(this.globalEpochKey)
			if (epochStored) {
				this.globalEpoch = new Date(epochStored)
				console.log(`[BroadcastState] Loaded global epoch: ${this.globalEpoch.toISOString()}`)
			}

			// Load channel states
			const stored = localStorage.getItem(this.storageKey)
			if (stored) {
				const data = JSON.parse(stored)
				this.state = data || {}
				console.log(`[BroadcastState] Loaded ${Object.keys(this.state).length} channel states`)
				return true
			}
		} catch (err) {
			console.error('[BroadcastState] Error loading from storage:', err)
		}
		return false
	}

	/**
	 * Save state to localStorage
	 */
	saveToStorage() {
		try {
			// Save global epoch
			if (this.globalEpoch) {
				localStorage.setItem(this.globalEpochKey, this.globalEpoch.toISOString())
			}

			// Save channel states
			localStorage.setItem(this.storageKey, JSON.stringify(this.state))
			return true
		} catch (err) {
			console.error('[BroadcastState] Error saving to storage:', err)
			if (err.name === 'QuotaExceededError') {
				this.cleanupOldStates()
				try {
					if (this.globalEpoch) {
						localStorage.setItem(this.globalEpochKey, this.globalEpoch.toISOString())
					}
					localStorage.setItem(this.storageKey, JSON.stringify(this.state))
					return true
				} catch (retryErr) {
					console.error('[BroadcastState] Retry save failed:', retryErr)
				}
			}
			return false
		}
	}

	/**
	 * Clean up old/unused channel states
	 */
	cleanupOldStates() {
		const entries = Object.entries(this.state)
		if (entries.length > this.config.maxChannelStates) {
			entries.sort((a, b) => {
				const timeA = new Date(a[1].lastAccessTime || 0).getTime()
				const timeB = new Date(b[1].lastAccessTime || 0).getTime()
				return timeB - timeA
			})
			
			this.state = Object.fromEntries(entries.slice(0, this.config.maxChannelStates))
			console.log(`[BroadcastState] Cleaned up old states, kept ${this.config.maxChannelStates} most recent`)
		}
	}

	/**
	 * Initialize global epoch (IMMUTABLE - set once, never changes)
	 * This represents the "login time" and all channels calculate from this point
	 */
	initializeGlobalEpoch() {
		// If already locked, return existing epoch
		if (this.globalEpochLocked && this.globalEpoch) {
			return this.globalEpoch
		}

		if (this.globalEpoch === null) {
			this.loadFromStorage()
		}

		if (!this.globalEpoch) {
			this.globalEpoch = new Date()
			console.log(`[BroadcastState] Global epoch initialized: ${this.globalEpoch.toISOString()}`)
			this.saveToStorage()
		}

		// Lock the epoch - it should never change after initialization
		this.globalEpochLocked = true
		console.log(`[BroadcastState] Global epoch locked - will not change for this session`)

		return this.globalEpoch
	}

	/**
	 * Initialize channel state
	 */
	initializeChannel(channel) {
		if (!channel || !channel._id) return null

		if (!this.globalEpoch) {
			this.initializeGlobalEpoch()
		}

		if (Object.keys(this.state).length === 0) {
			this.loadFromStorage()
		}

		const channelId = channel._id
		const now = new Date()
		const savedState = this.state[channelId]

		if (savedState) {
			this.state[channelId] = {
				...savedState,
				channelName: channel.name,
				playlistTotalDuration: this.calculateTotalDuration(channel.items),
				videoDurations: channel.items.map((v) => 
					(typeof v.duration === 'number' && v.duration > 0) ? v.duration : this.config.defaultVideoDuration
				),
				lastAccessTime: now,
				// Preserve channelOffset if it exists (for manual seeking)
				channelOffset: savedState.channelOffset || 0,
			}
		} else {
			this.state[channelId] = {
				channelId,
				channelName: channel.name,
				lastAccessTime: now,
				playlistTotalDuration: this.calculateTotalDuration(channel.items),
				videoDurations: channel.items.map((v) => 
					(typeof v.duration === 'number' && v.duration > 0) ? v.duration : this.config.defaultVideoDuration
				),
				channelOffset: 0, // Per-channel offset for manual seeking (doesn't affect global epoch)
			}
			this.saveToStorage()
		}

		return this.state[channelId]
	}

	/**
	 * Initialize all channels
	 */
	initializeAllChannels(channels) {
		if (!channels || !Array.isArray(channels)) return

		this.initializeGlobalEpoch()

		channels.forEach(channel => {
			if (channel && channel._id) {
				this.initializeChannel(channel)
			}
		})

		console.log(`[BroadcastState] Initialized ${channels.length} channels`)
		this.saveToStorage()
	}

	/**
	 * Calculate current position in broadcast timeline
	 * Uses immutable global epoch + per-channel offset (for manual seeking)
	 */
	calculateCurrentPosition(channel) {
		if (!channel || !channel.items || channel.items.length === 0) {
			return {
				videoIndex: 0,
				offset: 0,
				debugInfo: 'No items in channel',
			}
		}

		if (!this.globalEpoch) {
			this.initializeGlobalEpoch()
		}

		const channelId = channel._id
		const savedState = this.state[channelId]

		if (!savedState) {
			this.initializeChannel(channel)
			return this.calculateCurrentPosition(channel)
		}

		const now = new Date()
		// Calculate elapsed time from immutable global epoch
		const totalElapsedMs = now.getTime() - this.globalEpoch.getTime()
		const totalElapsedSec = totalElapsedMs / 1000

		// Apply per-channel offset (for manual seeking - doesn't affect global epoch)
		const channelOffset = savedState.channelOffset || 0
		const adjustedElapsedSec = totalElapsedSec + channelOffset

		const videoDurations = channel.items.map((v) => {
			const duration = v.duration
			if (typeof duration === 'number' && duration > 0) {
				return duration
			}
			return this.config.defaultVideoDuration
		})
		
		const totalDurationSec = videoDurations.reduce((sum, d) => sum + d, 0)
		
		if (totalDurationSec === 0) {
			return {
				videoIndex: 0,
				offset: 0,
				debugInfo: 'Zero total duration',
			}
		}

		let videoIndex = 0
		let offsetInVideo = 0
		let cyclePosition = 0
		let cycleCount = 0

		// Single video case
		if (channel.items.length === 1) {
			const singleVideoDuration = videoDurations[0]
			if (singleVideoDuration <= 0) {
				return {
					videoIndex: 0,
					offset: 0,
					debugInfo: 'Invalid single video duration',
				}
			}
			// Handle negative adjustedElapsedSec (if user seeks backward)
			const effectiveElapsed = adjustedElapsedSec >= 0 
				? adjustedElapsedSec 
				: (Math.ceil(Math.abs(adjustedElapsedSec) / singleVideoDuration) * singleVideoDuration + adjustedElapsedSec)
			cyclePosition = effectiveElapsed % singleVideoDuration
			if (cyclePosition < 0) cyclePosition += singleVideoDuration
			offsetInVideo = cyclePosition
			videoIndex = 0
			cycleCount = Math.floor(effectiveElapsed / singleVideoDuration)
		}
		// Multiple videos case
		else {
			// Handle negative adjustedElapsedSec
			const effectiveElapsed = adjustedElapsedSec >= 0
				? adjustedElapsedSec
				: (Math.ceil(Math.abs(adjustedElapsedSec) / totalDurationSec) * totalDurationSec + adjustedElapsedSec)
			
			cyclePosition = effectiveElapsed % totalDurationSec
			if (cyclePosition < 0) cyclePosition += totalDurationSec
			cycleCount = Math.floor(effectiveElapsed / totalDurationSec)

			let accumulatedTime = 0
			let found = false
			
			for (let i = 0; i < videoDurations.length; i++) {
				const videoDuration = videoDurations[i]
				const videoEndTime = accumulatedTime + videoDuration
				
				if (cyclePosition >= accumulatedTime && cyclePosition < videoEndTime) {
					videoIndex = i
					offsetInVideo = cyclePosition - accumulatedTime
					found = true
					break
				}
				
				accumulatedTime = videoEndTime
			}
			
			if (!found) {
				videoIndex = 0
				offsetInVideo = 0
			}
		}

		// Validate calculated position
		if (videoIndex < 0 || videoIndex >= channel.items.length) {
			videoIndex = 0
			offsetInVideo = 0
		}
		
		const currentVideoDuration = videoDurations[videoIndex] || this.config.defaultVideoDuration
		if (offsetInVideo >= currentVideoDuration) {
			offsetInVideo = Math.max(0, currentVideoDuration - 1)
		}
		if (offsetInVideo < 0) {
			offsetInVideo = 0
		}

		const position = {
			videoIndex,
			offset: Math.max(0, Math.min(offsetInVideo, currentVideoDuration)),
			cyclePosition,
			totalDuration: totalDurationSec,
			totalElapsedSec,
			adjustedElapsedSec,
			channelOffset,
			cycleCount,
			videoDurations,
			isSingleVideo: channel.items.length === 1,
		}

		return position
	}

	/**
	 * Calculate total playlist duration
	 */
	calculateTotalDuration(items) {
		if (!items || items.length === 0) return this.config.defaultPlaylistDuration
		return items.reduce((sum, item) => {
			const duration = item.duration
			if (typeof duration === 'number' && duration > 0) {
				return sum + duration
			}
			return sum + this.config.defaultVideoDuration
		}, 0)
	}

	/**
	 * Start auto-save
	 */
	startAutoSave() {
		if (this.saveInterval) {
			clearInterval(this.saveInterval)
		}

		this.saveInterval = setInterval(() => {
			this.saveToStorage()
		}, this.config.saveInterval)
	}

	/**
	 * Stop auto-save
	 */
	stopAutoSave() {
		if (this.saveInterval) {
			clearInterval(this.saveInterval)
			this.saveInterval = null
		}
		this.saveToStorage()
	}

	/**
	 * Get channel state
	 */
	getChannelState(channelId) {
		return this.state[channelId] || null
	}

	/**
	 * Get global epoch
	 */
	getGlobalEpoch() {
		if (!this.globalEpoch) {
			this.initializeGlobalEpoch()
		}
		return this.globalEpoch
	}

	/**
	 * Update channel state (for backward compatibility)
	 */
	updateChannelState(channelId, updateData) {
		if (!this.state[channelId]) {
			console.warn(`[BroadcastState] Cannot update - no state for channel ${channelId}`)
			return false
		}

		this.state[channelId] = {
			...this.state[channelId],
			...updateData,
			lastAccessTime: new Date(),
		}

		this.saveToStorage()
		return true
	}

	/**
	 * Jump to specific video (adjusts per-channel offset, NOT global epoch)
	 * Global epoch is immutable - this only affects the current channel
	 */
	jumpToVideo(channelId, targetVideoIndex, targetOffset = 0, items) {
		const state = this.state[channelId]
		if (!state || !items || items.length === 0) {
			console.warn(`[BroadcastState] Cannot jump - no state for channel ${channelId}`)
			return false
		}

		// Ensure global epoch is initialized
		if (!this.globalEpoch) {
			this.initializeGlobalEpoch()
		}

		// Calculate cumulative time up to target video
		let cumulativeTime = 0
		for (let i = 0; i < targetVideoIndex && i < items.length; i++) {
			cumulativeTime += items[i]?.duration || this.config.defaultVideoDuration
		}
		cumulativeTime += targetOffset

		// Calculate total playlist duration
		const totalDuration = items.reduce((sum, v) => sum + (v.duration || this.config.defaultVideoDuration), 0)
		
		// Get target cycle position
		const targetCyclePosition = cumulativeTime % totalDuration

		// Calculate what the current cycle position would be from global epoch
		const now = new Date()
		const totalElapsedMs = now.getTime() - this.globalEpoch.getTime()
		const totalElapsedSec = totalElapsedMs / 1000
		const currentCyclePosition = totalElapsedSec % totalDuration

		// Calculate offset needed to make current position = target position
		// offset = targetCyclePosition - currentCyclePosition
		// This adjusts the calculation for this channel only, without affecting global epoch
		const channelOffset = targetCyclePosition - currentCyclePosition
		
		// Normalize offset to be within reasonable range (within one cycle)
		const normalizedOffset = channelOffset > totalDuration / 2 
			? channelOffset - totalDuration 
			: channelOffset < -totalDuration / 2 
				? channelOffset + totalDuration 
				: channelOffset

		this.state[channelId] = {
			...state,
			channelOffset: normalizedOffset,
			lastAccessTime: now,
		}

		this.saveToStorage()
		console.log(`[BroadcastState] Jumped to video ${targetVideoIndex} at ${targetOffset}s (channel offset: ${normalizedOffset.toFixed(1)}s)`)
		return true
	}

	/**
	 * Reset channel offset (return to timeline-based position)
	 */
	resetChannelOffset(channelId) {
		const state = this.state[channelId]
		if (!state) {
			return false
		}

		this.state[channelId] = {
			...state,
			channelOffset: 0,
			lastAccessTime: new Date(),
		}

		this.saveToStorage()
		console.log(`[BroadcastState] Reset channel offset for ${channelId}`)
		return true
	}

	/**
	 * Clear all state
	 */
	clearAll() {
		this.state = {}
		this.globalEpoch = null
		localStorage.removeItem(this.storageKey)
		localStorage.removeItem(this.globalEpochKey)
		this.stopAutoSave()
		this.listeners = []
	}
}

// Export singleton instance
const broadcastStateManager = new BroadcastStateManager()
export default broadcastStateManager

