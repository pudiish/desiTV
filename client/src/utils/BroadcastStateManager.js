/**
 * BroadcastStateManager.js
 * Manages virtual live broadcast state that persists across sessions
 * Simulates a TV channel that never stops, even when the app is closed
 */

class BroadcastStateManager {
	constructor() {
		this.state = {
			channels: {}, // { channelId: { currentVideoIndex, currentTime, lastUpdate, playlistStartEpoch } }
			sessionStart: null,
			lastSync: null,
		}
		this.storageKey = 'retro_tv_broadcast_state'
		this.syncInterval = null
		this.syncIntervalMs = 5000 // Sync to DB every 5 seconds
		this.listeners = []
	}

	/**
	 * Initialize broadcast state for a channel
	 * Called when channel is first loaded
	 */
	initializeChannel(channel) {
		if (!channel || !channel._id) return null

		const channelId = channel._id
		const now = new Date()

		// If channel state doesn't exist, create it
		if (!this.state.channels[channelId]) {
			this.state.channels[channelId] = {
				channelId,
				channelName: channel.name,
				currentVideoIndex: 0,
				currentTime: 0, // Current playback time in video
				playlistStartEpoch: channel.playlistStartEpoch || now,
				sessionStartTime: now, // When user tuned into this channel
				lastUpdate: now,
				playbackRate: 1.0, // Normal playback
			}
		}

		return this.state.channels[channelId]
	}

	/**
	 * Get the correct video and playback position based on elapsed time
	 * This is the heart of the pseudo-live system
	 */
	calculateCurrentPosition(channel, uiLoadTime) {
		if (!channel || !channel.items || channel.items.length === 0) {
			return { videoIndex: 0, offset: 0, cyclePosition: 0 }
		}

		const playlistStartEpoch = new Date(channel.playlistStartEpoch || uiLoadTime)
		const now = new Date(uiLoadTime)
		const elapsedMs = now.getTime() - playlistStartEpoch.getTime()

		// Calculate total duration of all videos
		let totalDurationMs = 0
		const videoDurations = []

		channel.items.forEach((video) => {
			// Estimate duration: YouTube videos average 4-10 minutes, use 5 as default
			const durationSec = video.duration || 300
			const durationMs = durationSec * 1000
			videoDurations.push(durationMs)
			totalDurationMs += durationMs
		})

		// Handle edge case: no videos
		if (totalDurationMs === 0) {
			totalDurationMs = 300000 // Default 5 minutes
			videoDurations.forEach((_, i) => {
				videoDurations[i] = 300000
			})
		}

		// Find current position in broadcast timeline
		// Timeline is cyclic - after all videos play, loop back to start
		const cyclePosition = elapsedMs % totalDurationMs
		let currentPosition = 0
		let videoIndex = 0

		for (let i = 0; i < videoDurations.length; i++) {
			if (currentPosition + videoDurations[i] > cyclePosition) {
				videoIndex = i
				break
			}
			currentPosition += videoDurations[i]
		}

		// Calculate offset (how far into this video we are)
		const offset = (cyclePosition - currentPosition) / 1000 // Convert to seconds

		return {
			videoIndex,
			offset: Math.max(0, offset),
			cyclePosition: elapsedMs,
			totalDuration: totalDurationMs,
			elapsedMs,
			videoDurations,
		}
	}

	/**
	 * Update channel state during playback
	 * Call this periodically to keep state current
	 */
	updateChannelState(channelId, updateData) {
		if (!this.state.channels[channelId]) {
			return null
		}

		const now = new Date()
		this.state.channels[channelId] = {
			...this.state.channels[channelId],
			...updateData,
			lastUpdate: now,
		}

		this.notifyListeners('stateUpdated', {
			channelId,
			state: this.state.channels[channelId],
		})

		return this.state.channels[channelId]
	}

	/**
	 * Get channel state
	 */
	getChannelState(channelId) {
		return this.state.channels[channelId] || null
	}

	/**
	 * Get all channel states
	 */
	getAllStates() {
		return this.state.channels
	}

	/**
	 * Handle channel change - reset tracking for new channel
	 */
	onChannelChange(fromChannelId, toChannelId) {
		if (fromChannelId) {
			// Save state of previous channel
			const prevState = this.state.channels[fromChannelId]
			if (prevState) {
				this.saveToDB(fromChannelId, prevState)
			}
		}

		// Initialize new channel if needed
		return this.initializeChannel({ _id: toChannelId })
	}

