import React, { useEffect, useRef, useState } from 'react'

/**
 * DesiTV Player Component - iPhone Compatible
 * Based on RetroTV pattern with direct YouTube IFrame API
 * 
 * Props:
 *  - channel: object { _id, name, items: [{ youtubeId, title, duration }] }
 *  - onVideoEnd: function (called when playlist ends)
 *  - onChannelChange: function
 *  - volume: number (0-1)
 *  - onBufferingChange: function
 *  - onPlaybackStateChange: function
 *  - onTapHandlerReady: function
 */
export default function Player({ 
channel, 
onVideoEnd, 
volume = 0.5, 
onBufferingChange = null,
onPlaybackStateChange = null,
onTapHandlerReady = null,
}) {
	const playerRef = useRef(null)
	const ytRef = useRef(null)
	const [videoIndex, setVideoIndex] = useState(0)
	const [started, setStarted] = useState(
sessionStorage.getItem('desitv_gesture') === '1'
)
	const [staticVisible, setStaticVisible] = useState(false)
	const [error, setError] = useState(null)
	const channelIdRef = useRef(null)
	const volumeRef = useRef(volume)

	// Get current video from channel playlist
	const currentVideo = channel?.items?.[videoIndex]
	const videoId = currentVideo?.youtubeId || currentVideo?.videoId

	// Update volume ref when prop changes
	useEffect(() => {
		volumeRef.current = volume
		if (playerRef.current && started) {
			try {
				playerRef.current.setVolume(Math.round(volume * 100))
			} catch (err) {
				console.warn('[Player] Error setting volume:', err)
			}
		}
	}, [volume, started])

	// Debug log
	useEffect(() => {
		console.log('[Player] Channel:', channel?.name)
		console.log('[Player] Video index:', videoIndex)
		console.log('[Player] Current video:', currentVideo)
		console.log('[Player] VideoId:', videoId)
		console.log('[Player] Started:', started)
	}, [channel, videoIndex, currentVideo, videoId, started])

	// Reset video index when channel changes
	useEffect(() => {
		if (channel?._id !== channelIdRef.current) {
			console.log('[Player] Channel changed, resetting video index')
			channelIdRef.current = channel?._id
			setVideoIndex(0)
			setStaticVisible(true)
			
			// Clear static after brief delay
			setTimeout(() => {
				setStaticVisible(false)
			}, 400)
		}
	}, [channel?._id])

	// Load YT API once
	useEffect(() => {
		if (window.YT && window.YT.Player) {
			return
		}
		const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]')
		if (existing) return
		
		console.log('[Player] Loading YouTube IFrame API')
		const tag = document.createElement('script')
		tag.src = 'https://www.youtube.com/iframe_api'
		tag.async = true
		document.body.appendChild(tag)
	}, [])

	// Create player once, then update video
	useEffect(() => {
		if (!videoId) {
			console.log('[Player] No videoId available')
			return
		}

		const initPlayer = () => {
			if (!window.YT || !window.YT.Player) {
				console.log('[Player] Waiting for YT API...')
				return false
			}

			// Check if player container exists
			const container = document.getElementById('desitv-player-iframe')
			if (!container) {
				console.log('[Player] Container not found')
				return false
			}

			// If player already exists, just load new video
			if (ytRef.current && playerRef.current) {
				console.log('[Player] Loading video:', videoId)
				try {
					ytRef.current.loadVideoById(videoId)
					if (started) {
						setTimeout(() => tryPlayUnmute(), 500)
					}
					
					// Notify buffering state
					if (onBufferingChange) {
						onBufferingChange(true)
						setTimeout(() => onBufferingChange(false), 1000)
					}
				} catch (err) {
					console.error('[Player] Error loading video:', err)
					setError(`Error loading video: ${err.message}`)
				}
				return true
			}

			// Create new player
			console.log('[Player] Creating player with videoId:', videoId)
			try {
				ytRef.current = new window.YT.Player('desitv-player-iframe', {
height: '100%',
width: '100%',
videoId: videoId,
playerVars: {
autoplay: 0,
playsinline: 1,
controls: 0,
modestbranding: 1,
rel: 0,
iv_load_policy: 3,
mute: 1,
},
events: {
onReady: (e) => {
							console.log('[Player] Player ready')
							playerRef.current = e.target
							
							// Set initial volume
							try {
								playerRef.current.setVolume(Math.round(volumeRef.current * 100))
							} catch (err) {
								console.warn('[Player] Error setting initial volume:', err)
							}
							
							if (started) {
								setTimeout(() => tryPlayUnmute(), 300)
							}
							
							// Notify playback state
							if (onPlaybackStateChange) {
								onPlaybackStateChange('ready')
							}
						},
						onStateChange: (e) => {
							console.log('[Player] State change:', e.data)
							
							// Update playback state
							if (onPlaybackStateChange) {
								if (e.data === 1) onPlaybackStateChange('playing')
								else if (e.data === 2) onPlaybackStateChange('paused')
								else if (e.data === 3) onPlaybackStateChange('buffering')
								else if (e.data === 0) onPlaybackStateChange('ended')
							}
							
							// Update buffering state
							if (onBufferingChange) {
								onBufferingChange(e.data === 3) // 3 = buffering
							}
							
							// Video ended - play next
							if (e.data === 0) {
								console.log('[Player] Video ended, playing next')
								playNextVideo()
							}
						},
						onError: (e) => {
							console.error('[Player] Player error:', e.data)
							setError(`YT Error ${e.data}`)
							
							// Notify error state
							if (onPlaybackStateChange) {
								onPlaybackStateChange('error')
							}
							
							// Skip to next video after error
							setTimeout(() => {
								playNextVideo()
							}, 1000)
						},
					},
				})
				return true
			} catch (err) {
				console.error('[Player] Error creating player:', err)
				setError(`Failed to create player: ${err.message}`)
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
	}, [videoId, started])

	// Expose tap handler to parent (for external triggers if needed)
	useEffect(() => {
		if (onTapHandlerReady) {
			onTapHandlerReady(onUserGesture)
		}
	}, [onTapHandlerReady])

	// Helper: attempt to play and unmute (handles promise rejection)
	const tryPlayUnmute = async () => {
		if (!playerRef.current) return
		setError(null)
		
		try {
			playerRef.current.unMute?.()
		} catch (_) {}
		
		try {
			playerRef.current.playVideo?.()
			
			// Set volume after unmute
			try {
				playerRef.current.setVolume(Math.round(volumeRef.current * 100))
			} catch (err) {
				console.warn('[Player] Error setting volume:', err)
			}
		} catch (err) {
			console.warn('[Player] playVideo failed:', err)
		}
	}

	// Called when user taps the overlay / power button
	const onUserGesture = async () => {
		console.log('[Player] User gesture received')
		setStarted(true)
		sessionStorage.setItem('desitv_gesture', '1')
		
		// Ensure player exists
		if (!playerRef.current) {
			// Player still initializing; wait
			const waitTimer = setInterval(() => {
				if (playerRef.current) {
					clearInterval(waitTimer)
					tryPlayUnmute()
				}
			}, 50)
			return
		}

		// First, try to play while muted to satisfy autoplay rules
		try {
			playerRef.current.playVideo?.()
		} catch (_) {}
		
		// Then attempt to unmute (allowed because of user gesture)
		try {
			playerRef.current.unMute?.()
			playerRef.current.setVolume(Math.round(volumeRef.current * 100))
		} catch (_) {}
	}

	// Play next video in playlist
	const playNextVideo = () => {
		if (!channel?.items) return
		
		const nextIndex = (videoIndex + 1) % channel.items.length
		
		// If we've looped back to start, call onVideoEnd
if (nextIndex === 0 && onVideoEnd) {
console.log('[Player] Playlist ended, calling onVideoEnd')
onVideoEnd()
}

setStaticVisible(true)

setTimeout(() => {
setVideoIndex(nextIndex)
setStaticVisible(false)
}, 400)
}

return (
<div style={{ position: 'relative', width: '100%', height: '100%' }}>
{/* Tap overlay for iOS - only show if not started */}
{!started && (
<div
style={{
position: 'absolute',
top: 0,
left: 0,
right: 0,
bottom: 0,
zIndex: 9999,
display: 'flex',
alignItems: 'center',
justifyContent: 'center',
backgroundColor: 'rgba(0, 0, 0, 0.8)',
cursor: 'pointer',
}}
onClick={onUserGesture}
>
<div style={{ textAlign: 'center', color: 'white' }}>
<div style={{ fontSize: '48px', marginBottom: '20px' }}>⏻</div>
<div style={{ fontSize: '18px' }}>Tap to Start</div>
</div>
</div>
)}

{/* YouTube player container */}
<div
id="desitv-player-iframe"
style={{
position: 'absolute',
top: 0,
left: 0,
width: '100%',
height: '100%',
}}
/>

{/* Static/transition overlay */}
{staticVisible && (
<div
style={{
position: 'absolute',
top: 0,
left: 0,
right: 0,
bottom: 0,
zIndex: 100,
backgroundColor: 'black',
backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.5\'/%3E%3C/svg%3E")',
backgroundSize: '200px 200px',
animation: 'staticNoise 0.2s steps(10) infinite',
}}
/>
)}

{/* Error overlay */}
{error && (
<div
style={{
position: 'absolute',
bottom: '20px',
left: '50%',
transform: 'translateX(-50%)',
backgroundColor: 'rgba(255, 0, 0, 0.8)',
color: 'white',
padding: '10px 20px',
borderRadius: '5px',
zIndex: 200,
fontSize: '14px',
}}
>
{error}
</div>
)}
</div>
)
}
