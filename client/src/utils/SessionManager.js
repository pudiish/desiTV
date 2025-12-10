/**
 * SessionManager.js - LOCALSTORAGE-BASED SESSION MANAGEMENT
 * 
 * Serverless version - no MongoDB dependency
 * 
 * Features:
 * - Automatic session persistence to localStorage
 * - State recovery on page refresh/crash
 * - Simple, reliable, works offline
 */

class SessionManager {
	constructor() {
		this.sessionId = this.getOrCreateSessionId()
		this.state = null
		this.isInitialized = false
		this.listeners = []
		this.storageKey = 'desitv-session-state'
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
	 * Initialize session - load from localStorage or create new
	 */
	async initialize() {
		try {
			console.log('[SessionManager] Initializing session...')
			
			// Load from localStorage
			const cachedState = this.getLocalCache()
			if (cachedState) {
				this.state = cachedState
				this.isInitialized = true
				console.log('[SessionManager] Session restored from localStorage:', {
					channelId: this.state?.activeChannelId,
					volume: this.state?.volume,
					isPowerOn: this.state?.isPowerOn,
				})
				
				this.notifyListeners('restored', this.state)
				return { restored: true, state: this.state }
			}
			
			// No existing session - start fresh
			this.state = this.getDefaultState()
			this.isInitialized = true
			console.log('[SessionManager] Starting fresh session')
			
			return { restored: false, state: this.state }
		} catch (err) {
			console.error('[SessionManager] Init error:', err)
			
			// Fallback to default state
			this.state = this.getDefaultState()
			this.isInitialized = true
			return { restored: false, state: this.state }
		}
	}

	/**
	 * Get default session state
	 */
	getDefaultState() {
		return {
			activeCategoryId: null,
			activeCategoryName: null,
			activeVideoIndex: 0,
			volume: 0.5,
			isPowerOn: false,
			// NOTE: Do NOT persist currentVideoIndex or currentPlaybackPosition
			// Video playback is determined by the pseudo-live timeline, not saved state
			// When user returns, the timeline calculates which video should play based on time
			timeline: {},
		}
	}

	/**
	 * Update session state - save to localStorage immediately
	 */
	updateState(updates) {
		if (!this.isInitialized) {
			console.warn('[SessionManager] Not initialized, initializing now')
			this.state = this.getDefaultState()
			this.isInitialized = true
		}

		// Merge updates
		this.state = {
			...this.state,
			...updates,
		}

		// Save to localStorage immediately
		this.saveLocalCache()

		this.notifyListeners('updated', this.state)
	}

	/**
	 * Force immediate save (use on page unload)
	 */
	async forceSave() {
		this.saveLocalCache()
		return true
	}

	/**
	 * Local storage management
	 */
	saveLocalCache() {
		try {
			localStorage.setItem(this.storageKey, JSON.stringify({
				state: this.state,
				timestamp: Date.now(),
			}))
		} catch (err) {
			console.warn('[SessionManager] Local storage save error:', err)
			// If storage is full, try to clear old data
			if (err.name === 'QuotaExceededError') {
				console.warn('[SessionManager] Storage full, clearing old data')
				this.clearLocalCache()
				try {
					localStorage.setItem(this.storageKey, JSON.stringify({
						state: this.state,
						timestamp: Date.now(),
					}))
				} catch (retryErr) {
					console.error('[SessionManager] Retry save failed:', retryErr)
				}
			}
		}
	}

	getLocalCache() {
		try {
			const cached = localStorage.getItem(this.storageKey)
			if (cached) {
				const { state, timestamp } = JSON.parse(cached)
				// Use cache regardless of age (user's session)
				return state
			}
		} catch (err) {
			console.warn('[SessionManager] Local storage read error:', err)
		}
		return null
	}

	clearLocalCache() {
		localStorage.removeItem(this.storageKey)
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
	 * Cleanup on destroy
	 */
	destroy() {
		this.listeners = []
	}
}

// Export singleton instance
export default new SessionManager()
