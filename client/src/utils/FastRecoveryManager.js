/**
 * FastRecoveryManager.js
 * Unified, fast recovery mechanism for playback glitches
 * Detects and recovers from pause/unstarted states in < 500ms
 * Prevents race conditions and multiple recovery attempts
 */

class FastRecoveryManager {
	constructor() {
		this.playerRef = null
		this.isActive = false
		this.recoveryInProgress = false
		this.lastState = null
		this.lastStateTime = null
		this.recoveryAttempts = 0
		this.maxRecoveryAttempts = 3
		this.checkInterval = 500 // Check every 500ms for fast detection
		this.intervalId = null
		this.shouldPlayCallback = null
		this.onRecoveryCallback = null
		this.debounceTimeout = null
		this.lastRecoveryTime = 0
		this.minRecoveryInterval = 1000 // Minimum 1 second between recoveries
	}

	start(playerRef, options = {}) {
		if (this.isActive) {
			this.stop()
		}

		this.playerRef = playerRef
		this.shouldPlayCallback = options.shouldPlay || (() => true)
		this.onRecoveryCallback = options.onRecovery || (() => {})
		this.isActive = true
		this.recoveryAttempts = 0
		this.lastState = null
		this.lastStateTime = null

		console.log('[FastRecovery] Started with 500ms check interval')

		// Start fast monitoring
		this.intervalId = setInterval(() => {
			this.check()
		}, this.checkInterval)
	}

	stop() {
		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
		}
		if (this.debounceTimeout) {
			clearTimeout(this.debounceTimeout)
			this.debounceTimeout = null
		}
		this.isActive = false
		this.recoveryInProgress = false
		this.playerRef = null
		this.shouldPlayCallback = null
		this.onRecoveryCallback = null
		console.log('[FastRecovery] Stopped')
	}

	reset() {
		this.recoveryAttempts = 0
		this.recoveryInProgress = false
		this.lastState = null
		this.lastStateTime = null
	}

	// Fast check - runs every 500ms
	check() {
		if (!this.isActive || !this.playerRef?.current || this.recoveryInProgress) {
			return
		}

		const player = this.playerRef.current

		try {
			// Check if we should be playing
			if (!this.shouldPlayCallback()) {
				return
			}

			// Get current state
			const state = player.getPlayerState?.()
			const now = Date.now()

			// Track state changes
			if (state !== this.lastState) {
				this.lastState = state
				this.lastStateTime = now
				
				// Reset recovery attempts on state change
				if (state === 1) { // PLAYING
					this.recoveryAttempts = 0
					this.recoveryInProgress = false
					return
				}
			}

			// Fast recovery logic
			// If paused/unstarted and we should be playing, recover quickly
			if ((state === 2 || state === -1) && this.shouldPlayCallback()) {
				const timeSinceStateChange = this.lastStateTime ? now - this.lastStateTime : Infinity
				
				// Recover if:
				// 1. State has been paused/unstarted for > 300ms (fast detection)
				// 2. Enough time has passed since last recovery (debounce)
				// 3. Not already recovering
				if (timeSinceStateChange > 300 && 
				    (now - this.lastRecoveryTime) > this.minRecoveryInterval &&
				    !this.recoveryInProgress) {
					this.attemptRecovery('paused_or_unstarted', state)
				}
			}

			// Handle buffering timeout
			if (state === 3) { // BUFFERING
				const timeSinceStateChange = this.lastStateTime ? now - this.lastStateTime : Infinity
				if (timeSinceStateChange > 8000) { // 8 seconds of buffering
					this.attemptRecovery('buffering_timeout', state)
				}
			}

		} catch (err) {
			console.error('[FastRecovery] Error checking playback:', err)
		}
	}

	// Debounced recovery attempt
	attemptRecovery(reason, currentState) {
		if (this.recoveryInProgress || this.recoveryAttempts >= this.maxRecoveryAttempts) {
			if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
				console.error('[FastRecovery] Max recovery attempts reached')
				return
			}
			return
		}

		// Debounce recovery attempts
		if (this.debounceTimeout) {
			clearTimeout(this.debounceTimeout)
		}

		this.debounceTimeout = setTimeout(() => {
			this._doRecovery(reason, currentState)
		}, 100) // 100ms debounce
	}

	_doRecovery(reason, currentState) {
		if (!this.playerRef?.current || this.recoveryInProgress) {
			return
		}

		this.recoveryInProgress = true
		this.recoveryAttempts++
		this.lastRecoveryTime = Date.now()

		const player = this.playerRef.current

		console.log(`[FastRecovery] Attempting recovery (${this.recoveryAttempts}/${this.maxRecoveryAttempts}): ${reason}, state: ${currentState}`)

		try {
			// Try to play
			player.playVideo?.()

			// Verify recovery after a short delay
			setTimeout(() => {
				if (this.playerRef?.current) {
					const newState = this.playerRef.current.getPlayerState?.()
					if (newState === 1) { // PLAYING
						this.recoveryAttempts = 0
						this.recoveryInProgress = false
						if (this.onRecoveryCallback) {
							this.onRecoveryCallback(reason)
						}
						console.log('[FastRecovery] Recovery successful')
					} else {
						// Recovery failed, will retry on next check
						this.recoveryInProgress = false
						console.warn(`[FastRecovery] Recovery attempt failed, state: ${newState}`)
					}
				}
			}, 500)

		} catch (err) {
			console.error('[FastRecovery] Recovery attempt error:', err)
			this.recoveryInProgress = false
		}
	}

	// Force immediate recovery (for critical situations)
	forceRecovery() {
		if (this.playerRef?.current && this.shouldPlayCallback()) {
			this.recoveryAttempts = 0 // Reset attempts for forced recovery
			this._doRecovery('forced', null)
		}
	}
}

// Export singleton instance
const fastRecoveryManager = new FastRecoveryManager()
export default fastRecoveryManager

