import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import YouTube from 'react-youtube'
import { getPseudoLiveItem, getNextVideoInSequence } from '../utils/pseudoLive'
import YouTubeUIRemover from '../utils/YouTubeUIRemover'
import BroadcastStateManager from '../utils/BroadcastStateManager'

export default function Player({ channel, onVideoEnd, onChannelChange, volume = 0.5, uiLoadTime, allChannels = [], shouldAdvanceVideo = false, onBufferingChange = null }){
	const [currentIndex, setCurrentIndex] = useState(0)
	const [manualIndex, setManualIndex] = useState(null)
	const [channelChanged, setChannelChanged] = useState(false)
	const [isBuffering, setIsBuffering] = useState(false)
	const [isTransitioning, setIsTransitioning] = useState(false)
	const playerRef = useRef(null)
	const channelIdRef = useRef(null)
	const channelChangeCounterRef = useRef(0)
	const bufferTimeoutRef = useRef(null)
	const progressIntervalRef = useRef(null)
	const transitionTimeoutRef = useRef(null)
	const errorTimeoutRef = useRef(null)
	const isTransitioningRef = useRef(false)
	const failedVideosRef = useRef(new Set())
	const skipAttemptsRef = useRef(0)
	const staticAudioRef = useRef(null)
	const SWITCH_BEFORE_END = 3

	// Safe normalized items - ALWAYS compute this first
	const items = useMemo(() => {
		return Array.isArray(channel?.items) ? channel.items : []
	}, [channel?.items])
	
	const MAX_SKIP_ATTEMPTS = Math.max(items.length || 10, 10)

	// Check if current channel is Ads channel
	const isAdsChannel = useMemo(() => {
		return channel?.name && (
			channel.name.toLowerCase() === 'ads' || 
			channel.name.toLowerCase() === 'ad' || 
			channel.name.toLowerCase() === 'advertisements'
		)
	}, [channel?.name])

	// Compute pseudo-live item
	const effectiveStartEpoch = useMemo(() => {
		if (uiLoadTime && channel?.playlistStartEpoch) {
			return new Date(uiLoadTime)
		}
		return channel?.playlistStartEpoch || new Date('2020-01-01T00:00:00Z')
	}, [uiLoadTime, channel?.playlistStartEpoch])
	
	const live = useMemo(() => {
		if (items.length === 0) return null
		return getPseudoLiveItem(items, effectiveStartEpoch)
	}, [items, effectiveStartEpoch])

	const liveIndex = live?.videoIndex ?? 0
	
	// Calculate current index - must be computed before any conditional returns
	const currIndex = useMemo(() => {
		if (items.length === 0) return 0
		if (channelChanged) return liveIndex
		if (manualIndex !== null) return manualIndex
		if (currentIndex >= 0 && currentIndex < items.length) return currentIndex
		return liveIndex
	}, [channelChanged, liveIndex, manualIndex, currentIndex, items.length])

	// Get current video - safely handle empty items
	const current = items[currIndex] || null

	// Calculate offset
	const offset = useMemo(() => {
		return live?.offset || 0
	}, [live?.offset])

	// Player key for forcing remount
	const playerKey = useMemo(() => {
		if (!channel?._id || !current?.youtubeId) return 'no-video'
		return `${channel._id}-${current.youtubeId}-${currIndex}-${channelChangeCounterRef.current}`
	}, [channel?._id, current?.youtubeId, currIndex])

	// YouTube player options
	const opts = useMemo(() => ({
		width: '100%',
		height: '100%',
		playerVars: { 
			autoplay: 1, 
			controls: 0, 
			disablekb: 1, 
			modestbranding: 1, 
			rel: 0, 
			start: Math.floor(offset),
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
	}), [offset])

	// ===== ALL EFFECTS MUST BE DECLARED HERE, BEFORE ANY CONDITIONAL RETURNS =====

	// Effect: Reset when channel changes
	useEffect(() => {
		if (channel?._id !== channelIdRef.current) {
			const wasChannelChange = channelIdRef.current !== null
			channelIdRef.current = channel?._id
			channelChangeCounterRef.current += 1
			
			if (progressIntervalRef.current) {
				clearInterval(progressIntervalRef.current)
				progressIntervalRef.current = null
			}
			
			failedVideosRef.current.clear()
			skipAttemptsRef.current = 0
			
			setChannelChanged(wasChannelChange)
			setIsTransitioning(false)
			isTransitioningRef.current = false
			setManualIndex(null) // Reset manual index on channel change
			
			if (onChannelChange) onChannelChange()
			
			if (wasChannelChange) {
				setTimeout(() => setChannelChanged(false), 100)
			}
		}
	}, [channel?._id, onChannelChange])

	// Effect: Load and restore saved state from database
	useEffect(() => {
		if (!channel?._id || items.length === 0) return

		const loadAndRestoreState = async () => {
			try {
				console.log(`[Player] Loading state for channel ${channel._id}...`)
				
				const preloadedState = await BroadcastStateManager.preloadStateForChannel(channel._id)
				const position = BroadcastStateManager.calculateCurrentPosition(channel, preloadedState)

				console.log(`[Player] Calculated position:`, {
					videoIndex: position.videoIndex,
					offset: position.offset.toFixed(1),
					totalElapsed: position.totalElapsedSec?.toFixed(1),
				})

				await BroadcastStateManager.initializeChannel(channel, preloadedState)

				// Only update if position is valid
				if (position.videoIndex >= 0 && position.videoIndex < items.length) {
					setCurrentIndex(position.videoIndex)
					if (playerRef.current) {
						playerRef.current.targetOffset = position.offset
					}
				}
			} catch (err) {
				console.error('[Player] Error loading state:', err)
				await BroadcastStateManager.initializeChannel(channel)
			}
		}

		loadAndRestoreState()
	}, [channel?._id, items.length])

	// Effect: Save state before page unload
	useEffect(() => {
		const handleBeforeUnload = () => {
			if (channel?._id) {
				const stateData = BroadcastStateManager.getChannelState(channel._id)
				if (stateData) {
					try {
						navigator.sendBeacon(
							`/api/broadcast-state/${channel._id}`,
							JSON.stringify(stateData)
						)
						console.log('[Player] State saved via sendBeacon')
					} catch (err) {
						console.error('[Player] Error saving on unload:', err)
					}
				}
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

	// Effect: Handle advancing to next video after ad completes
	useEffect(() => {
		if (shouldAdvanceVideo && !isAdsChannel && !isTransitioningRef.current && items.length > 0) {
			console.log('Advancing to next video after ad...')
			setCurrentIndex(prevIndex => {
				const nextIndex = (prevIndex + 1) % items.length
				setManualIndex(nextIndex)
				return nextIndex
			})
		}
	}, [shouldAdvanceVideo, isAdsChannel, items.length])

	// Effect: Cleanup intervals and timeouts
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
			BroadcastStateManager.stopAutoSync()
		}
	}, [])

	// Effect: Reset transition state when video changes
	useEffect(() => {
		if (current) {
			setIsTransitioning(false)
			isTransitioningRef.current = false
			
			if (!failedVideosRef.current.has(current.youtubeId)) {
				skipAttemptsRef.current = 0
			}
		}
	}, [current?.youtubeId])

	// ===== CALLBACKS (defined with useCallback for stability) =====

	const startProgressMonitoring = useCallback(() => {
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current)
		}

		progressIntervalRef.current = setInterval(() => {
			if (!playerRef.current || isTransitioningRef.current) return

			try {
				Promise.all([
					playerRef.current.getCurrentTime(),
					playerRef.current.getDuration()
				]).then(([currentTime, duration]) => {
					if (duration && currentTime && duration > 0) {
						const timeRemaining = duration - currentTime
						if (timeRemaining <= SWITCH_BEFORE_END && timeRemaining > 0 && !isTransitioningRef.current) {
							switchToNextVideoRef.current()
						}
					}
				}).catch(() => {})
			} catch(err) {}
		}, 500)
	}, [])

	// Use ref to avoid stale closure in interval
	const switchToNextVideoRef = useRef(null)
	
	const switchToNextVideo = useCallback((skipFailed = false) => {
		if (isTransitioningRef.current) return

		if (isAdsChannel) {
			if (onVideoEnd) onVideoEnd()
			return
		}

		isTransitioningRef.current = true
		setIsTransitioning(true)
		
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current)
			progressIntervalRef.current = null
		}

		if (playerRef.current) {
			try {
				playerRef.current.pauseVideo()
			} catch(err) {}
		}

		if (onVideoEnd) onVideoEnd()

		transitionTimeoutRef.current = setTimeout(() => {
			if (channelIdRef.current === channel?._id && !isAdsChannel) {
				setCurrentIndex(prevIndex => {
					let nextIndex
					let attempts = 0
					const maxAttempts = items.length || 10
					
					do {
						if (items.length <= 1) {
							nextIndex = 0
							break
						}
						nextIndex = (prevIndex + 1) % items.length
						attempts++
						
						if (attempts >= maxAttempts && failedVideosRef.current.size >= items.length) {
							failedVideosRef.current.clear()
							skipAttemptsRef.current = 0
							break
						}
					} while (skipFailed && failedVideosRef.current.has(items[nextIndex]?.youtubeId) && attempts < maxAttempts)
					
					setManualIndex(nextIndex)
					isTransitioningRef.current = false
					setIsTransitioning(false)
					return nextIndex
				})
			} else {
				isTransitioningRef.current = false
				setIsTransitioning(false)
			}
		}, 500)
	}, [channel?._id, isAdsChannel, items, onVideoEnd])

	// Keep ref updated
	switchToNextVideoRef.current = switchToNextVideo

	const handleVideoError = useCallback((error) => {
		const errorCode = error?.data
		const isUnavailable = errorCode === 100 || errorCode === 101 || errorCode === 150 || errorCode === 2
		
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
				setTimeout(() => {
					skipAttemptsRef.current = 0
				}, 5000)
			}
		} else {
			console.error('YouTube player error:', error)
			setIsBuffering(false)
		}
	}, [current?.youtubeId, onBufferingChange, MAX_SKIP_ATTEMPTS, switchToNextVideo])

	const onStateChange = useCallback((event) => {
		const state = event.data
		
		if (state === 0) {
			if (!isTransitioningRef.current) {
				if (isAdsChannel) {
					if (onVideoEnd) onVideoEnd()
				} else {
					switchToNextVideo()
				}
			}
		} else if (state === 3) {
			setIsBuffering(true)
			if (staticAudioRef.current) {
				staticAudioRef.current.currentTime = 0
				staticAudioRef.current.play().catch(() => {})
			}
			if (bufferTimeoutRef.current) {
				clearTimeout(bufferTimeoutRef.current)
			}
		} else if (state === 1) {
			if (bufferTimeoutRef.current) {
				clearTimeout(bufferTimeoutRef.current)
			}
			bufferTimeoutRef.current = setTimeout(() => {
				setIsBuffering(false)
				if (staticAudioRef.current) {
					staticAudioRef.current.pause()
					staticAudioRef.current.currentTime = 0
				}
			}, 200)

			if (!progressIntervalRef.current && !isTransitioningRef.current) {
				startProgressMonitoring()
			}
		} else if (state === 5) {
			if (!progressIntervalRef.current && !isTransitioningRef.current) {
				setTimeout(() => startProgressMonitoring(), 1000)
			}
		}
	}, [isAdsChannel, onVideoEnd, switchToNextVideo, startProgressMonitoring])

	const onReady = useCallback((e) => {
		playerRef.current = e.target
		try {
			e.target.mute()
			e.target.setVolume(volume * 100)
			
			try {
				e.target.setPlaybackQuality('medium')
			} catch(err) {}
			
			const positionToSeek = playerRef.current?.targetOffset || offset || 0
			console.log(`[Player] Seeking to offset: ${positionToSeek.toFixed(1)}s`)
			
			if (positionToSeek > 0) e.target.seekTo(positionToSeek, true)
			e.target.playVideo()
			
			YouTubeUIRemover.init()
			
			if (channel?._id) {
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
			}
			
			setTimeout(() => {
				if (playerRef.current && volume > 0) {
					try {
						playerRef.current.unMute()
					} catch(err) {}
				}
			}, 500)

			startProgressMonitoring()
		} catch(err) {
			console.error('[Player] Error in onReady:', err)
		}
	}, [volume, offset, channel, currIndex, items, startProgressMonitoring])

	// ===== CONDITIONAL RENDERS - ONLY AFTER ALL HOOKS =====

	// Return null if no valid data, but ALL hooks have already been called
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
				</div>
			)}
		</div>
	)
}
