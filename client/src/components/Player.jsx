import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import LocalBroadcastStateManager from '../utils/LocalBroadcastStateManager'
import { useBroadcastPosition } from '../hooks/useBroadcastPosition'
import YouTubeRetryManager from '../utils/YouTubeRetryManager'
import YouTubeUIRemover from '../utils/YouTubeUIRemover'

/**
 * Enhanced Player Component with:
 * - Session caching and state recovery
 * - Timeline continuity maintenance
 * - YouTube retry mechanism (never go to loading state)
 * - Robust error handling with try-catch
 * - Unified position calculation via useBroadcastPosition hook
 * - iPhone/iOS autoplay support (muted autoplay, then unmute)
 */
export default function Player({ 
channel, 
onVideoEnd, 
	onChannelChange, 
volume = 0.5, 
	uiLoadTime, 
	allChannels = [], 
onBufferingChange = null,
	onPlaybackStateChange = null, // Callback for playback state
	onPlaybackProgress = null, // Emits current playback position
	onTapHandlerReady = null, // Callback to expose tap handler for external triggers (kept for compatibility)
}){
	// ===== SINGLE SOURCE OF TRUTH FOR POSITION =====
	// All timing and video index calculations come from this hook
	// Never recalculates unless channel changes
	const broadcastPosition = useBroadcastPosition(channel)

	// ===== STATE - ONLY for UI and transient events =====
	const [isBuffering, setIsBuffering] = useState(false)
	const [isTransitioning, setIsTransitioning] = useState(false)
	const [retryCount, setRetryCount] = useState(0)
	const [playbackHealth, setPlaybackHealth] = useState('healthy') // healthy, buffering, retrying, failed
	const [needsUserInteraction, setNeedsUserInteraction] = useState(false)
	const [userInteracted, setUserInteracted] = useState(false) // RetroTV pattern: track user interaction
	const [isMutedAutoplay, setIsMutedAutoplay] = useState(true) // Track if in muted autoplay mode
	const [showStaticOverlay, setShowStaticOverlay] = useState(true) // Show static on initial load
	const ytPlayerRef = useRef(null) // Direct YouTube API player reference

	// ===== REFS =====
	const playerRef = useRef(null)
	const channelIdRef = useRef(null)
	const channelChangeCounterRef = useRef(0)
	const bufferTimeoutRef = useRef(null)
	const progressIntervalRef = useRef(null)
	const transitionTimeoutRef = useRef(null)
	const errorTimeoutRef = useRef(null)
	const retryTimeoutRef = useRef(null)
	const isTransitioningRef = useRef(false)
	const failedVideosRef = useRef(new Set())
	const skipAttemptsRef = useRef(0)
	const staticAudioRef = useRef(null)
	const staticVideoRef = useRef(null) // Static video for loading/buffering
	const lastPlayTimeRef = useRef(Date.now())
	const bufferingStartTimeRef = useRef(null)
	const playbackStateRef = useRef('idle') // idle, loading, playing, buffering, error
	const hasInitializedRef = useRef(false) // Prevent double initialization
	const videoLoadedRef = useRef(false) // Track if video has loaded
	const autoplayAttemptedRef = useRef(false) // Track if we've attempted autoplay
	const watchDogTimeOutIdRef = useRef(null) // RetroTV pattern: watchdog timer for buffering
	const skipErrorTimeoutIdRef = useRef(null) // RetroTV pattern: error skip timeout
	const clipSeekTimeRef = useRef(0) // RetroTV pattern: seek time after video loads
	const e7Ref = useRef(false) // RetroTV pattern: track if video loading was initiated

	// ===== CONSTANTS =====
	// RetroTV state constants
	const STATE_UNSTARTED = -1
	const STATE_ENDED = 0
	const STATE_PLAYING = 1
	const STATE_PAUSED = 2
	const STATE_BUFFERING = 3
	const STATE_VIDEO_CUED = 5
	
	const SWITCH_BEFORE_END = 2 // Switch 2 seconds before end for smoother transition
	const MAX_BUFFER_TIME = 8000 // 8 seconds max buffering before retry (RetroTV watchdog)
	const MAX_RETRY_ATTEMPTS = 5
	const RETRY_BACKOFF_BASE = 1000 // 1 second base
	const ERROR_SKIP_DELAY = 1500 // 1.5 seconds before auto-skip on error (faster than RetroTV's 3s)

	// ===== COMPUTED VALUES =====
	const items = useMemo(() => {
		return Array.isArray(channel?.items) ? channel.items : []
	}, [channel?.items])
	
	const MAX_SKIP_ATTEMPTS = Math.max(items.length || 10, 10)

	// Derive current video from broadcast position (single source of truth)
	const currIndex = broadcastPosition.videoIndex
	const current = items[currIndex] || null
	const offset = broadcastPosition.offset

	// Only change key on channel change, NOT on video change
	// Changing on video change causes YouTube component to remount instead of using loadVideoById
	const playerKey = useMemo(() => {
		if (!channel?._id) return 'no-channel'
		return `${channel._id}-${channelChangeCounterRef.current}`
	}, [channel?._id])

	// Get current video ID and start time
	const videoId = current?.youtubeId
	const startSeconds = Math.floor(offset)

	// Use ref to avoid stale closure in interval
	const switchToNextVideoRef = useRef(null)
	const onStateChangeRef = useRef(null)
	const onReadyRef = useRef(null)
	const handleVideoErrorRef = useRef(null)

	// ===== RETRY MECHANISM =====
	const attemptRetry = useCallback(async () => {
		if (!playerRef.current || !current?.youtubeId) return false

		try {
			setRetryCount(prev => prev + 1)
			setPlaybackHealth('retrying')
			
			console.log(`[Player] Retry attempt ${retryCount + 1} for ${current.youtubeId}`)

			// Calculate backoff delay
			const delay = RETRY_BACKOFF_BASE * Math.pow(2, retryCount)
			
			await new Promise(resolve => setTimeout(resolve, Math.min(delay, 5000)))

			// Try to reload the video
			if (playerRef.current) {
				const currentTime = await playerRef.current.getCurrentTime().catch(() => offset)
				
				playerRef.current.loadVideoById({
					videoId: current.youtubeId,
					startSeconds: currentTime || offset,
				})
				
				playerRef.current.playVideo()
				
				console.log(`[Player] Retry initiated at ${currentTime?.toFixed(1)}s`)
				return true
			}
			} catch (err) {
			console.error('[Player] Retry failed:', err)
		}
		
		return false
	}, [current?.youtubeId, retryCount, offset])

	const handleBufferingTimeout = useCallback(() => {
		if (bufferingStartTimeRef.current) {
			const bufferingDuration = Date.now() - bufferingStartTimeRef.current
			
			if (bufferingDuration > MAX_BUFFER_TIME && retryCount < MAX_RETRY_ATTEMPTS) {
				console.log(`[Player] Buffering too long (${bufferingDuration}ms), attempting retry`)
				attemptRetry()
			}
		}
	}, [attemptRetry, retryCount])

	// ===== AUTOPLAY HELPER (RetroTV Pattern) =====
	// Strategy: Start muted autoplay, then on user interaction reload video to enable sound
	const attemptAutoplay = useCallback(async (player) => {
		if (!player || autoplayAttemptedRef.current) return
		
		try {
			autoplayAttemptedRef.current = true
			console.log('[Player] Attempting muted autoplay (iOS compatible)')
			
			// Start muted - this is allowed on iOS
			player.mute()
			player.setVolume(volume * 100)
			
			// Try to play muted
			await player.playVideo()
			setIsMutedAutoplay(true)
			console.log('[Player] Muted autoplay started')
		} catch (err) {
			console.warn('[Player] Autoplay failed (may need user interaction):', err)
			autoplayAttemptedRef.current = false
			setNeedsUserInteraction(true)
		}
	}, [volume])

	// Handle user interaction - unmute smoothly without reload
	const handleUserInteraction = useCallback(() => {
		if (userInteracted) return
		
		const player = playerRef.current
		if (!player) return
		
		try {
			console.log('[Player] User interaction detected - enabling sound')
			
			// Simply unmute and set volume - no reload needed
			player.unMute()
			player.setVolume(volume * 100)
			
			// Ensure video is playing
			const state = player.getPlayerState?.()
			if (state !== 1) { // Not playing
				player.playVideo()
			}
			
			setIsMutedAutoplay(false)
			setUserInteracted(true)
			console.log('[Player] Sound enabled smoothly')
		} catch (err) {
			console.error('[Player] Error enabling sound:', err)
		}
	}, [userInteracted, volume])

	// Listen for user interaction (click, touch, keydown)
	useEffect(() => {
		if (userInteracted) return // Already interacted
		
		const handleInteraction = () => {
			handleUserInteraction()
		}
		
		document.addEventListener('click', handleInteraction, { once: true })
		document.addEventListener('touchstart', handleInteraction, { once: true })
		document.addEventListener('keydown', handleInteraction, { once: true })
		
		return () => {
			document.removeEventListener('click', handleInteraction)
			document.removeEventListener('touchstart', handleInteraction)
			document.removeEventListener('keydown', handleInteraction)
		}
	}, [userInteracted, handleUserInteraction])

	// Expose tap handler to parent components (for compatibility)
	useEffect(() => {
		if (onTapHandlerReady) {
			onTapHandlerReady(() => {
				handleUserInteraction()
			})
		}
	}, [onTapHandlerReady, handleUserInteraction])

	// Effect: Control static video during loading/buffering
	useEffect(() => {
		const staticVideo = staticVideoRef.current
		if (!staticVideo) return
		
		const shouldShowStatic = showStaticOverlay || isBuffering || isTransitioning
		
		if (shouldShowStatic) {
			// Play static video during loading/buffering
			staticVideo.play().catch(() => {
				// Autoplay may be blocked, that's okay
			})
		} else {
			// Pause and reset when not needed
			staticVideo.pause()
			staticVideo.currentTime = 0
		}
	}, [showStaticOverlay, isBuffering, isTransitioning])

	// Effect: Play static video on initial mount (before YouTube loads)
	useEffect(() => {
		const staticVideo = staticVideoRef.current
		if (staticVideo) {
			staticVideo.play().catch(() => {})
		}
	}, [])

	// Effect: Reset when channel changes
	useEffect(() => {
		if (channel?._id !== channelIdRef.current) {
			const wasChannelChange = channelIdRef.current !== null
			channelIdRef.current = channel?._id
			channelChangeCounterRef.current += 1 // This forces iframe reload via playerKey
			
			// Reset initialization flags for new channel
			hasInitializedRef.current = false
			videoLoadedRef.current = false
			autoplayAttemptedRef.current = false
			// Keep userInteracted across channel changes (SPA pattern)
			// Only reset if it's a fresh page load
			if (!wasChannelChange) {
				setUserInteracted(false)
				setIsMutedAutoplay(true)
			}
			
			// Clear all timeouts and intervals
			if (progressIntervalRef.current) {
				clearInterval(progressIntervalRef.current)
				progressIntervalRef.current = null
			}
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current)
				retryTimeoutRef.current = null
			}
			if (watchDogTimeOutIdRef.current) {
				clearTimeout(watchDogTimeOutIdRef.current)
				watchDogTimeOutIdRef.current = null
			}
			if (skipErrorTimeoutIdRef.current) {
				clearTimeout(skipErrorTimeoutIdRef.current)
				skipErrorTimeoutIdRef.current = null
			}
			
			failedVideosRef.current.clear()
			skipAttemptsRef.current = 0
			setRetryCount(0)
			setPlaybackHealth('healthy')
			setShowStaticOverlay(true) // Show static when changing channels
			e7Ref.current = false
			clipSeekTimeRef.current = 0
			
			setIsTransitioning(false)
			isTransitioningRef.current = false
			
			if (onChannelChange) onChannelChange()
		}
	}, [channel?._id, onChannelChange])

	// Load YouTube IFrame API (RetroTV exact pattern)
	useEffect(() => {
		// RetroTV uses setTimeout wrapper for API loading
		setTimeout(() => {
			if (window.YT && window.YT.Player) {
				// API already loaded
				return
			}
			const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
			if (existing) return
			
			const tag = document.createElement('script')
			tag.src = 'https://www.youtube.com/iframe_api'
			tag.async = true
			const firstScriptTag = document.getElementsByTagName('script')[0]
			firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
			console.log('[Player] Loading YouTube IFrame API (RetroTV pattern)')
		}, 2) // RetroTV uses 2ms delay
	}, [])

	// RetroTV Pattern: Player initialization using window.onYouTubeIframeAPIReady
	useEffect(() => {
		if (!videoId || !channel?._id) {
			return
		}

		// RetroTV pattern: Use window.onYouTubeIframeAPIReady callback
		const initYouTubePlayer = () => {
			if (!window.YT || !window.YT.Player) {
				return false
			}

			const container = document.getElementById('desitv-player-iframe')
			if (!container) {
				return false
			}

			// If player exists, just load new video (RetroTV pattern)
			if (ytPlayerRef.current) {
				// Don't load here - will be triggered by useEffect dependency on videoId
				return true
			}

			// Create new player (RetroTV exact pattern)
			try {
				const containerEl = document.getElementById('desitv-player-iframe')
				if (!containerEl) return false

				ytPlayerRef.current = new window.YT.Player('desitv-player-iframe', {
					width: '100%',
					height: '100%',
					playerVars: {
						autoplay: 0, // We control playback manually
						playsinline: 1, // Critical for iOS
						controls: 0, // No controls
						modestbranding: 1, // Minimal branding
						rel: 0, // No related videos
						iv_load_policy: 3, // No annotations
						mute: userInteracted ? 0 : 1, // Start muted for autoplay unless user interacted
						enablejsapi: 1, // Required for API control
					},
					events: {
						onReady: (e) => {
							if (onReadyRef.current) {
								onReadyRef.current(e)
							}
						},
						onStateChange: (e) => {
							if (onStateChangeRef.current) {
								onStateChangeRef.current(e)
							}
						},
						onError: (e) => {
							if (handleVideoErrorRef.current) {
								handleVideoErrorRef.current(e)
							}
						},
					},
				})
				return true
			} catch (err) {
				console.error('[Player] Error creating player:', err)
				return false
			}
		}

		// RetroTV pattern: Load video function
		const loadVideoToPlayer = () => {
			if (!ytPlayerRef.current || !videoId) return
			
			console.log('[Player] Loading video (RetroTV pattern):', videoId, 'at', startSeconds, 's')
			e7Ref.current = true // Mark as loading initiated
			
			try {
				// Load video starting at 0, then seek after ready
				ytPlayerRef.current.loadVideoById({
					videoId: videoId,
					startSeconds: 0
				})
				
				// Store seek time for after video loads
				clipSeekTimeRef.current = startSeconds
			} catch (err) {
				console.error('[Player] Error loading video:', err)
			}
		}

		// RetroTV pattern: Set up onYouTubeIframeAPIReady
		if (window.YT && window.YT.Player) {
			// API already loaded
			if (ytPlayerRef.current) {
				// Player exists, load new video
				loadVideoToPlayer()
			} else {
				// Need to create player
				if (!initYouTubePlayer()) {
					const timer = setInterval(() => {
						if (initYouTubePlayer()) {
							clearInterval(timer)
						}
					}, 100)
					return () => clearInterval(timer)
				}
			}
		} else {
			// Wait for API to load - RetroTV pattern
			const originalCallback = window.onYouTubeIframeAPIReady
			window.onYouTubeIframeAPIReady = () => {
				if (originalCallback) originalCallback()
				initYouTubePlayer()
				// Video will load in onReady callback
			}
		}

		// Cleanup
		return () => {
			if (watchDogTimeOutIdRef.current) {
				clearTimeout(watchDogTimeOutIdRef.current)
				watchDogTimeOutIdRef.current = null
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [videoId, channel?._id, startSeconds, userInteracted])

	// Effect: Load and restore saved state with retry
	useEffect(() => {
		if (!channel?._id || items.length === 0) return

		// Initialize channel state (loads from localStorage if exists)
		try {
			console.log(`[Player] Initializing state for channel ${channel._id}...`)
			
			LocalBroadcastStateManager.initializeChannel(channel)
			
			// Start auto-save if not already started
			if (!LocalBroadcastStateManager.saveInterval) {
				LocalBroadcastStateManager.startAutoSave()
			}

			// Position is calculated by useBroadcastPosition hook
			// which uses LocalBroadcastStateManager internally
		} catch (err) {
			console.error('[Player] Error initializing state:', err)
		}
	}, [channel?._id, items.length])

	// Effect: Save state before page unload
	useEffect(() => {
		const handleBeforeUnload = () => {
			try {
				// Force save to localStorage
				LocalBroadcastStateManager.saveToStorage()
				console.log('[Player] State saved to localStorage on unload')
			} catch (err) {
				console.error('[Player] Error saving on unload:', err)
			}
		}

		window.addEventListener('beforeunload', handleBeforeUnload)
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload)
			// Cleanup: stop auto-save when component unmounts
			LocalBroadcastStateManager.stopAutoSave()
		}
	}, [channel?._id])

	// Effect: Sync volume with player
	useEffect(() => {
		if (playerRef.current) {
			try {
				playerRef.current.setVolume(volume * 100)
				if (volume > 0) {
					playerRef.current.unMute()
				} else {
					playerRef.current.mute()
				}
			} catch(err) {
				// Player not ready, ignore
			}
		}
	}, [volume])

	// Effect: Monitor buffering time
	useEffect(() => {
		if (isBuffering && !bufferingStartTimeRef.current) {
			bufferingStartTimeRef.current = Date.now()
			
			// Set timeout to check if buffering takes too long
			retryTimeoutRef.current = setTimeout(() => {
				handleBufferingTimeout()
			}, MAX_BUFFER_TIME)
		} else if (!isBuffering) {
			bufferingStartTimeRef.current = null
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current)
				retryTimeoutRef.current = null
			}
		}
	}, [isBuffering, handleBufferingTimeout])

	// Effect: Cleanup
	useEffect(() => {
		return () => {
			if (progressIntervalRef.current) {
				clearInterval(progressIntervalRef.current)
				progressIntervalRef.current = null
			}
			if (bufferTimeoutRef.current) {
				clearTimeout(bufferTimeoutRef.current)
			}
			if (transitionTimeoutRef.current) {
				clearTimeout(transitionTimeoutRef.current)
			}
			if (errorTimeoutRef.current) {
				clearTimeout(errorTimeoutRef.current)
			}
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current)
			}
			if (watchDogTimeOutIdRef.current) {
				clearTimeout(watchDogTimeOutIdRef.current)
			}
			if (skipErrorTimeoutIdRef.current) {
				clearTimeout(skipErrorTimeoutIdRef.current)
			}
			LocalBroadcastStateManager.stopAutoSave()
		}
	}, [])

	// Effect: Reset transition state when video changes
	useEffect(() => {
		if (current) {
			setIsTransitioning(false)
			isTransitioningRef.current = false
			setRetryCount(0)
			
			if (!failedVideosRef.current.has(current.youtubeId)) {
				skipAttemptsRef.current = 0
			}
		}
	}, [current?.youtubeId, currIndex])

	// ===== CALLBACKS =====

	const emitPlaybackProgress = useCallback(() => {
		if (!onPlaybackProgress || !playerRef.current) return

		const player = playerRef.current
		const videoData = player.getVideoData ? player.getVideoData() : {}
		const currentPromise = player.getCurrentTime ? Promise.resolve(player.getCurrentTime()) : Promise.resolve(0)
		const durationPromise = player.getDuration ? Promise.resolve(player.getDuration()) : Promise.resolve(current?.duration || 0)

		Promise.all([currentPromise, durationPromise])
			.then(([currentTime, duration]) => {
				onPlaybackProgress({
					channelId: channel?._id,
					videoIndex: currIndex,
					video: current,
					videoId: videoData?.video_id || current?.youtubeId,
					videoTitle: videoData?.title || current?.title,
					currentTime: currentTime || 0,
					duration: duration || current?.duration || 0,
				})
			})
			.catch(() => {})
	}, [channel?._id, currIndex, current, onPlaybackProgress])

	const startProgressMonitoring = useCallback(() => {
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current)
		}

		let hasTriggered = false // Prevent multiple triggers

		progressIntervalRef.current = setInterval(() => {
			if (!playerRef.current || isTransitioningRef.current || hasTriggered) return

			try {
				Promise.all([
					playerRef.current.getCurrentTime(),
					playerRef.current.getDuration()
				]).then(([currentTime, duration]) => {
					if (duration && currentTime && duration > 0 && !isTransitioningRef.current && !hasTriggered) {
						const timeRemaining = duration - currentTime

						// Report live playback info for UI sync
						emitPlaybackProgress()
						
						// Update last play time for health monitoring
						lastPlayTimeRef.current = Date.now()
						
						// Switch before end or when ended
						if (timeRemaining <= SWITCH_BEFORE_END && timeRemaining >= -0.5) {
							hasTriggered = true
							console.log(`[Player] Triggering video switch with ${timeRemaining.toFixed(1)}s remaining`)
							switchToNextVideoRef.current()
						}
					}
				}).catch(() => {})
			} catch(err) {}
		}, 500)
	}, [emitPlaybackProgress])

	// Simple: play next video immediately
	// Note: The next video is automatically calculated by pseudoLive algorithm on channel epoch
	// We just trigger the video switch and let broadcastPosition hook recalculate
	const switchToNextVideo = useCallback(() => {
		if (isTransitioningRef.current) return
		if (!playerRef.current) return
		if (!items || items.length === 0) return

		isTransitioningRef.current = true
		setShowStaticOverlay(true) // Show static during transition

		// Stop progress monitoring
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current)
			progressIntervalRef.current = null
		}

		if (onVideoEnd) onVideoEnd()

		// Use YouTubeRetryManager to find next healthy video (skips known failed)
		const { video: nextVid, index: nextIdx } = YouTubeRetryManager.getNextHealthyVideo(items, currIndex)

		if (nextVid?.youtubeId) {
			console.log(`[Player] Switching from video ${currIndex} to ${nextIdx}: ${nextVid.youtubeId}`)
			
			// CRITICAL FIX: Update broadcast state to reflect video change
			if (channel?._id) {
				try {
					// Jump to next video - this adjusts the epoch for correct timeline calculation
					LocalBroadcastStateManager.jumpToVideo(
						channel._id,
						nextIdx,
						0, // Start at beginning of video
						items
					)
					console.log(`[Player] Jumped to video ${nextIdx} in broadcast timeline`)
				} catch (err) {
					console.error('[Player] Error jumping to video:', err)
				}
			}
			
			try {
				// Load next video starting at 0
				playerRef.current.loadVideoById({
					videoId: nextVid.youtubeId,
					startSeconds: 0
				})
				
				// Reset seek time for new video
				clipSeekTimeRef.current = 0
				e7Ref.current = true
				
				// Attempt autoplay after switching
				setTimeout(() => {
					if (playerRef.current) {
						if (userInteracted) {
							// User has interacted - can play with sound directly
							try {
								playerRef.current.unMute()
								playerRef.current.setVolume(volume * 100)
								playerRef.current.playVideo()
							} catch (err) {
								console.error('[Player] Error playing next video:', err)
							}
						} else {
							// Start muted autoplay
							attemptAutoplay(playerRef.current)
						}
					}
				}, 300)
			} catch (err) {
				console.error('[Player] Switch video error:', err)
			}
		}
		
		// Restart monitoring after video is loaded
		setTimeout(() => {
			isTransitioningRef.current = false
			startProgressMonitoring()
		}, 800)
	}, [items, currIndex, onVideoEnd, startProgressMonitoring, channel, volume, attemptAutoplay, userInteracted])

	// Keep ref updated
	switchToNextVideoRef.current = switchToNextVideo

	// Error handler - auto-skip unavailable/restricted videos
	const handleVideoError = useCallback((error) => {
		try {
			const errorCode = error?.data
			console.error('[Player] onPlayerError:', errorCode)
			
			// Show static immediately on error
			setIsBuffering(true)
			setIsTransitioning(true)
			setShowStaticOverlay(true)
			
			// Clear any existing error timeout
			if (skipErrorTimeoutIdRef.current) {
				clearTimeout(skipErrorTimeoutIdRef.current)
			}
			
			// YouTube error codes:
			// 2 - Invalid video ID
			// 5 - HTML5 player error (can't play this video)
			// 100 - Video not found (removed or private)
			// 101 - Video owner doesn't allow embedding
			// 150 - Same as 101 (geo-restricted or copyright)
			const isUnavailable = [2, 5, 100, 101, 150].includes(errorCode)
			
			// Use YouTubeRetryManager for error handling
			const errorResult = YouTubeRetryManager.handlePlayerError(error, current?.youtubeId)
			
			if (isUnavailable && current?.youtubeId) {
				const errorMessages = {
					2: 'INVALID VIDEO',
					5: 'PLAYBACK ERROR',
					100: 'VIDEO NOT FOUND',
					101: 'EMBEDDING DISABLED',
					150: 'VIDEO RESTRICTED'
				}
				const errorMsg = errorMessages[errorCode] || `ERROR ${errorCode}`
				console.warn(`[Player] ${errorMsg} - Video ${current.youtubeId}, auto-skipping...`)
				
				if (onBufferingChange) {
					onBufferingChange(true, `${errorMsg} - Skipping...`)
				}
				
				failedVideosRef.current.add(current.youtubeId)
				skipAttemptsRef.current++
				
				if (skipAttemptsRef.current < MAX_SKIP_ATTEMPTS) {
					// Quick auto-skip to next video
					skipErrorTimeoutIdRef.current = setTimeout(() => {
						console.log('[Player] Auto-skipping to next video')
						switchToNextVideo()
						skipErrorTimeoutIdRef.current = null
					}, ERROR_SKIP_DELAY)
				} else {
					console.error('[Player] Too many consecutive errors, pausing auto-skip')
					setIsBuffering(false)
					setPlaybackHealth('failed')
					// Reset after 5 seconds and try again
					setTimeout(() => {
						skipAttemptsRef.current = 0
						failedVideosRef.current.clear()
						setPlaybackHealth('healthy')
						switchToNextVideo()
					}, 5000)
				}
			} else if (!errorResult.isPermanent && retryCount < MAX_RETRY_ATTEMPTS) {
				// Try to recover from non-permanent errors
				console.log('[Player] Non-permanent error, attempting retry...')
				attemptRetry()
			} else {
				// Unknown error - skip to next
				console.error('[Player] Unknown error, skipping:', error)
				setTimeout(() => switchToNextVideo(), ERROR_SKIP_DELAY)
			}
		} catch (err) {
			console.error('[Player] Error in handleVideoError:', err)
			setIsBuffering(false)
		}
	}, [current?.youtubeId, onBufferingChange, MAX_SKIP_ATTEMPTS, switchToNextVideo, retryCount, attemptRetry])

	// RetroTV Pattern: State change handler
	const onStateChange = useCallback((event) => {
		try {
			const state = event.data
			playbackStateRef.current = state === STATE_PLAYING ? 'playing' : state === STATE_BUFFERING ? 'buffering' : 'other'
			
			// RetroTV pattern: Clear watchdog timer on any state change
			if (watchDogTimeOutIdRef.current) {
				clearTimeout(watchDogTimeOutIdRef.current)
				watchDogTimeOutIdRef.current = null
			}
			
			switch (state) {
				case STATE_UNSTARTED:
					// RetroTV: Known causes - seeking to time out of range
					console.log('[Player] Video unstarted')
					break
					
				case STATE_ENDED:
					// RetroTV: Video ended - trigger transition
					if (!isTransitioningRef.current) {
						switchToNextVideo()
					}
					break
					
			case STATE_PLAYING:
				// RetroTV: Video is playing - hide static, start monitoring
				setRetryCount(0)
				setPlaybackHealth('healthy')
				setShowStaticOverlay(false) // Hide static video overlay
				lastPlayTimeRef.current = Date.now()
				
				// RetroTV pattern: Seek to correct position if needed
				if (clipSeekTimeRef.current > 0 && event.target) {
					try {
						const currentTime = event.target.getCurrentTime()
						if (currentTime < clipSeekTimeRef.current - 2) {
							console.log(`[Player] Seeking from ${currentTime.toFixed(1)}s to ${clipSeekTimeRef.current.toFixed(1)}s`)
							event.target.seekTo(clipSeekTimeRef.current, true)
							clipSeekTimeRef.current = 0 // Reset after seeking
						} else {
							clipSeekTimeRef.current = 0
						}
					} catch (err) {
						console.error('[Player] Error seeking:', err)
						clipSeekTimeRef.current = 0
					}
				}
				
				if (bufferTimeoutRef.current) {
					clearTimeout(bufferTimeoutRef.current)
				}
				bufferTimeoutRef.current = setTimeout(() => {
					setIsBuffering(false)
					if (staticAudioRef.current) {
						try {
							staticAudioRef.current.pause()
							staticAudioRef.current.currentTime = 0
						} catch (err) {}
					}
				}, 200)

				if (!progressIntervalRef.current && !isTransitioningRef.current) {
					startProgressMonitoring()
				}
				
				if (onPlaybackStateChange) {
					onPlaybackStateChange({ state: 'playing', videoId: current?.youtubeId })
				}

				emitPlaybackProgress()
				break
				
			case STATE_PAUSED:
				// Don't auto-skip on pause - may be user interaction or loading issue
				// RetroTV skips on pause but that's too aggressive for modern use
				console.log('[Player] Video paused')
				break
				
			case STATE_BUFFERING:
					// RetroTV: Buffering with 8-second watchdog timer
					if (bufferTimeoutRef.current) {
						clearTimeout(bufferTimeoutRef.current)
					}
					bufferTimeoutRef.current = setTimeout(() => {
						if (playbackStateRef.current === 'buffering') {
							setIsBuffering(true)
							setPlaybackHealth('buffering')
							
							if (staticAudioRef.current) {
								try {
									staticAudioRef.current.currentTime = 0
									staticAudioRef.current.play().catch(() => {})
								} catch (err) {}
							}
						}
					}, 500)
					
					// RetroTV watchdog: 8 seconds max buffering
					watchDogTimeOutIdRef.current = setTimeout(() => {
						if (playbackStateRef.current === 'buffering' && isTransitioningRef.current === false) {
							console.warn('[Player] Buffering watchdog triggered - attempting recovery')
							handleVideoError({ data: 5 }) // Trigger error recovery
						}
					}, MAX_BUFFER_TIME)
					break
					
				case STATE_VIDEO_CUED:
					// RetroTV: Video cued - prepare for playback
					if (!progressIntervalRef.current && !isTransitioningRef.current) {
						setTimeout(() => startProgressMonitoring(), 1000)
					}
					break
					
				default:
					break
			}
		} catch (err) {
			console.error('[Player] Error in onStateChange:', err)
		}
	}, [switchToNextVideo, startProgressMonitoring, current?.youtubeId, onPlaybackStateChange, emitPlaybackProgress])

	// Keep refs updated
	onStateChangeRef.current = onStateChange
	handleVideoErrorRef.current = handleVideoError

	// RetroTV Pattern: onReady handler
	const onReady = useCallback((e) => {
		try {
			// Prevent double initialization
			if (hasInitializedRef.current && videoLoadedRef.current) {
				console.log('[Player] Already initialized, skipping')
				return
			}
			
			playerRef.current = e.target
			hasInitializedRef.current = true
			
			console.log('[Player] onReady (RetroTV pattern)')
			
			// RetroTV pattern: Set volume and mute state
			e.target.setVolume(volume * 100)
			if (!userInteracted) {
				e.target.mute() // Start muted for autoplay
			} else {
				e.target.unMute()
			}
			
			// If video not loaded yet (first initialization), load it now
			if (!videoLoadedRef.current && videoId) {
				console.log('[Player] First initialization - loading video:', videoId)
				clipSeekTimeRef.current = startSeconds || offset
				videoLoadedRef.current = true // Mark as loading initiated
				e.target.loadVideoById({
					videoId: videoId,
					startSeconds: 0
				})
				// Seek will happen in STATE_PLAYING handler
				return
			}
			
			// RetroTV pattern: Seek after ready (not before)
			// We loaded with startSeconds=0, now seek to actual position
			const seekTime = clipSeekTimeRef.current || offset
			if (seekTime > 0) {
				console.log(`[Player] Seeking to: ${seekTime.toFixed(1)}s (RetroTV pattern)`)
				e.target.seekTo(seekTime, true)
			}
			
			
			// Small delay before autoplay
			setTimeout(() => {
				if (playerRef.current) {
					if (userInteracted) {
						// User has interacted - play with sound
						try {
							playerRef.current.unMute()
							playerRef.current.setVolume(volume * 100)
							playerRef.current.playVideo()
						} catch (err) {
							console.error('[Player] Error playing:', err)
						}
					} else {
						// Start muted autoplay
						attemptAutoplay(playerRef.current)
					}
					videoLoadedRef.current = true
				}
			}, 50)
			
			YouTubeUIRemover.init()
			
			if (channel?._id) {
				try {
					LocalBroadcastStateManager.updateChannelState(channel._id, {
						channelName: channel.name,
						currentVideoIndex: currIndex,
						currentTime: offset || 0,
					})
				} catch (err) {
					console.error('[Player] Error updating broadcast state:', err)
				}
			}

			// Mark video as healthy
			if (current?.youtubeId) {
				YouTubeRetryManager.healthyVideos?.add(current.youtubeId)
			}

			// Emit initial progress
			setTimeout(() => {
				emitPlaybackProgress()
			}, 200)
		} catch(err) {
			console.error('[Player] Error in onReady:', err)
		}
	}, [volume, offset, currIndex, channel, current?.youtubeId, emitPlaybackProgress, attemptAutoplay, userInteracted, videoId, startSeconds])

	// Keep ref updated
	onReadyRef.current = onReady

	// ===== RENDER =====

	if (!channel) {
		return (
			<div className="player-wrapper player-loading">
				<div className="tv-off-message">NO CHANNEL</div>
			</div>
		)
	}

	if (items.length === 0) {
		return (
			<div className="player-wrapper player-loading">
				<div className="tv-off-message">NO VIDEOS IN CHANNEL</div>
			</div>
		)
	}

	if (!current) {
		return (
			<div className="player-wrapper player-loading">
				<div className="tv-off-message">LOADING VIDEO...</div>
			</div>
		)
}

