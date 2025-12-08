/**
 * LocalBroadcastStateManager.js - LOCALSTORAGE-BASED BROADCAST STATE
 * 
 * Serverless version - no MongoDB dependency
 * 
 * Core Principle: "THE BROADCAST NEVER STOPS"
 * 
 * GLOBAL TIMELINE SYSTEM:
 * ======================
 * 1. GLOBAL EPOCH: Single timestamp when user first starts TV (stored in localStorage)
 *    - Set once when TV starts, never changes
 *    - Shared by ALL channels - common timeline for everything
 * 2. VIRTUAL ELAPSED TIME: Total seconds elapsed since global epoch to NOW
 *    - Accounts for app being closed, reloaded, or crashed
 *    - Calculated from: now - globalEpoch
 * 3. CYCLE POSITION: Where we are in current playlist cycle
 *    - Calculated from: virtualElapsedTime % totalPlaylistDuration
 * 4. VIDEO INDEX & OFFSET: Which video + where in that video
 *    - Find by: Iterate through videos until cumulative duration > cyclePosition
 * 5. SMOOTH RESUME: Seek to calculated position on player load
 *    - Player automatically starts from correct position
 *    - No visual interruption
 * 
 * Storage:
 * - All state saved to localStorage
 * - Global epoch shared by all channels
 * - Each channel stores only playlist metadata (durations, etc.)
 * - Auto-saves every 5 seconds
 */

class LocalBroadcastStateManager {
	constructor() {
		this.state = {} // { channelId: channelState }
		this.globalEpoch = null // Single global timeline epoch
		this.listeners = []
		this.saveInterval = null
		this.saveIntervalMs = 5000 // Save every 5 seconds
		this.storageKey = 'desitv-broadcast-state'
		this.globalEpochKey = 'desitv-global-epoch'
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
				console.log(`[LBSM] Loaded global epoch: ${this.globalEpoch.toISOString()}`)
			}

