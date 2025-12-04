import React, { useEffect, useRef } from 'react'

export default function StaticEffect({ active, onComplete }) {
	const audioRef = useRef(null)
	const timeoutRef = useRef(null)

	useEffect(() => {
		if (active) {
			// Play static sound (if available)
			if (audioRef.current) {
				audioRef.current.currentTime = 0
				audioRef.current.play().catch(err => {
					// Ignore autoplay restrictions - sound is optional
				})
			}
			
			// Remove effect after animation
			if (onComplete) {
				timeoutRef.current = setTimeout(() => {
					onComplete()
				}, 300)
			}
		} else {
			// Stop sound when effect ends
			if (audioRef.current) {
				audioRef.current.pause()
			}
		}

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
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