return (
		<div className="player-wrapper">
			{/* Static video for loading/buffering - plays on top to cover YouTube loading */}
			<video
				ref={staticVideoRef}
				src="/sounds/alb_tvn0411_1080p.mp4"
				preload="auto"
				loop
				muted
				playsInline
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: '100%',
					height: '100%',
					objectFit: 'cover',
					zIndex: (showStaticOverlay || isBuffering || isTransitioning) ? 10 : -1,
					opacity: (showStaticOverlay || isBuffering || isTransitioning) ? 1 : 0,
					transition: 'opacity 0.3s ease-out',
					pointerEvents: 'none',
				}}
			/>
			{/* Static audio (separate for better control) */}
			<audio
				ref={staticAudioRef}
				src="/sounds/tv-static-noise-291374.mp3"
				preload="auto"
				loop
			/>
			<div className="crt-scanlines" style={{ zIndex: 20, pointerEvents: 'none' }}></div>
			{/* Direct YouTube IFrame API - iPhone compatible */}
			<div
				id="desitv-player-iframe"
				className="youtube-player-container"
				style={{
					width: '100%',
					height: '100%',
					position: 'absolute',
					top: 0,
					left: 0
				}}
			/>
			{/* Glass overlay - blocks all iframe interactions (RetroTV pattern) */}
			<div
				className="player-glass-overlay"
				onClick={handleUserInteraction}
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: '100%',
					height: '100%',
					zIndex: 5,
					cursor: isMutedAutoplay ? 'pointer' : 'default',
					background: 'transparent',
				}}
			/>
			{/* Tap to unmute indicator - only show when muted autoplay is active */}
			{isMutedAutoplay && !showStaticOverlay && !isBuffering && !isTransitioning && (
				<div
					className="tap-to-unmute"
					onClick={handleUserInteraction}
					style={{
						position: 'absolute',
						bottom: '20px',
						left: '50%',
						transform: 'translateX(-50%)',
						zIndex: 15,
						background: 'rgba(0, 0, 0, 0.7)',
						color: '#fff',
						padding: '8px 16px',
						borderRadius: '20px',
						fontSize: '12px',
						fontFamily: 'monospace',
						cursor: 'pointer',
						animation: 'pulse 2s infinite',
						pointerEvents: 'auto',
					}}
				>
					🔇 TAP FOR SOUND
				</div>
			)}
			{/* Retry indicator overlay */}
			{(isBuffering || isTransitioning) && retryCount > 0 && (
				<div className="static-effect-tv" style={{ background: 'transparent', pointerEvents: 'none' }}>
					<div className="retry-indicator">
						RETRY {retryCount}/{MAX_RETRY_ATTEMPTS}
					</div>
				</div>
			)}
			{playbackHealth === 'failed' && (
				<div className="playback-error-overlay" style={{ pointerEvents: 'none' }}>
					<div className="error-message">PLAYBACK ERROR - RECOVERING...</div>
				</div>
			)}
</div>
)
}