			// Load channel states
			const stored = localStorage.getItem(this.storageKey)
			if (stored) {
				const data = JSON.parse(stored)
				this.state = data || {}
				console.log(`[LBSM] Loaded ${Object.keys(this.state).length} channel states from localStorage`)
				return true
			}
		} catch (err) {
			console.error('[LBSM] Error loading from storage:', err)
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
			console.error('[LBSM] Error saving to storage:', err)
			// If storage is full, try to clean up old states
			if (err.name === 'QuotaExceededError') {
				this.cleanupOldStates()
				try {
					if (this.globalEpoch) {
						localStorage.setItem(this.globalEpochKey, this.globalEpoch.toISOString())
					}
					localStorage.setItem(this.storageKey, JSON.stringify(this.state))
					return true
				} catch (retryErr) {
					console.error('[LBSM] Retry save failed:', retryErr)
				}
			}
			return false
		}
	}

	/**
	 * Clean up old/unused channel states (keep only last 10)
	 */
	cleanupOldStates() {
		const entries = Object.entries(this.state)
		if (entries.length > 10) {
			// Sort by last access time, keep most recent
			entries.sort((a, b) => {
				const timeA = new Date(a[1].lastAccessTime || 0).getTime()
				const timeB = new Date(b[1].lastAccessTime || 0).getTime()
				return timeB - timeA
			})
			
			// Keep top 10
			this.state = Object.fromEntries(entries.slice(0, 10))
			console.log('[LBSM] Cleaned up old states, kept 10 most recent')
		}
	}

	/**
	 * INITIALIZE GLOBAL EPOCH
	 * Sets the global timeline epoch when TV first starts
	 * This is called once when channels are loaded, not per-channel
	 */
	initializeGlobalEpoch() {
		// Load from storage first
		if (this.globalEpoch === null) {
			this.loadFromStorage()
		}

		// If no global epoch exists, create one now
		if (!this.globalEpoch) {
			this.globalEpoch = new Date()
			console.log(`[LBSM] Global epoch initialized: ${this.globalEpoch.toISOString()}`)
			this.saveToStorage()
		}

		return this.globalEpoch
	}

	/**
	 * INITIALIZE CHANNEL STATE
	 * Sets up playlist metadata for a channel (uses global epoch)
	 * Called for all channels when TV starts
	 */
	initializeChannel(channel) {
		if (!channel || !channel._id) return null

		// Ensure global epoch is initialized
		if (!this.globalEpoch) {
			this.initializeGlobalEpoch()
		}

		// Load from storage first
		if (Object.keys(this.state).length === 0) {
			this.loadFromStorage()
		}

		const channelId = channel._id
		const now = new Date()

		// Check if we have saved state for this channel
		const savedState = this.state[channelId]

		if (savedState) {
			// Use saved state, but update metadata if playlist changed
			this.state[channelId] = {
				...savedState,
				channelName: channel.name, // Update name in case it changed
				playlistTotalDuration: this.calculateTotalDuration(channel.items),
				videoDurations: channel.items.map((v) => (typeof v.duration === 'number' && v.duration > 0) ? v.duration : 300),
				lastAccessTime: now,
			}
			console.log(`[LBSM] Channel ${channelId} initialized from localStorage`)
		} else {
			// Create fresh state - channel metadata only (no epoch, uses global)
			this.state[channelId] = {
				channelId,
				channelName: channel.name,
				lastAccessTime: now,
				playlistTotalDuration: this.calculateTotalDuration(channel.items),
				videoDurations: channel.items.map((v) => (typeof v.duration === 'number' && v.duration > 0) ? v.duration : 300),
			}
			console.log(`[LBSM] Channel ${channelId} initialized (using global timeline)`)
			this.saveToStorage()
		}

		return this.state[channelId]
	}

	/**
	 * INITIALIZE ALL CHANNELS
	 * Called when TV starts to initialize all channels in background
	 */
	initializeAllChannels(channels) {
		if (!channels || !Array.isArray(channels)) return

		// Initialize global epoch first
		this.initializeGlobalEpoch()

		// Initialize all channels
		channels.forEach(channel => {
			if (channel && channel._id) {
				this.initializeChannel(channel)
			}
		})

		console.log(`[LBSM] Initialized ${channels.length} channels with global timeline`)
		this.saveToStorage()
	}

	/**
	 * CORE ALGORITHM: Calculate current position in broadcast timeline
	 * 
	 * Uses GLOBAL EPOCH - all channels share the same timeline
	 * 
	 * Handles TWO cases:
	 * 1. SINGLE VIDEO: Loop the same video continuously
	 * 2. MULTIPLE VIDEOS: Cycle through playlist
	 *
	 * This makes "broadcast never stops" work
	 * Even if app was closed for hours, this calculates exactly where to resume
	 */
	calculateCurrentPosition(channel) {
		if (!channel || !channel.items || channel.items.length === 0) {
			return {
				videoIndex: 0,
				offset: 0,
				debugInfo: 'No items in channel',
			}
		}

		// Ensure global epoch is initialized
		if (!this.globalEpoch) {
			this.initializeGlobalEpoch()
		}

		const channelId = channel._id
		const savedState = this.state[channelId]

		if (!savedState) {
			// No state yet - initialize it
			this.initializeChannel(channel)
			return this.calculateCurrentPosition(channel)
		}

		const now = new Date()

		// Calculate total elapsed time since GLOBAL epoch (shared by all channels)
		const totalElapsedMs = now.getTime() - this.globalEpoch.getTime()
		const totalElapsedSec = totalElapsedMs / 1000

		// Calculate video durations - use actual durations from channel items
		// IMPORTANT: Use consistent fallback (300 seconds = 5 minutes) for missing durations
		const videoDurations = channel.items.map((v) => {
			const duration = v.duration
			if (typeof duration === 'number' && duration > 0) {
				return duration
			}
			// Default to 5 minutes (300 seconds) if duration is missing or invalid
			console.warn(`[LBSM] Video ${v.youtubeId || v.title || 'unknown'} missing duration, using 300s default`)
			return 300
		})
		const totalDurationSec = videoDurations.reduce((sum, d) => sum + d, 0)
		
		if (totalDurationSec === 0) {
			console.error(`[LBSM] Channel ${channelId} has zero total duration, using default 3600s`)
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

		// CASE 1: SINGLE VIDEO - Loop it continuously
		if (channel.items.length === 1) {
			const singleVideoDuration = videoDurations[0]
			if (singleVideoDuration <= 0) {
				console.error(`[LBSM] Single video has invalid duration: ${singleVideoDuration}`)
				return {
					videoIndex: 0,
					offset: 0,
					debugInfo: 'Invalid single video duration',
				}
			}
			cyclePosition = totalElapsedSec % singleVideoDuration
			offsetInVideo = cyclePosition
			videoIndex = 0
			cycleCount = Math.floor(totalElapsedSec / singleVideoDuration)
		}
		// CASE 2: MULTIPLE VIDEOS - Cycle through playlist
		else {
			// Find cycle position in the full playlist
			cyclePosition = totalElapsedSec % totalDurationSec
			cycleCount = Math.floor(totalElapsedSec / totalDurationSec)

			// Find which video we're in using sequential time ranges
			// Each video has a time range: [accumulatedTime, accumulatedTime + videoDuration)
			let accumulatedTime = 0
			let found = false
			
			for (let i = 0; i < videoDurations.length; i++) {
				const videoDuration = videoDurations[i]
				const videoEndTime = accumulatedTime + videoDuration
				
				// Check if cyclePosition falls within this video's time range
				// Use >= for start and < for end to handle boundaries correctly
				if (cyclePosition >= accumulatedTime && cyclePosition < videoEndTime) {
					videoIndex = i
					offsetInVideo = cyclePosition - accumulatedTime
					found = true
					break
				}
				
				accumulatedTime = videoEndTime
			}
			
			// Fallback: if cyclePosition is exactly at the end (shouldn't happen due to modulo, but safety check)
			if (!found) {
				// This means cyclePosition equals totalDurationSec (exact end of playlist)
				// Wrap to first video at start
				videoIndex = 0
				offsetInVideo = 0
			}
		}

		// Validate calculated position
		if (videoIndex < 0 || videoIndex >= channel.items.length) {
			console.error(`[LBSM] Invalid videoIndex ${videoIndex} for channel with ${channel.items.length} items`)
			videoIndex = 0
			offsetInVideo = 0
		}
		
		// Ensure offset doesn't exceed video duration
		const currentVideoDuration = videoDurations[videoIndex] || 300
		if (offsetInVideo >= currentVideoDuration) {
			console.warn(`[LBSM] Offset ${offsetInVideo}s exceeds video duration ${currentVideoDuration}s, clamping`)
			offsetInVideo = Math.max(0, currentVideoDuration - 1)
		}

		const position = {
			videoIndex,
			offset: Math.max(0, Math.min(offsetInVideo, currentVideoDuration)),
			cyclePosition,
			totalDuration: totalDurationSec,
			totalElapsedSec,
			cycleCount,
			videoDurations,
			isSingleVideo: channel.items.length === 1,
		}

		// Debug logging for timeline calculation
		if (process.env.NODE_ENV === 'development') {
			console.log(`[LBSM] Position calculated for ${channel.name}:`, {
				videoIndex,
				offset: position.offset.toFixed(1),
				cyclePosition: cyclePosition.toFixed(1),
				totalElapsedSec: totalElapsedSec.toFixed(1),
				totalDuration: totalDurationSec.toFixed(1),
			})
		}

		return position
	}

	/**
	 * Calculate total playlist duration
	 * Uses consistent 300s (5 min) default for missing durations
	 */
	calculateTotalDuration(items) {
		if (!items || items.length === 0) return 3600
		return items.reduce((sum, item) => {
			const duration = item.duration
			if (typeof duration === 'number' && duration > 0) {
				return sum + duration
			}
			return sum + 300 // Consistent default: 5 minutes
		}, 0)
	}

	/**
	 * UPDATE STATE DURING PLAYBACK
	 * Called when video changes or we detect changes
	 */
	updateChannelState(channelId, updateData) {
		if (!this.state[channelId]) {
			console.warn(`[LBSM] No state for channel ${channelId}, cannot update`)
			return null
		}

		const now = new Date()
		this.state[channelId] = {
			...this.state[channelId],
			...updateData,
			lastAccessTime: now,
		}

		// Trigger listeners
		this.notifyListeners('stateUpdated', {
			channelId,
			state: this.state[channelId],
		})

		return this.state[channelId]
	}

	/**
	 * START AUTO-SAVE TO LOCALSTORAGE
	 * Periodic save of state to ensure persistence
	 */
	startAutoSave() {
		if (this.saveInterval) {
			clearInterval(this.saveInterval)
		}

		console.log(`[LBSM] Starting auto-save (every ${this.saveIntervalMs}ms)`)

		this.saveInterval = setInterval(() => {
			this.saveToStorage()
		}, this.saveIntervalMs)
	}

	/**
	 * STOP AUTO-SAVE
	 */
	stopAutoSave() {
		if (this.saveInterval) {
			clearInterval(this.saveInterval)
			this.saveInterval = null
		}
		// Final save before stopping
		this.saveToStorage()
		console.log(`[LBSM] Auto-save stopped`)
	}

	/**
	 * GET STATE
	 */
	getChannelState(channelId) {
		return this.state[channelId] || null
	}

	/**
	 * JUMP TO SPECIFIC VIDEO
	 * Adjusts the GLOBAL epoch so the timeline calculation lands on the specified video
	 * NOTE: This affects ALL channels since they share the global timeline
	 */
	jumpToVideo(channelId, targetVideoIndex, targetOffset = 0, items) {
		const state = this.state[channelId]
		if (!state || !items || items.length === 0) {
			console.warn(`[LBSM] Cannot jump - no state for channel ${channelId}`)
			return false
		}

		// Ensure global epoch exists
		if (!this.globalEpoch) {
			this.initializeGlobalEpoch()
		}

		// Calculate cumulative time up to target video
		let cumulativeTime = 0
		for (let i = 0; i < targetVideoIndex && i < items.length; i++) {
			cumulativeTime += items[i]?.duration || 30
		}
		cumulativeTime += targetOffset

		// Calculate total playlist duration
		const totalDuration = items.reduce((sum, v) => sum + (v.duration || 30), 0)
		
		// Get current cycle position
		const cyclePosition = cumulativeTime % totalDuration

		// Adjust GLOBAL epoch: now - cyclePosition = new epoch
		// WARNING: This affects ALL channels since they share the global timeline
		const now = new Date()
		this.globalEpoch = new Date(now.getTime() - (cyclePosition * 1000))

		this.state[channelId] = {
			...state,
			lastAccessTime: now,
		}

		this.saveToStorage()
		this.notifyListeners('videoJump', {
			channelId,
			videoIndex: targetVideoIndex,
			offset: targetOffset,
		})

		console.log(`[LBSM] Jumped to video ${targetVideoIndex} at ${targetOffset}s, adjusted global epoch`)
		return true
	}

	/**
	 * RESET CHANNEL STATE (start fresh timeline)
	 */
	resetChannel(channelId) {
		if (this.state[channelId]) {
			delete this.state[channelId]
			this.saveToStorage()
			console.log(`[LBSM] Reset state for channel ${channelId}`)
		}
	}

	/**
	 * SUBSCRIBE TO CHANGES
	 */
	subscribe(callback) {
		this.listeners.push(callback)
		return () => {
			this.listeners = this.listeners.filter((l) => l !== callback)
		}
	}

	/**
	 * NOTIFY LISTENERS
	 */
	notifyListeners(event, data) {
		this.listeners.forEach((callback) => {
			try {
				callback({ event, data, timestamp: new Date() })
			} catch (err) {
				console.error(`[LBSM] Listener error:`, err)
			}
		})
	}

	/**
	 * GET GLOBAL EPOCH
	 */
	getGlobalEpoch() {
		if (!this.globalEpoch) {
			this.initializeGlobalEpoch()
		}
		return this.globalEpoch
	}

	/**
	 * RESET GLOBAL EPOCH (start fresh timeline for all channels)
	 */
	resetGlobalEpoch() {
		this.globalEpoch = new Date()
		this.saveToStorage()
		console.log('[LBSM] Global epoch reset to:', this.globalEpoch.toISOString())
	}

	/**
	 * CLEAR ALL STATE
	 */
	clearAll() {
		this.state = {}
		this.globalEpoch = null
		localStorage.removeItem(this.storageKey)
		localStorage.removeItem(this.globalEpochKey)
		this.stopAutoSave()
		this.listeners = []
		console.log('[LBSM] All state cleared (including global epoch)')
	}
}

// Export singleton instance
export default new LocalBroadcastStateManager()

