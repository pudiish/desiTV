import React, { useRef, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Player from './Player'
import StaticEffect from './StaticEffect'
import BufferingOverlay from './BufferingOverlay'
import WhatsNextPreview from './WhatsNextPreview'
import CRTInfoOverlay from './CRTInfoOverlay'

export default function TVFrame({ power, activeChannel, onStaticTrigger, statusMessage, volume, crtVolume = null, crtIsMuted = false, staticActive, allChannels, onVideoEnd, isBuffering = false, bufferErrorMessage = '', onBufferingChange = null, onPlaybackProgress = null, playbackInfo = null, activeChannelIndex = 0, channels = [], onTapHandlerReady = null, onFullscreenChange = null, onRemoteEdgeHover = null, remoteOverlayComponent = null, remoteOverlayVisible = false, menuComponent = null, onPowerToggle = null, onChannelUp = null, onChannelDown = null, onVolumeUp = null, onVolumeDown = null, onMute = null }) {
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

	const toggleFullscreen = useCallback(() => {
		// Detect iOS specifically (iOS doesn't support Fullscreen API for iframes)
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
		
		// Detect mobile device
		const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
			(window.innerWidth <= 768 && 'ontouchstart' in window)

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
				// Remove iOS fullscreen class
				if (isIOS) {
					document.body.classList.remove('ios-fullscreen-active')
					if (tvFrameRef.current) {
						tvFrameRef.current.classList.remove('ios-fullscreen-active')
					}
				}
			} else {
				if (isIOS) {
					// iOS: Use CSS-based fullscreen (iframe doesn't support Fullscreen API)
					// Make the iframe container fill the viewport
					const iframeContainer = document.getElementById('desitv-player-iframe')
					if (iframeContainer) {
						// Add iOS fullscreen class to body and container
						document.body.classList.add('ios-fullscreen-active')
						if (tvFrameRef.current) {
							tvFrameRef.current.classList.add('ios-fullscreen-active')
						}
						// Try to access YouTube iframe's video element for native fullscreen
						const iframe = iframeContainer.querySelector('iframe')
						if (iframe && iframe.contentWindow) {
							try {
								// Try to find video element inside iframe (cross-origin may block this)
								const iframeDoc = iframe.contentDocument || iframe.contentWindow.document
								const video = iframeDoc?.querySelector('video')
								if (video && video.webkitEnterFullscreen) {
									video.webkitEnterFullscreen()
									return
								}
							} catch (e) {
								// Cross-origin restriction - use CSS fullscreen instead
								console.log('[Fullscreen] iOS: Using CSS-based fullscreen (cross-origin iframe)')
							}
						}
					}
				} else if (isMobile) {
					// Android/Other Mobile: Try standard Fullscreen API
					const iframeContainer = document.getElementById('desitv-player-iframe')
					if (iframeContainer) {
						if (iframeContainer.requestFullscreen) {
							iframeContainer.requestFullscreen()
						} else if (iframeContainer.webkitRequestFullscreen) {
							iframeContainer.webkitRequestFullscreen()
						} else if (iframeContainer.mozRequestFullScreen) {
							iframeContainer.mozRequestFullScreen()
						} else if (iframeContainer.msRequestFullscreen) {
							iframeContainer.msRequestFullscreen()
						}
					}
				} else {
					// Desktop: Make CONTAINER fullscreen (allows overlays, with scale)
					const element = tvFrameRef.current
					if (element) {
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
				}
			}
		} catch (error) {
			console.error('Error toggling fullscreen:', error)
			// Fallback for iOS: Use CSS fullscreen
			if (isIOS && !isCurrentlyFullscreen) {
				document.body.classList.add('ios-fullscreen-active')
				if (tvFrameRef.current) {
					tvFrameRef.current.classList.add('ios-fullscreen-active')
				}
			}
		}
	}, [])

	// Handle fullscreen change events
	useEffect(() => {
		const handleFullscreenChange = () => {
			// Check if container OR iframe container is fullscreen
			const isCurrentlyFullscreen = !!(
				document.fullscreenElement ||
				document.webkitFullscreenElement ||
				document.mozFullScreenElement ||
				document.msFullscreenElement ||
				document.body.classList.contains('ios-fullscreen-active') // iOS CSS fullscreen
			)
			setIsFullscreen(isCurrentlyFullscreen)
			if (onFullscreenChange) {
				onFullscreenChange(isCurrentlyFullscreen)
			}
		}

		document.addEventListener('fullscreenchange', handleFullscreenChange)
		document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
		document.addEventListener('mozfullscreenchange', handleFullscreenChange)
		document.addEventListener('MSFullscreenChange', handleFullscreenChange)

		// Allow double-click anywhere (document) to exit fullscreen when active
		const handleDocDblClick = () => {
			const isCurrentlyFullscreen = !!(
				document.fullscreenElement ||
				document.webkitFullscreenElement ||
				document.mozFullScreenElement ||
				document.msFullscreenElement ||
				document.body.classList.contains('ios-fullscreen-active') // iOS CSS fullscreen
			)
			if (isCurrentlyFullscreen) {
				toggleFullscreen()
			}
		}
		document.addEventListener('dblclick', handleDocDblClick)

		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange)
			document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
			document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
			document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
			document.removeEventListener('dblclick', handleDocDblClick)
		}
	}, [toggleFullscreen, onFullscreenChange])

	// Handle orientation change - auto fullscreen on landscape (mobile only, iframe fullscreen)
	useEffect(() => {
		// Detect iOS specifically
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
		
		// Detect mobile device
		const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
			(window.innerWidth <= 768 && 'ontouchstart' in window)

		if (!isMobile) return // Only for mobile devices

		const handleOrientationChange = () => {
			// Small delay to ensure window dimensions are updated
			setTimeout(() => {
				const isLandscape = window.innerWidth > window.innerHeight
				const isCurrentlyFullscreen = !!(
					document.fullscreenElement ||
					document.webkitFullscreenElement ||
					document.mozFullScreenElement ||
					document.msFullscreenElement ||
					document.body.classList.contains('ios-fullscreen-active') // iOS CSS fullscreen
				)

				if (isLandscape && !isCurrentlyFullscreen && power) {
					// Rotated to landscape - enter fullscreen
					if (isIOS) {
						// iOS: Use CSS-based fullscreen
						document.body.classList.add('ios-fullscreen-active')
						if (tvFrameRef.current) {
							tvFrameRef.current.classList.add('ios-fullscreen-active')
						}
					} else {
						// Android/Other: Use Fullscreen API
						const iframeContainer = document.getElementById('desitv-player-iframe')
						if (iframeContainer) {
							try {
								if (iframeContainer.requestFullscreen) {
									iframeContainer.requestFullscreen()
								} else if (iframeContainer.webkitRequestFullscreen) {
									iframeContainer.webkitRequestFullscreen()
								} else if (iframeContainer.mozRequestFullScreen) {
									iframeContainer.mozRequestFullScreen()
								} else if (iframeContainer.msRequestFullscreen) {
									iframeContainer.msRequestFullscreen()
								}
							} catch (error) {
								console.error('Error entering iframe fullscreen on orientation change:', error)
							}
						}
					}
				} else if (!isLandscape && isCurrentlyFullscreen) {
					// Rotated to portrait - exit fullscreen
					if (isIOS) {
						// iOS: Remove CSS fullscreen classes
						document.body.classList.remove('ios-fullscreen-active')
						if (tvFrameRef.current) {
							tvFrameRef.current.classList.remove('ios-fullscreen-active')
						}
					} else {
						// Android/Other: Use Fullscreen API exit
						try {
							if (document.exitFullscreen) {
								document.exitFullscreen()
							} else if (document.webkitExitFullscreen) {
								document.webkitExitFullscreen()
							} else if (document.mozCancelFullScreen) {
								document.mozCancelFullScreen()
							} else if (document.msExitFullscreen) {
								document.msExitFullscreen()
							}
						} catch (error) {
							console.error('Error exiting fullscreen on orientation change:', error)
						}
					}
				}
			}, 100) // Small delay to ensure dimensions are updated
		}

		// Listen to both orientationchange and resize events
		window.addEventListener('orientationchange', handleOrientationChange)
		window.addEventListener('resize', handleOrientationChange)

		return () => {
			window.removeEventListener('orientationchange', handleOrientationChange)
			window.removeEventListener('resize', handleOrientationChange)
		}
	}, [power])

	// Handle double-tap for mobile fullscreen toggle
	const handleTouchEnd = useCallback((e) => {
		const now = Date.now()
		const DOUBLE_TAP_DELAY = 300 // ms between taps
		
		// Check if iOS fullscreen is active - allow single tap to exit
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
		const isIOSFullscreen = document.body.classList.contains('ios-fullscreen-active')
		
		if (isIOS && isIOSFullscreen) {
			// iOS: Single tap exits fullscreen
			e.preventDefault()
			toggleFullscreen()
			lastTapRef.current = 0
			if (doubleTapTimeoutRef.current) {
				clearTimeout(doubleTapTimeoutRef.current)
			}
			return
		}
		
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
			className="tv-frame-container"
			ref={tvFrameRef} 
			onDoubleClick={toggleFullscreen}
			onTouchEnd={handleTouchEnd}
		>
			<div 
				className="tv-frame"
				onMouseEnter={() => { setShowFullscreenHint(true); setShowPreview(true); }}
				onMouseLeave={() => { setShowFullscreenHint(false); setShowPreview(false); }}
			>
				<div className="tv-screen" onClick={handleScreenClick}>
					{!power ? (
						<div className="tv-off-screen">
							<div className="scanlines" />
							<div className="tv-off-message">
								CLICK POWER TO START
							</div>
						</div>
					) : (
						<div style={{ 
							position: 'relative', 
							width: '100%', 
							height: '100%', 
							display: 'flex', 
							alignItems: 'center', 
							justifyContent: 'center' 
						}}>
							{activeChannel ? (
								<Player 
									channel={activeChannel} 
									onVideoEnd={onVideoEnd || onStaticTrigger}
									onChannelChange={onStaticTrigger}
									volume={volume}
									allChannels={allChannels}
									onBufferingChange={onBufferingChange}
									onPlaybackProgress={onPlaybackProgress}
									onTapHandlerReady={handleTapHandlerReady}
									power={power}
								/>
							) : (
								<div className="tv-off-screen">
									<div className="scanlines" />
									<div className="tv-off-message">
										NO CHANNEL SELECTED
									</div>
								</div>
							)}
							{/* Hide scanlines in fullscreen */}
							{!isFullscreen && <div className="scanlines" />}
							{/* Static effect inside TV screen */}
							<StaticEffect active={staticActive} />
							{/* Buffering overlay positioned absolutely over the player */}
							<BufferingOverlay 
								isBuffering={isBuffering} 
								duration={2000}
								videoPath="/sounds/alb_tvn0411_1080p.mp4"
								errorMessage={bufferErrorMessage}
							/>
							{/* What's Next Preview on hover - hide in fullscreen */}
							{!isFullscreen && (
								<WhatsNextPreview 
									channel={activeChannel}
									isVisible={showPreview && !isBuffering && !staticActive}
									playbackInfo={playbackInfo}
								/>
							)}
							{/* CRT Volume Overlay - hide in fullscreen */}
							{!isFullscreen && (
								<CRTInfoOverlay 
									volume={crtVolume !== null ? crtVolume : volume}
									isMuted={crtIsMuted}
								/>
							)}
						</div>
					)}
										{/* Hide glow in fullscreen */}
										{false && !isFullscreen && <div className="tv-screen-glow" />}
										{/*
											To re-enable the TV frame glow/ambient light effect, set the above to:
											{!isFullscreen && <div className="tv-screen-glow" />}
											and ensure tv-glow.css is imported.
										*/}
				</div>
				{/* Bottom control strip to mimic 2000s CRT front panel */}
				<div className="tv-control-bar">
					<div className="tv-control-buttons">
						<button 
							className="tv-btn small" 
							onClick={(e) => { e.stopPropagation(); onChannelDown && onChannelDown(); }}
							title="Channel Down"
							aria-label="Channel Down"
						></button>
						<button 
							className="tv-btn small" 
							onClick={(e) => { e.stopPropagation(); onChannelUp && onChannelUp(); }}
							title="Channel Up"
							aria-label="Channel Up"
						></button>
						<button 
							className="tv-btn small" 
							onClick={(e) => { e.stopPropagation(); onVolumeDown && onVolumeDown(); }}
							title="Volume Down"
							aria-label="Volume Down"
						></button>
						<button 
							className="tv-btn small" 
							onClick={(e) => { e.stopPropagation(); onVolumeUp && onVolumeUp(); }}
							title="Volume Up"
							aria-label="Volume Up"
						></button>
						<button 
							className="tv-btn small" 
							onClick={(e) => { e.stopPropagation(); onMute && onMute(); }}
							title="Mute"
							aria-label="Mute"
						></button>
						<button 
							className="tv-btn small" 
							onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
							title="Fullscreen"
							aria-label="Fullscreen"
						></button>
						<button 
							className="tv-btn power" 
							onClick={(e) => { e.stopPropagation(); onPowerToggle && onPowerToggle(); }}
							title="Power"
							aria-label="Power"
						></button>
					</div>
				</div>
			</div>
			{/* Right-edge sensor to reveal remote in fullscreen (above iframe) */}
			{isFullscreen && (
				<div
					style={{
						position: 'fixed',
						top: 0,
						right: 0,
						width: '80px',
						height: '100vh',
						zIndex: 10002,
						pointerEvents: 'auto',
						background: 'transparent',
					}}
					onMouseEnter={() => onRemoteEdgeHover && onRemoteEdgeHover()}
					onMouseMove={() => onRemoteEdgeHover && onRemoteEdgeHover()}
					onTouchStart={() => onRemoteEdgeHover && onRemoteEdgeHover()}
					onTouchMove={() => onRemoteEdgeHover && onRemoteEdgeHover()}
				/>
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
			
			{/* Remote overlay portal - renders inside fullscreen container */}
			{isFullscreen && tvFrameRef.current && remoteOverlayComponent && createPortal(
				<div className={`remote-overlay ${remoteOverlayVisible ? 'visible' : ''}`}>
					{remoteOverlayComponent}
				</div>,
				tvFrameRef.current
			)}
			
			{/* Menu portal - renders inside fullscreen container */}
			{tvFrameRef.current && menuComponent && createPortal(
				menuComponent,
				tvFrameRef.current
			)}
		</div>
	)
}
