/**
 * PlaybackWatchdog.js
 * Monitors and automatically recovers playback when it stops unexpectedly
 * Similar to retrotv-org implementation
 */

class PlaybackWatchdog {
	constructor() {
		this.intervalId = null
		this.playerRef = null
		this.options = null
		this.recoveryAttempts = 0
		this.maxRecoveryAttempts = 5
		this.checkInterval = 2000 // Check every 2 seconds
		this.lastPlayTime = null
		this.isRunning = false
	}

	start(playerRef, options = {}) {
		if (this.isRunning) {
			this.stop()
		}

		this.playerRef = playerRef
		this.options = {
			shouldAutoResume: options.shouldAutoResume || (() => true),
			onRecovery: options.onRecovery || (() => {}),
			onMaxRecoveryAttempts: options.onMaxRecoveryAttempts || (() => {}),
			checkInterval: options.checkInterval || 2000,
		}
		this.recoveryAttempts = 0
		this.isRunning = true

		console.log('[PlaybackWatchdog] Started')

		this.intervalId = setInterval(() => {
			this.check()
		}, this.options.checkInterval)
	}

	stop() {
		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
		}
		this.isRunning = false
		this.playerRef = null
		this.options = null
		this.recoveryAttempts = 0
		this.lastPlayTime = null
		console.log('[PlaybackWatchdog] Stopped')
	}

	reset() {
		this.recoveryAttempts = 0
		this.lastPlayTime = Date.now()
	}

	check() {
		if (!this.isRunning || !this.playerRef?.current || !this.options) {
			return
		}

		const player = this.playerRef.current

		try {
			// Check if we should be playing
			if (!this.options.shouldAutoResume()) {
				return // Don't check if we shouldn't be playing
			}

			// Get current state
			const state = player.getPlayerState?.()
			
			// YouTube API states:
			// -1 = unstarted
			// 0 = ended
			// 1 = playing
			// 2 = paused
			// 3 = buffering
			// 5 = video cued

			// If playing, update last play time
			if (state === 1) {
				this.lastPlayTime = Date.now()
				this.recoveryAttempts = 0 // Reset recovery attempts on successful playback
				return
			}

			// If paused or unstarted and we should be playing, try to recover
			if ((state === 2 || state === -1) && this.options.shouldAutoResume()) {
				const timeSinceLastPlay = this.lastPlayTime ? Date.now() - this.lastPlayTime : Infinity
				
				// Only attempt recovery if it's been more than 1 second since last play
				// This prevents rapid recovery attempts
				if (timeSinceLastPlay > 1000) {
					this.attemptRecovery('paused_or_unstarted')
				}
			}

			// If buffering for too long, try recovery
			if (state === 3) {
				const timeSinceLastPlay = this.lastPlayTime ? Date.now() - this.lastPlayTime : Infinity
				if (timeSinceLastPlay > 10000) { // 10 seconds of buffering
					this.attemptRecovery('buffering_timeout')
				}
			}

		} catch (err) {
			console.error('[PlaybackWatchdog] Error checking playback:', err)
		}
	}

	attemptRecovery(reason) {
		if (!this.playerRef?.current || this.recoveryAttempts >= this.maxRecoveryAttempts) {
			if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
				console.error('[PlaybackWatchdog] Max recovery attempts reached')
				if (this.options?.onMaxRecoveryAttempts) {
					this.options.onMaxRecoveryAttempts()
				}
			}
			return
		}

		this.recoveryAttempts++
		console.log(`[PlaybackWatchdog] Attempting recovery (${this.recoveryAttempts}/${this.maxRecoveryAttempts}): ${reason}`)

		const player = this.playerRef.current

		try {
			// Try to play
			player.playVideo?.()
			this.lastPlayTime = Date.now()

			// Call recovery callback
			if (this.options?.onRecovery) {
				this.options.onRecovery(reason)
			}

			// Reset attempts after successful recovery
			setTimeout(() => {
				if (player.getPlayerState?.() === 1) {
					this.recoveryAttempts = 0
				}
			}, 2000)

		} catch (err) {
			console.error('[PlaybackWatchdog] Recovery attempt failed:', err)
		}
	}
}

// Export singleton instance
const playbackWatchdog = new PlaybackWatchdog()
export default playbackWatchdog