	/**
	 * Prepare state for save to database
	 */
	prepareForDB(channelId) {
		const channelState = this.state.channels[channelId]
		if (!channelState) return null

		return {
			channelId,
			channelName: channelState.channelName,
			currentVideoIndex: channelState.currentVideoIndex,
			currentTime: channelState.currentTime,
			playlistStartEpoch: channelState.playlistStartEpoch,
			sessionStartTime: channelState.sessionStartTime,
			lastUpdate: channelState.lastUpdate,
			playbackRate: channelState.playbackRate,
			// Calculate virtual position as of now
			virtualElapsedTime: this.calculateElapsedTime(channelState),
		}
	}

	/**
	 * Calculate how much time has elapsed since session start
	 */
	calculateElapsedTime(channelState) {
		if (!channelState || !channelState.sessionStartTime) return 0

		const now = new Date()
		const startTime = new Date(channelState.sessionStartTime)
		const elapsedMs = now.getTime() - startTime.getTime()

		return Math.max(0, elapsedMs / 1000) // Return in seconds
	}

	/**
	 * Start periodic sync to database
	 */
	startAutoSync(onSync) {
		if (this.syncInterval) {
			clearInterval(this.syncInterval)
		}

		this.syncInterval = setInterval(() => {
			// Sync all active channels
			Object.keys(this.state.channels).forEach((channelId) => {
				const stateForDB = this.prepareForDB(channelId)
				if (stateForDB && onSync) {
					onSync(channelId, stateForDB)
				}
			})

			this.state.lastSync = new Date()
			this.notifyListeners('synced', { timestamp: this.state.lastSync })
		}, this.syncIntervalMs)
	}

	/**
	 * Stop auto sync
	 */
	stopAutoSync() {
		if (this.syncInterval) {
			clearInterval(this.syncInterval)
			this.syncInterval = null
		}
	}

	/**
	 * Handle manual sync (immediate save to DB)
	 */
	async saveToDB(channelId, stateData = null) {
		try {
			const dataToSave = stateData || this.prepareForDB(channelId)

			if (!dataToSave) {
				console.warn('[BroadcastStateManager] No data to save for channel:', channelId)
				return false
			}

			// Make API call to save state
			const response = await fetch(`/api/channels/${channelId}/broadcast-state`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(dataToSave),
			})

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`)
			}

			const result = await response.json()
			this.notifyListeners('savedToDB', { channelId, result })

			return true
		} catch (err) {
			console.error('[BroadcastStateManager] Error saving to DB:', err)
			this.notifyListeners('dbSaveError', { channelId, error: err.message })
			return false
		}
	}

	/**
	 * Load state from database
	 */
	async loadFromDB(channelId) {
		try {
			const response = await fetch(`/api/channels/${channelId}/broadcast-state`)

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`)
			}

			const stateData = await response.json()

			// Restore state
			this.state.channels[channelId] = {
				...stateData,
				playlistStartEpoch: new Date(stateData.playlistStartEpoch),
				sessionStartTime: new Date(stateData.sessionStartTime),
				lastUpdate: new Date(stateData.lastUpdate),
			}

			this.notifyListeners('loadedFromDB', { channelId, state: this.state.channels[channelId] })

			return this.state.channels[channelId]
		} catch (err) {
			console.warn('[BroadcastStateManager] Could not load from DB, using defaults:', err)
			return null
		}
	}

	/**
	 * Subscribe to state changes
	 */
	subscribe(callback) {
		this.listeners.push(callback)
		return () => {
			this.listeners = this.listeners.filter((l) => l !== callback)
		}
	}

	/**
	 * Notify all listeners of state changes
	 */
	notifyListeners(event, data) {
		this.listeners.forEach((callback) => {
			try {
				callback({ event, data, timestamp: new Date() })
			} catch (err) {
				console.error('[BroadcastStateManager] Listener error:', err)
			}
		})
	}

	/**
	 * Clear all state
	 */
	clearAll() {
		this.state.channels = {}
		this.state.lastSync = null
		this.stopAutoSync()
		this.listeners = []
	}

	/**
	 * Get diagnostic info
	 */
	getDiagnostics() {
		return {
			channelCount: Object.keys(this.state.channels).length,
			channels: Object.keys(this.state.channels).map((channelId) => ({
				channelId,
				...this.state.channels[channelId],
				elapsedTime: this.calculateElapsedTime(this.state.channels[channelId]),
			})),
			lastSync: this.state.lastSync,
			syncIntervalMs: this.syncIntervalMs,
			isSyncing: !!this.syncInterval,
		}
	}
}

export default new BroadcastStateManager()
