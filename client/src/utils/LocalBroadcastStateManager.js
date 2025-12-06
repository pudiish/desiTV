/**
 * LocalBroadcastStateManager.js - LOCALSTORAGE-BASED BROADCAST STATE
 * 
 * Serverless version - no MongoDB dependency
 * 
 * Core Principle: "THE BROADCAST NEVER STOPS"
 * 
 * Algorithm:
 * =========
 * 1. TIMELINE EPOCH: When user first starts watching a channel (stored in localStorage)
 * 2. VIRTUAL ELAPSED TIME: Total seconds elapsed since epoch to NOW
 *    - Accounts for app being closed, reloaded, or crashed
 *    - Calculated from: now - playlistStartEpoch
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
 * - Each channel has its own state
 * - Auto-saves every 5 seconds
 */

class LocalBroadcastStateManager {
	constructor() {
		this.state = {} // { channelId: state }
		this.listeners = []
		this.saveInterval = null
		this.saveIntervalMs = 5000 // Save every 5 seconds
		this.storageKey = 'desitv-broadcast-state'
	}

	/**
	 * Load state from localStorage
	 */
	loadFromStorage() {
		try {
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
			localStorage.setItem(this.storageKey, JSON.stringify(this.state))
			return true
		} catch (err) {
			console.error('[LBSM] Error saving to storage:', err)
			// If storage is full, try to clean up old states
			if (err.name === 'QuotaExceededError') {
				this.cleanupOldStates()
				try {
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
	 * INITIALIZE CHANNEL STATE
	 * Sets up state for a channel - either from localStorage or fresh
	 */
	initializeChannel(channel) {
		if (!channel || !channel._id) return null

		// Load from storage first
		if (Object.keys(this.state).length === 0) {
			this.loadFromStorage()
		}

		const channelId = channel._id
		const now = new Date()

		// Check if we have saved state for this channel
		const savedState = this.state[channelId]

		if (savedState && savedState.playlistStartEpoch) {
			// Use saved state
			this.state[channelId] = {
				...savedState,
				lastAccessTime: now,
			}
			console.log(`[LBSM] Channel ${channelId} initialized from localStorage`)
		} else {
			// Create fresh state - this is when user first watches this channel
			this.state[channelId] = {
				channelId,
				channelName: channel.name,
				playlistStartEpoch: now.toISOString(), // Start timeline NOW
				currentVideoIndex: 0,
				currentTime: 0,
				lastAccessTime: now,
				playlistTotalDuration: this.calculateTotalDuration(channel.items),
				videoDurations: channel.items.map((v) => v.duration || 300),
				playbackRate: 1.0,
			}
			console.log(`[LBSM] Channel ${channelId} initialized as new (timeline starts now)`)
			this.saveToStorage()
		}

		return this.state[channelId]
	}

	/**
	 * CORE ALGORITHM: Calculate current position in broadcast timeline
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

		const channelId = channel._id
		const savedState = this.state[channelId]

		if (!savedState || !savedState.playlistStartEpoch) {
			// No state yet - initialize it
			this.initializeChannel(channel)
			return this.calculateCurrentPosition(channel)
		}

		const now = new Date()
		const playlistStartEpoch = new Date(savedState.playlistStartEpoch)

		// Calculate total elapsed time since broadcast started
		const totalElapsedMs = now.getTime() - playlistStartEpoch.getTime()
		const totalElapsedSec = totalElapsedMs / 1000

		// Calculate video durations
		const videoDurations = channel.items.map((v) => v.duration || 300)
		const totalDurationSec = videoDurations.reduce((sum, d) => sum + d, 0) || 3600

		let videoIndex = 0
		let offsetInVideo = 0
		let cyclePosition = 0
		let cycleCount = 0

		// CASE 1: SINGLE VIDEO - Loop it continuously
		if (channel.items.length === 1) {
			const singleVideoDuration = videoDurations[0]
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

			// Find which video we're in
			let accumulatedTime = 0
			for (let i = 0; i < videoDurations.length; i++) {
				const videoDuration = videoDurations[i]
				if (accumulatedTime + videoDuration > cyclePosition) {
					videoIndex = i
					offsetInVideo = cyclePosition - accumulatedTime
					break
				}
				accumulatedTime += videoDuration
			}
		}

		const position = {
			videoIndex,
			offset: Math.max(0, offsetInVideo),
			cyclePosition,
			totalDuration: totalDurationSec,
			totalElapsedSec,
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
		if (!items || items.length === 0) return 3600
		return items.reduce((sum, item) => sum + (item.duration || 300), 0)
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
	 * CLEAR ALL STATE
	 */
	clearAll() {
		this.state = {}
		localStorage.removeItem(this.storageKey)
		this.stopAutoSave()
		this.listeners = []
		console.log('[LBSM] All state cleared')
	}
}

// Export singleton instance
export default new LocalBroadcastStateManager()

