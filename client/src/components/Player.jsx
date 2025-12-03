import React, { useEffect, useState, useMemo, useRef } from 'react'
import YouTube from 'react-youtube'
import { getPseudoLiveItem } from '../utils/pseudoLive'

export default function Player({ channel, onVideoEnd, onChannelChange, volume = 0.5, uiLoadTime }){
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
	const isTransitioningRef = useRef(false) // Ref to track transition state for interval checks
	const SWITCH_BEFORE_END = 3 // Switch 3 seconds before video ends

	// safe normalized items even if channel is null
	const items = Array.isArray(channel?.items) ? channel.items : []

	// reset when channel changes
	useEffect(() => {
		if (channel?._id !== channelIdRef.current) {
			const wasChannelChange = channelIdRef.current !== null
			channelIdRef.current = channel?._id
			channelChangeCounterRef.current += 1 // Increment counter to force key change
			
			// Stop progress monitoring
			if (progressIntervalRef.current) {
				clearInterval(progressIntervalRef.current)
				progressIntervalRef.current = null
			}
			
			setManualIndex(null)
			setCurrentIndex(0)
			setChannelChanged(wasChannelChange)
			setIsTransitioning(false)
			isTransitioningRef.current = false
			if (onChannelChange) onChannelChange()
			// Reset channelChanged flag after a brief moment
			if (wasChannelChange) {
				setTimeout(() => setChannelChanged(false), 100)
			}
		}
	}, [channel?._id, onChannelChange])

	// Compute pseudo-live item using UI load time if available, otherwise use channel's playlistStartEpoch
	// This ensures consistent timing across page loads
	const effectiveStartEpoch = useMemo(() => {
		if (uiLoadTime && channel?.playlistStartEpoch) {
			// Use UI load time as the reference point for pseudo-live playback
			// This makes it feel like a real TV channel that's always "on air"
			return new Date(uiLoadTime)
		}
		return channel?.playlistStartEpoch || new Date('2020-01-01T00:00:00Z')
	}, [uiLoadTime, channel?.playlistStartEpoch])
	
	const live = useMemo(() => getPseudoLiveItem(items, effectiveStartEpoch), [items, effectiveStartEpoch])

	const liveIndex = items.findIndex(i => i.youtubeId === (live?.item?.youtubeId))
	// When channel just changed, always start at index 0, otherwise use manualIndex or currentIndex or liveIndex
	const currIndex = channelChanged 
		? 0
		: (manualIndex ?? (currentIndex >= 0 ? currentIndex : (liveIndex >= 0 ? liveIndex : 0)))
	const current = items[currIndex]

	// Sync volume with player
	useEffect(() => {
		if (playerRef.current) {
			try {
				playerRef.current.setVolume(volume * 100)
				if (volume > 0) {
					playerRef.current.unMute()
				} else {
					playerRef.current.mute()
				}
			} catch(err) {}
		}
	}, [volume])

	// if no channel or no items, render a placeholder (hooks already declared above)
	if (!channel) return null
	if (!items.length) return null
	if (!current) return null

	// When switching channels, always start from beginning (offset 0)
	// Only use pseudo-live offset when continuing in the same channel (not just changed)
	const offset = (channelChanged || manualIndex !== null) ? 0 : Math.floor(live?.offset || 0)
	// Key must change when channel changes to force YouTube component remount
	// Use channelChangeCounterRef to ensure key changes on channel switch
	const playerKey = `${channel?._id}-${current.youtubeId}-${currIndex}-${channelChangeCounterRef.current}`

	function onReady(e){
		playerRef.current = e.target
		try{
			// Start muted for autoplay, then unmute if volume > 0
			e.target.mute()
			e.target.setVolume(volume * 100)
			
			// Set playback quality for better buffering
			try {
				e.target.setPlaybackQuality('medium')
			} catch(err) {
				// Quality setting not available, ignore
			}
			
			if(offset) e.target.seekTo(offset, true)
			e.target.playVideo()
			
			// Unmute after short delay if volume > 0
			setTimeout(() => {
				if (playerRef.current && volume > 0) {
					try {
						playerRef.current.unMute()
					} catch(err) {}
				}
			}, 500)

			// Start monitoring video progress for early switching
			startProgressMonitoring()
		}catch{}
	}

	function startProgressMonitoring() {
		// Clear any existing interval
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current)
		}

		// Check progress every 500ms
		progressIntervalRef.current = setInterval(() => {
			if (!playerRef.current || isTransitioningRef.current) return

			try {
				Promise.all([
					playerRef.current.getCurrentTime(),
					playerRef.current.getDuration()
				]).then(([currentTime, duration]) => {
					if (duration && currentTime && duration > 0) {
						const timeRemaining = duration - currentTime
						
						// Switch to next video a few seconds before end
						// Only switch if we're not already transitioning
						if (timeRemaining <= SWITCH_BEFORE_END && timeRemaining > 0 && !isTransitioningRef.current) {
							switchToNextVideo()
						}
					}
				}).catch(() => {
					// Duration or current time not available yet, ignore
				})
			} catch(err) {
				// Player not ready, ignore
			}
		}, 500)
	}

	function switchToNextVideo() {
		if (isTransitioningRef.current) return // Prevent multiple transitions

		isTransitioningRef.current = true
		setIsTransitioning(true)
		
		// Clear progress monitoring
		if (progressIntervalRef.current) {
			clearInterval(progressIntervalRef.current)
			progressIntervalRef.current = null
		}

		// Pause current video to reduce buffering on next
		if (playerRef.current) {
			try {
				playerRef.current.pauseVideo()
			} catch(err) {}
		}

		// Trigger static effect
		if (onVideoEnd) onVideoEnd()

		// Small delay for smooth transition (300ms for better visual effect)
		transitionTimeoutRef.current = setTimeout(() => {
			setCurrentIndex(prevIndex => {
				// If only one video, restart it (loop)
				const nextIndex = items.length === 1 ? 0 : (prevIndex + 1) % items.length
				setManualIndex(nextIndex)
				isTransitioningRef.current = false
				setIsTransitioning(false)
				return nextIndex
			})
		}, 300)
	}

	function onStateChange(event) {
		// YouTube player state: -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
		const state = event.data
		
		if (state === 0) { // Video ended (fallback - should rarely happen due to early switching)
			if (!isTransitioningRef.current) {
				switchToNextVideo()
			}
		} else if (state === 3) { // Buffering
			// Show static effect during buffering
			setIsBuffering(true)
			// Clear any existing timeout
			if (bufferTimeoutRef.current) {
				clearTimeout(bufferTimeoutRef.current)
			}
		} else if (state === 1) { // Playing
			// Hide static effect when playing starts
			if (bufferTimeoutRef.current) {
				clearTimeout(bufferTimeoutRef.current)
			}
			// Small delay to ensure smooth transition
			bufferTimeoutRef.current = setTimeout(() => {
				setIsBuffering(false)
			}, 200)

			// Restart progress monitoring when video starts playing
			if (!progressIntervalRef.current && !isTransitioningRef.current) {
				startProgressMonitoring()
			}
		} else if (state === 5) { // Video cued
			// Restart progress monitoring when video is cued
			if (!progressIntervalRef.current && !isTransitioningRef.current) {
				setTimeout(() => startProgressMonitoring(), 1000)
			}
		}
	}

	const opts = {
		width: '100%',
		height: '100%',
		playerVars: { 
			autoplay: 1, 
			controls: 0, 
			disablekb: 1, 
			modestbranding: 1, 
			rel: 0, 
			start: offset,
			iv_load_policy: 3, // Hide annotations
			showinfo: 0,
			fs: 0, // Disable fullscreen button
			cc_load_policy: 0, // Hide captions
			playsinline: 1,
			enablejsapi: 1, // Enable JS API for better control
			origin: window.location.origin, // Set origin for security
			widget_referrer: window.location.origin, // Referrer for analytics
			// Optimize for better buffering
			quality: 'medium', // Use medium quality for better buffering
			autohide: 1, // Auto-hide controls
			loop: 0, // Don't loop individual videos (we handle looping)
		}
	}

	// Cleanup intervals and timeouts on unmount or when video changes
	useEffect(() => {
		return () => {
			if (progressIntervalRef.current) {
				clearInterval(progressIntervalRef.current)
			}
			if (bufferTimeoutRef.current) {
				clearTimeout(bufferTimeoutRef.current)
			}
			if (transitionTimeoutRef.current) {
				clearTimeout(transitionTimeoutRef.current)
			}
		}
	}, [currIndex]) // Re-run cleanup when video index changes

	// Reset transition state when video actually changes
	useEffect(() => {
		if (current) {
			setIsTransitioning(false)
			isTransitioningRef.current = false
			// Restart progress monitoring for new video
			if (playerRef.current && !progressIntervalRef.current) {
				setTimeout(() => startProgressMonitoring(), 1000)
			}
		}
	}, [current?.youtubeId])

	return (
		<div className="player-wrapper">
			<YouTube 
				key={playerKey} 
				videoId={current.youtubeId} 
				opts={opts} 
				onReady={onReady}
				onStateChange={onStateChange}
				onError={(e) => {
					console.error('YouTube player error:', e)
					setIsBuffering(false)
				}}
				className="youtube-player-container"
				iframeClassName="youtube-iframe"
			/>
			{/* Show static effect during buffering or transitioning */}
			{(isBuffering || isTransitioning) && (
				<div className="static-effect-tv">
					<div className="static-noise-overlay" />
				</div>
			)}
		</div>
	)
}