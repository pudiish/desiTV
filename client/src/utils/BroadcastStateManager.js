/**
 * BroadcastStateManager.js - SOLID ALGORITHM FOR PERSISTENT BROADCAST STATE
 * 
 * Core Principle: "THE BROADCAST NEVER STOPS"
 * 
 * Algorithm:
 * =========
 * 1. TIMELINE EPOCH: When broadcast started (stored in DB, never changes)
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
 * Error Handling:
 * - Network gaps: Stored times are used for calculation
 * - DB outages: Fall back to calculation from channel epoch
 * - Rapid reloads: Debounced saves to DB (500ms intervals)
 * - Missing data: Sensible defaults (300 sec per video)
 */

class BroadcastStateManager {
	constructor() {
		this.state = {} // { channelId: state }
		this.syncInterval = null
		this.syncIntervalMs = 5000 // Sync to DB every 5 seconds
		this.listeners = []
		this.isSyncing = false
		this.pendingSaves = {} // Track pending saves per channel
		this.lastCalculatedPosition = {} // Cache last calculated positions
	}

	/**
	 * PRE-LOAD STATE BEFORE PLAYER STARTS
	 * This is critical - must happen BEFORE any playback
	 */
	async preloadStateForChannel(channelId) {
		try {
			console.log(`[BSM] Pre-loading state for channel: ${channelId}`)

			// Fetch saved state from MongoDB - using new route path
			const response = await fetch(`/api/broadcast-state/${channelId}`)

			if (response.ok) {
				const savedState = await response.json()
				console.log(`[BSM] Pre-loaded state from DB:`, {
					videoIndex: savedState.videoIndex,
					currentTime: savedState.currentTime?.toFixed(1),
					cyclePosition: savedState.cyclePosition?.toFixed(1),
				})
				return savedState
			}

			console.log(`[BSM] No saved state in DB (first time or cleared)`)
			return null
		} catch (err) {
			console.error(`[BSM] Error pre-loading state:`, err)
			return null
		}
	}

	/**
	 * INITIALIZE CHANNEL STATE
	 * Sets up state for a channel - either from DB or fresh
	 */
	async initializeChannel(channel, preloadedState = null) {
		if (!channel || !channel._id) return null

		const channelId = channel._id
		const now = new Date()

		if (preloadedState) {
			// Use preloaded state from DB
			this.state[channelId] = preloadedState
			console.log(`[BSM] Channel ${channelId} initialized from DB state`)
		} else {
			// Create fresh state
			this.state[channelId] = {
				channelId,
				channelName: channel.name,
				playlistStartEpoch: new Date(
					channel.playlistStartEpoch || now.toISOString()
				),
				currentVideoIndex: 0,
				currentTime: 0,
				lastSessionEndTime: now,
				playlistTotalDuration: this.calculateTotalDuration(channel.items),
				videoDurations: channel.items.map((v) => v.duration || 300),
				playbackRate: 1.0,
				virtualElapsedTime: 0,
			}
			console.log(`[BSM] Channel ${channelId} initialized as new`)
		}

		return this.state[channelId]
	}

	/**
	 * CORE ALGORITHM: Calculate current position in broadcast timeline
	 * 
	 * Handles TWO cases:
	 * 1. SINGLE VIDEO: Loop the same video continuously
	 *    - Entire timeline is just looping one video
	 *    - Calculate offset by: totalElapsed % videoDuration
	 * 
	 * 2. MULTIPLE VIDEOS: Cycle through playlist
	 *    - Timeline cycles through all videos in sequence
	 *    - Calculate offset by: totalElapsed % totalPlaylistDuration
	 *
	 * This is the "magic" that makes "broadcast never stops" work
	 * Even if app was closed for hours, this calculates exactly where to resume
	 */
	calculateCurrentPosition(channel, savedState = null) {
		if (!channel || !channel.items || channel.items.length === 0) {
			return {
				videoIndex: 0,
				offset: 0,
				debugInfo: 'No items in channel',
			}
		}

		const now = new Date()

		// Step 1: Determine broadcast epoch
		// This is the absolute start time of the broadcast timeline
		const playlistStartEpoch = savedState?.playlistStartEpoch
			? new Date(savedState.playlistStartEpoch)
			: new Date(channel.playlistStartEpoch)

		console.log(`[BSM] Calculating position for ${channel.items.length} video(s):`, {
			now: now.toISOString(),
			epoch: playlistStartEpoch.toISOString(),
		})

		// Step 2: Calculate total elapsed time since broadcast epoch
		// CRUCIAL: This is in absolute terms, not relative to last session
		const totalElapsedMs = now.getTime() - playlistStartEpoch.getTime()
		const totalElapsedSec = totalElapsedMs / 1000

		console.log(
			`[BSM] Total elapsed: ${totalElapsedSec.toFixed(1)}s (${(totalElapsedMs / 1000 / 60 / 60).toFixed(1)}h)`
		)

		// Step 3: Calculate video durations
		const videoDurations = channel.items.map((v) => v.duration || 300)
		const totalDurationSec = videoDurations.reduce((sum, d) => sum + d, 0) || 3600

		let videoIndex = 0
		let offsetInVideo = 0
		let cyclePosition = 0
		let cycleCount = 0

		// ========================================
		// CASE 1: SINGLE VIDEO - Loop it continuously
		// ========================================
		if (channel.items.length === 1) {
			const singleVideoDuration = videoDurations[0]

			// Position is just looping within this one video
			cyclePosition = totalElapsedSec % singleVideoDuration
			offsetInVideo = cyclePosition
			videoIndex = 0
			cycleCount = Math.floor(totalElapsedSec / singleVideoDuration)

			console.log(`[BSM] SINGLE VIDEO MODE:`, {
				videoDuration: singleVideoDuration.toFixed(1),
				offset: offsetInVideo.toFixed(1),
				loopCount: cycleCount,
			})
		}
		// ========================================
		// CASE 2: MULTIPLE VIDEOS - Cycle through playlist
		// ========================================
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

			console.log(`[BSM] MULTI-VIDEO MODE:`, {
				totalPlaylistDuration: totalDurationSec.toFixed(1),
				cyclePosition: cyclePosition.toFixed(1),
				videoIndex,
				offsetInVideo: offsetInVideo.toFixed(1),
				cycleCount,
			})
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

		console.log(`[BSM] Final position:`, {
			videoIndex: position.videoIndex,
			offset: position.offset.toFixed(1),
			totalElapsed: position.totalElapsedSec.toFixed(1),
		})

		this.lastCalculatedPosition[channel._id] = position
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
			this.state[channelId] = updateData
			return updateData
		}

