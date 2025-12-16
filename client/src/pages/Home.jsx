import React, { useState, useEffect, useRef, useCallback } from 'react'
import TVFrame from '../components/TVFrame'
import TVRemote from '../components/TVRemote'
import TVMenuV2 from '../components/TVMenuV2'
import TVSurvey from '../components/TVSurvey'
import SessionManager from '../utils/SessionManager'
import analytics from '../utils/analytics'
import performanceMonitor from '../utils/performanceMonitor'
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
	const [surveyOpen, setSurveyOpen] = useState(false) // Survey visibility
	const [userAgeGroup, setUserAgeGroup] = useState(null) // User age group for testing
	const lastPlaybackInfoRef = useRef(null) // Throttle updates to UI
	const surveyTimerRef = useRef(null) // Timer to show survey after watching
	const watchStartTimeRef = useRef(null) // Track when user started watching
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

	// Callback to show/hide remote overlay (triggered from TVFrame sensor or mobile toggle)
	const handleRemoteEdgeHover = useCallback(() => {
		// Check if fullscreen (including iOS CSS fullscreen)
		const isCurrentlyFullscreen = !!(
			document.fullscreenElement ||
			document.webkitFullscreenElement ||
			document.mozFullScreenElement ||
			document.msFullscreenElement ||
			document.body.classList.contains('ios-fullscreen-active') ||
			isFullscreen
		)
		
		if (!isCurrentlyFullscreen) return
		
		// Toggle remote visibility
		setRemoteOverlayVisible(prev => {
			const newState = !prev
			if (remoteHideTimeoutRef.current) {
				clearTimeout(remoteHideTimeoutRef.current)
			}
			// Don't auto-hide on mobile (user controls it manually)
			const isMobile = window.innerWidth <= 768
			if (newState && !isMobile) {
				remoteHideTimeoutRef.current = setTimeout(() => {
					setRemoteOverlayVisible(false)
				}, 5000)
			}
			return newState
		})
	}, [isFullscreen])
	
	// Handle swipe down to dismiss (mobile only)
	const handleRemoteSwipeDismiss = useCallback(() => {
		setRemoteOverlayVisible(false)
	}, [])

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
			console.log('[Home] Loading channels...')
			const allCategories = await channelManager.loadChannels()
			console.log('[Home] Loaded categories:', allCategories.length)
			
			if (!allCategories || allCategories.length === 0) {
				console.error('[Home] No categories loaded!')
				setStatusMessage('NO CATEGORIES FOUND. CHECKING CHANNELS.JSON FILE...')
				// Try to reload once more
				try {
					await channelManager.reload()
					const retryCategories = channelManager.getAllCategories()
					if (retryCategories && retryCategories.length > 0) {
						setCategories(retryCategories)
						setStatusMessage(`LOADED ${retryCategories.length} CATEGORIES.`)
					} else {
						setStatusMessage('NO CATEGORIES FOUND. PLEASE CHECK CHANNELS.JSON FILE.')
					}
				} catch (reloadErr) {
					console.error('[Home] Reload failed:', reloadErr)
					setStatusMessage('ERROR LOADING CHANNELS. CHECK CONSOLE FOR DETAILS.')
				}
				setSessionRestored(true)
				return
			}
			
			setCategories(allCategories)
			console.log('[Home] Categories set:', allCategories.map(c => c.name))
				
				// If session was restored, use saved state
				if (sessionResult.restored && sessionResult.state) {
					const savedState = sessionResult.state
					console.log('[Home] Restoring session from localStorage:', savedState)
					// Restore selected category (logic only, not JSX)
					// (No code needed here, logic continues below)
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
			// If no category is selected but categories exist, select the first
			if (!selectedCategory && categories.length > 0) {
				setSelectedCategory(categories[0])
				setVideosInCategory(categories[0].items || [])
			}
			// Show buffering overlay for 2 seconds when powering on
			setIsBuffering(true)
			setBufferErrorMessage('POWERING ON...')
			setTimeout(() => {
				setIsBuffering(false)
				setBufferErrorMessage('')
			}, 2000)
			const categoryName = (selectedCategory || categories[0])?.name || 'CATEGORY'
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
		
		const startTime = performance.now()
		const fromChannel = activeVideoIndex
		
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
		
		// Track analytics
		const switchTime = performanceMonitor.trackChannelSwitch(startTime)
		analytics.trackChannelChange('up', fromChannel, nextIndex, selectedCategory.name)
		analytics.trackPerformance('channel_switch_time', switchTime)
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
			analytics.trackVolumeChange(newVol, 'down')
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
			analytics.trackVolumeChange(0, 'mute')
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
		const startTime = performance.now()
		setMenuOpen(prev => {
			const isOpening = !prev
			if (isOpening) {
				analytics.trackMenuOpen()
			} else {
				analytics.trackMenuClose()
			}
			return !prev
		})
		
		// Track menu open performance
		if (!menuOpen) {
			setTimeout(() => {
				const openTime = performanceMonitor.trackMenuOpen(startTime)
				analytics.trackPerformance('menu_open_time', openTime)
			}, 100)
		}
	}

	// Close menu on orientation change and when entering fullscreen
	useEffect(() => {
		const handleOrientationChange = () => {
			if (menuOpen) {
				setMenuOpen(false)
			}
		}

		window.addEventListener('orientationchange', handleOrientationChange)
		window.addEventListener('resize', handleOrientationChange)

		return () => {
			window.removeEventListener('orientationchange', handleOrientationChange)
			window.removeEventListener('resize', handleOrientationChange)
		}
	}, [menuOpen])

	// Close menu when entering fullscreen
	useEffect(() => {
		if (isFullscreen && menuOpen) {
			setMenuOpen(false)
		}
	}, [isFullscreen, menuOpen])

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
		<>
		<div className="main-container">
			{/* Global glass overlay covering window while keeping remote above */}
			<div className="glass-full-overlay" aria-hidden="true" />
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
			onPowerToggle={handlePowerToggle}
			onChannelUp={handleChannelUp}
			onChannelDown={handleChannelDown}
			onVolumeUp={handleVolumeUp}
			onVolumeDown={handleVolumeDown}
			onMute={handleMute}
			remoteOverlayComponent={
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
			}
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
		
		{/* Simple TV-like Survey - appears after watching for a few minutes */}
		<TVSurvey
			isOpen={surveyOpen}
			onClose={() => setSurveyOpen(false)}
			ageGroup={userAgeGroup}
		/>
		</>
	)
}
