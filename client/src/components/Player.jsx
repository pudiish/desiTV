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
	const lastPlayTimeRef = useRef(Date.now())
	const bufferingStartTimeRef = useRef(null)
	const playbackStateRef = useRef('idle') // idle, loading, playing, buffering, error
	const hasInitializedRef = useRef(false) // Prevent double initialization
	const videoLoadedRef = useRef(false) // Track if video has loaded
	const autoplayAttemptedRef = useRef(false) // Track if we've attempted autoplay

	// ===== CONSTANTS =====
	const SWITCH_BEFORE_END = 2 // Switch 2 seconds before end for smoother transition
	const MAX_BUFFER_TIME = 8000 // 8 seconds max buffering before retry
	const MAX_RETRY_ATTEMPTS = 5
	const RETRY_BACKOFF_BASE = 1000 // 1 second base

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

	// ===== AUTOPLAY HELPER (iOS/Phone compatible) =====
	// Strategy: Start muted (allowed on iOS), then unmute after playing
	const attemptAutoplay = useCallback(async (player) => {
		if (!player || autoplayAttemptedRef.current) return
		
		try {
			autoplayAttemptedRef.current = true
			console.log('[Player] Attempting autoplay (muted first for iOS compatibility)')
			
			// Start muted - this is allowed on iOS
			player.mute()
			player.setVolume(volume * 100)
			
			// Try to play
			await player.playVideo()
			
			// After a short delay, unmute (iOS allows unmuting after muted autoplay starts)
			setTimeout(() => {
				try {
					if (player && volume > 0) {
						player.unMute()
						player.setVolume(volume * 100)
						console.log('[Player] Autoplay successful, unmuted')
					}
				} catch (err) {
					console.warn('[Player] Could not unmute after autoplay:', err)
				}
			}, 500)
		} catch (err) {
			console.warn('[Player] Autoplay failed (may need user interaction):', err)
			autoplayAttemptedRef.current = false
			setNeedsUserInteraction(true)
		}
	}, [volume])

	// Expose tap handler to parent components (for compatibility, but we auto-play)
	useEffect(() => {
		if (onTapHandlerReady) {
			// Provide a handler that just attempts autoplay
			onTapHandlerReady(() => {
				if (playerRef.current) {
					attemptAutoplay(playerRef.current)
				}
			})
		}
	}, [onTapHandlerReady, attemptAutoplay])

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
			
			// Clear all timeouts and intervals
			if (progressIntervalRef.current) {
				clearInterval(progressIntervalRef.current)
				progressIntervalRef.current = null
			}
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current)
				retryTimeoutRef.current = null
			}
			
			failedVideosRef.current.clear()
			skipAttemptsRef.current = 0
			setRetryCount(0)
			setPlaybackHealth('healthy')
			
			setIsTransitioning(false)
			isTransitioningRef.current = false
			
			if (onChannelChange) onChannelChange()
		}
	}, [channel?._id, onChannelChange])

	// Load YouTube IFrame API (like RetroTV)
	useEffect(() => {
		if (window.YT && window.YT.Player) {
			return
		}
		const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
		if (existing) return
		
		const tag = document.createElement('script')
		tag.src = 'https://www.youtube.com/iframe_api'
		tag.async = true
		document.body.appendChild(tag)
		console.log('[Player] Loading YouTube IFrame API')
	}, [])

	// Direct YouTube API player initialization (RetroTV approach)
	useEffect(() => {
		if (!videoId || !channel?._id) {
			console.log('[Player] No videoId or channel')
			return
		}

		const initPlayer = () => {
			if (!window.YT || !window.YT.Player) {
				console.log('[Player] Waiting for YT API...')
				return false
			}

			const container = document.getElementById('desitv-player-iframe')
			if (!container) {
				console.log('[Player] Container not found')
				return false
			}

			// If player exists, load new video
			if (ytPlayerRef.current) {
				console.log('[Player] Loading video:', videoId, 'at', startSeconds, 's')
				try {
					ytPlayerRef.current.loadVideoById({
						videoId: videoId,
						startSeconds: startSeconds
					})
					
					// Attempt autoplay after loading
					setTimeout(() => {
						if (ytPlayerRef.current) {
							attemptAutoplay(ytPlayerRef.current)
						}
					}, 300)
				} catch (err) {
					console.error('[Player] Error loading video:', err)
				}
				return true
			}

			// Create new player
			console.log('[Player] Creating player:', videoId, 'at', startSeconds, 's')
			try {
				ytPlayerRef.current = new window.YT.Player('desitv-player-iframe', {
					height: '100%',
					width: '100%',
					videoId: videoId,
					playerVars: {
						autoplay: 0, // We'll control autoplay manually
						playsinline: 1, // Critical for iOS
						controls: 0,
						modestbranding: 1,
						rel: 0,
						start: startSeconds,
						iv_load_policy: 3,
						mute: 1, // Start muted for iOS autoplay compatibility
					},
					events: {
						onReady: (e) => {
							// Use ref to call the callback (defined later)
							if (onReadyRef.current) {
								onReadyRef.current(e)
							}
						},
						onStateChange: (e) => {
							// Use ref to call the callback (defined later)
							if (onStateChangeRef.current) {
								onStateChangeRef.current(e)
							}
						},
						onError: (e) => {
							// Use ref to call the callback (defined later)
							if (handleVideoErrorRef.current) {
								handleVideoErrorRef.current(e)
							} else {
								console.error('[Player] Error:', e.data)
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

		// Try to initialize, poll if API not ready
		if (!initPlayer()) {
			const timer = setInterval(() => {
				if (initPlayer()) {
					clearInterval(timer)
				}
			}, 100)
			return () => clearInterval(timer)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [videoId, channel?._id, startSeconds, volume, attemptAutoplay])

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

		// Stop progress monitoring
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current)
			progressIntervalRef.current = null
		}

		if (onVideoEnd) onVideoEnd()

		// Calculate next index using broadcast position logic
		const nextIdx = (currIndex + 1) % items.length
		const nextVid = items[nextIdx]

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
				playerRef.current.loadVideoById({
					videoId: nextVid.youtubeId,
					startSeconds: 0,
				})
				
				// Attempt autoplay after switching
				setTimeout(() => {
					if (playerRef.current) {
						attemptAutoplay(playerRef.current)
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
	}, [items, currIndex, onVideoEnd, startProgressMonitoring, channel, volume, attemptAutoplay])

	// Keep ref updated
	switchToNextVideoRef.current = switchToNextVideo

	const handleVideoError = useCallback((error) => {
		try {
			const errorCode = error?.data
			const isUnavailable = errorCode === 100 || errorCode === 101 || errorCode === 150 || errorCode === 2
			
			// Use YouTubeRetryManager for error handling
			const errorResult = YouTubeRetryManager.handlePlayerError(error, current?.youtubeId)
			
			if (isUnavailable && current?.youtubeId) {
				console.warn(`Video ${current.youtubeId} is unavailable (error ${errorCode}), skipping to next...`)
				
				if (onBufferingChange) {
					const errorMessages = {
						100: 'VIDEO NOT FOUND',
						101: 'VIDEO EMBEDDING DISABLED - Skipping...',
						150: 'VIDEO RESTRICTED (Geographic/Copyright) - Skipping...',
						2: 'INVALID VIDEO ID'
					}
					onBufferingChange(true, errorMessages[errorCode] || `ERROR ${errorCode} - Skipping...`)
				}
				
				failedVideosRef.current.add(current.youtubeId)
				skipAttemptsRef.current++
				
				if (skipAttemptsRef.current < MAX_SKIP_ATTEMPTS) {
					if (errorTimeoutRef.current) {
						clearTimeout(errorTimeoutRef.current)
					}
					
					errorTimeoutRef.current = setTimeout(() => {
						switchToNextVideo()
					}, 1500) // Slightly longer delay for restricted videos
				} else {
					console.error('Too many consecutive video errors, stopping auto-skip')
					setIsBuffering(false)
					setPlaybackHealth('failed')
					setTimeout(() => {
						skipAttemptsRef.current = 0
						setPlaybackHealth('healthy')
					}, 5000)
				}
			} else if (!errorResult.isPermanent && retryCount < MAX_RETRY_ATTEMPTS) {
				// Try to recover from non-permanent errors
				console.log('[Player] Non-permanent error, attempting retry...')
				attemptRetry()
			} else {
				console.error('YouTube player error:', error)
				setIsBuffering(false)
			}
		} catch (err) {
			console.error('[Player] Error in handleVideoError:', err)
			setIsBuffering(false)
		}
	}, [current?.youtubeId, onBufferingChange, MAX_SKIP_ATTEMPTS, switchToNextVideo, retryCount, attemptRetry])

	const onStateChange = useCallback((event) => {
		try {
			const state = event.data
			playbackStateRef.current = state === 1 ? 'playing' : state === 3 ? 'buffering' : 'other'
			
			if (state === 0) {
				// Video ended - switch immediately
				if (!isTransitioningRef.current) {
					switchToNextVideo()
				}
			} else if (state === 3) {
				// Buffering - only show indicator after 500ms to avoid flicker
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
				}, 500) // Only show buffering after 500ms
			} else if (state === 1) {
				// SUCCESS - Video is playing
				setRetryCount(0)
				setPlaybackHealth('healthy')
				lastPlayTimeRef.current = Date.now()
				
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
				
				// Notify playback state change
				if (onPlaybackStateChange) {
					onPlaybackStateChange({ state: 'playing', videoId: current?.youtubeId })
				}

				// Emit progress snapshot on play start for menu sync
				emitPlaybackProgress()
			} else if (state === 5) {
				if (!progressIntervalRef.current && !isTransitioningRef.current) {
					setTimeout(() => startProgressMonitoring(), 1000)
				}
			} else if (state === -1) {
				// Unstarted - might need retry
				console.log('[Player] Video unstarted, monitoring...')
			}
		} catch (err) {
			console.error('[Player] Error in onStateChange:', err)
		}
	}, [switchToNextVideo, startProgressMonitoring, current?.youtubeId, onPlaybackStateChange, emitPlaybackProgress])

	// Keep refs updated
	onStateChangeRef.current = onStateChange
	handleVideoErrorRef.current = handleVideoError

	const onReady = useCallback((e) => {
		try {
			// Prevent double initialization
			if (hasInitializedRef.current && videoLoadedRef.current) {
				console.log('[Player] Already initialized, skipping')
				return
			}
			
			playerRef.current = e.target
			hasInitializedRef.current = true
			
			// Mute first to allow autoplay (iOS requirement)
			e.target.mute()
			e.target.setVolume(volume * 100)
			
			try {
				e.target.setPlaybackQuality('medium')
			} catch(err) {}
			
			// Use broadcast position offset directly - this is the single source of truth
			console.log(`[Player] onReady - Seeking to: ${offset.toFixed(1)}s, videoIndex: ${currIndex}`)
			
			// Seek BEFORE playing to prevent flash of wrong position
			if (offset > 0) {
				e.target.seekTo(offset, true)
			}
			
			// Small delay to ensure seek completes before play
			setTimeout(() => {
				if (playerRef.current) {
					// Attempt autoplay (muted, then unmute)
					attemptAutoplay(playerRef.current)
					videoLoadedRef.current = true
				}
			}, 50)
			
			YouTubeUIRemover.init()
			
			if (channel?._id) {
				try {
					// Update state (auto-save is already running)
					LocalBroadcastStateManager.updateChannelState(channel._id, {
						channelName: channel.name,
						currentVideoIndex: currIndex,
						currentTime: offset || 0,
					})
				} catch (err) {
					console.error('[Player] Error updating broadcast state:', err)
				}
			}

			// Start progress monitoring after video is confirmed playing
			setTimeout(() => {
				startProgressMonitoring()
			}, 200)
			
			// Mark video as healthy
			if (current?.youtubeId) {
				YouTubeRetryManager.healthyVideos?.add(current.youtubeId)
			}

			// Emit initial progress snapshot after ready
			emitPlaybackProgress()
		} catch(err) {
			console.error('[Player] Error in onReady:', err)
		}
	}, [volume, offset, currIndex, channel, startProgressMonitoring, current?.youtubeId, emitPlaybackProgress, attemptAutoplay])

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
			<audio
				ref={staticAudioRef}
				src="/sounds/tv-static-noise-291374.mp3"
				preload="auto"
				loop
			/>
			<div className="crt-scanlines"></div>
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
			{(isBuffering || isTransitioning) && (
				<div className="static-effect-tv">
					<div className="static-noise-overlay" />
					{retryCount > 0 && (
						<div className="retry-indicator">
							RETRY {retryCount}/{MAX_RETRY_ATTEMPTS}
						</div>
					)}
				</div>
			)}
			{playbackHealth === 'failed' && (
				<div className="playback-error-overlay">
					<div className="error-message">PLAYBACK ERROR - RECOVERING...</div>
				</div>
			)}
		</div>
	)
}
