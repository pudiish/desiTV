import React, { useEffect, useRef } from 'react'

const STATIC_DURATION = 300 // Match the visual animation duration (0.3s)

export default function StaticEffect({ active, onComplete }) {
	const timeoutRef = useRef(null)

	useEffect(() => {
		if (active) {
			// Remove effect after animation (matches visual duration)
			if (onComplete) {
				timeoutRef.current = setTimeout(() => {
					onComplete()
				}, STATIC_DURATION)
			}
		}

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [active, onComplete])

	if (!active) return null

	return (
		<div className="static-effect-tv">
			<div className="static-noise-overlay" />
		</div>
	)
}

