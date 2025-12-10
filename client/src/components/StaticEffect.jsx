import React, { useEffect, useRef } from 'react'

const STATIC_DURATION = 300 // Match the visual animation duration (0.3s)

export default function StaticEffect({ active, onComplete }) {
	const audioRef = useRef(null)
	const timeoutRef = useRef(null)
	const audioStopTimeoutRef = useRef(null)

	useEffect(() => {
		if (active) {
			// Play static sound exactly when visual starts
			if (audioRef.current) {
				audioRef.current.currentTime = 0
				audioRef.current.play().catch(err => {
					// Ignore autoplay restrictions - sound is optional
					console.warn('[StaticEffect] Could not play static sound:', err)
				})
				
				// Stop audio exactly after STATIC_DURATION to match visual
				audioStopTimeoutRef.current = setTimeout(() => {
					if (audioRef.current) {
						audioRef.current.pause()
						audioRef.current.currentTime = 0
					}
				}, STATIC_DURATION)
			}
			
			// Remove effect after animation (matches visual duration)
			if (onComplete) {
				timeoutRef.current = setTimeout(() => {
					onComplete()
				}, STATIC_DURATION)
			}
		} else {
			// Stop sound immediately when effect is deactivated
			if (audioRef.current) {
				audioRef.current.pause()
				audioRef.current.currentTime = 0
			}
			// Clear any pending stop timeout
			if (audioStopTimeoutRef.current) {
				clearTimeout(audioStopTimeoutRef.current)
				audioStopTimeoutRef.current = null
			}
		}

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
			if (audioStopTimeoutRef.current) {
				clearTimeout(audioStopTimeoutRef.current)
			}
			// Ensure audio stops on cleanup
			if (audioRef.current) {
				audioRef.current.pause()
				audioRef.current.currentTime = 0
			}
		}
	}, [active, onComplete])

	return (
		<>
			<audio 
				ref={audioRef} 
				preload="auto"
				src="/sounds/tv-static-noise-291374.mp3"
				loop
				onError={() => {
					// Silently handle missing sound file
					console.warn('[StaticEffect] Could not load static sound')
				}}
			/>
			{active && (
				<div className="static-effect-tv">
					<div className="static-noise-overlay" />
				</div>
			)}
		</>
	)
}

