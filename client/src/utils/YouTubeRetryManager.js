/**
 * YouTubeRetryManager.js - Robust retry mechanism for YouTube player
 * 
 * Priority: YouTube should NEVER go to loading state
 * 
 * Features:
 * - Exponential backoff retry
 * - Pre-buffering next videos
 * - Fallback video queue
 * - Health monitoring
 * - Automatic recovery from errors
 */

class YouTubeRetryManager {
	constructor() {
		this.maxRetries = 5
		this.baseDelay = 500 // 500ms base delay
		this.maxDelay = 10000 // 10 second max delay
		this.retryState = new Map() // videoId -> retry state
		this.healthyVideos = new Set() // Videos that played successfully
		this.failedVideos = new Set() // Videos that failed permanently
		this.preloadedVideos = new Map() // videoId -> preload state
		this.listeners = []
	}

	/**
	 * Calculate exponential backoff delay
	 */
	getRetryDelay(attempt) {
		const delay = Math.min(this.baseDelay * Math.pow(2, attempt), this.maxDelay)
		// Add jitter to prevent thundering herd
		return delay + Math.random() * 500
	}

	/**
	 * Attempt to play a video with retry logic
	 * Returns a promise that resolves when video starts playing or all retries exhausted
	 */
	async playWithRetry(player, videoId, startTime = 0, options = {}) {
		const {
			onRetry = () => {},
			onSuccess = () => {},
			onFailure = () => {},
			onBuffering = () => {},
		} = options

		// If video is known to be permanently failed, skip immediately
		if (this.failedVideos.has(videoId)) {
			console.warn(`[YTRetry] Video ${videoId} is permanently failed, skipping`)
			onFailure({ videoId, reason: 'permanently_failed', retries: 0 })
			return { success: false, reason: 'permanently_failed' }
		}

		// Initialize retry state for this video
		const retryKey = `${videoId}-${Date.now()}`
		this.retryState.set(retryKey, {
			videoId,
			startTime,
			attempts: 0,
			startedAt: Date.now(),
			lastError: null,
		})

		return new Promise((resolve) => {
			this.attemptPlay(player, retryKey, {
				onRetry,
				onSuccess: (result) => {
					this.healthyVideos.add(videoId)
					onSuccess(result)
					resolve({ success: true, ...result })
				},
				onFailure: (result) => {
					onFailure(result)
					resolve({ success: false, ...result })
				},
				onBuffering,
			})
		})
	}

	/**
	 * Internal attempt to play video
	 */
	attemptPlay(player, retryKey, callbacks) {
		const state = this.retryState.get(retryKey)
		if (!state) return

		const { videoId, startTime, attempts } = state
		const { onRetry, onSuccess, onFailure, onBuffering } = callbacks

		console.log(`[YTRetry] Attempt ${attempts + 1}/${this.maxRetries} for video ${videoId}`)

		try {
			// Set up state change listener for this attempt
			const stateHandler = (event) => {
				const playerState = event.data

				// YouTube states: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
				if (playerState === 1) {
					// SUCCESS - Video is playing
					console.log(`[YTRetry] ✓ Video ${videoId} playing successfully`)
					this.retryState.delete(retryKey)
					onSuccess({
						videoId,
						attempts: attempts + 1,
						timeToPlay: Date.now() - state.startedAt,
					})
				} else if (playerState === 3) {
					// BUFFERING - Not a failure, but notify
					console.log(`[YTRetry] Video ${videoId} buffering...`)
					onBuffering({ videoId, attempts: attempts + 1 })
				}
			}

			// Try to load and play the video
			player.loadVideoById({
				videoId: videoId,
				startSeconds: startTime,
			})

			// Set a timeout for this attempt
			const attemptTimeout = setTimeout(() => {
				// Check if video started playing
				try {
					const currentState = player.getPlayerState()
					if (currentState !== 1 && currentState !== 2) {
						// Not playing or paused - retry
						this.handleRetry(player, retryKey, callbacks, 'timeout')
					}
				} catch (err) {
					this.handleRetry(player, retryKey, callbacks, err.message)
				}
			}, 5000) // 5 second timeout per attempt

			// Store timeout for cleanup
			state.currentTimeout = attemptTimeout

		} catch (err) {
			console.error(`[YTRetry] Error during play attempt:`, err)
			this.handleRetry(player, retryKey, callbacks, err.message)
		}
	}

