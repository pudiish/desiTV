import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import YouTube from 'react-youtube'
import YouTubeUIRemover from '../utils/YouTubeUIRemover'
import LocalBroadcastStateManager from '../utils/LocalBroadcastStateManager'
import YouTubeRetryManager from '../utils/YouTubeRetryManager'
import { useBroadcastPosition } from '../hooks/useBroadcastPosition'

/**
 * Enhanced Player Component with:
 * - Session caching and state recovery
 * - Timeline continuity maintenance
 * - YouTube retry mechanism (never go to loading state)
 * - Robust error handling with try-catch
 * - Unified position calculation via useBroadcastPosition hook
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
	// iOS autoplay handling - automatic gesture capture
	const [userGestureReceived, setUserGestureReceived] = useState(false)
	const autoTriggerAttemptedRef = useRef(false)

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

	// YouTube player options - start time from broadcast position
	const opts = useMemo(() => {
		// Use broadcast position offset directly
		const startSeconds = Math.floor(offset)
		console.log(`[Player] opts calculated with start: ${startSeconds}s, videoIndex: ${currIndex}`)
		
		return {
			width: '100%',
			height: '100%',
			// Use standard youtube.com domain instead of nocookie to avoid restrictions
			playerVars: { 
				autoplay: userGestureReceived ? 1 : 0, // iOS requires user gesture first
				mute: userGestureReceived ? 0 : 1, // Start muted, unmute after gesture
				controls: 0, 
				disablekb: 1, 
				modestbranding: 1, 
				rel: 0, 
				start: startSeconds,
				iv_load_policy: 3,
				showinfo: 0,
				fs: 0,
				cc_load_policy: 0,
				playsinline: 1,
				enablejsapi: 1,
				origin: window.location.origin,
				widget_referrer: window.location.origin,
				autohide: 1,
				loop: 0,
			}
		}
	}, [offset, currIndex])

	// Use ref to avoid stale closure in interval
	const switchToNextVideoRef = useRef(null)

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

	// ===== EFFECTS =====

	// Effect: Automatic gesture unlock on ANY interaction
	useEffect(() => {
		if (userGestureReceived || autoTriggerAttemptedRef.current) return

		const unlockPlayback = () => {
			if (autoTriggerAttemptedRef.current) return
			autoTriggerAttemptedRef.current = true

			setUserGestureReceived(true)
			console.log('[Player] Auto-gesture captured - playback unlocked')

			// Immediately try to play if player is ready
			setTimeout(() => {
				if (playerRef.current) {
					try {
						playerRef.current.unMute()
						playerRef.current.setVolume(volume * 100)
						playerRef.current.playVideo()
						console.log('[Player] Autoplay initiated after gesture unlock')
					} catch (err) {
						console.warn('[Player] Autoplay attempt:', err)
					}
				}
			}, 100)

			// Remove all listeners after first trigger
			document.removeEventListener('mousemove', unlockPlayback)
			document.removeEventListener('touchstart', unlockPlayback)
			document.removeEventListener('click', unlockPlayback)
			document.removeEventListener('keydown', unlockPlayback)
			document.removeEventListener('scroll', unlockPlayback)
		}

		// Listen for ANY user interaction to unlock
		document.addEventListener('mousemove', unlockPlayback, { once: true, passive: true })
		document.addEventListener('touchstart', unlockPlayback, { once: true, passive: true })
		document.addEventListener('click', unlockPlayback, { once: true, passive: true })
		document.addEventListener('keydown', unlockPlayback, { once: true, passive: true })
		document.addEventListener('scroll', unlockPlayback, { once: true, passive: true })

		return () => {
			document.removeEventListener('mousemove', unlockPlayback)
			document.removeEventListener('touchstart', unlockPlayback)
			document.removeEventListener('click', unlockPlayback)
			document.removeEventListener('keydown', unlockPlayback)
			document.removeEventListener('scroll', unlockPlayback)
		}
	}, [userGestureReceived, volume])

	// Effect: Reset when channel changes
	useEffect(() => {
		if (channel?._id !== channelIdRef.current) {
			const wasChannelChange = channelIdRef.current !== null
			channelIdRef.current = channel?._id
			channelChangeCounterRef.current += 1
			
			// Reset initialization flags for new channel
			hasInitializedRef.current = false
			videoLoadedRef.current = false
			
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
				
				// Auto-trigger playback after gesture unlock
				if (userGestureReceived) {
					try {
						playerRef.current.unMute()
						playerRef.current.setVolume(volume * 100)
					} catch (err) {}
				}
				
				// Ensure video plays
				playerRef.current.playVideo()
			} catch (err) {
				console.error('[Player] Switch video error:', err)
			}
		}
		
		// Restart monitoring after video is loaded
		setTimeout(() => {
			isTransitioningRef.current = false
			startProgressMonitoring()
		}, 800)
	}, [items, currIndex, onVideoEnd, startProgressMonitoring, channel, userGestureReceived, volume])

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
						switchToNextVideo(true)
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
}, [onVideoEnd, switchToNextVideo, startProgressMonitoring, current?.youtubeId, onPlaybackStateChange, emitPlaybackProgress])

	const onReady = useCallback((e) => {
		try {
			// Prevent double initialization
			if (hasInitializedRef.current && videoLoadedRef.current) {
				console.log('[Player] Already initialized, skipping')
				return
			}
			
			playerRef.current = e.target
			hasInitializedRef.current = true
			
			// Mute first to allow autoplay
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
					// If gesture already received, unmute and play
					if (userGestureReceived) {
						try {
							playerRef.current.unMute()
							playerRef.current.setVolume(volume * 100)
						} catch (err) {}
					}
					playerRef.current.playVideo().catch(() => {
						setNeedsUserInteraction(true)
					})
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
			
			// Unmute after a longer delay to ensure video is fully playing
			setTimeout(() => {
				if (playerRef.current && volume > 0) {
					try {
						playerRef.current.unMute()
						playerRef.current.setVolume(volume * 100)
						playerRef.current.playVideo().catch(() => {
							setNeedsUserInteraction(true)
						})
					} catch(err) {}
				}
			}, 800)

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
}, [volume, offset, currIndex, channel, items, startProgressMonitoring, current?.youtubeId, emitPlaybackProgress])

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
			<YouTube 
				key={playerKey} 
				videoId={current.youtubeId} 
				opts={opts} 
				onReady={onReady}
				onStateChange={onStateChange}
				onError={handleVideoError}
				className="youtube-player-container"
				iframeClassName="youtube-iframe"
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
