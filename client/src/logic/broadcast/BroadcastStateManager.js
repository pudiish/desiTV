/**
 * BroadcastStateManager.js
 * 
 * Manages broadcast timeline state for channels
 * Extracted from LocalBroadcastStateManager for better organization
 */

import { BROADCAST_THRESHOLDS } from '../../config/thresholds/index.js'
import { fetchGlobalEpoch, getCachedEpoch } from '../../services/api/globalEpochService.js'

class BroadcastStateManager {
	constructor() {
		this.state = {} // { channelId: channelState }
		this.globalEpoch = null // Single global timeline epoch (IMMUTABLE after initialization)
		this.globalEpochLocked = false // Lock flag to prevent modification after initialization
		this.listeners = []
		this.saveInterval = null
		this.epochRefreshInterval = null // Periodic epoch refresh for sync
		this.storageKey = 'desitv-broadcast-state'
		this.globalEpochKey = 'desitv-global-epoch'
		this.gradualResetIntervals = {} // Track gradual reset intervals per channel
		
		// Configuration from thresholds
		this.config = {
			saveInterval: BROADCAST_THRESHOLDS.AUTO_SAVE_INTERVAL,
			defaultVideoDuration: BROADCAST_THRESHOLDS.DEFAULT_VIDEO_DURATION,
			defaultPlaylistDuration: BROADCAST_THRESHOLDS.DEFAULT_PLAYLIST_DURATION,
			maxChannelStates: BROADCAST_THRESHOLDS.MAX_CHANNEL_STATES,
			manualModeAutoReturnDelay: BROADCAST_THRESHOLDS.MANUAL_MODE_AUTO_RETURN_DELAY,
			manualModeGradualResetDuration: BROADCAST_THRESHOLDS.MANUAL_MODE_GRADUAL_RESET_DURATION,
			manualModeGradualResetSteps: BROADCAST_THRESHOLDS.MANUAL_MODE_GRADUAL_RESET_STEPS,
		}
	}

