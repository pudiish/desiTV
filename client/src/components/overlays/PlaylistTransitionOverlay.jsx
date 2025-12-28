/**
 * PlaylistTransitionOverlay.jsx
 * 
 * Overlay that shows when playlist is transitioning between time slots
 * Provides smooth visual feedback during transitions
 */

import React from 'react'
import { getTransitionState, getTransitionMessage } from '../../utils/playlistTransition'

export default function PlaylistTransitionOverlay({ 
	currentTimeSlot, 
	nextTimeSlot, 
	secondsUntilNextSlot,
	isVisible = false 
}) {
	if (!isVisible || !secondsUntilNextSlot || secondsUntilNextSlot > 60) {
		return null
	}
	
	const transition = getTransitionState(secondsUntilNextSlot, 30)
	const message = getTransitionMessage(currentTimeSlot, nextTimeSlot, secondsUntilNextSlot)
	
	if (!transition.isTransitioning) {
		return null
	}
	
	return (
		<div 
			className="playlist-transition-overlay"
			style={{
				position: 'absolute',
				top: '20px',
				left: '50%',
				transform: 'translateX(-50%)',
				zIndex: 100,
				background: 'rgba(0, 0, 0, 0.8)',
				color: '#fff',
				padding: '12px 24px',
				borderRadius: '8px',
				fontSize: '14px',
				fontFamily: 'monospace',
				opacity: transition.opacity,
				transition: 'opacity 0.3s ease',
				pointerEvents: 'none',
				border: '2px solid rgba(255, 255, 255, 0.3)',
			}}
		>
			<div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
				<div className="transition-spinner" style={{
					width: '20px',
					height: '20px',
					border: '2px solid rgba(255, 255, 255, 0.3)',
					borderTop: '2px solid #fff',
					borderRadius: '50%',
					animation: 'spin 1s linear infinite',
				}} />
				<div>
					<div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
						{message || `Transitioning to ${nextTimeSlot}...`}
					</div>
					<div style={{ fontSize: '12px', opacity: 0.8 }}>
						{currentTimeSlot} → {nextTimeSlot}
					</div>
				</div>
			</div>
			
			<style>{`
				@keyframes spin {
					from { transform: rotate(0deg); }
					to { transform: rotate(360deg); }
				}
			`}</style>
		</div>
	)
}

