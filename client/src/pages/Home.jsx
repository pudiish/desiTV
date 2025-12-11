import React, { useState, useEffect, useRef, useCallback } from 'react'
import TVFrame from '../components/TVFrame'
import TVRemote from '../components/TVRemote'
import TVMenuV2 from '../components/TVMenuV2'
import SessionManager from '../utils/SessionManager'
import { channelManager } from '../logic/channel'
import { channelSwitchPipeline } from '../logic/effects'
import { broadcastStateManager } from '../logic/broadcast'

export default function Home() {
	// RESTRUCTURED: Categories are playlists, videos are channels
	const [categories, setCategories] = useState([]) // All categories (playlists)
	const [selectedCategory, setSelectedCategory] = useState(null) // Currently selected category/playlist
	const [videosInCategory, setVideosInCategory] = useState([]) // Videos in selected category (these are the "channels")
	const [activeVideoIndex, setActiveVideoIndex] = useState(0) // Index of current video within category
	const [power, setPower] = useState(false)
	const [volume, setVolume] = useState(0.5)
	const [prevVolume, setPrevVolume] = useState(0.5) // For mute toggle
	const [staticActive, setStaticActive] = useState(false)
	const [statusMessage, setStatusMessage] = useState('WELCOME BACK! CLICK ON POWER BUTTON TO BEGIN JOURNEY.')
	const [isBuffering, setIsBuffering] = useState(false)
	const [bufferErrorMessage, setBufferErrorMessage] = useState('')
	const [menuOpen, setMenuOpen] = useState(false) // TV Menu state
	const [sessionRestored, setSessionRestored] = useState(false) // Track if session was restored
	const [playbackInfo, setPlaybackInfo] = useState(null) // Live playback snapshot from Player
	const [crtVolume, setCrtVolume] = useState(null) // CRT overlay volume trigger
	const [crtIsMuted, setCrtIsMuted] = useState(false) // CRT overlay muted state
	const [isFullscreen, setIsFullscreen] = useState(false) // Track fullscreen for overlay remote
	const [remoteOverlayVisible, setRemoteOverlayVisible] = useState(false) // Slide-up remote visibility
	const lastPlaybackInfoRef = useRef(null) // Throttle updates to UI
	const shutdownSoundRef = useRef(null) // Shutdown sound
	const sessionSaveTimeoutRef = useRef(null) // Debounced session save
	const tapTriggerRef = useRef(null) // iOS gesture unlock handler from Player
	const remoteHideTimeoutRef = useRef(null) // Auto-hide timer for overlay remote
	// Track video switch timestamp to force Player recalculation
	const [videoSwitchTimestamp, setVideoSwitchTimestamp] = useState(Date.now())

	// Store tap handler from Player (passed through TVFrame)
	const handleTapHandlerReady = (handler) => {
		tapTriggerRef.current = handler
	}

	// Callback to show remote overlay (triggered from TVFrame sensor)
	const handleRemoteEdgeHover = useCallback(() => {
		if (!isFullscreen) return
		setRemoteOverlayVisible(true)
		if (remoteHideTimeoutRef.current) {
			clearTimeout(remoteHideTimeoutRef.current)
		}
		remoteHideTimeoutRef.current = setTimeout(() => {
			setRemoteOverlayVisible(false)
		}, 2500)
	}, [isFullscreen])

	// Trigger tap for remote buttons and screen clicks
	const handleTapTrigger = () => {
		if (tapTriggerRef.current) {
			tapTriggerRef.current()
		}
	}


	// ===== SESSION MANAGEMENT =====
	
	// Save session state (debounced)
	const saveSessionState = useCallback(() => {
		if (sessionSaveTimeoutRef.current) {
			clearTimeout(sessionSaveTimeoutRef.current)
		}
		
		sessionSaveTimeoutRef.current = setTimeout(() => {
			// Get current video index from broadcast position (more accurate than state)
			let currentVideoIndex = activeVideoIndex
			if (selectedCategory) {
				try {
					const position = broadcastStateManager.calculateCurrentPosition(selectedCategory)
					if (position && position.videoIndex >= 0) {
						currentVideoIndex = position.videoIndex
					}
				} catch (err) {
					console.warn('[Home] Could not calculate position for save, using state index')
				}
			}
			
			SessionManager.updateState({
				activeCategoryId: selectedCategory?._id,
				activeCategoryName: selectedCategory?.name,
				activeVideoIndex: currentVideoIndex, // Save calculated position
				volume,
				isPowerOn: power,
			})
			
			// Also ensure broadcast state is saved
			try {
				broadcastStateManager.saveToStorage()
			} catch (err) {
				console.error('[Home] Error saving broadcast state:', err)
			}
		}, 500) // 500ms debounce
	}, [videosInCategory, activeVideoIndex, selectedCategory, volume, power])

	// Save session on page unload
	useEffect(() => {
		const handleBeforeUnload = () => {
			// Save session state
			SessionManager.forceSave()
			
			// CRITICAL: Save broadcast state (global epoch and channel states)
			// This ensures playback continues from correct position on reload
			try {
				broadcastStateManager.saveToStorage()
				console.log('[Home] Broadcast state saved on unload')
			} catch (err) {
				console.error('[Home] Error saving broadcast state on unload:', err)
			}
		}
		
		window.addEventListener('beforeunload', handleBeforeUnload)
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload)
			if (sessionSaveTimeoutRef.current) {
				clearTimeout(sessionSaveTimeoutRef.current)
			}
		}
	}, [])

	// Save session when key state changes
	useEffect(() => {
		if (sessionRestored) {
			saveSessionState()
		}
	}, [power, volume, activeVideoIndex, selectedCategory, sessionRestored, saveSessionState])

	// Periodic status message update (manual mode no longer expires automatically)
	useEffect(() => {
		if (!power || !selectedCategory) return

		const updateStatus = setInterval(() => {
			if (!selectedCategory?._id) return

			// Update status message based on mode (only if not already set by other handlers)
			const mode = broadcastStateManager.getMode(selectedCategory._id)
			const currentStatus = statusMessage || ''
			
			// Only update if status doesn't contain manual/timeline indicators
			if (!currentStatus.includes('MANUAL') && !currentStatus.includes('RETURNING') && !currentStatus.includes('LIVE')) {
				if (mode === 'manual') {
					// Manual mode - show current video info
					const currentVideo = videosInCategory[activeVideoIndex] || null
					const videoTitle = currentVideo?.title?.substring(0, 30) || 'VIDEO'
					setStatusMessage(`MANUAL MODE - ${selectedCategory.name} - ${videoTitle}...`)
				} else if (mode === 'timeline') {
					// Timeline mode - show LIVE indicator
					const currentVideo = videosInCategory[activeVideoIndex] || null
					const videoTitle = currentVideo?.title?.substring(0, 30) || 'VIDEO'
					setStatusMessage(`● LIVE - ${selectedCategory.name} - ${videoTitle}...`)
				}
			}
		}, 2000) // Update every 2 seconds (less frequent since we don't need timer checks)

		return () => clearInterval(updateStatus)
	}, [power, selectedCategory, videosInCategory, activeVideoIndex, statusMessage])

	// Initialize shutdown sound
	useEffect(() => {
		shutdownSoundRef.current = new Audio('/sounds/tv-shutdown-386167.mp3')
		shutdownSoundRef.current.volume = 0.5
	}, [])

	// NOTE: Broadcast epoch (stored in category) is the timing reference
	// Do NOT create any local timing references - they break on reload

	// Set selected category and load its videos
	function setCategory(categoryName) {
		const category = categories.find(cat => cat.name === categoryName)
		if (!category) {
			console.warn(`[Home] Category not found: ${categoryName}`)
			return
		}
		
		setSelectedCategory(category)
		setVideosInCategory(category.items || [])
		
		// Initialize broadcast state for this category
		try {
			broadcastStateManager.initializeChannel(category)
		} catch (err) {
			console.error('[Home] Error initializing category state:', err)
		}
		
		// Calculate timeline position for new category (pseudo-live)
		let targetIndex = 0
		let shouldUseTimeline = true
		
		try {
			const timelinePosition = broadcastStateManager.calculateCurrentPosition(category)
			targetIndex = timelinePosition.videoIndex
			shouldUseTimeline = true
		} catch (err) {
			console.error('[Home] Error calculating timeline position, starting from beginning:', err)
			targetIndex = 0
			shouldUseTimeline = false
		}
		
		setActiveVideoIndex(targetIndex)
		
		// Jump to timeline position (or first video if calculation failed)
		if (category.items && category.items.length > 0) {
			try {
				if (shouldUseTimeline) {
					const timelinePosition = broadcastStateManager.calculateCurrentPosition(category)
					broadcastStateManager.jumpToVideo(
						category._id,
						timelinePosition.videoIndex,
						timelinePosition.offset,
						category.items
					)
					setStatusMessage(`● LIVE - ${categoryName} - Video ${timelinePosition.videoIndex + 1}`)
				} else {
					broadcastStateManager.jumpToVideo(
						category._id,
						0,
						0,
						category.items
					)
					setStatusMessage(`${categoryName} - Video 1`)
				}
				// Reset manual mode when switching categories (start fresh)
				broadcastStateManager.setManualMode(category._id, false)
				// Force Player to recalculate by updating timestamp
				setVideoSwitchTimestamp(Date.now())
			} catch (err) {
				console.error('[Home] Error jumping to video:', err)
			}
		}
		
		console.log(`[Home] Selected category: ${categoryName} with ${category.items?.length || 0} videos`)
	}

	// Load categories and restore session
	useEffect(() => {
		const initializeApp = async () => {
			try {
				// CRITICAL: Load broadcast state FIRST (loads global epoch from localStorage)
				// This must happen before initializing channels so the epoch is preserved
				broadcastStateManager.loadFromStorage()
				console.log('[Home] Broadcast state loaded, global epoch:', broadcastStateManager.getGlobalEpoch()?.toISOString())
				
				// Initialize session manager (loads from localStorage)
				const sessionResult = await SessionManager.initialize()
				
				// Load categories (playlists) from JSON
				const allCategories = await channelManager.loadChannels()
				setCategories(allCategories)
				
				if (allCategories.length === 0) {
					setStatusMessage('NO CATEGORIES FOUND. PLEASE CHECK CHANNELS.JSON FILE.')
					setSessionRestored(true)
					return
				}
				
				// If session was restored, use saved state
				if (sessionResult.restored && sessionResult.state) {
					const savedState = sessionResult.state
					console.log('[Home] Restoring session from localStorage:', savedState)
					
					// Restore selected category
					let restoredCategory = null
					if (savedState.activeCategoryName) {
						restoredCategory = allCategories.find(cat => cat.name === savedState.activeCategoryName)
					}
					
					// Fallback to first category if not found
					if (!restoredCategory && allCategories.length > 0) {
						restoredCategory = allCategories[0]
					}
					
					if (restoredCategory) {
						setSelectedCategory(restoredCategory)
						setVideosInCategory(restoredCategory.items || [])
						
						// Initialize broadcast state for restored category
						// This will use the loaded global epoch (preserved across reloads)
						try {
							broadcastStateManager.initializeChannel(restoredCategory)
							
							// CRITICAL: Don't jump to saved video index - let pseudolive algorithm calculate
							// The pseudolive algorithm will calculate the correct position based on elapsed time
							// from the global epoch. This ensures playback continues from where it should be
							// based on the timeline, not from a potentially stale saved index.
							
							// Calculate current position using pseudolive algorithm
							const position = broadcastStateManager.calculateCurrentPosition(restoredCategory)
							if (position && position.videoIndex >= 0 && position.videoIndex < restoredCategory.items.length) {
								// Set the video index based on calculated position (not saved index)
								setActiveVideoIndex(position.videoIndex)
								setVideoSwitchTimestamp(Date.now()) // Force Player recalculation
								console.log(`[Home] Restored to video ${position.videoIndex} at ${position.offset.toFixed(1)}s (calculated from timeline)`)
							} else {
								// Fallback to saved index if calculation fails
								if (typeof savedState.activeVideoIndex === 'number' && 
								    savedState.activeVideoIndex < restoredCategory.items.length) {
									setActiveVideoIndex(savedState.activeVideoIndex)
									setVideoSwitchTimestamp(Date.now())
								}
							}
						} catch (err) {
							console.error('[Home] Error initializing restored category state:', err)
							// Fallback: use saved index
							if (typeof savedState.activeVideoIndex === 'number' && 
							    savedState.activeVideoIndex < restoredCategory.items.length) {
								setActiveVideoIndex(savedState.activeVideoIndex)
							}
						}
					}
					
					// Restore volume
					if (typeof savedState.volume === 'number') {
						setVolume(savedState.volume)
						setPrevVolume(savedState.volume)
					}
					
					// Always start with TV OFF - user must click power to start (enables sound properly)
					// This follows the MyRetroTVs pattern - power button click = user interaction
					const categoryName = savedState.activeCategoryName || allCategories[0]?.name || 'CATEGORY'
					setStatusMessage(`WELCOME BACK! CLICK POWER TO WATCH ${categoryName}.`)
					
					setSessionRestored(true)
				} else {
					// Fresh start - select first category
					const firstCategory = allCategories[0]
					if (firstCategory) {
						setSelectedCategory(firstCategory)
						setVideosInCategory(firstCategory.items || [])
						
						// Initialize broadcast state for first category
						// This will create a new global epoch if none exists
						try {
							broadcastStateManager.initializeChannel(firstCategory)
						} catch (err) {
							console.error('[Home] Error initializing first category state:', err)
						}
					}
					
					setStatusMessage(`LOADED ${allCategories.length} CATEGORIES. SELECT A CATEGORY TO START.`)
					setSessionRestored(true)
				}
			} catch (err) {
				console.error('Error initializing app:', err)
				setStatusMessage('ERROR LOADING. PLEASE REFRESH.')
				
				// Try to load categories anyway
				try {
					const allCategories = await channelManager.loadChannels()
					setCategories(allCategories)
					
					if (allCategories.length > 0) {
						const firstCategory = allCategories[0]
						setSelectedCategory(firstCategory)
						setVideosInCategory(firstCategory.items || [])
						setStatusMessage(`LOADED ${allCategories.length} CATEGORIES.`)
					} else {
						setStatusMessage('NO CATEGORIES FOUND IN JSON FILE.')
					}
					
					setSessionRestored(true)
				} catch (loadErr) {
					console.error('Failed to load categories:', loadErr)
					setStatusMessage('ERROR LOADING CATEGORIES FROM JSON FILE.')
				}
			}
		}

		initializeApp()
	}, [])

	// Active video - current video in selected category
	// This is what gets passed to Player as the "channel"
	const activeVideo = videosInCategory[activeVideoIndex] || null
	
	// Create a channel-like object for Player component (backward compatibility)
	// The "channel" is actually the selected category with current video
	// Include videoSwitchTimestamp to force recalculation when video changes
	const activeChannel = selectedCategory ? {
		_id: selectedCategory._id,
		name: selectedCategory.name,
		playlistStartEpoch: selectedCategory.playlistStartEpoch,
		items: videosInCategory, // All videos in this category
		// Current video info for display
		currentVideo: activeVideo,
		currentVideoIndex: activeVideoIndex,
		// Force recalculation when video switches
		_videoSwitchTimestamp: videoSwitchTimestamp
	} : null

	function handlePowerToggle() {
		const newPower = !power
		
		// Play shutdown sound when turning off
		if (!newPower && shutdownSoundRef.current) {
			shutdownSoundRef.current.currentTime = 0
			shutdownSoundRef.current.play().catch(() => {})
		}
		
		setPower(newPower)
		
		if (newPower) {
			// Show buffering overlay for 2 seconds when powering on
			setIsBuffering(true)
			setBufferErrorMessage('POWERING ON...')
			setTimeout(() => {
				setIsBuffering(false)
				setBufferErrorMessage('')
			}, 2000)
			const categoryName = selectedCategory?.name || 'CATEGORY'
			const videoTitle = activeVideo?.title?.substring(0, 20) || 'VIDEO'
			setStatusMessage(`TV ON. ${categoryName} - ${videoTitle}...`)
			
			// Auto-trigger tap overlay after 2.5 seconds delay
			setTimeout(() => {
				if (tapTriggerRef.current) {
					console.log('[Home] Auto-triggering tap after power on')
					tapTriggerRef.current()
				}
			}, 2500)
		} else {
			setStatusMessage('TV OFF. CLICK POWER TO START.')
			setIsBuffering(false)
			setBufferErrorMessage('')
			setMenuOpen(false) // Close menu when TV turns off
		}
	}

	function handleChannelUp() {
		if (!power || videosInCategory.length === 0 || !selectedCategory) return
		
		// Switch to next video within the selected category
		const nextIndex = (activeVideoIndex + 1) % videosInCategory.length
		
		// Jump to this video in broadcast state (so Player plays it)
		try {
			broadcastStateManager.jumpToVideo(
				selectedCategory._id,
				nextIndex,
				0, // Start at beginning of video
				videosInCategory
			)
			// Enable manual mode (user manually switched)
			broadcastStateManager.setManualMode(selectedCategory._id, true)
			// Force Player to recalculate by updating timestamp
			setVideoSwitchTimestamp(Date.now())
		} catch (err) {
			console.error('[Home] Error jumping to video:', err)
		}
		
		setActiveVideoIndex(nextIndex)
		setStatusMessage(`MANUAL MODE - ${selectedCategory.name} - Video ${nextIndex + 1}`)
		switchVideo(nextIndex)
	}

	function handleChannelDown() {
		if (!power || videosInCategory.length === 0 || !selectedCategory) return
		
		// Switch to previous video within the selected category
		const newIndex = activeVideoIndex === 0 
			? videosInCategory.length - 1 
			: activeVideoIndex - 1
		
		// Jump to this video in broadcast state (so Player plays it)
		try {
			broadcastStateManager.jumpToVideo(
				selectedCategory._id,
				newIndex,
				0, // Start at beginning of video
				videosInCategory
			)
			// Enable manual mode (user manually switched)
			broadcastStateManager.setManualMode(selectedCategory._id, true)
			// Force Player to recalculate by updating timestamp
			setVideoSwitchTimestamp(Date.now())
		} catch (err) {
			console.error('[Home] Error jumping to video:', err)
		}
		
		setActiveVideoIndex(newIndex)
		setStatusMessage(`MANUAL MODE - ${selectedCategory.name} - Video ${newIndex + 1}`)
		switchVideo(newIndex)
	}

	function handleVolumeUp() {
		setVolume(prev => {
			const newVol = Math.min(1, prev + 0.1)
			setCrtVolume(newVol)
			setCrtIsMuted(false)
			setStatusMessage(`VOLUME: ${Math.round(newVol * 100)}%`)
			return newVol
		})
	}

	function handleVolumeDown() {
		setVolume(prev => {
			const newVol = Math.max(0, prev - 0.1)
			setCrtVolume(newVol)
			setCrtIsMuted(false)
			setStatusMessage(`VOLUME: ${Math.round(newVol * 100)}%`)
			return newVol
		})
	}

	function handleMute() {
		if (volume > 0) {
			setPrevVolume(volume)
			setVolume(0)
			setCrtVolume(0)
			setCrtIsMuted(true)
			setStatusMessage('MUTED')
		} else {
			setVolume(prevVolume || 0.5)
			setCrtVolume(prevVolume || 0.5)
			setCrtIsMuted(false)
			setStatusMessage(`VOLUME: ${Math.round((prevVolume || 0.5) * 100)}%`)
		}
	}

	function handleChannelDirect(index) {
		if (!power || videosInCategory.length === 0 || !selectedCategory) return
		if (index < 0 || index >= videosInCategory.length) {
			setStatusMessage(`VIDEO ${index + 1} NOT AVAILABLE`)
			return
		}
		
		// Jump to this video in broadcast state (so Player plays it)
		try {
			broadcastStateManager.jumpToVideo(
				selectedCategory._id,
				index,
				0, // Start at beginning of video
				videosInCategory
			)
			// Enable manual mode (user manually switched)
			broadcastStateManager.setManualMode(selectedCategory._id, true)
			// Force Player to recalculate by updating timestamp
			setVideoSwitchTimestamp(Date.now())
		} catch (err) {
			console.error('[Home] Error jumping to video:', err)
		}
		
		setActiveVideoIndex(index)
		setStatusMessage(`MANUAL MODE - ${selectedCategory.name} - Video ${index + 1}`)
		switchVideo(index)
	}

	function handleCategoryUp() {
		if (!power || categories.length === 0) return
		
		// Find current category index
		const currentIndex = categories.findIndex(cat => cat._id === selectedCategory?._id)
		if (currentIndex === -1) return
		
		// Switch to next category (wrap around)
		const nextIndex = (currentIndex + 1) % categories.length
		const nextCategory = categories[nextIndex]
		
		if (nextCategory) {
			setCategory(nextCategory.name)
			setStatusMessage(`CATEGORY: ${nextCategory.name.toUpperCase()}`)
		}
	}

	function handleCategoryDown() {
		if (!power || categories.length === 0) return
		
		// Find current category index
		const currentIndex = categories.findIndex(cat => cat._id === selectedCategory?._id)
		if (currentIndex === -1) return
		
		// Switch to previous category (wrap around)
		const prevIndex = currentIndex === 0 
			? categories.length - 1 
			: currentIndex - 1
		const prevCategory = categories[prevIndex]
		
		if (prevCategory) {
			setCategory(prevCategory.name)
			setStatusMessage(`CATEGORY: ${prevCategory.name.toUpperCase()}`)
		}
	}

	function handleMenuToggle() {
		setMenuOpen(prev => !prev)
	}

	function triggerStatic() {
		setStaticActive(true)
		setTimeout(() => setStaticActive(false), 300)
	}

	function handleVideoEnd() {
		triggerStatic()
		// Videos now auto-advance in Player component
	}

	function handleChannelChange() {
		triggerStatic()
	}

	/**
	 * Video switching within category (Retro-TV animation pipeline)
	 */
	async function switchVideo(index) {
		if (index < 0 || index >= videosInCategory.length) return
		
		const video = videosInCategory[index]
		if (!video) return

		// Execute channel switch pipeline
		channelSwitchPipeline.on('onStaticStart', () => {
			setStaticActive(true)
		})
		
		channelSwitchPipeline.on('onStaticEnd', () => {
			setStaticActive(false)
		})
		
		channelSwitchPipeline.on('onBlackScreen', () => {
			setIsBuffering(true)
			setBufferErrorMessage(`SWITCHING TO VIDEO ${index + 1}...`)
		})
		
		channelSwitchPipeline.on('onVideoLoad', () => {
			// Video loading is handled by Player component
		})
		
		channelSwitchPipeline.on('onFadeIn', () => {
			// Fade-in handled by CRT effects
		})
		
		channelSwitchPipeline.on('onComplete', () => {
			setIsBuffering(false)
			setBufferErrorMessage('')
			const videoTitle = video.title || `Video ${index + 1}`
			setStatusMessage(`${selectedCategory?.name || 'CATEGORY'} - ${videoTitle.substring(0, 30)}...`)
		})

		await channelSwitchPipeline.execute()
	}

	// Handle category selection (this becomes the active playlist)
	function handleSelectCategory(categoryName) {
		setCategory(categoryName)
		setStatusMessage(`SELECTED: ${categoryName}. CHANNEL UP/DOWN TO SWITCH VIDEOS.`)
	}

		return (
		<div className="main-container">
			<div className="content-wrapper">
				{/* Left Side - TV Frame */}
		<TVFrame 
			power={power}
			activeChannel={activeChannel}
			activeChannelIndex={activeVideoIndex}
			channels={videosInCategory.map((v, i) => ({ ...v, _id: v._id || `video-${i}`, name: v.title }))}
			onStaticTrigger={handleChannelChange}
			statusMessage={statusMessage}
			volume={volume}
			crtVolume={crtVolume}
			crtIsMuted={crtIsMuted}
			staticActive={staticActive}
			allChannels={categories}
			onVideoEnd={handleVideoEnd}
			isBuffering={isBuffering}
			bufferErrorMessage={bufferErrorMessage}
			playbackInfo={playbackInfo}
			onTapHandlerReady={handleTapHandlerReady}
			onFullscreenChange={setIsFullscreen}
			onRemoteEdgeHover={handleRemoteEdgeHover}
			remoteOverlayVisible={remoteOverlayVisible}
			remoteOverlayComponent={isFullscreen ? (
				<TVRemote
					power={power}
					onPowerToggle={handlePowerToggle}
					onChannelUp={handleChannelUp}
					onChannelDown={handleChannelDown}
					onChannelDirect={handleChannelDirect}
					onCategoryUp={handleCategoryUp}
					onCategoryDown={handleCategoryDown}
					volume={volume}
					onVolumeUp={handleVolumeUp}
					onVolumeDown={handleVolumeDown}
					onMute={handleMute}
					onMenuToggle={handleMenuToggle}
					activeChannelIndex={activeVideoIndex}
					totalChannels={videosInCategory.length}
					menuOpen={menuOpen}
					onTapTrigger={handleTapTrigger}
				/>
			) : null}
			menuComponent={menuOpen ? (
				<TVMenuV2
					isOpen={menuOpen}
					onClose={() => setMenuOpen(false)}
					channels={categories}
					activeChannelIndex={categories.findIndex(cat => cat._id === selectedCategory?._id)}
					onChannelSelect={(index) => {
						const category = categories[index]
						if (category) {
							setCategory(category.name)
							setMenuOpen(false)
						}
					}}
					power={power}
					playbackInfo={playbackInfo}
				/>
			) : null}
				onBufferingChange={(isBuffering, errorMsg) => {
						setIsBuffering(isBuffering)
						setBufferErrorMessage(errorMsg || '')
						// Auto-hide after 2 seconds
						if (isBuffering) {
							setTimeout(() => {
								setIsBuffering(false)
								setBufferErrorMessage('')
							}, 2000)
						}
				}}
				onPlaybackProgress={(info) => {
					// Only update when active channel matches and change is meaningful
					const activeId = activeChannel?._id
					if (!info || !activeId || info.channelId !== activeId) return

					const last = lastPlaybackInfoRef.current
					const videoChanged = info.videoId && last?.videoId !== info.videoId
					const timeDelta = Math.abs((info.currentTime || 0) - (last?.currentTime || 0))

					if (!videoChanged && timeDelta < 0.5) return // Throttle minor updates

					lastPlaybackInfoRef.current = info
					setPlaybackInfo(info)
					
					// Update status message to show LIVE indicator if in timeline mode
					if (selectedCategory?._id) {
						const mode = broadcastStateManager.getMode(selectedCategory._id)
						const currentStatus = statusMessage || ''
						// Only update if not in manual mode and not showing manual/returning message
						if (mode === 'timeline' && !currentStatus.includes('MANUAL') && !currentStatus.includes('RETURNING')) {
							const videoTitle = info.videoTitle?.substring(0, 30) || 'VIDEO'
							setStatusMessage(`● LIVE - ${selectedCategory.name} - ${videoTitle}...`)
						}
					}
				}}
			/>

				{/* Right Side - Remote Control and Categories (hidden in fullscreen) */}
				{!isFullscreen && (
					<div className="right-panel">
						<TVRemote
							power={power}
							onPowerToggle={handlePowerToggle}
							onChannelUp={handleChannelUp}
							onChannelDown={handleChannelDown}
							onChannelDirect={handleChannelDirect}
							onCategoryUp={handleCategoryUp}
							onCategoryDown={handleCategoryDown}
							volume={volume}
							onVolumeUp={handleVolumeUp}
							onVolumeDown={handleVolumeDown}
							onMute={handleMute}
							onMenuToggle={handleMenuToggle}
							activeChannelIndex={activeVideoIndex}
							totalChannels={videosInCategory.length}
							menuOpen={menuOpen}
							onTapTrigger={handleTapTrigger}
						/>
					</div>
				)}
			</div>

		{/* Footer / Status Text */}
			<div className="footer-status">
				<div className="status-text">
					{statusMessage}
				</div>
			</div>

		</div>
	)
}