	/**
	 * Load state from localStorage
	 * NOTE: Global epoch is NOT loaded from localStorage - always fetched from server
	 */
	loadFromStorage() {
		try {
			// DON'T load global epoch from localStorage - always fetch from server
			// This ensures all devices use the same epoch
			// const epochStored = localStorage.getItem(this.globalEpochKey)
			// if (epochStored) {
			// 	this.globalEpoch = new Date(epochStored)
			// 	console.log(`[BroadcastState] Loaded global epoch: ${this.globalEpoch.toISOString()}`)
			// }

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
	 * CRITICAL: Always fetches from server first to ensure sync across all devices
	 * Replaces any localStorage epoch with server epoch for true synchronization
	 */
	async initializeGlobalEpoch(forceRefresh = false) {
		// If already locked and not forcing refresh, return existing epoch
		if (this.globalEpochLocked && this.globalEpoch && !forceRefresh) {
			return this.globalEpoch
		}

		// CRITICAL: Always fetch from server first (for true synchronization)
		// This ensures mobile and desktop use the same epoch
		try {
			const serverEpoch = await fetchGlobalEpoch()
			if (serverEpoch) {
				// Check if we had a different epoch in localStorage
				const oldEpoch = this.globalEpoch
				if (oldEpoch && oldEpoch.getTime() !== serverEpoch.getTime()) {
					console.warn(`[BroadcastState] ⚠️ Epoch mismatch! Local: ${oldEpoch.toISOString()}, Server: ${serverEpoch.toISOString()}`)
					console.warn(`[BroadcastState] Replacing local epoch with server epoch for synchronization`)
				}
				
				this.globalEpoch = serverEpoch
				this.globalEpochLocked = true
				console.log(`[BroadcastState] ✅ Global epoch from server: ${this.globalEpoch.toISOString()}`)
				this.saveToStorage()
				return this.globalEpoch
			}
		} catch (err) {
			console.error('[BroadcastState] ❌ Failed to fetch server epoch:', err)
			// CRITICAL: Don't use localStorage epoch - it causes desync between devices
			// Instead, retry server fetch with exponential backoff
			if (!this.globalEpoch) {
				console.warn('[BroadcastState] ⚠️ No epoch available - retrying server fetch...')
				// Retry with exponential backoff (max 3 retries)
				let retryCount = 0
				const maxRetries = 3
				const retryInterval = setInterval(async () => {
					retryCount++
					try {
						const serverEpoch = await fetchGlobalEpoch(true) // Force refresh
						if (serverEpoch) {
							this.globalEpoch = serverEpoch
							this.globalEpochLocked = true
							console.log(`[BroadcastState] ✅ Global epoch fetched on retry ${retryCount}: ${this.globalEpoch.toISOString()}`)
							this.saveToStorage()
							clearInterval(retryInterval)
							return
						}
					} catch (retryErr) {
						console.warn(`[BroadcastState] Retry ${retryCount} failed:`, retryErr.message)
						if (retryCount >= maxRetries) {
							clearInterval(retryInterval)
							// Last resort: use fixed epoch (ensures app works, but may cause desync)
							console.error('[BroadcastState] ❌ All retries failed - using fixed epoch (may cause desync)')
							this.globalEpoch = new Date('2020-01-01T00:00:00.000Z')
							this.globalEpochLocked = true
							this.saveToStorage()
						}
					}
				}, Math.min(1000 * Math.pow(2, retryCount), 5000)) // 1s, 2s, 4s, 5s max
			}
		}

		// Lock the epoch - it should never change after initialization
		this.globalEpochLocked = true
		console.log(`[BroadcastState] Global epoch locked: ${this.globalEpoch.toISOString()}`)

		return this.globalEpoch
	}

	/**
	 * Initialize channel state
	 */
	initializeChannel(channel) {
		if (!channel || !channel._id) return null

		if (!this.globalEpoch) {
			// Initialize synchronously for backward compatibility
			// Will be properly initialized async when needed
			this.initializeGlobalEpoch().catch(err => {
				console.warn('[BroadcastState] Failed to initialize epoch:', err)
			})
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
				// Preserve manual mode state
				manualMode: savedState.manualMode || false,
				manualModeUntil: savedState.manualModeUntil || null,
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
				manualMode: false, // Whether user has manually switched (temporarily overrides timeline)
				manualModeUntil: null, // Timestamp when manual mode should expire
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
			// Initialize synchronously for backward compatibility
			// Will be properly initialized async when needed
			this.initializeGlobalEpoch().catch(err => {
				console.warn('[BroadcastState] Failed to initialize epoch:', err)
			})
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
	 * Start periodic epoch refresh (ensures sync across devices)
	 * Refreshes every 5 minutes to catch any epoch changes
	 */
	startEpochRefresh() {
		if (this.epochRefreshInterval) {
			clearInterval(this.epochRefreshInterval)
		}

		// Refresh epoch every 1.5 minutes for faster sync (optimized from 5 minutes)
		// This ensures users stay synchronized within 1.5 minutes instead of 5 minutes
		this.epochRefreshInterval = setInterval(() => {
			this.initializeGlobalEpoch(true).catch(err => {
				console.warn('[BroadcastState] Periodic epoch refresh failed:', err)
			})
		}, 1.5 * 60 * 1000) // 1.5 minutes (3.3x faster sync)

		console.log('[BroadcastState] Started periodic epoch refresh (every 1.5 minutes)')
	}

	/**
	 * Stop periodic epoch refresh
	 */
	stopEpochRefresh() {
		if (this.epochRefreshInterval) {
			clearInterval(this.epochRefreshInterval)
			this.epochRefreshInterval = null
		}
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
			// Initialize synchronously for backward compatibility
			// Will be properly initialized async when needed
			this.initializeGlobalEpoch().catch(err => {
				console.warn('[BroadcastState] Failed to initialize epoch:', err)
			})
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
			// Initialize synchronously for backward compatibility
			// Will be properly initialized async when needed
			this.initializeGlobalEpoch().catch(err => {
				console.warn('[BroadcastState] Failed to initialize epoch:', err)
			})
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

		// Clear any gradual reset in progress
		if (this.gradualResetIntervals[channelId]) {
			clearInterval(this.gradualResetIntervals[channelId])
			delete this.gradualResetIntervals[channelId]
		}

		this.state[channelId] = {
			...state,
			channelOffset: 0,
			manualMode: false,
			manualModeUntil: null,
			lastAccessTime: new Date(),
		}

		this.saveToStorage()
		console.log(`[BroadcastState] Reset channel offset for ${channelId}`)
		return true
	}

	/**
	 * Set manual mode (user has manually switched videos)
	 * Manual mode persists until channel/category is changed
	 * @param {string} channelId - Channel ID
	 * @param {boolean} isManual - Whether to enable manual mode
	 */
	setManualMode(channelId, isManual) {
		const state = this.state[channelId]
		if (!state) {
			console.warn(`[BroadcastState] Cannot set manual mode - no state for channel ${channelId}`)
			return false
		}

		// Clear any existing gradual reset
		if (this.gradualResetIntervals[channelId]) {
			clearInterval(this.gradualResetIntervals[channelId])
			delete this.gradualResetIntervals[channelId]
		}

		this.state[channelId] = {
			...state,
			manualMode: isManual,
			manualModeUntil: null, // No timer - manual mode persists until category/channel change
			lastAccessTime: new Date(),
		}

		this.saveToStorage()
		console.log(`[BroadcastState] Manual mode ${isManual ? 'enabled' : 'disabled'} for ${channelId} (persists until category change)`)
		return true
	}

	/**
	 * Check if should return to timeline mode
	 * Manual mode no longer expires automatically - it persists until category/channel change
	 * @param {string} channelId - Channel ID
	 * @returns {boolean} - Always returns false (manual mode persists until explicit change)
	 */
	shouldReturnToTimeline(channelId) {
		// Manual mode persists until category/channel is changed
		// This method is kept for compatibility but always returns false
		return false
	}

	/**
	 * Get current mode (timeline or manual)
	 * @param {string} channelId - Channel ID
	 * @returns {string} - 'timeline' or 'manual'
	 */
	getMode(channelId) {
		const state = this.state[channelId]
		if (!state) return 'timeline'
		
		// Manual mode persists until explicitly cleared (category change)
		return state.manualMode ? 'manual' : 'timeline'
	}

	/**
	 * Gradually reset offset to return to timeline mode
	 * Creates a smooth transition back to timeline position
	 * @param {string} channelId - Channel ID
	 */
	gradualOffsetReset(channelId) {
		const state = this.state[channelId]
		if (!state) return

		// Clear any existing gradual reset
		if (this.gradualResetIntervals[channelId]) {
			clearInterval(this.gradualResetIntervals[channelId])
		}

		const currentOffset = state.channelOffset || 0
		if (Math.abs(currentOffset) < 0.1) {
			// Already close to 0, just reset immediately
			this.state[channelId] = {
				...state,
				channelOffset: 0,
				manualMode: false,
				manualModeUntil: null,
			}
			this.saveToStorage()
			return
		}

		const targetOffset = 0
		const steps = this.config.manualModeGradualResetSteps
		const stepInterval = this.config.manualModeGradualResetDuration / steps
		const stepSize = currentOffset / steps

		let stepCount = 0

		console.log(`[BroadcastState] Starting gradual offset reset for ${channelId} (${currentOffset.toFixed(1)}s → 0s over ${this.config.manualModeGradualResetDuration/1000}s)`)

		this.gradualResetIntervals[channelId] = setInterval(() => {
			stepCount++
			const newOffset = currentOffset - (stepSize * stepCount)

			if (stepCount >= steps || Math.abs(newOffset) < Math.abs(stepSize)) {
				// Reset complete
				this.state[channelId] = {
					...state,
					channelOffset: 0,
					manualMode: false,
					manualModeUntil: null,
					lastAccessTime: new Date(),
				}
				clearInterval(this.gradualResetIntervals[channelId])
				delete this.gradualResetIntervals[channelId]
				this.saveToStorage()
				console.log(`[BroadcastState] Gradual reset complete for ${channelId}, returned to timeline mode`)
			} else {
				// Update offset gradually
				this.state[channelId] = {
					...state,
					channelOffset: newOffset,
					lastAccessTime: new Date(),
				}
				this.saveToStorage()
			}
		}, stepInterval)
	}

	/**
	 * Check and handle auto-return to timeline if needed
	 * Should be called periodically to check if manual mode has expired
	 * @param {string} channelId - Channel ID
	 */
	checkAndReturnToTimeline(channelId) {
		if (this.shouldReturnToTimeline(channelId)) {
			this.gradualOffsetReset(channelId)
			return true
		}
		return false
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

