import React, { useRef, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Player from './Player'
import StaticEffect from './StaticEffect'
import BufferingOverlay from './BufferingOverlay'
import WhatsNextPreview from './WhatsNextPreview'
import CRTInfoOverlay from './CRTInfoOverlay'

export default function TVFrame({ power, activeChannel, onStaticTrigger, statusMessage, volume, crtVolume = null, crtIsMuted = false, staticActive, allChannels, onVideoEnd, isBuffering = false, bufferErrorMessage = '', onBufferingChange = null, onPlaybackProgress = null, playbackInfo = null, activeChannelIndex = 0, channels = [], onTapHandlerReady = null, onFullscreenChange = null, onRemoteEdgeHover = null, remoteOverlayComponent = null, remoteOverlayVisible = false, menuComponent = null, onPowerToggle = null, onChannelUp = null, onChannelDown = null, onCategoryUp = null, onCategoryDown = null, onVolumeUp = null, onVolumeDown = null, onMute = null }) {
	const tvFrameRef = useRef(null)
	const [isFullscreen, setIsFullscreen] = useState(false)
	const [showPreview, setShowPreview] = useState(false)
	const tapHandlerRef = useRef(null)
	
	// Helper to check if actually in fullscreen (including iOS CSS fullscreen)
	const isActuallyFullscreen = () => {
		return !!(
			isFullscreen ||
			document.fullscreenElement ||
			document.webkitFullscreenElement ||
			document.mozFullScreenElement ||
			document.msFullscreenElement ||
			document.body.classList.contains('ios-fullscreen-active') ||
			(tvFrameRef.current && tvFrameRef.current.classList.contains('ios-fullscreen-active'))
		)
	}

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
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
		const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
			(window.innerWidth <= 768 && 'ontouchstart' in window)

		const isCurrentlyFullscreen = !!(
			document.fullscreenElement ||
			document.webkitFullscreenElement ||
			document.mozFullScreenElement ||
			document.msFullscreenElement ||
			document.body.classList.contains('ios-fullscreen-active') ||
			document.documentElement.classList.contains('ios-fullscreen-active') ||
			(tvFrameRef.current && tvFrameRef.current.classList.contains('ios-fullscreen-active'))
		)

		if (isCurrentlyFullscreen) {
			// Exit fullscreen
			document.documentElement.classList.remove('ios-fullscreen-active')
			document.body.classList.remove('ios-fullscreen-active')
			if (tvFrameRef.current) {
				tvFrameRef.current.classList.remove('ios-fullscreen-active')
			}
			
			if (document.exitFullscreen) {
				document.exitFullscreen().catch(() => {})
			} else if (document.webkitExitFullscreen) {
				document.webkitExitFullscreen()
			} else if (document.mozCancelFullScreen) {
				document.mozCancelFullScreen()
			} else if (document.msExitFullscreen) {
				document.msExitFullscreen()
			}
			
			setIsFullscreen(false)
			if (onFullscreenChange) {
				onFullscreenChange(false)
			}
		} else {
			// Enter fullscreen
			if (isIOS || isMobile) {
				// Mobile: CSS-based fullscreen
				document.documentElement.classList.add('ios-fullscreen-active')
				document.body.classList.add('ios-fullscreen-active')
				if (tvFrameRef.current) {
					tvFrameRef.current.classList.add('ios-fullscreen-active')
				}
				setIsFullscreen(true)
				if (onFullscreenChange) {
					onFullscreenChange(true)
				}
			} else {
				// Desktop: Standard Fullscreen API
				const element = tvFrameRef.current
				if (element) {
					const promise = element.requestFullscreen?.() ||
						element.webkitRequestFullscreen?.() ||
						element.mozRequestFullScreen?.() ||
						element.msRequestFullscreen?.()
					
					if (promise) {
						promise.catch(() => {
							// Fallback to CSS fullscreen
							document.documentElement.classList.add('ios-fullscreen-active')
							document.body.classList.add('ios-fullscreen-active')
							if (tvFrameRef.current) {
								tvFrameRef.current.classList.add('ios-fullscreen-active')
							}
							setIsFullscreen(true)
							if (onFullscreenChange) {
								onFullscreenChange(true)
							}
						})
					}
				}
			}
		}
	}, [onFullscreenChange])

	// Handle fullscreen change events
	useEffect(() => {
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

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

		// Check initial state (important for iOS)
		handleFullscreenChange()

		document.addEventListener('fullscreenchange', handleFullscreenChange)
		document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
		document.addEventListener('mozfullscreenchange', handleFullscreenChange)
		document.addEventListener('MSFullscreenChange', handleFullscreenChange)

		// Exit fullscreen: double-click (desktop) or double-tap (mobile)
		let lastTapTime = 0
		const DOUBLE_TAP_DELAY = 300

		const handleExitFullscreen = (e) => {
			const isCurrentlyFullscreen = !!(
				document.fullscreenElement ||
				document.webkitFullscreenElement ||
				document.mozFullScreenElement ||
				document.msFullscreenElement ||
				document.body.classList.contains('ios-fullscreen-active') ||
				(tvFrameRef.current && tvFrameRef.current.classList.contains('ios-fullscreen-active'))
			)
			if (!isCurrentlyFullscreen) return

			// Ignore if clicking on buttons or controls
			const target = e.target
			if (target.closest('button') || target.closest('.tv-control-bar')) {
				return
			}

			const now = Date.now()
			const isTouch = e.type === 'touchend'
			
			if (isTouch) {
				// Mobile: Double-tap to exit
				if (now - lastTapTime < DOUBLE_TAP_DELAY) {
					e.preventDefault()
					e.stopPropagation()
					toggleFullscreen()
					lastTapTime = 0
				} else {
					lastTapTime = now
				}
			} else {
				// Desktop: Double-click to exit
				toggleFullscreen()
			}
		}

		document.addEventListener('dblclick', handleExitFullscreen)
		document.addEventListener('touchend', handleExitFullscreen, { passive: false, capture: true })

		// iOS: Watch for CSS class changes (for iOS fullscreen detection)
		let observer = null
		if (isIOS) {
			observer = new MutationObserver(handleFullscreenChange)
			observer.observe(document.body, {
				attributes: true,
				attributeFilter: ['class']
			})
			if (tvFrameRef.current) {
				observer.observe(tvFrameRef.current, {
					attributes: true,
					attributeFilter: ['class']
				})
			}
		}

		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange)
			document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
			document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
			document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
			document.removeEventListener('dblclick', handleExitFullscreen)
			document.removeEventListener('touchend', handleExitFullscreen, { capture: true })
			if (observer) observer.disconnect()
		}
	}, [toggleFullscreen, onFullscreenChange])

	// Handle orientation change - auto fullscreen on landscape (mobile only)
	useEffect(() => {
		// Detect iOS specifically
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
		
		// Detect mobile device
		const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
			(window.innerWidth <= 768 && 'ontouchstart' in window)

		if (!isMobile) return // Only for mobile devices

		// Check if currently in landscape
		const checkIsLandscape = () => {
			return window.innerWidth > window.innerHeight || 
				   window.matchMedia('(orientation: landscape)').matches ||
				   (window.screen && window.screen.orientation && 
				    (window.screen.orientation.angle === 90 || window.screen.orientation.angle === -90))
		}

		// Check if currently in fullscreen
		const checkIsFullscreen = () => {
			return !!(
				document.fullscreenElement ||
				document.webkitFullscreenElement ||
				document.mozFullScreenElement ||
				document.msFullscreenElement ||
				document.body.classList.contains('ios-fullscreen-active') ||
				(tvFrameRef.current && tvFrameRef.current.classList.contains('ios-fullscreen-active'))
			)
		}

		const handleOrientationChange = () => {
			// Multiple checks with delays to handle all orientation change scenarios
			const checks = [0, 100, 300, 500] // Progressive delays
			
			checks.forEach(delay => {
				setTimeout(() => {
					const isLandscape = checkIsLandscape()
					const isCurrentlyFullscreen = checkIsFullscreen()

					if (isLandscape && !isCurrentlyFullscreen && power) {
						// Rotated to landscape - enter fullscreen IMMEDIATELY
						if (isIOS) {
							// iOS: Use CSS-based fullscreen to fill browser viewport
							document.body.classList.add('ios-fullscreen-active')
							document.documentElement.classList.add('ios-fullscreen-active')
							if (tvFrameRef.current) {
								tvFrameRef.current.classList.add('ios-fullscreen-active')
							}
							setIsFullscreen(true)
							if (onFullscreenChange) {
								onFullscreenChange(true)
							}
						} else {
							// Android/Other: Try Fullscreen API first, fallback to CSS
							const iframeContainer = document.getElementById('desitv-player-iframe')
							if (iframeContainer) {
								try {
									// Try iframe container first
									if (iframeContainer.requestFullscreen) {
										iframeContainer.requestFullscreen().catch(() => {
											// Fallback to CSS fullscreen
											enterCSSFullscreen()
										})
									} else if (iframeContainer.webkitRequestFullscreen) {
										iframeContainer.webkitRequestFullscreen()
									} else {
										enterCSSFullscreen()
									}
								} catch (error) {
									// Fallback to CSS fullscreen
									enterCSSFullscreen()
								}
							} else {
								enterCSSFullscreen()
							}
						}
					} else if (!isLandscape && isCurrentlyFullscreen) {
						// Rotated to portrait - exit fullscreen
						if (isIOS) {
							// iOS: Remove CSS fullscreen classes
							document.body.classList.remove('ios-fullscreen-active')
							document.documentElement.classList.remove('ios-fullscreen-active')
							if (tvFrameRef.current) {
								tvFrameRef.current.classList.remove('ios-fullscreen-active')
							}
							setIsFullscreen(false)
							if (onFullscreenChange) {
								onFullscreenChange(false)
							}
						} else {
							// Android/Other: Use Fullscreen API exit
							try {
								if (document.exitFullscreen) {
									document.exitFullscreen().catch(() => {
										exitCSSFullscreen()
									})
								} else if (document.webkitExitFullscreen) {
									document.webkitExitFullscreen()
								} else if (document.mozCancelFullScreen) {
									document.mozCancelFullScreen()
								} else if (document.msExitFullscreen) {
									document.msExitFullscreen()
								} else {
									exitCSSFullscreen()
								}
							} catch (error) {
								exitCSSFullscreen()
							}
						}
					}
				}, delay)
			})
		}

		// CSS fullscreen helper (fallback for all platforms)
		const enterCSSFullscreen = () => {
			document.body.classList.add('ios-fullscreen-active')
			document.documentElement.classList.add('ios-fullscreen-active')
			if (tvFrameRef.current) {
				tvFrameRef.current.classList.add('ios-fullscreen-active')
			}
			setIsFullscreen(true)
			if (onFullscreenChange) {
				onFullscreenChange(true)
			}
		}

		const exitCSSFullscreen = () => {
			document.body.classList.remove('ios-fullscreen-active')
			document.documentElement.classList.remove('ios-fullscreen-active')
			if (tvFrameRef.current) {
				tvFrameRef.current.classList.remove('ios-fullscreen-active')
			}
			setIsFullscreen(false)
			if (onFullscreenChange) {
				onFullscreenChange(false)
			}
		}

		// Check initial orientation
		if (checkIsLandscape() && power && !checkIsFullscreen()) {
			handleOrientationChange()
		}

		// Listen to orientation change events
		window.addEventListener('orientationchange', handleOrientationChange)
		window.addEventListener('resize', handleOrientationChange)
		
		// Also listen to screen orientation API if available
		if (window.screen && window.screen.orientation) {
			window.screen.orientation.addEventListener('change', handleOrientationChange)
		}

		return () => {
			window.removeEventListener('orientationchange', handleOrientationChange)
			window.removeEventListener('resize', handleOrientationChange)
			if (window.screen && window.screen.orientation) {
				window.screen.orientation.removeEventListener('change', handleOrientationChange)
			}
		}
	}, [power, onFullscreenChange, setIsFullscreen])


	return (
		<div 
			className="tv-frame-container"
			ref={tvFrameRef}
		>
			<div 
				className="tv-frame"
				onMouseEnter={() => { setShowPreview(true); }}
				onMouseLeave={() => { setShowPreview(false); }}
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
				{/* Bottom control strip - clean mobile controls */}
				<div className="tv-control-bar">
					<div className="tv-control-buttons">
						<button 
							className="tv-btn small channel-down" 
							onClick={(e) => { e.stopPropagation(); onChannelDown && onChannelDown(); }}
							onTouchEnd={(e) => { e.stopPropagation(); onChannelDown && onChannelDown(); }}
							title="Channel Down"
							aria-label="Channel Down"
						>
							<svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<polyline points="18 15 12 9 6 15"></polyline>
							</svg>
							<span className="btn-label">CH-</span>
						</button>
						<button 
							className="tv-btn small channel-up" 
							onClick={(e) => { e.stopPropagation(); onChannelUp && onChannelUp(); }}
							onTouchEnd={(e) => { e.stopPropagation(); onChannelUp && onChannelUp(); }}
							title="Channel Up"
							aria-label="Channel Up"
						>
							<svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<polyline points="6 9 12 15 18 9"></polyline>
							</svg>
							<span className="btn-label">CH+</span>
						</button>
						<button 
							className="tv-btn small category-down" 
							onClick={(e) => { e.stopPropagation(); onCategoryDown && onCategoryDown(); }}
							onTouchEnd={(e) => { e.stopPropagation(); onCategoryDown && onCategoryDown(); }}
							title="Previous Category"
							aria-label="Previous Category"
						>
							<svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<rect x="3" y="3" width="7" height="7"></rect>
								<rect x="14" y="3" width="7" height="7"></rect>
								<rect x="3" y="14" width="7" height="7"></rect>
								<rect x="14" y="14" width="7" height="7"></rect>
								<polyline points="10 12 8 10 10 8"></polyline>
								<polyline points="14 12 16 10 14 8"></polyline>
							</svg>
							<span className="btn-label">CAT-</span>
						</button>
						<button 
							className="tv-btn small category-up" 
							onClick={(e) => { e.stopPropagation(); onCategoryUp && onCategoryUp(); }}
							onTouchEnd={(e) => { e.stopPropagation(); onCategoryUp && onCategoryUp(); }}
							title="Next Category"
							aria-label="Next Category"
						>
							<svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<rect x="3" y="3" width="7" height="7"></rect>
								<rect x="14" y="3" width="7" height="7"></rect>
								<rect x="3" y="14" width="7" height="7"></rect>
								<rect x="14" y="14" width="7" height="7"></rect>
								<polyline points="10 12 12 10 10 8"></polyline>
								<polyline points="14 12 12 10 14 8"></polyline>
							</svg>
							<span className="btn-label">CAT+</span>
						</button>
						<button 
							className="tv-btn small volume-down" 
							onClick={(e) => { e.stopPropagation(); onVolumeDown && onVolumeDown(); }}
							onTouchEnd={(e) => { e.stopPropagation(); onVolumeDown && onVolumeDown(); }}
							title="Volume Down"
							aria-label="Volume Down"
						>
							<svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
								<path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
								<line x1="15" y1="12" x2="23" y2="12"></line>
							</svg>
							<span className="btn-label">VOL-</span>
						</button>
						<button 
							className="tv-btn small volume-up" 
							onClick={(e) => { e.stopPropagation(); onVolumeUp && onVolumeUp(); }}
							onTouchEnd={(e) => { e.stopPropagation(); onVolumeUp && onVolumeUp(); }}
							title="Volume Up"
							aria-label="Volume Up"
						>
							<svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
								<path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
							</svg>
							<span className="btn-label">VOL+</span>
						</button>
						<button 
							className="tv-btn small mute" 
							onClick={(e) => { e.stopPropagation(); onMute && onMute(); }}
							onTouchEnd={(e) => { e.stopPropagation(); onMute && onMute(); }}
							title="Mute"
							aria-label="Mute"
						>
							<svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
								<line x1="23" y1="9" x2="17" y2="15"></line>
								<line x1="17" y1="9" x2="23" y2="15"></line>
							</svg>
							<span className="btn-label">MUTE</span>
						</button>
						<button 
							className="tv-btn small fullscreen-btn" 
							onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
							onTouchEnd={(e) => { e.stopPropagation(); toggleFullscreen(); }}
							title="Fullscreen"
							aria-label="Fullscreen"
						>
							<svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
							</svg>
							<span className="btn-label">FULL</span>
						</button>
						<button 
							className="tv-btn power" 
							onClick={(e) => { e.stopPropagation(); onPowerToggle && onPowerToggle(); }}
							onTouchEnd={(e) => { e.stopPropagation(); onPowerToggle && onPowerToggle(); }}
							title="Power"
							aria-label="Power"
						>
							<svg className="btn-icon power-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
								<path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
								<line x1="12" y1="2" x2="12" y2="12"></line>
							</svg>
							<span className="btn-label">PWR</span>
						</button>
					</div>
				</div>
			</div>
			{/* Right-edge sensor to reveal remote in fullscreen - Desktop only */}
			{isActuallyFullscreen() && window.innerWidth > 768 && (
				<div
					className="remote-trigger-sensor"
					style={{
						position: 'fixed',
						top: 0,
						right: 0,
						width: '120px',
						height: '100vh',
						zIndex: 9999,
						pointerEvents: 'auto',
						background: 'transparent',
						touchAction: 'manipulation',
					}}
					onMouseEnter={() => onRemoteEdgeHover && onRemoteEdgeHover()}
					onMouseMove={() => onRemoteEdgeHover && onRemoteEdgeHover()}
				/>
			)}

			
			{/* Remote overlay portal - renders inside fullscreen container (Desktop only) */}
			{isActuallyFullscreen() && window.innerWidth > 768 && tvFrameRef.current && remoteOverlayComponent && createPortal(
				<div 
					className={`remote-overlay ${remoteOverlayVisible ? 'visible' : ''}`}
				>
					{/* Backdrop - tap to dismiss */}
					{remoteOverlayVisible && (
						<div 
							className="remote-overlay-backdrop" 
							onClick={(e) => {
								e.stopPropagation()
								onRemoteEdgeHover && onRemoteEdgeHover()
							}}
							onTouchEnd={(e) => {
								e.stopPropagation()
								onRemoteEdgeHover && onRemoteEdgeHover()
							}}
						/>
					)}
					{/* Content container */}
					<div 
						className="remote-overlay-content"
						onTouchStart={(e) => e.stopPropagation()}
						onTouchMove={(e) => e.stopPropagation()}
						onClick={(e) => e.stopPropagation()}
					>
						{remoteOverlayComponent}
					</div>
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
