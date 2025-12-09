/**
 * UnifiedPlaybackManager.js
 * 
 * SINGLE unified system for all playback recovery and management
 * Replaces: FastRecoveryManager, PlaybackWatchdog, YouTubeRetryManager
 * 
 * Features:
 * - Single recovery mechanism (no conflicts)
 * - Configurable thresholds from config files
 * - Debounced play attempts
 * - State validation before actions
 * - Clean separation of concerns
 */

import { PLAYBACK_THRESHOLDS } from '../../config/thresholds/index.js'
import { YOUTUBE_STATES } from '../../config/constants/youtube.js'

class UnifiedPlaybackManager {
	constructor() {
		this.playerRef = null
		this.isActive = false
		this.recoveryInProgress = false
		this.playAttemptInProgress = false
		
		// State tracking
		this.lastState = null
		this.lastStateTime = null
		this.lastPlayAttempt = 0
		this.lastRecoveryTime = 0
		this.recoveryAttempts = 0
		
		// Callbacks
		this.shouldPlayCallback = null
		this.onRecoveryCallback = null
		this.onStateChangeCallback = null
		
		// Intervals
		this.checkIntervalId = null
		this.recoveryDebounceTimeout = null
		
		// Configuration from thresholds
		this.config = {
			checkInterval: PLAYBACK_THRESHOLDS.RECOVERY_CHECK_INTERVAL,
			detectionDelay: PLAYBACK_THRESHOLDS.RECOVERY_DETECTION_DELAY,
			minRecoveryInterval: PLAYBACK_THRESHOLDS.RECOVERY_MIN_INTERVAL,
			maxRecoveryAttempts: PLAYBACK_THRESHOLDS.RECOVERY_MAX_ATTEMPTS,
			recoveryDebounce: PLAYBACK_THRESHOLDS.RECOVERY_DEBOUNCE,
			playDebounce: PLAYBACK_THRESHOLDS.PLAY_ATTEMPT_DEBOUNCE,
			maxBufferTime: PLAYBACK_THRESHOLDS.MAX_BUFFER_TIME,
		}
	}

	/**
	 * Start monitoring playback
	 */
	start(playerRef, options = {}) {
		if (this.isActive) {
			this.stop()
		}

		this.playerRef = playerRef
		this.shouldPlayCallback = options.shouldPlay || (() => true)
		this.onRecoveryCallback = options.onRecovery || (() => {})
		this.onStateChangeCallback = options.onStateChange || (() => {})
		this.isActive = true
		this.recoveryAttempts = 0
		this.lastState = null
		this.lastStateTime = null

		console.log(`[UnifiedPlayback] Started monitoring (check interval: ${this.config.checkInterval}ms)`)

		// Start monitoring interval
		this.checkIntervalId = setInterval(() => {
			this.check()
		}, this.config.checkInterval)
	}

	/**
	 * Stop monitoring
	 */
	stop() {
		if (this.checkIntervalId) {
			clearInterval(this.checkIntervalId)
			this.checkIntervalId = null
		}
		if (this.recoveryDebounceTimeout) {
			clearTimeout(this.recoveryDebounceTimeout)
			this.recoveryDebounceTimeout = null
		}
		this.isActive = false
		this.recoveryInProgress = false
		this.playAttemptInProgress = false
		this.playerRef = null
		this.shouldPlayCallback = null
		this.onRecoveryCallback = null
		this.onStateChangeCallback = null
		console.log('[UnifiedPlayback] Stopped')
	}

	/**
	 * Reset recovery state
	 */
	reset() {
		this.recoveryAttempts = 0
		this.recoveryInProgress = false
		this.playAttemptInProgress = false
		this.lastState = null
		this.lastStateTime = null
	}

	/**
	 * Main check function - runs at configured interval
	 */
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
				
				// Notify state change
				if (this.onStateChangeCallback) {
					this.onStateChangeCallback(state, this.lastState)
				}
				
