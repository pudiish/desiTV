import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { useBroadcastPosition } from '../hooks/useBroadcastPosition'
import YouTubeUIRemover from '../utils/YouTubeUIRemover'
import mediaSessionManager from '../utils/MediaSessionManager'
import { unifiedPlaybackManager } from '../logic/playback'
import { broadcastStateManager } from '../logic/broadcast'
import { PLAYBACK_THRESHOLDS } from '../config/thresholds'
import { YOUTUBE_STATES, YOUTUBE_ERROR_CODES, YOUTUBE_PERMANENT_ERRORS } from '../config/constants/youtube'
import { PLAYBACK_CONSTANTS } from '../config/constants/playback'
import VideoSourceManager from '../utils/VideoSourceManager'

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
	allChannels = [], 
onBufferingChange = null,
	onPlaybackStateChange = null, // Callback for playback state
	onPlaybackProgress = null, // Emits current playback position
	onTapHandlerReady = null, // Callback to expose tap handler for external triggers (kept for compatibility)
	power = true, // Power state - controls whether playback should be active
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
	const [userInteracted, setUserInteracted] = useState(false) // Track user interaction (power ON counts as interaction)
	const [isMutedAutoplay, setIsMutedAutoplay] = useState(true) // Always start muted for mobile autoplay compatibility
	const [showStaticOverlay, setShowStaticOverlay] = useState(true) // Show static on initial load only
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
	const staticShownRef = useRef(false) // Track if static has been shown for current video
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
	const powerRef = useRef(power) // Track power state
	const shouldPlayRef = useRef(false) // Track if we should be playing
	const playAttemptInProgressRef = useRef(false) // Prevent multiple simultaneous play attempts
	const lastPlayAttemptRef = useRef(0) // Track last play attempt time for debouncing
	const loadedVideoRef = useRef(null) // Cache: { videoId, offset, channelId } - track what's currently loaded
	const loadVideoTimeoutRef = useRef(null) // Debounce video loading
	const videoSourceManagerRef = useRef(null) // Video source fallback manager

	// ===== CONSTANTS FROM CONFIG =====
	// Use constants from config files for easy tweaking
	const STATE_UNSTARTED = YOUTUBE_STATES.UNSTARTED
	const STATE_ENDED = YOUTUBE_STATES.ENDED
	const STATE_PLAYING = YOUTUBE_STATES.PLAYING
	const STATE_PAUSED = YOUTUBE_STATES.PAUSED
	const STATE_BUFFERING = YOUTUBE_STATES.BUFFERING
	const STATE_VIDEO_CUED = YOUTUBE_STATES.VIDEO_CUED
	
	const SWITCH_BEFORE_END = PLAYBACK_THRESHOLDS.SWITCH_BEFORE_END
	const MAX_BUFFER_TIME = PLAYBACK_THRESHOLDS.MAX_BUFFER_TIME
	const MAX_RETRY_ATTEMPTS = PLAYBACK_THRESHOLDS.MAX_RETRY_ATTEMPTS
	const RETRY_BACKOFF_BASE = PLAYBACK_THRESHOLDS.RETRY_BACKOFF_BASE
	const ERROR_SKIP_DELAY = PLAYBACK_THRESHOLDS.ERROR_SKIP_DELAY

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

	// Initialize video source manager for current video
	const videoSourceManager = useMemo(() => {
		if (!current) return null
		return new VideoSourceManager(current, { maxFallbacks: 3 })
	}, [current])
	
	// Store in ref for use in callbacks
	videoSourceManagerRef.current = videoSourceManager

	// Get current video ID from source manager (with fallback support)
	const currentSource = videoSourceManager?.getCurrentSource()
	const videoId = currentSource?.id || current?.youtubeId
	
	// Calculate start seconds from broadcast position offset
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

	// ===== AUTOPLAY HELPER (Mobile-compatible with power ON = user interaction) =====
	// Strategy: On mobile, start muted for autoplay compatibility, then unmute once playing
	// Power ON sets userInteracted=true which triggers immediate unmute after playback starts
	const attemptAutoplay = useCallback(async (player) => {
		if (!player) return
		
		// Reset autoplay attempted flag if player state is unstarted (stuck state)
		if (player.getPlayerState?.() === STATE_UNSTARTED) {
			autoplayAttemptedRef.current = false
		}
		
		if (autoplayAttemptedRef.current) return
		
		try {
			autoplayAttemptedRef.current = true
			
			// MOBILE FIX: Always start muted for autoplay compatibility
			// Even if user clicked power button, the gesture context is lost by the time YT player loads
			console.log('[Player] Attempting muted autoplay (mobile compatible)')
			
			player.mute()
			player.setVolume(volume * 100) // Set volume for when we unmute later
			
			// Set shouldPlay to true
			shouldPlayRef.current = true
			
			// Play muted first (this works on all browsers/mobile)
			player.playVideo()
			
			setIsMutedAutoplay(true)
			
			// Mobile fix: Check if playback actually started after delay
			setTimeout(() => {
				if (player && powerRef.current) {
					const state = player.getPlayerState?.()
					if (state === STATE_PLAYING) {
						// Playback started! Now unmute if user has interacted (power ON)
						if (userInteracted) {
							console.log('[Player] Playback started - unmuting (user interacted via power ON)')
							player.unMute()
							player.setVolume(volume * 100)
							setIsMutedAutoplay(false)
						}
					} else if (state === STATE_UNSTARTED || state === STATE_VIDEO_CUED || state === STATE_PAUSED) {
						console.log('[Player] Mobile: Playback stuck, retrying muted...')
						autoplayAttemptedRef.current = false // Allow retry
						player.mute()
						player.playVideo()
					}
				}
			}, 1000)
			
			// Second check at 2s for stubborn mobile browsers
			setTimeout(() => {
				if (player && powerRef.current) {
					const state = player.getPlayerState?.()
					if (state === STATE_PLAYING) {
						// Unmute if user has interacted
						if (userInteracted && isMutedAutoplay) {
							console.log('[Player] Late unmute after power ON interaction')
							player.unMute()
							player.setVolume(volume * 100)
							setIsMutedAutoplay(false)
						}
					} else if (state === STATE_UNSTARTED || state === STATE_VIDEO_CUED || state === STATE_PAUSED) {
						console.log('[Player] Mobile: Still stuck, showing tap overlay')
						setNeedsUserInteraction(true)
					}
				}
			}, 2500)
			
		} catch (err) {
			console.warn('[Player] Autoplay failed:', err)
			autoplayAttemptedRef.current = false
			setNeedsUserInteraction(true)
		}
	}, [volume, userInteracted, isMutedAutoplay])

	/* ===== BACKUP: MUTED AUTOPLAY APPROACH =====
	 * To restore this approach:
	 * 1. Replace attemptAutoplay above with this version
	 * 2. Change initial state: isMutedAutoplay to useState(true)
	 * 3. In Home.jsx, restore session power state restoration
	 * 4. Remove the power ON = userInteracted logic in the power effect
	 *
	const attemptAutoplay = useCallback(async (player) => {
		if (!player) return
		
		if (player.getPlayerState?.() === STATE_UNSTARTED) {
			autoplayAttemptedRef.current = false
		}
		
		if (autoplayAttemptedRef.current) return
		
		try {
			autoplayAttemptedRef.current = true
			console.log('[Player] Attempting muted autoplay (mobile compatible)')
			
			// Start muted - this is allowed on mobile/iOS
			player.mute()
			player.setVolume(volume * 100)
			shouldPlayRef.current = true
			player.playVideo()
			
			// Check if playback started
			setTimeout(() => {
				if (player && powerRef.current) {
					const state = player.getPlayerState?.()
					if (state === STATE_UNSTARTED || state === STATE_VIDEO_CUED) {
						console.log('[Player] Mobile: Playback stuck, retrying...')
						autoplayAttemptedRef.current = false
						player.playVideo()
					} else if (state === STATE_PLAYING) {
						setIsMutedAutoplay(true)
					}
				}
			}, 500)
			
			setTimeout(() => {
				if (player && powerRef.current) {
					const state = player.getPlayerState?.()
					if (state === STATE_UNSTARTED || state === STATE_VIDEO_CUED || state === STATE_PAUSED) {
						console.log('[Player] Mobile: Playback stuck, showing tap overlay')
						setNeedsUserInteraction(true)
					}
				}
			}, 2000)
			
			setIsMutedAutoplay(true)
		} catch (err) {
			console.warn('[Player] Autoplay failed:', err)
			autoplayAttemptedRef.current = false
			setNeedsUserInteraction(true)
		}
	}, [volume])
	===== END BACKUP ===== */

	// Handle user interaction - unmute smoothly without reload
	// CRITICAL: This must be called synchronously from a user gesture (click/tap) to work on mobile
	const handleUserInteraction = useCallback(() => {
		// Always try to unmute even if userInteracted is already true
		// This ensures we catch the gesture context
		const player = playerRef.current || ytPlayerRef.current
		
		try {
			console.log('[Player] User interaction detected - enabling playback/sound')
			
			// Mark as interacted
			setUserInteracted(true)
			setNeedsUserInteraction(false)
			setIsMutedAutoplay(false) // Mark that we're no longer in muted autoplay mode
			
			if (!player) {
				console.log('[Player] No player yet - will unmute when ready')
				return
			}
			
			// CRITICAL: Unmute IMMEDIATELY while we have user gesture context
			// This is the key to getting sound on mobile without additional taps
			try {
				player.unMute()
				player.setVolume(volume * 100)
				console.log('[Player] Unmuted successfully in user gesture context')
			} catch (unmuteErr) {
				console.warn('[Player] Could not unmute:', unmuteErr)
			}
			
			// Ensure video is playing (critical for mobile first-load)
			const state = player.getPlayerState?.()
			console.log('[Player] Current player state:', state)
			
			if (state === -1 || state === 0 || state === 2 || state === 5) {
				// -1: UNSTARTED, 0: ENDED, 2: PAUSED, 5: CUED
				console.log('[Player] Starting playback after user tap')
				player.playVideo()
			}
			
			console.log('[Player] Sound enabled via user gesture')
		} catch (err) {
			console.error('[Player] Error enabling sound:', err)
		}
	}, [volume]) // Removed userInteracted dependency so it always runs

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

	// Effect: Smart video loading with caching (only load when video actually changes)
	useEffect(() => {
		if (!videoId || !channel?._id || !ytPlayerRef.current) return

		// Clear any pending load timeout
		if (loadVideoTimeoutRef.current) {
			clearTimeout(loadVideoTimeoutRef.current)
			loadVideoTimeoutRef.current = null
		}

		const loaded = loadedVideoRef.current
		const VIDEO_BUFFER_WINDOW = PLAYBACK_THRESHOLDS.VIDEO_BUFFER_WINDOW || 5

		// Check if we need to reload:
		// 1. Different video ID
		// 2. Different channel
		// 3. Offset is outside buffer window (more than 5 seconds difference)
		const needsReload = !loaded || 
			loaded.videoId !== videoId || 
			loaded.channelId !== channel._id ||
			Math.abs(loaded.offset - startSeconds) > VIDEO_BUFFER_WINDOW

		if (!needsReload) {
			// Same video within buffer window - just seek if needed
			const offsetDiff = Math.abs(loaded.offset - startSeconds)
			if (offsetDiff > 1) { // Only seek if difference is more than 1 second
				try {
					if (typeof ytPlayerRef.current.seekTo === 'function') {
						ytPlayerRef.current.seekTo(startSeconds, true)
						loadedVideoRef.current = { videoId, offset: startSeconds, channelId: channel._id }
						console.log(`[Player] Seeking to ${startSeconds}s (within buffer window)`)
					}
				} catch (err) {
					console.error('[Player] Error seeking:', err)
				}
			}
			return
		}

		// Debounce video loading to avoid rapid reloads
		loadVideoTimeoutRef.current = setTimeout(() => {
			if (!ytPlayerRef.current || !videoId || !channel?._id) return

			// Ensure player is fully initialized
			if (typeof ytPlayerRef.current.loadVideoById !== 'function') {
				setTimeout(() => {
					if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
						// Load video
						try {
							ytPlayerRef.current.loadVideoById({
								videoId: videoId,
								startSeconds: 0
							})
							e7Ref.current = true
							clipSeekTimeRef.current = startSeconds
							loadedVideoRef.current = { videoId, offset: startSeconds, channelId: channel._id }
							console.log(`[Player] Loading video: ${videoId} at ${startSeconds}s (channel: ${channel._id})`)
						} catch (err) {
							console.error('[Player] Error loading video:', err)
						}
					}
				}, 100)
				return
			}

			console.log(`[Player] Loading video: ${videoId} at ${startSeconds}s (channel: ${channel._id})`)
			
			e7Ref.current = true
			clipSeekTimeRef.current = startSeconds
			
			try {
				// Load video starting at 0, then seek after ready
				ytPlayerRef.current.loadVideoById({
					videoId: videoId,
					startSeconds: 0
				})
				
				// Update cache
				loadedVideoRef.current = { videoId, offset: startSeconds, channelId: channel._id }
			} catch (err) {
				console.error('[Player] Error loading video:', err)
			}
		}, 100) // Small debounce to batch rapid changes

		return () => {
			if (loadVideoTimeoutRef.current) {
				clearTimeout(loadVideoTimeoutRef.current)
				loadVideoTimeoutRef.current = null
			}
		}
	}, [videoId, channel?._id, startSeconds])

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
			setShowStaticOverlay(true) // Show static when changing channels (intentional transition)
			staticShownRef.current = true
			e7Ref.current = false
			clipSeekTimeRef.current = 0
			// Clear loaded video cache on channel change
			loadedVideoRef.current = null
			
			setIsTransitioning(false)
			isTransitioningRef.current = false
			
			if (onChannelChange) onChannelChange()
		}
	}, [channel?._id, onChannelChange])

	// Suppress console errors for YouTube postMessage origin warnings in development
	// Note: YouTube API is loaded in main.jsx, so we don't need to load it here
	useEffect(() => {
		if (import.meta.env?.DEV) {
			const originalError = console.error
			console.error = (...args) => {
				const message = args.join(' ')
				// Suppress YouTube postMessage origin warnings (harmless in development)
				if (message.includes('Failed to execute \'postMessage\'') && 
				    message.includes('www-widgetapi.js')) {
					return // Suppress this specific error
				}
				originalError.apply(console, args)
			}

			return () => {
				console.error = originalError
			}
		}
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
						autoplay: 1, // Enable autoplay (muted for mobile compatibility)
						playsinline: 1, // Critical for iOS
						controls: 0, // No controls
						modestbranding: 1, // Minimal branding
						rel: 0, // No related videos
						iv_load_policy: 3, // No annotations
						mute: 1, // ALWAYS start muted for mobile autoplay - unmute happens after playback starts
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

		// RetroTV pattern: Set up onYouTubeIframeAPIReady
		// Video loading is now handled by the smart caching effect above
		if (window.YT && window.YT.Player) {
			// API already loaded
			if (!ytPlayerRef.current) {
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
	}, [channel?._id]) // Only re-run on channel change, not video/offset changes

	// Effect: Load and restore saved state with retry
	useEffect(() => {
		if (!channel?._id || items.length === 0) return

		// Initialize channel state (loads from localStorage if exists)
		try {
			console.log(`[Player] Initializing state for channel ${channel._id}...`)
			
			broadcastStateManager.initializeChannel(channel)
			
			// Start auto-save if not already started
			if (!broadcastStateManager.saveInterval) {
				broadcastStateManager.startAutoSave()
			}

			// Position is calculated by useBroadcastPosition hook
			// which uses broadcastStateManager internally
		} catch (err) {
			console.error('[Player] Error initializing state:', err)
		}
	}, [channel?._id, items.length])

	// Effect: Save state before page unload
	useEffect(() => {
		const handleBeforeUnload = () => {
			try {
				// Force save to localStorage
				broadcastStateManager.saveToStorage()
				console.log('[Player] State saved to localStorage on unload')
			} catch (err) {
				console.error('[Player] Error saving on unload:', err)
			}
		}

		window.addEventListener('beforeunload', handleBeforeUnload)
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload)
			// Cleanup: stop auto-save when component unmounts
			broadcastStateManager.stopAutoSave()
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

	// Use unified playback manager's safe play function
	// Defined early so it can be used in dependency arrays
	const safePlayVideo = useCallback(() => {
		return unifiedPlaybackManager.safePlayVideo()
	}, [])

	// Effect: Re-initialize MediaSession when channel/video changes (debounced)
	useEffect(() => {
		if (!current || !playerRef.current || !hasInitializedRef.current) return
		
		// Debounce MediaSession updates to avoid excessive re-initialization
		const timeoutId = setTimeout(() => {
			if (!current || !playerRef.current) return
			
			// Re-initialize MediaSession with new video metadata
			mediaSessionManager.init(
				{
					title: current.title || 'DesiTV',
					artist: channel?.name || 'DesiTV Channel',
					album: 'Live TV',
					channelName: channel?.name,
				},
				{
					play: () => {
						if (playerRef.current) {
							playerRef.current.playVideo()
						}
					},
					pause: () => {
						if (playerRef.current) {
							playerRef.current.pauseVideo()
						}
					},
					previoustrack: () => {
						// Switch to previous video
						if (items.length > 0) {
							const prevIndex = currIndex === 0 ? items.length - 1 : currIndex - 1
							if (channel?._id) {
								try {
									broadcastStateManager.jumpToVideo(
										channel._id,
										prevIndex,
										0,
										items
									)
								} catch (err) {
									console.error('[Player] Error jumping to previous video:', err)
								}
							}
						}
					},
					nexttrack: () => {
						// Switch to next video
						if (switchToNextVideoRef.current) {
							switchToNextVideoRef.current()
						}
					},
					seekbackward: (details) => {
						if (playerRef.current) {
							try {
								const seekOffset = details.seekOffset || 10
								const currentTime = playerRef.current.getCurrentTime?.() || 0
								if (typeof currentTime === 'number') {
									playerRef.current.seekTo(Math.max(0, currentTime - seekOffset), true)
								} else if (currentTime && typeof currentTime.then === 'function') {
									currentTime.then((time) => {
										playerRef.current.seekTo(Math.max(0, time - seekOffset), true)
									}).catch(() => {})
								}
							} catch (err) {
								console.error('[Player] Error seeking backward:', err)
							}
						}
					},
					seekforward: (details) => {
						if (playerRef.current) {
							try {
								const seekOffset = details.seekOffset || 10
								const currentTime = playerRef.current.getCurrentTime?.() || 0
								const duration = playerRef.current.getDuration?.() || 0
								
								if (typeof currentTime === 'number' && typeof duration === 'number') {
									playerRef.current.seekTo(Math.min(duration, currentTime + seekOffset), true)
								} else {
									// Handle promises
									Promise.resolve(currentTime).then((time) => {
										Promise.resolve(duration).then((dur) => {
											playerRef.current.seekTo(Math.min(dur, time + seekOffset), true)
										}).catch(() => {})
									}).catch(() => {})
								}
							} catch (err) {
								console.error('[Player] Error seeking forward:', err)
							}
						}
					},
				}
			)
			
			// Update position state and playback state safely
			setTimeout(() => {
				if (playerRef.current) {
					try {
						const state = playerRef.current.getPlayerState?.()
						const duration = playerRef.current.getDuration?.() || 0
						const currentTime = playerRef.current.getCurrentTime?.() || 0
						
						// Set playback state based on current player state (critical for iOS background playback)
						if (state === STATE_PLAYING || state === STATE_BUFFERING) {
							mediaSessionManager.setPlaybackState('playing')
						} else if (state === STATE_PAUSED) {
							mediaSessionManager.setPlaybackState('paused')
						}
						
						if (typeof duration === 'number' && typeof currentTime === 'number') {
							mediaSessionManager.setPositionState({
								duration: duration || 0,
								playbackRate: 1.0,
								position: currentTime || 0,
							})
						} else {
							// Handle promises
							Promise.resolve(duration).then((dur) => {
								Promise.resolve(currentTime).then((time) => {
									mediaSessionManager.setPositionState({
										duration: dur || 0,
										playbackRate: 1.0,
										position: time || 0,
									})
								}).catch(() => {})
							}).catch(() => {})
						}
					} catch (err) {
						// Silently fail
					}
				}
			}, 1000) // Delay to ensure video is loaded
		}, 500) // Debounce MediaSession updates
		
		return () => clearTimeout(timeoutId)
	}, [current?.youtubeId, current?.title, channel?.name, channel?._id, currIndex, items])

	// Effect: Handle page visibility for background playback (retro-tv org pattern)
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				// Page is in background - maintain playback state for iOS/mobile
				console.log('[Player] Page went to background - maintaining playback state')
				
				// CRITICAL for iOS background playback: Set MediaSession state BEFORE going to background
				// This tells iOS to keep audio playing even if video pauses
				if (playerRef.current && powerRef.current) {
					try {
						const state = playerRef.current.getPlayerState?.()
						
						// Always set MediaSession to 'playing' if we should be playing
						// This is key for iOS background audio continuation
						if (state === STATE_PLAYING || state === STATE_BUFFERING || shouldPlayRef.current) {
							mediaSessionManager.setPlaybackState('playing')
							
							// Update position state for lock screen controls
							const duration = playerRef.current.getDuration?.() || 0
							const currentTime = playerRef.current.getCurrentTime?.() || 0
							
							if (typeof duration === 'number' && typeof currentTime === 'number' && duration > 0) {
								mediaSessionManager.setPositionState({
									duration: duration,
									playbackRate: 1.0,
									position: currentTime,
								})
							}
							
							console.log('[Player] MediaSession set to playing for background playback')
						}
					} catch (err) {
						console.error('[Player] Error setting MediaSession state on background:', err)
					}
				}
			} else {
				// Page is visible again - resume playback if it was paused by iOS
				console.log('[Player] Page became visible - checking playback state')
				
				if (playerRef.current && current && powerRef.current && shouldPlayRef.current) {
					// Small delay to ensure player is ready
					setTimeout(() => {
						try {
							const state = playerRef.current.getPlayerState?.()
							const duration = playerRef.current.getDuration?.() || 0
							const currentTime = playerRef.current.getCurrentTime?.() || 0
							
							// Update position state
							if (typeof duration === 'number' && typeof currentTime === 'number' && duration > 0) {
								mediaSessionManager.setPositionState({
									duration: duration,
									playbackRate: 1.0,
									position: currentTime,
								})
							}
							
							// If iOS paused the video, resume it (muted autoplay or with sound based on user interaction)
							if (state === STATE_PAUSED) {
								console.log('[Player] Resuming playback after returning from background')
								if (userInteracted) {
									// User has interacted - resume with sound
									playerRef.current.unMute()
									playerRef.current.setVolume(volume * 100)
									playerRef.current.playVideo()
								} else {
									// No user interaction - resume muted autoplay
									attemptAutoplay(playerRef.current)
								}
								mediaSessionManager.setPlaybackState('playing')
							} else if (state === STATE_PLAYING) {
								// Ensure MediaSession state matches
								mediaSessionManager.setPlaybackState('playing')
							}
						} catch (err) {
							console.error('[Player] Error updating position on visibility change:', err)
						}
					}, 200) // Reduced delay for faster resume
				}
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange)
		}
	}, [current, power, userInteracted, attemptAutoplay, volume])

	// Effect: Update MediaSession position state periodically (simplified - no health check)
	// Fast recovery manager handles all recovery, this just updates position
	useEffect(() => {
		if (!playerRef.current || !current || !power) return

		const updatePositionState = () => {
			// Only update if power is on and playing
			if (!powerRef.current) return
			
			try {
				const state = playerRef.current.getPlayerState?.()
				if (state === STATE_PLAYING) {
					// Update MediaSession position state when playing
					const duration = playerRef.current.getDuration?.() || 0
					const currentTime = playerRef.current.getCurrentTime?.() || 0
					
					if (typeof duration === 'number' && typeof currentTime === 'number') {
						mediaSessionManager.setPositionState({
							duration: duration || 0,
							playbackRate: 1.0,
							position: currentTime || 0,
						})
					} else {
						// Handle promises
						Promise.resolve(duration).then((dur) => {
							Promise.resolve(currentTime).then((time) => {
								mediaSessionManager.setPositionState({
									duration: dur || 0,
									playbackRate: 1.0,
									position: time || 0,
								})
							}).catch(() => {})
						}).catch(() => {})
					}
				}
			} catch (err) {
				// Silently fail - position updates are non-critical
			}
		}

		const interval = setInterval(updatePositionState, 10000) // Update every 10 seconds
		return () => clearInterval(interval)
	}, [current?.youtubeId, power])

	// Effect: Cleanup
	useEffect(() => {
		return () => {
			unifiedPlaybackManager.stop()
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
			broadcastStateManager.stopAutoSave()
			mediaSessionManager.clear()
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

	// Effect: Update power ref and treat power ON as user interaction
	useEffect(() => {
		const wasPoweredOff = !powerRef.current
		powerRef.current = power
		shouldPlayRef.current = power
		
		// If power just turned ON, treat it as user interaction (they clicked the power button)
		if (power && wasPoweredOff) {
			console.log('[Player] Power turned ON - treating as user interaction')
			setUserInteracted(true)
			setIsMutedAutoplay(false)
			setNeedsUserInteraction(false)
		}
	}, [power])

	// Effect: Hard-stop static audio when power is off to avoid lingering glitches
	useEffect(() => {
		if (!power && staticAudioRef.current) {
			try {
				staticAudioRef.current.pause()
				staticAudioRef.current.currentTime = 0
			} catch (err) {}
		}
	}, [power])

	// Effect: Start/stop unified playback manager based on power state
	useEffect(() => {
		if (power && playerRef.current && hasInitializedRef.current) {
			// Start unified playback manager when power is on
			unifiedPlaybackManager.start(playerRef, {
				shouldPlay: () => {
					// Power ON = user interacted, so always allow playback
					return powerRef.current && shouldPlayRef.current && !isTransitioningRef.current
				},
				onRecovery: (type) => {
					console.log(`[Player] Playback recovery successful: ${type}`)
					mediaSessionManager.setPlaybackState('playing')
					setPlaybackHealth('healthy')
					lastPlayTimeRef.current = Date.now()
				},
				onStateChange: (newState, oldState) => {
					// Optional: Handle state changes if needed
				},
			})
			
			// Mobile startup watchdog: Check if playback started within 3 seconds
			// MOBILE FIX: Always try muted first - unmute happens in STATE_PLAYING
			const mobileWatchdog = setTimeout(() => {
				if (playerRef.current && powerRef.current) {
					const state = playerRef.current.getPlayerState?.()
					if (state === STATE_UNSTARTED || state === STATE_VIDEO_CUED || state === STATE_PAUSED) {
						console.log('[Player] Mobile startup watchdog triggered - forcing muted playback')
						autoplayAttemptedRef.current = false // Reset to allow retry
						
						// MOBILE FIX: Start muted - unmute will happen in STATE_PLAYING if userInteracted
						playerRef.current.mute()
						playerRef.current.playVideo()
						setIsMutedAutoplay(true)
					}
				}
			}, 3000)
			
			// Second watchdog at 6 seconds for very stubborn cases
			const mobileWatchdog2 = setTimeout(() => {
				if (playerRef.current && powerRef.current) {
					const state = playerRef.current.getPlayerState?.()
					if (state === STATE_UNSTARTED || state === STATE_VIDEO_CUED || state === STATE_PAUSED) {
						console.log('[Player] Mobile startup watchdog 2 triggered - final muted playback attempt')
						playerRef.current.mute()
						playerRef.current.playVideo()
					}
				}
			}, 6000)
			
			return () => {
				clearTimeout(mobileWatchdog)
				clearTimeout(mobileWatchdog2)
				unifiedPlaybackManager.stop()
			}
		} else {
			// Stop unified playback manager when power is off
			unifiedPlaybackManager.stop()
		}
		
		return () => {
			unifiedPlaybackManager.stop()
		}
	}, [power, hasInitializedRef.current, volume])

	// Effect: Handle power on/off - RESTRUCTURED for robustness
	useEffect(() => {
		if (!hasInitializedRef.current) return

		if (power) {
			// Power ON - MOBILE FIX: Always use muted autoplay strategy
			// Unmuting happens in STATE_PLAYING when playback actually starts
			shouldPlayRef.current = true
			
			const timeoutId = setTimeout(() => {
				if (playerRef.current && powerRef.current && !isTransitioningRef.current) {
					try {
						const state = playerRef.current.getPlayerState?.()
						
						// If paused, unstarted, or cued, try to play (muted first for mobile)
						if (state === STATE_PAUSED || state === STATE_UNSTARTED || state === STATE_VIDEO_CUED) {
							console.log('[Player] Power ON - starting muted autoplay, state:', state)
							// MOBILE FIX: Always use attemptAutoplay which starts muted
							// This ensures playback works on mobile after reload
							attemptAutoplay(playerRef.current)
							mediaSessionManager.setPlaybackState('playing')
							unifiedPlaybackManager.reset()
						} else if (state === STATE_PLAYING) {
							// Already playing - unmute if user interacted
							if (userInteracted && isMutedAutoplay) {
								playerRef.current.unMute()
								playerRef.current.setVolume(volume * 100)
								setIsMutedAutoplay(false)
							}
							mediaSessionManager.setPlaybackState('playing')
							unifiedPlaybackManager.reset()
						}
					} catch (err) {
						console.error('[Player] Error resuming on power on:', err)
					}
				}
			}, 300)
			
			return () => clearTimeout(timeoutId)
		} else {
			// Power OFF - pause playback
			shouldPlayRef.current = false
			playAttemptInProgressRef.current = false // Clear play attempt flag
			
			if (playerRef.current) {
				try {
					playerRef.current.pauseVideo()
					mediaSessionManager.setPlaybackState('paused')
				} catch (err) {
					console.error('[Player] Error pausing on power off:', err)
				}
			}
		}
	}, [power, hasInitializedRef.current, userInteracted, attemptAutoplay, volume, isMutedAutoplay])

	// Effect: Ensure playback continues after channel/video change - RESTRUCTURED
	useEffect(() => {
		if (!current || !playerRef.current || !hasInitializedRef.current || isTransitioningRef.current || !power) {
			return
		}

		// Wait for video to load before attempting playback
		const timeoutId = setTimeout(() => {
			if (!playerRef.current || isTransitioningRef.current || !powerRef.current) {
				return
			}

			try {
				const state = playerRef.current.getPlayerState?.()
				
				// If paused, unstarted, or cued, start playback (muted first for mobile)
				if (state === STATE_PAUSED || state === STATE_UNSTARTED || state === STATE_VIDEO_CUED) {
					console.log('[Player] Channel/video changed - starting muted autoplay, state:', state)
					// MOBILE FIX: Always use attemptAutoplay (muted first)
					attemptAutoplay(playerRef.current)
					mediaSessionManager.setPlaybackState('playing')
					unifiedPlaybackManager.reset()
				} else if (state === STATE_PLAYING) {
					// Already playing - unmute if user interacted
					if (userInteracted && isMutedAutoplay) {
						playerRef.current.unMute()
						playerRef.current.setVolume(volume * 100)
						setIsMutedAutoplay(false)
					}
					mediaSessionManager.setPlaybackState('playing')
					unifiedPlaybackManager.reset()
				} else if (state === STATE_BUFFERING) {
					// Buffering - let unified playback manager handle it
				}
			} catch (err) {
				console.error('[Player] Error resuming playback after change:', err)
			}
		}, 800) // Increased delay to ensure video is loaded
		
		return () => clearTimeout(timeoutId)
	}, [current?.youtubeId, channel?._id, power, userInteracted, attemptAutoplay, volume, isMutedAutoplay])

	// ===== CALLBACKS =====

	const emitPlaybackProgress = useCallback(() => {
		if (!onPlaybackProgress || !playerRef.current) return

		const player = playerRef.current
		const videoData = player.getVideoData ? player.getVideoData() : {}
		const actualVideoId = videoData?.video_id
		const currentPromise = player.getCurrentTime ? Promise.resolve(player.getCurrentTime()) : Promise.resolve(0)
		const durationPromise = player.getDuration ? Promise.resolve(player.getDuration()) : Promise.resolve(current?.duration || 0)

		Promise.all([currentPromise, durationPromise])
			.then(([currentTime, duration]) => {
				// CRITICAL: Find the ACTUAL video index from what YouTube is playing
				// NOT from broadcastPosition which can be wrong
				let actualVideoIndex = currIndex
				let actualVideo = current
				let actualTitle = current?.title || ''

				if (actualVideoId && items.length > 0) {
					// Find the video in items by YouTube ID
					const foundIndex = items.findIndex(v => v.youtubeId === actualVideoId)
					if (foundIndex !== -1) {
						actualVideoIndex = foundIndex
						actualVideo = items[foundIndex]
						actualTitle = videoData?.title || items[foundIndex]?.title || ''
					} else {
						// Video not in items - use YouTube data
						actualTitle = videoData?.title || current?.title || ''
					}
				} else if (videoData?.title) {
					// No video_id but have title from YouTube
					actualTitle = videoData.title
				}

				onPlaybackProgress({
					channelId: channel?._id,
					videoIndex: actualVideoIndex,
					video: actualVideo,
					videoId: actualVideoId || current?.youtubeId,
					videoTitle: actualTitle,
					currentTime: currentTime || 0,
					duration: duration || current?.duration || 0,
				})
			})
			.catch(() => {})
	}, [channel?._id, currIndex, current, items, onPlaybackProgress])

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

	// Simple: play next video immediately - RESTRUCTURED for robustness
	// Note: The next video is automatically calculated by pseudoLive algorithm on channel epoch
	// We just trigger the video switch and let broadcastPosition hook recalculate
	const switchToNextVideo = useCallback(() => {
		if (isTransitioningRef.current) {
			console.log('[Player] Already transitioning, skipping switch')
			return
		}
		if (!playerRef.current) {
			console.warn('[Player] No player ref, cannot switch video')
			return
		}
		if (!items || items.length === 0) {
			console.warn('[Player] No items available, cannot switch')
			return
		}

		isTransitioningRef.current = true
		setShowStaticOverlay(true) // Show static during intentional video transition
		staticShownRef.current = true

		// Stop progress monitoring
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current)
			progressIntervalRef.current = null
		}

		if (onVideoEnd) onVideoEnd()

		// Determine next video based on current mode
		// Manual mode persists until category/channel is changed (no timer expiration)
		let nextVid = null
		let targetOffset = 0
		let nextIdx = (currIndex + 1) % items.length
		
		if (channel?._id && broadcastStateManager.getMode(channel._id) === 'manual') {
			// Manual mode - continue sequential progression (user manually changed channel)
			nextVid = items[nextIdx]
			targetOffset = 0
			console.log(`[Player] Manual mode - continuing sequential to video ${nextIdx}`)
		} else {
			// Timeline mode - calculate from timeline (pseudo-live)
			const timelinePosition = broadcastStateManager.calculateCurrentPosition(channel)
			nextIdx = timelinePosition.videoIndex
			nextVid = items[nextIdx]
			targetOffset = timelinePosition.offset
			console.log(`[Player] Timeline mode - video ${nextIdx} at ${targetOffset.toFixed(1)}s`)
		}

		if (nextVid?.youtubeId) {
			console.log(`[Player] Switching from video ${currIndex} to ${nextIdx}: ${nextVid.youtubeId}`)
			
			try {
				// Load next video starting at target offset
				playerRef.current.loadVideoById({
					videoId: nextVid.youtubeId,
					startSeconds: targetOffset
				})
				
			// Reset seek time for new video
			clipSeekTimeRef.current = targetOffset
			e7Ref.current = true
			// Clear loaded video cache to force reload of next video
			loadedVideoRef.current = null
				
				// Attempt autoplay after switching - RESTRUCTURED for robustness
				// Use multiple retry attempts to ensure playback starts
				const attemptPlayback = (attempt = 0) => {
					if (!playerRef.current || !powerRef.current) return
					
					setTimeout(() => {
						if (!playerRef.current || !powerRef.current) return
						
						try {
							const state = playerRef.current.getPlayerState?.()
							
							if (userInteracted) {
								// User has interacted - can play with sound directly
								playerRef.current.unMute()
								playerRef.current.setVolume(volume * 100)
								
								if (state !== STATE_PLAYING) {
									playerRef.current.playVideo()
								}
								shouldPlayRef.current = true
								unifiedPlaybackManager.reset()
							} else {
								// Start muted autoplay
								if (state !== STATE_PLAYING) {
									attemptAutoplay(playerRef.current)
								}
							}
							
							// Verify playback started, retry if needed
							setTimeout(() => {
								if (playerRef.current && powerRef.current && shouldPlayRef.current) {
									const verifyState = playerRef.current.getPlayerState?.()
									if (verifyState !== STATE_PLAYING && attempt < 2) {
										console.log(`[Player] Playback not started, retrying (attempt ${attempt + 1})`)
										attemptPlayback(attempt + 1)
									}
								}
							}, 1000)
						} catch (err) {
							console.error('[Player] Error playing next video:', err)
							if (attempt < 2) {
								setTimeout(() => attemptPlayback(attempt + 1), 500)
							}
						}
					}, attempt === 0 ? 300 : 500)
				}
				
				attemptPlayback(0)
			} catch (err) {
				console.error('[Player] Switch video error:', err)
				// Reset transition state on error
				setTimeout(() => {
					isTransitioningRef.current = false
				}, 1000)
			}
		} else {
			console.warn('[Player] No next video found')
			isTransitioningRef.current = false
		}
		
		// Restart monitoring after video is loaded
		setTimeout(() => {
			isTransitioningRef.current = false
			if (powerRef.current) {
				startProgressMonitoring()
			}
		}, 1000) // Increased delay to ensure video is loaded
	}, [items, currIndex, onVideoEnd, startProgressMonitoring, channel, volume, attemptAutoplay, userInteracted])

	// Keep ref updated
	switchToNextVideoRef.current = switchToNextVideo

	// Error handler - auto-skip unavailable/restricted videos with fallback support
	const handleVideoError = useCallback((error) => {
		try {
			const errorCode = error?.data || error
			console.error('[Player] onPlayerError:', errorCode)
			
			// Show static immediately on error (only for actual errors, not normal buffering)
			setIsBuffering(true)
			setIsTransitioning(true)
			setShowStaticOverlay(true)
			staticShownRef.current = true
			
			// Clear any existing error timeout
			if (skipErrorTimeoutIdRef.current) {
				clearTimeout(skipErrorTimeoutIdRef.current)
			}
			
			// Check if error is permanent
			const isPermanent = YOUTUBE_PERMANENT_ERRORS.includes(errorCode)
			
			// Try fallback source first (if available)
			const sourceManager = videoSourceManagerRef.current
			if (sourceManager && sourceManager.hasMoreSources()) {
				console.log('[Player] Video error detected, trying fallback source...')
				sourceManager.markCurrentSourceFailed()
				const nextSource = sourceManager.getNextSource()
				
				if (nextSource) {
					console.log(`[Player] Switching to fallback source: ${nextSource.label} (${nextSource.id})`)
					
					if (onBufferingChange) {
						onBufferingChange(true, `Trying fallback source...`)
					}
					
					// Reload video with fallback source
					if (playerRef.current && ytPlayerRef.current) {
						setTimeout(() => {
							try {
								ytPlayerRef.current.loadVideoById({
									videoId: nextSource.id,
									startSeconds: startSeconds,
								})
								ytPlayerRef.current.playVideo()
								setRetryCount(0) // Reset retry count for new source
								return // Exit early - fallback source loaded
							} catch (err) {
								console.error('[Player] Error loading fallback source:', err)
							}
						}, 500)
					}
				}
			}
			
			// If no fallback or all fallbacks failed, proceed with normal error handling
			if (isPermanent && current?.youtubeId) {
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
			} else if (!isPermanent && retryCount < MAX_RETRY_ATTEMPTS) {
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
	}, [current?.youtubeId, onBufferingChange, MAX_SKIP_ATTEMPTS, switchToNextVideo, retryCount, attemptRetry, startSeconds])

	// RetroTV Pattern: State change handler - RESTRUCTURED for robustness
	const onStateChange = useCallback((event) => {
		try {
			const state = event.data
			const player = event.target || playerRef.current
			
			playbackStateRef.current = state === STATE_PLAYING ? 'playing' : state === STATE_BUFFERING ? 'buffering' : 'other'
			
			// RetroTV pattern: Clear watchdog timer on any state change
			if (watchDogTimeOutIdRef.current) {
				clearTimeout(watchDogTimeOutIdRef.current)
				watchDogTimeOutIdRef.current = null
			}
			
			switch (state) {
				case STATE_UNSTARTED:
					console.log('[Player] Video unstarted')
					// Mobile fix: Set watchdog timer for stuck unstarted state
					// If still unstarted after 3 seconds, force play attempt
					if (powerRef.current && shouldPlayRef.current) {
						watchDogTimeOutIdRef.current = setTimeout(() => {
							if (player && powerRef.current) {
								const currentState = player.getPlayerState?.()
								if (currentState === STATE_UNSTARTED || currentState === STATE_VIDEO_CUED) {
									console.log('[Player] Mobile watchdog: Still unstarted, forcing play')
									autoplayAttemptedRef.current = false // Reset to allow retry
									if (userInteracted) {
										player.unMute()
										player.setVolume(volume * 100)
									} else {
										player.mute()
									}
									player.playVideo()
								}
							}
						}, 3000)
					}
					break
					
				case STATE_ENDED:
					// RetroTV: Video ended - trigger transition
					if (!isTransitioningRef.current) {
						switchToNextVideo()
					}
					break
					
			case STATE_PLAYING:
				// RetroTV: Video is playing - hide static immediately, start monitoring
				setRetryCount(0)
				setPlaybackHealth('healthy')
				setShowStaticOverlay(false) // Hide static immediately when playing
				setIsBuffering(false) // Clear buffering state immediately
				staticShownRef.current = false // Reset static shown flag
				lastPlayTimeRef.current = Date.now()
				shouldPlayRef.current = true
				
				// MOBILE FIX: Unmute now that playback has started (if user interacted via power ON)
				if (userInteracted && isMutedAutoplay && player) {
					console.log('[Player] Playback started - unmuting (user interacted)')
					try {
						player.unMute()
						player.setVolume(volume * 100)
						setIsMutedAutoplay(false)
					} catch (err) {
						console.warn('[Player] Error unmuting:', err)
					}
				}
				
				// Update MediaSession - CRITICAL for background playback
				mediaSessionManager.setPlaybackState('playing')
				
				// Reset unified playback manager on successful playback
				unifiedPlaybackManager.reset()
				
				// RetroTV pattern: Seek to correct position if needed
				if (clipSeekTimeRef.current > 0 && player) {
					try {
						const currentTime = typeof player.getCurrentTime === 'function' 
							? (typeof player.getCurrentTime() === 'number' ? player.getCurrentTime() : 0)
							: 0
						
						if (currentTime < clipSeekTimeRef.current - 2) {
							console.log(`[Player] Seeking from ${currentTime.toFixed(1)}s to ${clipSeekTimeRef.current.toFixed(1)}s`)
							player.seekTo(clipSeekTimeRef.current, true)
							clipSeekTimeRef.current = 0
						} else {
							clipSeekTimeRef.current = 0
						}
					} catch (err) {
						console.error('[Player] Error seeking:', err)
						clipSeekTimeRef.current = 0
					}
				}
				
				// Clear buffering timeout and static audio immediately
				if (bufferTimeoutRef.current) {
					clearTimeout(bufferTimeoutRef.current)
					bufferTimeoutRef.current = null
				}
				if (staticAudioRef.current) {
					try {
						staticAudioRef.current.pause()
						staticAudioRef.current.currentTime = 0
					} catch (err) {}
				}

				// Start progress monitoring if not already running
				if (!progressIntervalRef.current && !isTransitioningRef.current) {
					startProgressMonitoring()
				}
				
				if (onPlaybackStateChange) {
					onPlaybackStateChange({ state: 'playing', videoId: current?.youtubeId })
				}

				emitPlaybackProgress()
				break
				
			case STATE_PAUSED:
				console.log('[Player] Video paused')
				// Only update MediaSession if power is off or user explicitly paused
				// If power is on and we should be playing, fast recovery will handle it
				if (!powerRef.current || !shouldPlayRef.current) {
					mediaSessionManager.setPlaybackState('paused')
				} else {
					// Power is on but paused - fast recovery will detect and fix this quickly
					// No manual intervention needed to avoid conflicts
				}
				break
				
			case STATE_BUFFERING:
					// RetroTV: Buffering - only show static after 3 seconds (not immediately)
					// This prevents static from showing during normal brief buffering
					if (bufferTimeoutRef.current) {
						clearTimeout(bufferTimeoutRef.current)
					}
					bufferTimeoutRef.current = setTimeout(() => {
						if (playbackStateRef.current === 'buffering' && !isTransitioningRef.current) {
							// Only show buffering UI after 3 seconds of continuous buffering
							setIsBuffering(true)
							setPlaybackHealth('buffering')
							
							if (staticAudioRef.current) {
								try {
									staticAudioRef.current.currentTime = 0
									staticAudioRef.current.play().catch(() => {})
								} catch (err) {}
							}
						}
					}, 3000) // Increased from 500ms to 3 seconds to reduce static frequency
					
					// RetroTV watchdog: 8 seconds max buffering
					watchDogTimeOutIdRef.current = setTimeout(() => {
						if (playbackStateRef.current === 'buffering' && isTransitioningRef.current === false && powerRef.current) {
							console.warn('[Player] Buffering watchdog triggered - attempting recovery')
							// Try to recover by reloading video
							if (player && current?.youtubeId) {
								try {
									const currentTime = typeof player.getCurrentTime === 'function'
										? (typeof player.getCurrentTime() === 'number' ? player.getCurrentTime() : 0)
										: 0
									player.loadVideoById({
										videoId: current.youtubeId,
										startSeconds: Math.max(0, currentTime - 1)
									})
									setTimeout(() => {
										if (player && powerRef.current) {
											player.playVideo()
										}
									}, 500)
								} catch (err) {
									console.error('[Player] Error recovering from buffering:', err)
									handleVideoError({ data: 5 })
								}
							} else {
								handleVideoError({ data: 5 })
							}
						}
					}, MAX_BUFFER_TIME)
					break
					
				case STATE_VIDEO_CUED:
					// RetroTV: Video cued - prepare for playback
					// Fast recovery manager will handle playback automatically
					// Manual play attempt here to start immediately
					if (powerRef.current && shouldPlayRef.current && !isTransitioningRef.current && player) {
						setTimeout(() => {
							if (player && powerRef.current && shouldPlayRef.current) {
								try {
									const currentState = player.getPlayerState?.()
									if (currentState === STATE_VIDEO_CUED || currentState === STATE_UNSTARTED) {
										console.log('[Player] Auto-playing from cued state')
										player.playVideo()
									}
								} catch (err) {
									console.error('[Player] Error playing from cued:', err)
									// Fast recovery will handle retry
								}
							}
						}, 100) // Faster initial attempt
					}
					break
					
				default:
					break
			}
		} catch (err) {
			console.error('[Player] Error in onStateChange:', err)
		}
	}, [switchToNextVideo, startProgressMonitoring, current?.youtubeId, onPlaybackStateChange, emitPlaybackProgress, handleVideoError, userInteracted, isMutedAutoplay, volume])

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
			
			// MOBILE FIX: Always start muted for autoplay compatibility
			// Even with userInteracted=true, we mute initially and unmute in STATE_PLAYING
			e.target.setVolume(volume * 100)
			e.target.mute() // Always start muted - unmute happens in STATE_PLAYING when playback starts
			
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
			
			
			// Small delay before autoplay - MOBILE FIX: Always use attemptAutoplay (muted first)
			// Unmuting happens in STATE_PLAYING handler when playback actually starts
			setTimeout(() => {
				if (playerRef.current && powerRef.current) {
					// MOBILE FIX: Always use muted autoplay strategy
					// Unmute will happen in STATE_PLAYING once playback starts
					attemptAutoplay(playerRef.current)
					videoLoadedRef.current = true
				}
			}, 50)
			
			YouTubeUIRemover.init()
			
			if (channel?._id) {
				try {
					broadcastStateManager.updateChannelState(channel._id, {
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
				// Video played successfully - unified manager tracks this internally
			}

			// Emit initial progress
			setTimeout(() => {
				emitPlaybackProgress()
			}, 200)
			
			// Initialize MediaSession for background playback
			if (current) {
				mediaSessionManager.init(
					{
						title: current.title || 'DesiTV',
						artist: channel?.name || 'DesiTV Channel',
						album: 'Live TV',
						channelName: channel?.name,
					},
					{
						play: () => {
							if (playerRef.current) {
								playerRef.current.playVideo()
							}
						},
						pause: () => {
							if (playerRef.current) {
								playerRef.current.pauseVideo()
							}
						},
						previoustrack: () => {
							// Switch to previous video
							if (items.length > 0) {
								const prevIndex = currIndex === 0 ? items.length - 1 : currIndex - 1
								if (channel?._id) {
									try {
										broadcastStateManager.jumpToVideo(
											channel._id,
											prevIndex,
											0,
											items
										)
									} catch (err) {
										console.error('[Player] Error jumping to previous video:', err)
									}
								}
							}
						},
						nexttrack: () => {
							// Switch to next video
							if (switchToNextVideoRef.current) {
								switchToNextVideoRef.current()
							}
						},
						seekbackward: (details) => {
							if (playerRef.current) {
								try {
									const seekOffset = details.seekOffset || 10
									const currentTime = playerRef.current.getCurrentTime?.() || 0
									if (typeof currentTime === 'number') {
										playerRef.current.seekTo(Math.max(0, currentTime - seekOffset), true)
									} else if (currentTime && typeof currentTime.then === 'function') {
										currentTime.then((time) => {
											playerRef.current.seekTo(Math.max(0, time - seekOffset), true)
										}).catch(() => {})
									}
								} catch (err) {
									console.error('[Player] Error seeking backward:', err)
								}
							}
						},
						seekforward: (details) => {
							if (playerRef.current) {
								try {
									const seekOffset = details.seekOffset || 10
									const currentTime = playerRef.current.getCurrentTime?.() || 0
									const duration = playerRef.current.getDuration?.() || 0
									
									if (typeof currentTime === 'number' && typeof duration === 'number') {
										playerRef.current.seekTo(Math.min(duration, currentTime + seekOffset), true)
									} else {
										// Handle promises
										Promise.resolve(currentTime).then((time) => {
											Promise.resolve(duration).then((dur) => {
												playerRef.current.seekTo(Math.min(dur, time + seekOffset), true)
											}).catch(() => {})
										}).catch(() => {})
									}
								} catch (err) {
									console.error('[Player] Error seeking forward:', err)
								}
							}
						},
					}
				)
			}
		} catch(err) {
			console.error('[Player] Error in onReady:', err)
		}
	}, [volume, offset, currIndex, channel, current, items, switchToNextVideo, emitPlaybackProgress, attemptAutoplay, userInteracted, videoId, startSeconds])

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
			{/* Tap to START overlay - show when autoplay fails completely on mobile */}
			{needsUserInteraction && !userInteracted && !isMutedAutoplay && (
				<div
					className="tap-to-start-overlay"
					onClick={handleUserInteraction}
					style={{
						position: 'absolute',
						top: 0,
						left: 0,
						width: '100%',
						height: '100%',
						zIndex: 30,
						background: 'rgba(0, 0, 0, 0.85)',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						cursor: 'pointer',
						pointerEvents: 'auto',
					}}
				>
					<div style={{ fontSize: '48px', marginBottom: '16px' }}>📺</div>
					<h2 style={{ 
						color: '#d4a574', 
						fontFamily: 'monospace',
						fontSize: '24px',
						textShadow: '0 0 10px rgba(212, 165, 116, 0.6), 0 0 20px rgba(212, 165, 116, 0.3)',
						marginBottom: '8px'
					}}>TAP TO START TV</h2>
					<p style={{ 
						color: '#888', 
						fontFamily: 'monospace',
						fontSize: '14px',
						marginBottom: '16px'
					}}>Experience retro television</p>
					<div style={{ 
						color: '#fff', 
						fontFamily: 'monospace',
						fontSize: '16px',
						animation: 'pulse 2s infinite'
					}}>👆 Tap anywhere</div>
				</div>
			)}
			{/* Tap to unmute indicator - only show when muted autoplay is active and user hasn't interacted */}
			{isMutedAutoplay && !userInteracted && !showStaticOverlay && !isBuffering && !isTransitioning && (
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
