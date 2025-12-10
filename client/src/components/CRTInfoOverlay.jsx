import React, { useState, useEffect, useRef } from 'react'

/**
 * CRTInfoOverlay - Displays volume info with retro CRT TV graphics
 * Volume: Right side vertical bar
 */
export default function CRTInfoOverlay({ volume, isMuted }) {
	const [displayVolume, setDisplayVolume] = useState(null)
	const [volumeFadeOut, setVolumeFadeOut] = useState(false)
	const volumeTimerRef = useRef(null)
	const volumeHideTimerRef = useRef(null)

	// Handle volume changes
	useEffect(() => {
		// Clear any existing timers first
		if (volumeTimerRef.current) {
			clearTimeout(volumeTimerRef.current)
			volumeTimerRef.current = null
		}
		if (volumeHideTimerRef.current) {
			clearTimeout(volumeHideTimerRef.current)
			volumeHideTimerRef.current = null
		}

		if (volume !== null && volume !== undefined) {
			setVolumeFadeOut(false)
			const volumePercent = Math.round(volume * 100)
			setDisplayVolume({
				percent: volumePercent,
				bars: Math.ceil(volumePercent / 10),
				muted: isMuted
			})

			// Timeline: 0ms=show, 2000ms=start fade, then wait for animation to complete
			volumeTimerRef.current = setTimeout(() => {
				setVolumeFadeOut(true)
				
				// After fade animation completes (600ms), remove from DOM
				volumeHideTimerRef.current = setTimeout(() => {
					setDisplayVolume(null)
					setVolumeFadeOut(false)
				}, 600)
			}, 2000)
		}

		return () => {
			if (volumeTimerRef.current) {
				clearTimeout(volumeTimerRef.current)
				volumeTimerRef.current = null
			}
			if (volumeHideTimerRef.current) {
				clearTimeout(volumeHideTimerRef.current)
				volumeHideTimerRef.current = null
			}
		}
	}, [volume, isMuted])

	if (!displayVolume) return null

	return (
		<div className={`crt-volume-display ${volumeFadeOut ? 'fade-out' : ''}`}>
			<div className="volume-box">
				<div className="volume-label">VOL</div>
				<div className="volume-bars-vertical">
					{Array.from({ length: 10 }).map((_, i) => (
						<div
							key={i}
							className={`volume-bar-vertical ${i < displayVolume.bars ? 'active' : ''}`}
						/>
					))}
				</div>
				<div className="volume-value">
					{displayVolume.muted ? '●' : displayVolume.percent}
				</div>
			</div>
			<div className="scanlines-small" />
		</div>
	)
}