				// Reset recovery attempts on successful playback
				if (state === YOUTUBE_STATES.PLAYING) {
					this.recoveryAttempts = 0
					this.recoveryInProgress = false
					return
				}
			}

			// Recovery logic: Only if paused/unstarted and should be playing
			if ((state === YOUTUBE_STATES.PAUSED || state === YOUTUBE_STATES.UNSTARTED) && 
			    this.shouldPlayCallback()) {
				const timeSinceStateChange = this.lastStateTime ? now - this.lastStateTime : Infinity
				
				// Recover if:
				// 1. State has been paused/unstarted for > detectionDelay
				// 2. Enough time has passed since last recovery
				// 3. Not already recovering
				if (timeSinceStateChange > this.config.detectionDelay && 
				    (now - this.lastRecoveryTime) > this.config.minRecoveryInterval &&
				    !this.recoveryInProgress) {
					this.attemptRecovery('paused_or_unstarted', state)
				}
			}

			// Handle buffering timeout
			if (state === YOUTUBE_STATES.BUFFERING) {
				const timeSinceStateChange = this.lastStateTime ? now - this.lastStateTime : Infinity
				if (timeSinceStateChange > this.config.maxBufferTime) {
					this.attemptRecovery('buffering_timeout', state)
				}
			}

		} catch (err) {
			console.error('[UnifiedPlayback] Error checking playback:', err)
		}
	}

	/**
	 * Safe play video with debouncing and conflict prevention
	 */
	safePlayVideo() {
		if (!this.playerRef?.current || this.playAttemptInProgress) {
			return false
		}

		const now = Date.now()
		
		// Debounce: Don't attempt play if last attempt was too recent
		if (now - this.lastPlayAttempt < this.config.playDebounce) {
			return false
		}

		this.playAttemptInProgress = true
		this.lastPlayAttempt = now

		try {
			const state = this.playerRef.current.getPlayerState?.()
			
			// Only play if actually paused/unstarted/cued, not if already playing
			if (state === YOUTUBE_STATES.PAUSED || 
			    state === YOUTUBE_STATES.UNSTARTED || 
			    state === YOUTUBE_STATES.VIDEO_CUED) {
				this.playerRef.current.playVideo()
				
				// Reset flag after timeout
				setTimeout(() => {
					this.playAttemptInProgress = false
				}, PLAYBACK_THRESHOLDS.PLAY_ATTEMPT_TIMEOUT)
				
				return true
			} else {
				this.playAttemptInProgress = false
				return false
			}
		} catch (err) {
			console.error('[UnifiedPlayback] Error in safePlayVideo:', err)
			this.playAttemptInProgress = false
			return false
		}
	}

	/**
	 * Attempt recovery with debouncing
	 */
	attemptRecovery(reason, currentState) {
		if (this.recoveryInProgress || 
		    this.recoveryAttempts >= this.config.maxRecoveryAttempts) {
			if (this.recoveryAttempts >= this.config.maxRecoveryAttempts) {
				console.error('[UnifiedPlayback] Max recovery attempts reached')
			}
			return
		}

		// Debounce recovery attempts
		if (this.recoveryDebounceTimeout) {
			clearTimeout(this.recoveryDebounceTimeout)
		}

		this.recoveryDebounceTimeout = setTimeout(() => {
			this._doRecovery(reason, currentState)
		}, this.config.recoveryDebounce)
	}

	/**
	 * Internal recovery execution
	 */
	_doRecovery(reason, currentState) {
		if (!this.playerRef?.current || this.recoveryInProgress) {
			return
		}

		const now = Date.now()
		
		// Additional debounce check
		if ((now - this.lastRecoveryTime) < this.config.minRecoveryInterval) {
			return
		}

		this.recoveryInProgress = true
		this.recoveryAttempts++
		this.lastRecoveryTime = now

		const player = this.playerRef.current

		console.log(`[UnifiedPlayback] Recovery attempt (${this.recoveryAttempts}/${this.config.maxRecoveryAttempts}): ${reason}, state: ${currentState}`)

		try {
			// Double-check state before attempting recovery
			const currentStateCheck = player.getPlayerState?.()
			
			// Already playing - no recovery needed
			if (currentStateCheck === YOUTUBE_STATES.PLAYING) {
				this.recoveryInProgress = false
				this.recoveryAttempts = 0
				return
			}

			// Attempt to play
			player.playVideo?.()

			// Verify recovery after delay
			setTimeout(() => {
				if (this.playerRef?.current) {
					const newState = this.playerRef.current.getPlayerState?.()
					if (newState === YOUTUBE_STATES.PLAYING) {
						this.recoveryAttempts = 0
						this.recoveryInProgress = false
						if (this.onRecoveryCallback) {
							this.onRecoveryCallback(reason)
						}
						console.log('[UnifiedPlayback] Recovery successful')
					} else {
						this.recoveryInProgress = false
						console.warn(`[UnifiedPlayback] Recovery attempt failed, state: ${newState}`)
					}
				}
			}, 500)

		} catch (err) {
			console.error('[UnifiedPlayback] Recovery attempt error:', err)
			this.recoveryInProgress = false
		}
	}

	/**
	 * Force immediate recovery (for critical situations)
	 */
	forceRecovery() {
		if (this.playerRef?.current && this.shouldPlayCallback()) {
			this.recoveryAttempts = 0 // Reset attempts for forced recovery
			this._doRecovery('forced', null)
		}
	}
}

// Export singleton instance
const unifiedPlaybackManager = new UnifiedPlaybackManager()
export default unifiedPlaybackManager

