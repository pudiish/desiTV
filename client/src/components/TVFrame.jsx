import React, { useRef, useEffect, useState, useCallback } from 'react'
import Player from './Player'
import StaticEffect from './StaticEffect'
import BufferingOverlay from './BufferingOverlay'
import WhatsNextPreview from './WhatsNextPreview'
import CRTInfoOverlay from './CRTInfoOverlay'

export default function TVFrame({ power, activeChannel, onStaticTrigger, statusMessage, volume, staticActive, allChannels, onVideoEnd, shouldAdvanceVideo, isBuffering = false, bufferErrorMessage = '', onBufferingChange = null, onPlaybackProgress = null, playbackInfo = null, activeChannelIndex = 0, channels = [], onTapHandlerReady = null }) {
	const tvFrameRef = useRef(null)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [showFullscreenHint, setShowFullscreenHint] = useState(false)
	const [showPreview, setShowPreview] = useState(false)
	const tapHandlerRef = useRef(null)
	const lastTapRef = useRef(0)
	const doubleTapTimeoutRef = useRef(null)

	// Store tap handler from Player
	const handleTapHandlerReady = (handler) => {
		tapHandlerRef.current = handler
		if (onTapHandlerReady) {
			onTapHandlerReady(handler)
		}
	}

	// Handle screen click to trigger tap
	const handleScreenClick = () => {
		if (tapHandlerRef.current) {
			tapHandlerRef.current()
		}
	}

	// Handle fullscreen change events
	useEffect(() => {
		const handleFullscreenChange = () => {
			const isCurrentlyFullscreen = !!(
				document.fullscreenElement ||
				document.webkitFullscreenElement ||
				document.mozFullScreenElement ||
				document.msFullscreenElement
			)
			setIsFullscreen(isCurrentlyFullscreen)
		}

		document.addEventListener('fullscreenchange', handleFullscreenChange)
		document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
		document.addEventListener('mozfullscreenchange', handleFullscreenChange)
		document.addEventListener('MSFullscreenChange', handleFullscreenChange)

		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange)
			document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
			document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
			document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
		}
	}, [])

	const toggleFullscreen = useCallback(() => {
		if (!tvFrameRef.current) return

		const element = tvFrameRef.current

		// Check if currently in fullscreen
		const isCurrentlyFullscreen = !!(
			document.fullscreenElement ||
			document.webkitFullscreenElement ||
			document.mozFullScreenElement ||
			document.msFullscreenElement
		)

		try {
			if (isCurrentlyFullscreen) {
				// Exit fullscreen
				if (document.exitFullscreen) {
					document.exitFullscreen()
				} else if (document.webkitExitFullscreen) {
					document.webkitExitFullscreen()
				} else if (document.mozCancelFullScreen) {
					document.mozCancelFullScreen()
				} else if (document.msExitFullscreen) {
					document.msExitFullscreen()
				}
			} else {
				// Enter fullscreen
				if (element.requestFullscreen) {
					element.requestFullscreen()
				} else if (element.webkitRequestFullscreen) {
					element.webkitRequestFullscreen()
				} else if (element.mozRequestFullScreen) {
					element.mozRequestFullScreen()
				} else if (element.msRequestFullscreen) {
					element.msRequestFullscreen()
				}
			}
		} catch (error) {
			console.error('Error toggling fullscreen:', error)
		}
	}, [])

	// Handle double-tap for mobile fullscreen toggle
	const handleTouchEnd = useCallback((e) => {
		const now = Date.now()
		const DOUBLE_TAP_DELAY = 300 // ms between taps
		
		if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
			// Double tap detected
			e.preventDefault()
			toggleFullscreen()
			lastTapRef.current = 0 // Reset
			if (doubleTapTimeoutRef.current) {
				clearTimeout(doubleTapTimeoutRef.current)
			}
		} else {
			// First tap - wait for potential second tap
			lastTapRef.current = now
			
			// Clear previous timeout
			if (doubleTapTimeoutRef.current) {
				clearTimeout(doubleTapTimeoutRef.current)
			}
			
			// Set timeout to reset if no second tap
			doubleTapTimeoutRef.current = setTimeout(() => {
				lastTapRef.current = 0
			}, DOUBLE_TAP_DELAY)
		}
	}, [toggleFullscreen])

	return (
		<div 
			className={`tv-frame-container ${isFullscreen ? 'is-fullscreen' : ''}`}
			ref={tvFrameRef} 
			onDoubleClick={toggleFullscreen}
			onTouchEnd={handleTouchEnd}
			onMouseEnter={() => { setShowFullscreenHint(true); setShowPreview(true); }}
			onMouseLeave={() => { setShowFullscreenHint(false); setShowPreview(false); }}
		>
			<div className={`tv-frame ${isFullscreen ? 'fullscreen-mode' : ''}`}>
				<div className={`tv-screen ${isFullscreen ? 'fullscreen-mode' : ''}`} onClick={handleScreenClick}>
					{!power ? (
						<div className="tv-off-screen">
							<div className="scanlines" />
							<div className="tv-off-message">
								CLICK POWER TO START
							</div>
						</div>
					) : (
						<div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
							{activeChannel ? (
								<Player 
									channel={activeChannel} 
									onVideoEnd={onVideoEnd || onStaticTrigger}
									onChannelChange={onStaticTrigger}
									volume={volume}
									allChannels={allChannels}
									shouldAdvanceVideo={shouldAdvanceVideo}
									onBufferingChange={onBufferingChange}
									onPlaybackProgress={onPlaybackProgress}
									onTapHandlerReady={handleTapHandlerReady}
								/>
							) : (
								<div className="tv-off-screen">
									<div className="scanlines" />
									<div className="tv-off-message">
										NO CHANNEL SELECTED
									</div>
								</div>
							)}
							<div className="scanlines" />
							{/* Static effect inside TV screen */}
							<StaticEffect active={staticActive} />
							{/* Buffering overlay positioned absolutely over the player */}
							<BufferingOverlay 
								isBuffering={isBuffering} 
								duration={2000}
								videoPath="/sounds/alb_tvn0411_1080p.mp4"
								errorMessage={bufferErrorMessage}
							/>
							{/* What's Next Preview on hover */}
							<WhatsNextPreview 
								channel={activeChannel}
								isVisible={showPreview && !isBuffering && !staticActive}
								playbackInfo={playbackInfo}
							/>
							{/* CRT Info Overlay - Channel and Volume Display */}
							<CRTInfoOverlay 
								activeChannelIndex={activeChannelIndex}
								channels={channels}
								volume={volume}
								isMuted={volume === 0}
							/>
						</div>
					)}
					{/* Hide glow in fullscreen */}
					{!isFullscreen && <div className="tv-screen-glow" />}
				</div>
			</div>
			{/* Hide status and hints in fullscreen */}
			{!isFullscreen && (
				<>
					<div className="tv-status-indicator">
						{statusMessage || "WELCOME BACK! CLICK ON POWER BUTTON TO BEGIN JOURNEY."}
					</div>
					{power && (
						<div style={{
							fontSize: '10px',
							color: '#666',
							marginTop: '10px',
							textAlign: 'center',
							opacity: showFullscreenHint ? 1 : 0.5,
							transition: 'opacity 0.3s ease'
						}}>
							Double tap/click for fullscreen
						</div>
					)}
				</>
			)}
			{/* Minimal exit hint in fullscreen - positioned at bottom */}
			{isFullscreen && (
				<div 
					className="fullscreen-exit-hint"
					style={{
						position: 'fixed',
						bottom: '20px',
						left: '50%',
						transform: 'translateX(-50%)',
						fontSize: '12px',
						color: 'rgba(255,255,255,0.5)',
						textAlign: 'center',
						zIndex: 9999,
						pointerEvents: 'none',
						opacity: 0.7,
						transition: 'opacity 0.3s ease'
					}}
				>
					Double tap to exit
				</div>
			)}
		</div>
	)
}
