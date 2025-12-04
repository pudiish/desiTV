/**
 * SessionManager.js - Client-side session caching and state recovery
 * 
 * Features:
 * - Automatic session persistence to MongoDB
 * - State recovery on page refresh/crash
 * - Timeline continuity maintenance
 * - Debounced saves to prevent API spam
 * - Offline queue for network failures
 */

class SessionManager {
	constructor() {
		this.sessionId = this.getOrCreateSessionId()
		this.state = null
		this.saveTimeout = null
		this.saveIntervalMs = 3000 // Save every 3 seconds
		this.isInitialized = false
		this.offlineQueue = []
		this.listeners = []
		this.lastSaveTime = 0
		this.minSaveInterval = 1000 // Minimum 1 second between saves
	}

	/**
	 * Generate or retrieve session ID
	 * Uses localStorage for persistence across page loads
	 */
	getOrCreateSessionId() {
		let sessionId = localStorage.getItem('retro-tv-session-id')
		
		if (!sessionId) {
			// Generate a unique session ID
			sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
			localStorage.setItem('retro-tv-session-id', sessionId)
			console.log('[SessionManager] Created new session:', sessionId)
		} else {
			console.log('[SessionManager] Restored session:', sessionId)
		}
		
		return sessionId
	}

	/**
	 * Initialize session - load from server or create new
	 */
	async initialize() {
		try {
			console.log('[SessionManager] Initializing session...')
			
			const response = await fetch(`/api/session/${this.sessionId}`)
			
			if (response.ok) {
				const data = await response.json()
				this.state = data.session
				this.isInitialized = true
				console.log('[SessionManager] Session restored from server:', {
					channelId: this.state?.activeChannelId,
					volume: this.state?.volume,
					isPowerOn: this.state?.isPowerOn,
				})
				
				this.notifyListeners('restored', this.state)
				return { restored: true, state: this.state, broadcastState: data.broadcastState }
			}
			
			// No existing session - start fresh
			this.state = this.getDefaultState()
			this.isInitialized = true
			console.log('[SessionManager] Starting fresh session')
			
			return { restored: false, state: this.state, broadcastState: null }
		} catch (err) {
			console.error('[SessionManager] Init error:', err)
			
			// Try to recover from localStorage cache
			const cachedState = this.getLocalCache()
			if (cachedState) {
				this.state = cachedState
				console.log('[SessionManager] Recovered from local cache')
				return { restored: true, state: this.state, broadcastState: null, fromCache: true }
			}
			
			this.state = this.getDefaultState()
			this.isInitialized = true
			return { restored: false, state: this.state, broadcastState: null }
		}
	}

	/**
	 * Get default session state
	 */
	getDefaultState() {
		return {
			activeChannelId: null,
			activeChannelIndex: 0,
			volume: 0.5,
			isPowerOn: false,
			selectedChannels: [],
			currentVideoIndex: 0,
			currentPlaybackPosition: 0,
			timeline: {},
		}
	}

	/**
	 * Update session state - debounced save to server
	 */
	updateState(updates) {
		if (!this.isInitialized) {
			console.warn('[SessionManager] Not initialized, queuing update')
			this.offlineQueue.push(updates)
			return
		}

		// Merge updates
		this.state = {
			...this.state,
			...updates,
		}

		// Save to local cache immediately
		this.saveLocalCache()

		// Debounced save to server
		this.scheduleSave()

		this.notifyListeners('updated', this.state)
	}

	/**
	 * Schedule a debounced save to server
	 */
	scheduleSave() {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout)
		}

		const timeSinceLastSave = Date.now() - this.lastSaveTime
		const delay = Math.max(this.minSaveInterval - timeSinceLastSave, 0)

		this.saveTimeout = setTimeout(() => {
			this.saveToServer()
		}, delay + 500) // Add 500ms debounce
	}

	/**
	 * Save state to server
	 */
	async saveToServer() {
		if (!this.state) return false

		try {
			const response = await fetch(`/api/session/${this.sessionId}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...this.state,
					deviceInfo: {
						userAgent: navigator.userAgent,
						screenWidth: window.screen.width,
						screenHeight: window.screen.height,
					},
				}),
			})

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}`)
			}

			this.lastSaveTime = Date.now()
			console.log('[SessionManager] State saved to server')
			this.notifyListeners('saved', this.state)
			return true
		} catch (err) {
			console.error('[SessionManager] Save error:', err)
			// Queue for retry
			this.offlineQueue.push({ ...this.state })
			this.notifyListeners('saveError', err)
			return false
		}
	}

	/**
	 * Force immediate save (use on page unload)
	 */
	async forceSave() {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout)
		}
		
		// Use sendBeacon for reliable delivery on page unload
		try {
			const data = JSON.stringify({
				...this.state,
				deviceInfo: {
					userAgent: navigator.userAgent,
					screenWidth: window.screen.width,
					screenHeight: window.screen.height,
				},
			})
			
			navigator.sendBeacon(`/api/session/${this.sessionId}`, new Blob([data], { type: 'application/json' }))
			console.log('[SessionManager] State saved via sendBeacon')
			return true
		} catch (err) {
			console.error('[SessionManager] Force save error:', err)
			return false
		}
	}

	/**
	 * Attempt recovery from server
	 */
	async attemptRecovery(reason = 'unknown') {
		try {
			const response = await fetch(`/api/session/${this.sessionId}/recovery`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reason }),
			})

			if (response.ok) {
				const data = await response.json()
				if (data.lastStableState) {
					this.state = data.lastStableState
					console.log('[SessionManager] Recovered from server:', data.recoveryAttempts, 'attempts')
					this.notifyListeners('recovered', this.state)
					return { success: true, state: this.state }
				}
			}

			return { success: false, state: null }
		} catch (err) {
			console.error('[SessionManager] Recovery error:', err)
			return { success: false, error: err.message }
		}
	}

	/**
	 * Local cache management
	 */
	saveLocalCache() {
		try {
			localStorage.setItem('retro-tv-session-cache', JSON.stringify({
				state: this.state,
				timestamp: Date.now(),
			}))
		} catch (err) {
			console.warn('[SessionManager] Local cache save error:', err)
		}
	}

	getLocalCache() {
		try {
			const cached = localStorage.getItem('retro-tv-session-cache')
			if (cached) {
				const { state, timestamp } = JSON.parse(cached)
				// Only use cache if less than 1 hour old
				if (Date.now() - timestamp < 60 * 60 * 1000) {
					return state
				}
			}
		} catch (err) {
			console.warn('[SessionManager] Local cache read error:', err)
		}
		return null
	}

	clearLocalCache() {
		localStorage.removeItem('retro-tv-session-cache')
	}

	/**
	 * Get current session state
	 */
	getState() {
		return this.state
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
	 * Notify listeners
	 */
	notifyListeners(event, data) {
		this.listeners.forEach((callback) => {
			try {
				callback({ event, data, timestamp: new Date() })
			} catch (err) {
				console.error('[SessionManager] Listener error:', err)
			}
		})
	}

	/**
	 * Process offline queue
	 */
	async processOfflineQueue() {
		while (this.offlineQueue.length > 0) {
			const update = this.offlineQueue.shift()
			this.state = { ...this.state, ...update }
		}
		await this.saveToServer()
	}

	/**
	 * Cleanup on destroy
	 */
	destroy() {
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout)
		}
		this.listeners = []
	}
}

// Export singleton instance
export default new SessionManager()
