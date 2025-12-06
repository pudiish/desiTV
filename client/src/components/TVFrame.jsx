import React, { useRef, useEffect, useState } from 'react'
import Player from './Player'
import StaticEffect from './StaticEffect'
import BufferingOverlay from './BufferingOverlay'
import WhatsNextPreview from './WhatsNextPreview'
import CRTInfoOverlay from './CRTInfoOverlay'
import BlueRaysEffect from './BlueRaysEffect'

export default function TVFrame({ power, activeChannel, onStaticTrigger, statusMessage, volume, staticActive, allChannels, onVideoEnd, shouldAdvanceVideo, isBuffering = false, bufferErrorMessage = '', onBufferingChange = null, onPlaybackProgress = null, playbackInfo = null, activeChannelIndex = 0, channels = [], onTapHandlerReady = null }) {
	const tvFrameRef = useRef(null)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [showFullscreenHint, setShowFullscreenHint] = useState(false)
	const [showPreview, setShowPreview] = useState(false)
	const tapHandlerRef = useRef(null)

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
			onMouseEnter={() => { setShowFullscreenHint(true); setShowPreview(true); }}
			onMouseLeave={() => { setShowFullscreenHint(false); setShowPreview(false); }}
		>
			{/* Blue Rays Effect - Positioned behind everything in fullscreen */}
			{isFullscreen && <BlueRaysEffect isFullscreen={isFullscreen} volume={volume} />}
			
			<div className="tv-frame">
				<div className="tv-screen" onClick={handleScreenClick}>
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
					<div className="tv-screen-glow" />
				</div>
			</div>
			<div className="tv-status-indicator">
				{statusMessage || "WELCOME BACK! CLICK ON POWER BUTTON TO BEGIN JOURNEY."}
			</div>
			{/* Fullscreen hint outside TV box */}
			{!isFullscreen && power && (
				<div style={{
					fontSize: '10px',
					color: '#666',
					marginTop: '10px',
					textAlign: 'center',
					opacity: showFullscreenHint ? 1 : 0.5,
					transition: 'opacity 0.3s ease'
				}}>
					Double click for fullscreen
				</div>
			)}
			{isFullscreen && (
				<div style={{
					fontSize: '10px',
					color: '#4a9eff',
					marginTop: '10px',
					textAlign: 'center',
					textShadow: '0 0 5px #4a9eff'
				}}>
					Double click to exit fullscreen
				</div>
			)}
		</div>
	)
}
