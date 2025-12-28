import React, { useRef, useEffect, useState } from 'react'

export default function BufferingOverlay({ isBuffering = false, duration = 2000, errorMessage = '', videoPath = '/sounds/alb_tvn0411_1080p.mp4' }) {
	const videoRef = useRef(null)
	const timeoutRef = useRef(null)
	const [showOverlay, setShowOverlay] = useState(false)

	useEffect(() => {
		if (isBuffering) {
			// Show buffering overlay and play video
			setShowOverlay(true)
			console.log('[BufferingOverlay] Starting buffering - playing video for', duration, 'ms')

			// Play the video with better handling
			if (videoRef.current) {
				try {
					videoRef.current.currentTime = 0
					const playPromise = videoRef.current.play()
					
					if (playPromise !== undefined) {
						playPromise
							.then(() => {
								console.log('[BufferingOverlay] ✓ Video playing successfully')
							})
							.catch(err => {
								console.error('[BufferingOverlay] ✗ Play failed:', err.message)
								// Retry play on user interaction if needed
								const retryPlay = () => {
									videoRef.current?.play().catch(() => {})
									document.removeEventListener('click', retryPlay)
									document.removeEventListener('touchstart', retryPlay)
								}
								document.addEventListener('click', retryPlay, { once: true })
								document.addEventListener('touchstart', retryPlay, { once: true })
							})
					}
				} catch (err) {
					console.error('[BufferingOverlay] Error starting video:', err)
				}
			}

			// Set timeout to hide overlay after duration
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}

			timeoutRef.current = setTimeout(() => {
				console.log('[BufferingOverlay] Hiding overlay after', duration, 'ms')
				setShowOverlay(false)
				// Stop video
				if (videoRef.current) {
					videoRef.current.pause()
					videoRef.current.currentTime = 0
				}
			}, duration)
		} else {
			// Hide overlay when buffering ends
			setShowOverlay(false)
			if (videoRef.current) {
				videoRef.current.pause()
				videoRef.current.currentTime = 0
			}
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [isBuffering, duration])

	if (!showOverlay) {
		return null
	}

	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				backgroundColor: '#000000',
				zIndex: 50,
				overflow: 'hidden',
				pointerEvents: 'none' // Allow clicks through to YouTube player underneath
			}}
		>
			{/* Static noise video - gracefully handle missing file */}
			<video
				ref={videoRef}
				src={videoPath}
				style={{
					width: '100%',
					height: '100%',
					objectFit: 'cover',
					display: 'block'
				}}
				autoPlay
				loop
				playsInline
				preload="auto"
				crossOrigin="anonymous"
				onLoadedMetadata={() => {
					console.log('[BufferingOverlay] Video metadata loaded')
					if (videoRef.current && isBuffering) {
						videoRef.current.play().catch(err => {
							// Silently handle - video is optional
							console.warn('[BufferingOverlay] Video play failed (non-critical):', err.message)
						})
					}
				}}
				onError={(e) => {
					// Silently handle missing video file - just show black screen
					console.warn('[BufferingOverlay] Video file not available (non-critical):', e.target.error?.message || 'Unknown error')
					// Video element will just not display, black background will show
				}}
			/>

			{/* Error message at bottom left in green CRT font */}
			{errorMessage && (
				<div
					style={{
						position: 'absolute',
						bottom: '20px',
						left: '20px',
						color: '#00ff00',
						fontFamily: 'Courier New, monospace',
						fontSize: '12px',
						textShadow: '0 0 10px #00ff00, 0 0 20px #00ff00',
						letterSpacing: '1px',
						lineHeight: '1.4',
						maxWidth: '300px',
						backgroundColor: 'rgba(0, 0, 0, 0.7)',
						padding: '8px 12px',
						border: '1px solid #00ff00',
						borderRadius: '2px'
					}}
				>
					{errorMessage}
				</div>
			)}

			{/* Scanlines effect */}
			<div
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: '100%',
					height: '100%',
					backgroundImage: 'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.15), rgba(0, 0, 0, 0.15) 1px, transparent 1px, transparent 2px)',
					pointerEvents: 'none'
				}}
			/>
		</div>
	)
}
