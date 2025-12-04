import React, { useRef, useEffect, useState } from 'react'
import Player from './Player'
import StaticEffect from './StaticEffect'
import BufferingOverlay from './BufferingOverlay'

export default function TVFrame({ power, activeChannel, onStaticTrigger, statusMessage, volume, staticActive, uiLoadTime, allChannels, onVideoEnd, shouldAdvanceVideo, isBuffering = false, bufferErrorMessage = '', onBufferingChange = null }) {
	const tvFrameRef = useRef(null)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [showFullscreenHint, setShowFullscreenHint] = useState(false)

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

	const toggleFullscreen = () => {
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
	}

	return (
		<div 
			className="tv-frame-container" 
			ref={tvFrameRef} 
			onDoubleClick={toggleFullscreen}
			onMouseEnter={() => setShowFullscreenHint(true)}
			onMouseLeave={() => setShowFullscreenHint(false)}
		>
			{showFullscreenHint && !isFullscreen && (
				<div className="fullscreen-hint-overlay">
					DOUBLE CLICK FOR FULLSCREEN
				</div>
			)}
			<div className="tv-frame">
				<div className="tv-screen">
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
									uiLoadTime={uiLoadTime}
									allChannels={allChannels}
									shouldAdvanceVideo={shouldAdvanceVideo}
									onBufferingChange={onBufferingChange}
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
						</div>
					)}
					<div className="tv-screen-glow" />
				</div>
			</div>
			<div className="tv-status-indicator">
				{statusMessage || "WELCOME BACK! CLICK ON POWER BUTTON TO BEGIN JOURNEY."}
				{isFullscreen && (
					<div className="fullscreen-hint" style={{
						fontSize: '8px',
						color: '#4a9eff',
						marginTop: '5px',
						textShadow: '0 0 5px #4a9eff'
					}}>
						DOUBLE CLICK TO EXIT FULLSCREEN
					</div>
				)}
			</div>
		</div>
	)
}
