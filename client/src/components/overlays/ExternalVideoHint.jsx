import React, { useState, useEffect, useCallback } from 'react'

/**
 * ExternalVideoHint - Industry-grade toast notification for external video mode
 * 
 * Features:
 * - Animated entrance/exit with CSS transitions
 * - Auto-dismiss with configurable duration
 * - Retro TV aesthetic matching the app theme
 * - Accessible with proper ARIA attributes
 * - Memory efficient with cleanup on unmount
 */
const ExternalVideoHint = React.memo(function ExternalVideoHint({ 
	videoTitle = '', 
	show = false, 
	duration = 4000,
	onDismiss = null 
}) {
	const [visible, setVisible] = useState(false)
	const [exiting, setExiting] = useState(false)

	// Handle show/hide with animation
	useEffect(() => {
		let enterTimer = null
		let exitTimer = null
		let dismissTimer = null

		if (show) {
			// Small delay for mount animation
			enterTimer = setTimeout(() => setVisible(true), 50)
			
			// Auto-dismiss after duration
			dismissTimer = setTimeout(() => {
				setExiting(true)
				exitTimer = setTimeout(() => {
					setVisible(false)
					setExiting(false)
					onDismiss?.()
				}, 300) // Exit animation duration
			}, duration)
		} else {
			setVisible(false)
			setExiting(false)
		}

		return () => {
			clearTimeout(enterTimer)
			clearTimeout(exitTimer)
			clearTimeout(dismissTimer)
		}
	}, [show, duration, onDismiss])

	// Don't render if not shown
	if (!show && !visible) return null

	// Truncate long titles
	const displayTitle = videoTitle.length > 40 
		? videoTitle.substring(0, 37) + '...' 
		: videoTitle

	return (
		<div
			role="status"
			aria-live="polite"
			aria-label={`Now playing: ${videoTitle}. Press channel or category buttons to return to TV.`}
			style={{
				position: 'absolute',
				bottom: '20px',
				left: '50%',
				transform: `translateX(-50%) translateY(${visible && !exiting ? '0' : '20px'})`,
				zIndex: 200,
				opacity: visible && !exiting ? 1 : 0,
				transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
				pointerEvents: 'none',
				maxWidth: '90%',
				width: 'auto'
			}}
		>
			<div
				style={{
					background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(20, 20, 20, 0.95) 100%)',
					backdropFilter: 'blur(10px)',
					WebkitBackdropFilter: 'blur(10px)',
					border: '1px solid rgba(212, 165, 116, 0.4)',
					borderRadius: '12px',
					padding: '14px 20px',
					boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(212, 165, 116, 0.1) inset',
					display: 'flex',
					flexDirection: 'column',
					gap: '8px',
					fontFamily: '"Press Start 2P", "Courier New", monospace'
				}}
			>
				{/* Now Playing Title */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '8px'
					}}
				>
					<span
						style={{
							fontSize: '16px',
							animation: 'pulse 1.5s ease-in-out infinite'
						}}
					>
						🎬
					</span>
					<span
						style={{
							color: '#d4a574',
							fontSize: '11px',
							fontWeight: '600',
							letterSpacing: '0.5px',
							textShadow: '0 2px 4px rgba(0, 0, 0, 0.5)'
						}}
					>
						NOW PLAYING
					</span>
				</div>

				{/* Video Title */}
				{displayTitle && (
					<div
						style={{
							color: '#ffffff',
							fontSize: '10px',
							fontWeight: '400',
							lineHeight: 1.4,
							opacity: 0.9,
							maxWidth: '300px',
							overflow: 'hidden',
							textOverflow: 'ellipsis',
							whiteSpace: 'nowrap'
						}}
					>
						{displayTitle}
					</div>
				)}

				{/* Exit Instructions */}
				<div
					style={{
						display: 'flex',
						alignItems: 'center',
						gap: '6px',
						marginTop: '4px',
						paddingTop: '8px',
						borderTop: '1px solid rgba(212, 165, 116, 0.2)'
					}}
				>
					<span
						style={{
							color: 'rgba(212, 165, 116, 0.7)',
							fontSize: '8px',
							letterSpacing: '0.3px'
						}}
					>
						▲▼ CH/CAT or POWER to exit
					</span>
				</div>
			</div>

			{/* CSS Animation Keyframes */}
			<style>{`
				@keyframes pulse {
					0%, 100% { opacity: 1; transform: scale(1); }
					50% { opacity: 0.7; transform: scale(1.1); }
				}
			`}</style>
		</div>
	)
})

export default ExternalVideoHint