		const now = new Date()
		this.state[channelId] = {
			...this.state[channelId],
			...updateData,
			lastSessionEndTime: now,
		}

		// Trigger listeners
		this.notifyListeners('stateUpdated', {
			channelId,
			state: this.state[channelId],
		})

		// Queue save to DB (debounced)
		this.queueSaveToDb(channelId)

		return this.state[channelId]
	}

	/**
	 * QUEUE SAVE TO DB (Debounced)
	 * Prevents excessive database writes
	 */
	queueSaveToDb(channelId) {
		if (this.pendingSaves[channelId]) {
			clearTimeout(this.pendingSaves[channelId])
		}

		this.pendingSaves[channelId] = setTimeout(() => {
			this.saveToDB(channelId)
			delete this.pendingSaves[channelId]
		}, 500) // Wait 500ms before saving
	}

	/**
	 * START AUTO-SYNC TO DATABASE
	 * Periodic save of state to ensure persistence
	 */
	startAutoSync(onSync) {
		if (this.syncInterval) {
			clearInterval(this.syncInterval)
		}

		console.log(`[BSM] Starting auto-sync (every ${this.syncIntervalMs}ms)`)

		this.syncInterval = setInterval(async () => {
			// Sync all active channels
			for (const channelId of Object.keys(this.state)) {
				try {
					const stateToSave = this.state[channelId]

					if (stateToSave) {
						await this.saveToDB(channelId, stateToSave)

						if (onSync) {
							onSync(channelId, stateToSave)
						}
					}
				} catch (err) {
					console.error(`[BSM] Error in auto-sync for ${channelId}:`, err)
				}
			}
		}, this.syncIntervalMs)
	}

	/**
	 * STOP AUTO-SYNC
	 * Called on component unmount
	 */
	stopAutoSync() {
		if (this.syncInterval) {
			clearInterval(this.syncInterval)
			this.syncInterval = null
		}
		console.log(`[BSM] Auto-sync stopped`)
	}

	/**
	 * SAVE STATE TO DATABASE
	 * Persists current state to MongoDB
	 */
	async saveToDB(channelId, stateData = null) {
		try {
			const dataToSave = stateData || this.state[channelId]

			if (!dataToSave) {
				return false
			}

			const response = await fetch(`/api/broadcast-state/${channelId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(dataToSave),
			})

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`)
			}

			const result = await response.json()
			console.log(`[BSM] State saved to DB for ${channelId}`)

			this.notifyListeners('savedToDB', { channelId, result })
			return true
		} catch (err) {
			console.error(`[BSM] Error saving to DB:`, err)
			this.notifyListeners('dbSaveError', { channelId, error: err.message })
			return false
		}
	}

	/**
	 * GET STATE
	 */
	getChannelState(channelId) {
		return this.state[channelId] || null
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
				console.error(`[BSM] Listener error:`, err)
			}
		})
	}

	/**
	 * GET DIAGNOSTICS
	 */
	getDiagnostics() {
		return {
			channels: Object.keys(this.state).map((cid) => ({
				channelId: cid,
				...this.state[cid],
			})),
			isSyncing: !!this.syncInterval,
			pendingSaves: Object.keys(this.pendingSaves),
		}
	}

	/**
	 * CLEAR ALL STATE
	 */
	clearAll() {
		this.state = {}
		this.stopAutoSync()
		this.listeners = []
	}
}

export default new BroadcastStateManager()
