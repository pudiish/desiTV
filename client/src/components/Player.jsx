import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import YouTube from 'react-youtube'
import { getPseudoLiveItem, getNextVideoInSequence } from '../utils/pseudoLive'
import YouTubeUIRemover from '../utils/YouTubeUIRemover'
import BroadcastStateManager from '../utils/BroadcastStateManager'
import YouTubeRetryManager from '../utils/YouTubeRetryManager'

/**
 * Enhanced Player Component with:
 * - Session caching and state recovery
 * - Timeline continuity maintenance
 * - YouTube retry mechanism (never go to loading state)
 * - Robust error handling with try-catch
 */
export default function Player({ 
	channel, 
	onVideoEnd, 
	onChannelChange, 
	volume = 0.5, 
	uiLoadTime, 
	allChannels = [], 
	onBufferingChange = null,
	onPlaybackStateChange = null, // New: callback for playback state
}){
	// ===== STATE =====
	const [currentIndex, setCurrentIndex] = useState(0)
	const [manualIndex, setManualIndex] = useState(null)
	const [channelChanged, setChannelChanged] = useState(false)
	const [isBuffering, setIsBuffering] = useState(false)
	const [isTransitioning, setIsTransitioning] = useState(false)
	const [retryCount, setRetryCount] = useState(0)
	const [playbackHealth, setPlaybackHealth] = useState('healthy') // healthy, buffering, retrying, failed

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
	const calculatedStartTimeRef = useRef(0) // Precise start time calculated at render
	const hasInitializedRef = useRef(false) // Prevent double initialization
	const videoLoadedRef = useRef(false) // Track if video has loaded
	const nextVideoPreloadedRef = useRef(false) // Track if next video is preloaded
	const pendingVideoIdRef = useRef(null) // Video ID to load next
	const useLoadVideoByIdRef = useRef(false) // Use loadVideoById for seamless transition

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



	// Use broadcast epoch directly - this is the single source of truth
	// Broadcast never stops, so always calculate from epoch
	const effectiveStartEpoch = useMemo(() => {
		return channel?.playlistStartEpoch || new Date('2020-01-01T00:00:00Z')
	}, [channel?.playlistStartEpoch])
	
	const live = useMemo(() => {
		if (items.length === 0) return null
		try {
			return getPseudoLiveItem(items, effectiveStartEpoch)
		} catch (err) {
			console.error('[Player] Error calculating live position:', err)
			return { videoIndex: 0, offset: 0 }
		}
	}, [items, effectiveStartEpoch])

	const liveIndex = live?.videoIndex ?? 0
	
	const currIndex = useMemo(() => {
		if (items.length === 0) return 0
		if (channelChanged) return liveIndex
		if (manualIndex !== null) return manualIndex
		if (currentIndex >= 0 && currentIndex < items.length) return currentIndex
		return liveIndex
	}, [channelChanged, liveIndex, manualIndex, currentIndex, items.length])

	const current = items[currIndex] || null

	// Calculate precise offset at render time and store in ref
	const offset = useMemo(() => {
		const calculatedOffset = live?.offset || 0
		// Store in ref for immediate access in callbacks
		calculatedStartTimeRef.current = calculatedOffset
		return calculatedOffset
	}, [live?.offset])

	// Only change key on channel change, NOT on video change
	// Changing on video change causes YouTube component to remount instead of using loadVideoById
	const playerKey = useMemo(() => {
		if (!channel?._id) return 'no-channel'
		return `${channel._id}-${channelChangeCounterRef.current}`
	}, [channel?._id])

	// YouTube player options - start time is set here and in onReady for reliability
	const opts = useMemo(() => {
		// Calculate fresh offset at this moment for accuracy
		const startSeconds = Math.floor(calculatedStartTimeRef.current || offset)
		console.log(`[Player] opts calculated with start: ${startSeconds}s`)
		
		return {
			width: '100%',
			height: '100%',
			// Use nocookie domain to prevent tracking and reduce glitches
			host: 'https://www.youtube-nocookie.com',
			playerVars: { 
				autoplay: 1, 
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
	}, [offset])

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
			
			setChannelChanged(wasChannelChange)
			setIsTransitioning(false)
			isTransitioningRef.current = false
			setManualIndex(null)
			
			if (onChannelChange) onChannelChange()
			
			if (wasChannelChange) {
				setTimeout(() => setChannelChanged(false), 100)
			}
		}
	}, [channel?._id, onChannelChange])

	// Effect: Load and restore saved state with retry
	useEffect(() => {
		if (!channel?._id || items.length === 0) return

		const loadAndRestoreState = async () => {
			try {
				console.log(`[Player] Loading state for channel ${channel._id}...`)
				
				let preloadedState = null
				let retries = 0
				
				// Retry fetching state up to 3 times
				while (retries < 3) {
					try {
						preloadedState = await BroadcastStateManager.preloadStateForChannel(channel._id)
						break
					} catch (err) {
						retries++
						console.warn(`[Player] State fetch retry ${retries}:`, err)
						await new Promise(resolve => setTimeout(resolve, 500 * retries))
					}
				}
				
				const position = BroadcastStateManager.calculateCurrentPosition(channel, preloadedState)

				console.log(`[Player] Calculated position:`, {
					videoIndex: position.videoIndex,
					offset: position.offset.toFixed(1),
					totalElapsed: position.totalElapsedSec?.toFixed(1),
				})

				await BroadcastStateManager.initializeChannel(channel, preloadedState)

				// IMPORTANT: Do NOT set currentIndex from saved state
				// The 'live' timeline value (calculated from epoch and current time)
				// will automatically determine the correct video
				// We only need to set the offset for seeking within the video
				if (position.offset && playerRef.current) {
					playerRef.current.targetOffset = position.offset
					console.log(`[Player] Set target offset: ${position.offset.toFixed(1)}s`)
				}
			} catch (err) {
				console.error('[Player] Error loading state:', err)
				// Fall back gracefully
				try {
					await BroadcastStateManager.initializeChannel(channel)
				} catch (initErr) {
					console.error('[Player] Init fallback also failed:', initErr)
				}
			}
		}

		loadAndRestoreState()
	}, [channel?._id, items.length])

	// Effect: Save state before page unload
	useEffect(() => {
		const handleBeforeUnload = () => {
			try {
				if (channel?._id) {
					const stateData = BroadcastStateManager.getChannelState(channel._id)
					if (stateData) {
						navigator.sendBeacon(
							`/api/broadcast-state/${channel._id}`,
							JSON.stringify(stateData)
						)
						console.log('[Player] State saved via sendBeacon')
					}
				}
			} catch (err) {
				console.error('[Player] Error saving on unload:', err)
			}
		}

		window.addEventListener('beforeunload', handleBeforeUnload)
		return () => window.removeEventListener('beforeunload', handleBeforeUnload)
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
			BroadcastStateManager.stopAutoSync()
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
	}, [current?.youtubeId])

	// ===== CALLBACKS =====

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
	}, [])

	// Simple: play next video immediately
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

		// Calculate next video index using setter to get latest state
		setCurrentIndex(prevIndex => {
			const nextIdx = (prevIndex + 1) % items.length
			const nextVid = items[nextIdx]

			if (nextVid?.youtubeId) {
				console.log(`[Player] Loading video ${nextIdx}: ${nextVid.youtubeId}`)
				try {
					playerRef.current.loadVideoById({
						videoId: nextVid.youtubeId,
						startSeconds: 0,
					})
					// Ensure video plays
					playerRef.current.playVideo()
				} catch (err) {
					console.error('[Player] Switch video error:', err)
				}
			}

			setManualIndex(nextIdx)
			
			// Restart monitoring after video is loaded
			setTimeout(() => {
				isTransitioningRef.current = false
				startProgressMonitoring()
			}, 800)

			return nextIdx
		})
	}, [items, onVideoEnd, startProgressMonitoring])

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
						101: 'VIDEO NOT EMBEDDABLE',
						150: 'VIDEO RESTRICTED',
						2: 'INVALID VIDEO ID'
					}
					onBufferingChange(true, errorMessages[errorCode] || `ERROR ${errorCode}`)
				}
				
				failedVideosRef.current.add(current.youtubeId)
				skipAttemptsRef.current++
				
				if (skipAttemptsRef.current < MAX_SKIP_ATTEMPTS) {
					if (errorTimeoutRef.current) {
						clearTimeout(errorTimeoutRef.current)
					}
					
					errorTimeoutRef.current = setTimeout(() => {
						switchToNextVideo(true)
					}, 1000)
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
	}, [onVideoEnd, switchToNextVideo, startProgressMonitoring, current?.youtubeId, onPlaybackStateChange])

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
			
			// Use the most accurate offset - prioritize ref, then prop
			const positionToSeek = calculatedStartTimeRef.current || playerRef.current?.targetOffset || offset || 0
			console.log(`[Player] onReady - Seeking to: ${positionToSeek.toFixed(1)}s (ref: ${calculatedStartTimeRef.current}, prop: ${offset})`)
			
			// Seek BEFORE playing to prevent flash of wrong position
			if (positionToSeek > 0) {
				e.target.seekTo(positionToSeek, true)
			}
			
			// Small delay to ensure seek completes before play
			setTimeout(() => {
				if (playerRef.current) {
					playerRef.current.playVideo()
					videoLoadedRef.current = true
				}
			}, 50)
			
			YouTubeUIRemover.init()
			
			if (channel?._id) {
				try {
					BroadcastStateManager.updateChannelState(channel._id, {
						channelName: channel.name,
						currentVideoIndex: currIndex,
						currentTime: positionToSeek || 0,
						playlistStartEpoch: new Date(channel.playlistStartEpoch),
						videoDurations: items.map(v => v.duration || 300),
						playlistTotalDuration: items.reduce((sum, v) => sum + (v.duration || 300), 0),
					})
					
					BroadcastStateManager.startAutoSync((channelId, state) => {
						console.log(`[Player] Auto-synced state for ${channelId}`)
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
		} catch(err) {
			console.error('[Player] Error in onReady:', err)
		}
	}, [volume, offset, channel, currIndex, items, startProgressMonitoring, current?.youtubeId])

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