	/**
	 * Handle retry logic
	 */
	handleRetry(player, retryKey, callbacks, errorReason) {
		const state = this.retryState.get(retryKey)
		if (!state) return

		const { videoId, attempts } = state
		const { onRetry, onFailure } = callbacks

		// Clear any existing timeout
		if (state.currentTimeout) {
			clearTimeout(state.currentTimeout)
		}

		state.attempts += 1
		state.lastError = errorReason

		if (state.attempts >= this.maxRetries) {
			// All retries exhausted
			console.error(`[YTRetry] ✗ Video ${videoId} failed after ${state.attempts} attempts`)
			
			// Mark as permanently failed if it's a known bad error
			if (this.isPermanentError(errorReason)) {
				this.failedVideos.add(videoId)
			}

			this.retryState.delete(retryKey)
			onFailure({
				videoId,
				reason: 'max_retries_exhausted',
				lastError: errorReason,
				retries: state.attempts,
			})
			return
		}

		// Calculate delay and retry
		const delay = this.getRetryDelay(state.attempts)
		console.log(`[YTRetry] Retrying ${videoId} in ${delay.toFixed(0)}ms (attempt ${state.attempts + 1})`)

		onRetry({
			videoId,
			attempt: state.attempts + 1,
			maxRetries: this.maxRetries,
			delayMs: delay,
			reason: errorReason,
		})

		setTimeout(() => {
			this.attemptPlay(player, retryKey, callbacks)
		}, delay)
	}

	/**
	 * Check if error is permanent (shouldn't retry)
	 */
	isPermanentError(errorReason) {
		const permanentErrors = [
			'video_not_found',
			'video_unavailable',
			'embedding_disabled',
			'private_video',
			'deleted',
			100, // YouTube error code: not found
			101, // YouTube error code: not embeddable
			150, // YouTube error code: restricted
		]
		return permanentErrors.some((e) => 
			String(errorReason).toLowerCase().includes(String(e).toLowerCase())
		)
	}

	/**
	 * Handle YouTube player error event
	 */
	handlePlayerError(error, videoId, callbacks = {}) {
		const errorCode = error?.data || error

		console.error(`[YTRetry] Player error for ${videoId}:`, errorCode)

		const errorMessages = {
			2: 'Invalid video ID',
			5: 'HTML5 player error',
			100: 'Video not found',
			101: 'Video not embeddable',
			150: 'Video restricted',
		}

		const errorMessage = errorMessages[errorCode] || `Unknown error (${errorCode})`

		if (this.isPermanentError(errorCode)) {
			this.failedVideos.add(videoId)
			console.log(`[YTRetry] Video ${videoId} marked as permanently failed: ${errorMessage}`)
		}

		this.notifyListeners('error', {
			videoId,
			errorCode,
			errorMessage,
			isPermanent: this.isPermanentError(errorCode),
		})

		if (callbacks.onError) {
			callbacks.onError({ videoId, errorCode, errorMessage })
		}

		return {
			isPermanent: this.isPermanentError(errorCode),
			errorCode,
			errorMessage,
		}
	}

	/**
	 * Preload a video for faster switching
	 */
	preloadVideo(videoId) {
		if (this.preloadedVideos.has(videoId) || this.failedVideos.has(videoId)) {
			return
		}

		console.log(`[YTRetry] Preloading video ${videoId}`)
		this.preloadedVideos.set(videoId, {
			preloadedAt: Date.now(),
			status: 'pending',
		})

		// Preload by creating a hidden element or using YouTube API
		// This is a placeholder - actual implementation depends on requirements
	}

	/**
	 * Check if a video is likely to play successfully
	 */
	isVideoHealthy(videoId) {
		if (this.failedVideos.has(videoId)) return false
		if (this.healthyVideos.has(videoId)) return true
		return null // Unknown
	}

	/**
	 * Get next healthy video from a list
	 */
	getNextHealthyVideo(videos, currentIndex) {
		const startIndex = (currentIndex + 1) % videos.length
		
		for (let i = 0; i < videos.length; i++) {
			const index = (startIndex + i) % videos.length
			const video = videos[index]
			
			if (!this.failedVideos.has(video.youtubeId)) {
				return { video, index }
			}
		}

		// All videos failed - clear failed list and try again
		console.warn('[YTRetry] All videos failed, clearing failed list')
		this.failedVideos.clear()
		return { video: videos[startIndex], index: startIndex }
	}

	/**
	 * Subscribe to events
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
				console.error('[YTRetry] Listener error:', err)
			}
		})
	}

	/**
	 * Get diagnostics
	 */
	getDiagnostics() {
		return {
			healthyVideos: Array.from(this.healthyVideos),
			failedVideos: Array.from(this.failedVideos),
			preloadedVideos: Object.fromEntries(this.preloadedVideos),
			activeRetries: Array.from(this.retryState.entries()),
		}
	}

	/**
	 * Reset all state
	 */
	reset() {
		this.retryState.clear()
		this.healthyVideos.clear()
		this.failedVideos.clear()
		this.preloadedVideos.clear()
	}
}

// Export singleton
export default new YouTubeRetryManager()
