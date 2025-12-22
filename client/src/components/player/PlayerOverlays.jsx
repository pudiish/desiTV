/**
 * PlayerOverlays - Visual effects and overlays for the player
 * 
 * Extracted from Player.jsx to reduce complexity
 */

import React from 'react'

export default function PlayerOverlays({
	isBuffering,
	isTransitioning,
	retryCount,
	maxRetryAttempts,
	playbackHealth,
	needsUserInteraction,
	userInteracted,
	isMutedAutoplay,
	showStaticOverlay,
	onTapToStart,
}) {
	return (
		<>
			{/* Static Effect Overlay */}
			{(isBuffering || isTransitioning || showStaticOverlay) && (
				<div className="static-effect-tv">
					<div className="static-noise-overlay" />
					{retryCount > 0 && (
						<div className="retry-indicator">
							RETRY {retryCount}/{maxRetryAttempts}
						</div>
					)}
				</div>
			)}

			{/* Tap to Start Overlay (iOS autoplay) */}
			{needsUserInteraction && !userInteracted && (
				<div className="tap-to-start-overlay" onClick={onTapToStart}>
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
			)}

			{/* Muted Autoplay Indicator */}
			{isMutedAutoplay && !userInteracted && (
				<div className="muted-autoplay-overlay" onClick={onTapToStart}>
					🔇 TAP FOR SOUND
				</div>
			)}

			{/* Playback Error Overlay */}
			{playbackHealth === 'failed' && (
				<div className="playback-error-overlay" style={{ pointerEvents: 'none' }}>
					<div className="error-message">PLAYBACK ERROR - RECOVERING...</div>
				</div>
			)}
		</>
	)
}

