/**
 * PlayerVideoContainer - YouTube iframe and static video overlay
 * 
 * Extracted from Player.jsx to reduce complexity
 */

import React from 'react'
import logger from '../../utils/logger.js'

export default function PlayerVideoContainer({
	staticVideoRef,
	showStaticOverlay,
	isBuffering,
	isTransitioning,
}) {
	return (
		<>
			{/* Static video for loading/buffering - plays on top to cover YouTube loading */}
			<video
				ref={staticVideoRef}
				src="/sounds/alb_tvn0411_1080p.mp4"
				preload="auto"
				loop
				muted
				playsInline
				onError={(e) => {
					// Silently handle missing video file - black background will show instead
					logger.warn('[Player] Static video not available (non-critical):', e.target.error?.message || 'Unknown error')
				}}
				style={{
					position: 'absolute',
					top: 0,
					left: 0,
					width: '100%',
					height: '100%',
					objectFit: 'cover',
					zIndex: (showStaticOverlay || isBuffering || isTransitioning) ? 10 : -1,
					opacity: (showStaticOverlay || isBuffering || isTransitioning) ? 1 : 0,
					transition: 'opacity 0.3s ease-out',
					pointerEvents: 'none',
				}}
			/>
			<div className="crt-scanlines" style={{ zIndex: 20, pointerEvents: 'none' }}></div>
			{/* Direct YouTube IFrame API - iPhone compatible */}
			<div
				id="desitv-player-iframe"
				className="youtube-player-container"
				style={{
					width: '100%',
					height: '100%',
					position: 'absolute',
					top: 0,
					left: 0
				}}
			/>
		</>
	)
}
