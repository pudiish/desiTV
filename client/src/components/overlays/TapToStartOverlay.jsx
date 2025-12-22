import React from 'react'

/**
 * iOS-compatible tap-to-start overlay
 * Required for autoplay on iPhone Safari
 */
export default function TapToStartOverlay({ onTap, show }) {
	if (!show) return null

	return (
		<div className="tap-to-start-overlay" onClick={onTap}>
			<div className="tap-to-start-content">
				<div className="crt-flicker"></div>
				<div className="tap-message">
					<div className="tv-icon">📺</div>
					<h2>TAP TO START TV</h2>
					<p>Experience retro television</p>
					<div className="tap-hint">👆 Tap anywhere</div>
				</div>
			</div>
		</div>
	)
}
