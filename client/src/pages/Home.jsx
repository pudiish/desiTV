import React, { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { TVFrame, TVRemote } from '../components/tv'
import { Galaxy } from '../components/backgrounds'
import { VJChat } from '../components/chat'
import { SessionManager } from '../services/storage'
import { analytics, performanceMonitor } from '../services/analytics'
import { channelManager } from '../logic/channel'
import { channelSwitchPipeline } from '../logic/effects'
import { broadcastStateManager } from '../logic/broadcast'
import { getTimeSuggestion, getTimeBasedGreeting } from '../utils/timeBasedProgramming'
import { useEasterEggs } from '../hooks/useEasterEggs'
import { checksumSyncService } from '../services/checksumSync'
import { clearEpochCache } from '../services/api/globalEpochService'

// Lazy load heavy components that aren't always visible
const TVMenuV2 = lazy(() => import('../components/tv').then(m => ({ default: m.TVMenuV2 })))
const TVSurvey = lazy(() => import('../components/tv').then(m => ({ default: m.TVSurvey })))

export default function Home() {
	// RESTRUCTURED: Categories are playlists, videos are channels
	const [categories, setCategories] = useState([]) // All categories (playlists)
	const [selectedCategory, setSelectedCategory] = useState(null) // Currently selected category/playlist
	const [activeVideoIndex, setActiveVideoIndex] = useState(0) // Index of current video within category
	
	// Ref to track current category index synchronously (fixes race condition on rapid clicks)
	const currentCategoryIndexRef = useRef(-1)
	
	// Derive videosInCategory from selectedCategory (removes redundant state)
	const videosInCategory = useMemo(() => 
		selectedCategory?.items || [], 
		[selectedCategory]
	)
	const [power, setPower] = useState(false)
	const [volume, setVolume] = useState(0.5)
	const [prevVolume, setPrevVolume] = useState(0.5) // For mute toggle
	const [staticActive, setStaticActive] = useState(false)
	const [galaxyEnabled, setGalaxyEnabled] = useState(false) // Galaxy background toggle
	const [statusMessage, setStatusMessage] = useState(`${getTimeBasedGreeting()} POWER BUTTON DABAO AUR SHURU KARO!`)
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
	const [easterEggMessage, setEasterEggMessage] = useState(null) // Easter egg popup
	
	// External YouTube video playback
	const [externalVideo, setExternalVideo] = useState(null) // { videoId, videoTitle, thumbnail, channel }
	
	// Easter eggs hook - shows special messages for secret codes
	const { lastEasterEgg } = useEasterEggs((egg) => {
		setEasterEggMessage(egg)
		setStatusMessage(egg.message)
		// Auto-clear after duration
		setTimeout(() => setEasterEggMessage(null), egg.duration || 3000)
	})
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
			document.documentElement.classList.contains('ios-fullscreen-active') ||
			document.body.classList.contains('tv-fullscreen-active') ||
			isFullscreen
		)
		
		console.log('[Remote] handleRemoteEdgeHover called, fullscreen:', isCurrentlyFullscreen, 'isFullscreen:', isFullscreen)
		
		if (!isCurrentlyFullscreen) {
			// If not fullscreen, hide remote
			setRemoteOverlayVisible(false)
			return
		}
		
		// Only work on desktop
		const isMobile = window.innerWidth <= 768
		if (isMobile) {
			console.log('[Remote] Mobile device, skipping')
			return
		}
		
		// Show remote and reset auto-hide timer (original behavior: show on hover, auto-hide after 2.5 sec)
		setRemoteOverlayVisible(prev => {
			// If already visible, just reset the timer (don't re-render)
			if (prev) {
				// Clear existing timeout and set new one
				if (remoteHideTimeoutRef.current) {
					clearTimeout(remoteHideTimeoutRef.current)
				}
				remoteHideTimeoutRef.current = setTimeout(() => {
					console.log('[Remote] Auto-hiding after 2.5 seconds')
					setRemoteOverlayVisible(false)
					remoteHideTimeoutRef.current = null
				}, 2500)
				return prev // Return same value to prevent re-render
			}
			
			// First time showing - log it
			console.log('[Remote] Showing remote overlay')
			
			// Clear any existing timeout
			if (remoteHideTimeoutRef.current) {
				clearTimeout(remoteHideTimeoutRef.current)
				remoteHideTimeoutRef.current = null
			}
			
			// Set new auto-hide timer (2.5 seconds)
			remoteHideTimeoutRef.current = setTimeout(() => {
				console.log('[Remote] Auto-hiding after 5 seconds')
				setRemoteOverlayVisible(false)
				remoteHideTimeoutRef.current = null
			}, 5000)
			
			// Show the remote
			return true
		})
	}, [isFullscreen])
	
	// Handle mouse leave from remote overlay area
	const handleRemoteMouseLeave = useCallback(() => {
		console.log('[Remote] Mouse left remote area, starting 2.5 second timer')
		// Clear existing timeout
		if (remoteHideTimeoutRef.current) {
			clearTimeout(remoteHideTimeoutRef.current)
			remoteHideTimeoutRef.current = null
		}
		// Set new timeout to hide after 2.5 seconds
		remoteHideTimeoutRef.current = setTimeout(() => {
			console.log('[Remote] Auto-hiding after 5 seconds (mouse left)')
			setRemoteOverlayVisible(false)
			remoteHideTimeoutRef.current = null
		}, 5000)
	}, [])

	// Debug: Log remote visibility changes
	useEffect(() => {
		console.log('[Remote] Visibility changed:', remoteOverlayVisible, 'Fullscreen:', isFullscreen)
	}, [remoteOverlayVisible, isFullscreen])
	
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
			// Clear remote hide timeout on unmount
			if (remoteHideTimeoutRef.current) {
				clearTimeout(remoteHideTimeoutRef.current)
				remoteHideTimeoutRef.current = null
			}
			// Stop checksum sync on unmount
			checksumSyncService.stop()
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

	// Keep ref in sync with selectedCategory (safety net)
	useEffect(() => {
		if (selectedCategory && categories.length > 0) {
			const categoryIndex = categories.findIndex(cat => cat._id === selectedCategory._id)
			if (categoryIndex !== -1 && currentCategoryIndexRef.current !== categoryIndex) {
				console.log(`[Home] Syncing ref: ${currentCategoryIndexRef.current} -> ${categoryIndex} (${selectedCategory.name})`)
				currentCategoryIndexRef.current = categoryIndex
			}
		}
	}, [selectedCategory, categories])

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
		
		// Update ref immediately for synchronous access (before state update)
		const categoryIndex = categories.findIndex(cat => cat._id === category._id)
		if (categoryIndex === -1) {
			console.warn(`[Home] Category index not found for: ${categoryName}`)
			return
		}
		
		// CRITICAL: Always update ref to keep it in sync
		currentCategoryIndexRef.current = categoryIndex
		console.log(`[Home] Setting category: ${categoryName} at index ${categoryIndex} (total: ${categories.length})`)
		
		// Initialize channel state FIRST, then disable manual mode
		try {
			broadcastStateManager.initializeChannel(category)
			broadcastStateManager.setManualMode(category._id, false)
			
			// Clear manual mode for old category if different
			if (selectedCategory && selectedCategory._id !== category._id) {
				broadcastStateManager.setManualMode(selectedCategory._id, false)
			}
			
			// Only sync epoch if not in manual mode (manual mode should stay independent)
			// Category change already disabled manual mode above, so safe to sync
			broadcastStateManager.initializeGlobalEpoch(true).catch(err => {
				console.warn('[Home] ⚠️ Global epoch refresh failed:', err)
			})
			// Trigger sync only after manual mode is disabled (now in LIVE mode)
			checksumSyncService.triggerFastSync()
		} catch (err) {
			console.error('[Home] Error initializing category state:', err)
		}
		
		setSelectedCategory(category)
		
		// Calculate and jump to live timeline position
		try {
			const position = broadcastStateManager.calculateCurrentPosition(category)
			if (position && position.videoIndex >= 0) {
				setActiveVideoIndex(position.videoIndex)
				broadcastStateManager.jumpToVideo(
					category._id,
					position.videoIndex,
					position.offset,
					category.items
				)
				setStatusMessage(`● LIVE - ${categoryName} - Video ${position.videoIndex + 1}`)
				setVideoSwitchTimestamp(Date.now())
			} else {
				setActiveVideoIndex(0)
				setStatusMessage(`${categoryName} - Video 1`)
			}
		} catch (err) {
			console.error('[Home] Error calculating position:', err)
			setActiveVideoIndex(0)
		}
		
		console.log(`[Home] Selected category: ${categoryName} with ${category.items?.length || 0} videos`)
	}

	// Load categories and restore session
	useEffect(() => {
		const initializeApp = async () => {
			try {
				// CRITICAL SYNC FIX: Clear all caches on reload for fresh sync
				// This ensures mobile and desktop get the same data
				console.log('[Home] 🔄 Clearing caches for fresh sync...')
				broadcastStateManager.clearAll()
				clearEpochCache()
				localStorage.removeItem('desitv-global-epoch-cached')
				localStorage.removeItem('desitv-broadcast-state')
				
				// CRITICAL: Always fetch global epoch from server FIRST (for true sync)
				// Don't load from localStorage - server is the source of truth
				// This ensures mobile and desktop are perfectly synchronized
				await broadcastStateManager.initializeGlobalEpoch(true) // Force refresh - always fetch fresh
				const epoch = broadcastStateManager.getGlobalEpoch()
				if (!epoch) {
					throw new Error('Failed to initialize global epoch')
				}
				console.log('[Home] ✅ Global epoch from server:', epoch.toISOString())
				
				// Start periodic epoch refresh to maintain sync (every 5 seconds for perfect sync)
				broadcastStateManager.startEpochRefresh()
				
				// ULTRA-FAST VALIDATION: Start checksum sync service (max 2s latency)
				// - Checks every 2 seconds (meets max latency requirement)
				// - Fast sync on critical moments (100ms debounce)
				// - Immediate validation on startup (500ms)
				checksumSyncService.start()
				
				// ULTRA-FAST: Force immediate sync after initial load (1s delay)
				setTimeout(() => {
					checksumSyncService.forceSync().catch(err => {
						console.warn('[Home] Initial checksum sync failed:', err)
					})
				}, 1000) // After 1 second for faster initial sync
				
				// Load channel states (but NOT epoch - epoch comes from server only)
				broadcastStateManager.loadFromStorage()
				
				// Initialize session manager (loads from localStorage)
				const sessionResult = await SessionManager.initialize()
				
			// Load categories (playlists) from JSON
			console.log('[Home] Loading channels...')
			const allCategories = await channelManager.loadChannels()
			console.log('[Home] Loaded categories:', allCategories.length)
			
			if (!allCategories || allCategories.length === 0) {
				console.error('[Home] No categories loaded!')
				setStatusMessage('CHANNELS NAHI MILE. CHECK KARO...')
				// Try to reload once more
				try {
					await channelManager.reload()
					const retryCategories = channelManager.getAllCategories()
					if (retryCategories && retryCategories.length > 0) {
						setCategories(retryCategories)
						setStatusMessage(`LOADED ${retryCategories.length} CATEGORIES.`)
					} else {
						setStatusMessage('CHANNELS NAHI MILE. FILE CHECK KARO.')
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
				let categoryRestored = false
				if (sessionResult.restored && sessionResult.state) {
					const savedState = sessionResult.state
					console.log('[Home] Restoring session from localStorage:', savedState)
					
					// Restore selected category and update ref
					if (savedState.activeCategoryId || savedState.activeCategoryName) {
						const restoredCategory = allCategories.find(cat => 
							cat._id === savedState.activeCategoryId || 
							cat.name === savedState.activeCategoryName
						)
						
						if (restoredCategory) {
							const restoredIndex = allCategories.findIndex(cat => cat._id === restoredCategory._id)
							if (restoredIndex !== -1) {
								currentCategoryIndexRef.current = restoredIndex
								
								// Initialize channel state FIRST, then disable manual mode
								broadcastStateManager.initializeChannel(restoredCategory)
								broadcastStateManager.setManualMode(restoredCategory._id, false)
								
								setSelectedCategory(restoredCategory)
								categoryRestored = true
								console.log(`[Home] Restored category: ${restoredCategory.name} at index ${restoredIndex} (LIVE mode)`)
							}
						}
					}
				}
				
				// If no category was restored, use time-based suggestion
				if (!categoryRestored && allCategories.length > 0) {
					const timeSuggestion = getTimeSuggestion(allCategories)
					const defaultCategory = timeSuggestion.channel || allCategories[0]
					const categoryIndex = allCategories.findIndex(cat => cat._id === defaultCategory._id)
					
				// Initialize channel state and ensure manual mode is disabled
				broadcastStateManager.initializeChannel(defaultCategory)
				broadcastStateManager.setManualMode(defaultCategory._id, false)
				
				currentCategoryIndexRef.current = categoryIndex !== -1 ? categoryIndex : 0
				setSelectedCategory(defaultCategory)
				console.log(`[Home] ${sessionResult.restored ? 'No restored category' : 'New session'}, using time-based: ${defaultCategory.name} (${timeSuggestion.slotName}) - LIVE mode`)
			}
				
				setSessionRestored(true)
			} catch (err) {
				console.error('Error initializing app:', err)
				setStatusMessage('ERROR! PAGE REFRESH KARO.')
				
				// Try to load categories anyway
				try {
					const allCategories = await channelManager.loadChannels()
					setCategories(allCategories)
					
					if (allCategories.length > 0) {
						const firstCategory = allCategories[0]
						setSelectedCategory(firstCategory)
						currentCategoryIndexRef.current = 0
						setStatusMessage(`LOADED ${allCategories.length} CATEGORIES.`)
					} else {
						setStatusMessage('CHANNELS NAHI MILE.')
					}
					
					setSessionRestored(true)
				} catch (loadErr) {
					console.error('Failed to load categories:', loadErr)
					setStatusMessage('CHANNELS LOAD NAHI HUE.')
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
				currentCategoryIndexRef.current = 0
			}
			// Show buffering overlay for 2 seconds when powering on
			setIsBuffering(true)
			setBufferErrorMessage('CHALU HO RAHA HAI...')
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
			setStatusMessage('TV BAND HAI. POWER DABAO AUR MASTI SHURU!')
			setIsBuffering(false)
			setBufferErrorMessage('')
			setMenuOpen(false) // Close menu when TV turns off
		}
	}

	function handleChannelUp() {
		if (!power || videosInCategory.length === 0 || !selectedCategory) {
			console.warn('[Home] Channel up blocked:', { power, videosCount: videosInCategory.length, hasCategory: !!selectedCategory })
			return
		}
		
		const startTime = performance.now()
		const fromChannel = activeVideoIndex
		
		// Switch to next video within the selected category
		const nextIndex = (activeVideoIndex + 1) % videosInCategory.length
		console.log(`[Home] Channel UP: ${activeVideoIndex} -> ${nextIndex}`)
		
		// Update state first
		setActiveVideoIndex(nextIndex)
		
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
			// Force Player to recalculate by updating timestamp (must happen after state updates)
			const newTimestamp = Date.now()
			setVideoSwitchTimestamp(newTimestamp)
			console.log(`[Home] ✅ Jumped to video ${nextIndex}, manual mode enabled, timestamp: ${newTimestamp}`)
		} catch (err) {
			console.error('[Home] ❌ Error jumping to video:', err)
		}
		
		setStatusMessage(`⏭️ ${selectedCategory.name} - Video ${nextIndex + 1}`)
		
		// Execute switch pipeline (async, but don't block)
		switchVideo(nextIndex).catch(err => {
			console.error('[Home] ❌ Error in switchVideo pipeline:', err)
		})
		
		// Track analytics
		const switchTime = performanceMonitor.trackChannelSwitch(startTime)
		analytics.trackChannelChange('up', fromChannel, nextIndex, selectedCategory.name)
		analytics.trackPerformance('channel_switch_time', switchTime)
	}

	function handleChannelDown() {
		if (!power || videosInCategory.length === 0 || !selectedCategory) {
			console.warn('[Home] Channel down blocked:', { power, videosCount: videosInCategory.length, hasCategory: !!selectedCategory })
			return
		}
		
		// Switch to previous video within the selected category
		const newIndex = activeVideoIndex === 0 
			? videosInCategory.length - 1 
			: activeVideoIndex - 1
		console.log(`[Home] Channel DOWN: ${activeVideoIndex} -> ${newIndex}`)
		
		// Update state first
		setActiveVideoIndex(newIndex)
		
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
			console.log(`[Home] ✅ Jumped to video ${newIndex}, manual mode enabled`)
		} catch (err) {
			console.error('[Home] ❌ Error jumping to video:', err)
		}
		
		setStatusMessage(`⏮️ ${selectedCategory.name} - Video ${newIndex + 1}`)
		
		// Execute switch pipeline (async, but don't block)
		switchVideo(newIndex).catch(err => {
			console.error('[Home] ❌ Error in switchVideo pipeline:', err)
		})
	}

	function handleVolumeUp() {
		setVolume(prev => {
			const newVol = Math.min(1, prev + 0.1)
			setCrtVolume(newVol)
			setCrtIsMuted(false)
			setStatusMessage(`🔊 AWAAZ: ${Math.round(newVol * 100)}%`)
			return newVol
		})
	}

	function handleVolumeDown() {
		setVolume(prev => {
			const newVol = Math.max(0, prev - 0.1)
			setCrtVolume(newVol)
			setCrtIsMuted(false)
			setStatusMessage(`🔊 AWAAZ: ${Math.round(newVol * 100)}%`)
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
			setStatusMessage('🔇 AWAAZ BAND')
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
			setStatusMessage(`VIDEO ${index + 1} AVAILABLE NAHI HAI`)
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
		setStatusMessage(`🎬 ${selectedCategory.name} - Video ${index + 1}`)
		switchVideo(index)
	}

	// Debounce category changes to prevent rapid switching
	const categoryChangeTimeoutRef = useRef(null)
	const isChangingCategoryRef = useRef(false)

	function handleCategoryUp() {
		if (!power || categories.length === 0) return
		if (isChangingCategoryRef.current) {
			console.log('[Home] Category change already in progress, ignoring...')
			return
		}
		
		// Clear any pending category change
		if (categoryChangeTimeoutRef.current) {
			clearTimeout(categoryChangeTimeoutRef.current)
		}
		
		// Use ref for immediate, synchronous access (fixes race condition)
		let currentIndex = currentCategoryIndexRef.current
		
		// Fallback: if ref is invalid, find from selectedCategory
		if (currentIndex === -1 || currentIndex >= categories.length) {
			currentIndex = categories.findIndex(cat => cat._id === selectedCategory?._id)
			if (currentIndex === -1) {
				// No valid category found, use first category
				currentIndex = 0
				currentCategoryIndexRef.current = 0
			} else {
				// Sync ref with found index
				currentCategoryIndexRef.current = currentIndex
			}
		}
		
		// Switch to next category (wrap around)
		const nextIndex = (currentIndex + 1) % categories.length
		const nextCategory = categories[nextIndex]
		
		if (!nextCategory) {
			console.warn(`[Home] Next category not found at index ${nextIndex}`)
			return
		}
		
		// Prevent duplicate changes
		if (nextCategory._id === selectedCategory?._id) {
			console.log(`[Home] Already on category ${nextCategory.name}, skipping...`)
			return
		}
		
		console.log(`[Home] Category UP: ${currentIndex} -> ${nextIndex} (${nextCategory.name})`)
		
		// Mark as changing
		isChangingCategoryRef.current = true
		
		// Update ref immediately for next click (before setCategory)
		currentCategoryIndexRef.current = nextIndex
		
		// Debounce the actual category change
		categoryChangeTimeoutRef.current = setTimeout(() => {
			setCategory(nextCategory.name)
			setStatusMessage(`📺 ${nextCategory.name.toUpperCase()} CHALU!`)
			// Reset flag after state update completes
			setTimeout(() => {
				isChangingCategoryRef.current = false
			}, 300)
		}, 50) // Small delay to batch rapid clicks
	}

	function handleCategoryDown() {
		if (!power || categories.length === 0) return
		if (isChangingCategoryRef.current) {
			console.log('[Home] Category change already in progress, ignoring...')
			return
		}
		
		// Clear any pending category change
		if (categoryChangeTimeoutRef.current) {
			clearTimeout(categoryChangeTimeoutRef.current)
		}
		
		// Use ref for immediate, synchronous access (fixes race condition)
		let currentIndex = currentCategoryIndexRef.current
		
		// Fallback: if ref is invalid, find from selectedCategory
		if (currentIndex === -1 || currentIndex >= categories.length) {
			currentIndex = categories.findIndex(cat => cat._id === selectedCategory?._id)
			if (currentIndex === -1) {
				// No valid category found, use first category
				currentIndex = 0
				currentCategoryIndexRef.current = 0
			} else {
				// Sync ref with found index
				currentCategoryIndexRef.current = currentIndex
			}
		}
		
		// Switch to previous category (wrap around)
		const prevIndex = currentIndex === 0 
			? categories.length - 1 
			: currentIndex - 1
		const prevCategory = categories[prevIndex]
		
		if (!prevCategory) {
			console.warn(`[Home] Previous category not found at index ${prevIndex}`)
			return
		}
		
		// Prevent duplicate changes
		if (prevCategory._id === selectedCategory?._id) {
			console.log(`[Home] Already on category ${prevCategory.name}, skipping...`)
			return
		}
		
		console.log(`[Home] Category DOWN: ${currentIndex} -> ${prevIndex} (${prevCategory.name})`)
		
		// Mark as changing
		isChangingCategoryRef.current = true
		
		// Update ref immediately for next click (before setCategory)
		currentCategoryIndexRef.current = prevIndex
		
		// Debounce the actual category change
		categoryChangeTimeoutRef.current = setTimeout(() => {
			setCategory(prevCategory.name)
			setStatusMessage(`📺 ${prevCategory.name.toUpperCase()} CHALU!`)
			// Reset flag after state update completes
			setTimeout(() => {
				isChangingCategoryRef.current = false
			}, 300)
		}, 50) // Small delay to batch rapid clicks
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

// Close menu on orientation change (but allow it in fullscreen)
	useEffect(() => {
		const handleOrientationChange = () => {
			// Only close menu on orientation change if not in fullscreen
			// In fullscreen, menu should work normally
			if (menuOpen && !isFullscreen) {
				setMenuOpen(false)
			}
		}

		window.addEventListener('orientationchange', handleOrientationChange)
		window.addEventListener('resize', handleOrientationChange)

		return () => {
			window.removeEventListener('orientationchange', handleOrientationChange)
			window.removeEventListener('resize', handleOrientationChange)
		}
	}, [menuOpen, isFullscreen])

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
		setStatusMessage(`✅ ${categoryName} SELECTED. CHANNEL BADALNE KE LIYE ↑↓`)
	}

		return (
		<>
		{/* Galaxy Background - Shows when enabled and TV is powered on */}
		{galaxyEnabled && (
			<Galaxy 
				isActive={power} 
				baseSpeed={0.3} 
				density={400} 
				volume={volume} 
				isPlaying={power && (playbackInfo?.isPlaying === true) && !isBuffering && !playbackInfo?.isBuffering}
				isBuffering={isBuffering || playbackInfo?.isBuffering}
				videoId={activeVideo?.youtubeId}
			/>
		)}
		
		{/* Galaxy Toggle Button - Bottom Left Corner */}
		<button
			className={`galaxy-toggle-btn ${galaxyEnabled ? 'active' : ''}`}
			onClick={() => setGalaxyEnabled(!galaxyEnabled)}
			title={galaxyEnabled ? 'Disable Galaxy Effect' : 'Enable Galaxy Effect'}
			aria-label="Toggle Galaxy Background"
		>
			<span className="galaxy-icon">✨</span>
		</button>
		
		{/* VJ Chat Assistant - Bottom Right Corner */}
		<VJChat 
			// Current playback state - REAL-TIME context
			currentChannel={selectedCategory?.name}
			currentChannelId={selectedCategory?._id}
			currentVideo={videosInCategory[activeVideoIndex] || null}
			nextVideo={videosInCategory[activeVideoIndex + 1] || videosInCategory[0] || null}
			currentVideoIndex={activeVideoIndex}
			totalVideos={videosInCategory.length}
			
			// Available data
			channels={categories}
			
			// UI state
			isVisible={power}
			
			// Action handlers
			onChangeChannel={(channel) => {
				// Handle channel change from VJ chat
				if (channel) {
					const targetCategory = categories.find(
						c => c._id === channel._id || c.name === channel.name
					);
					if (targetCategory) {
						console.log('[VJChat] Changing channel to:', targetCategory.name);
						setCategory(targetCategory.name);
					}
				}
			}}
			onPlayVideo={({ channelId, channelName, videoIndex }) => {
				// Handle video play from VJ chat
				const targetCategory = categories.find(
					c => c._id === channelId || c.name === channelName
				);
				if (targetCategory) {
					console.log('[VJChat] Playing video:', videoIndex, 'on', targetCategory.name);
					// First change to the channel
					setCategory(targetCategory.name);
					// Then jump to the specific video after a short delay
					setTimeout(() => {
						broadcastStateManager.setManualMode(targetCategory._id, true);
						broadcastStateManager.jumpToVideo(
							targetCategory._id,
							videoIndex,
							0,
							targetCategory.items
						);
						setActiveVideoIndex(videoIndex);
						setStatusMessage(`📺 Playing video ${videoIndex + 1} on ${targetCategory.name}`);
					}, 300);
				}
			}}
			onPlayExternal={({ videoId, videoTitle, thumbnail }) => {
				// Handle YouTube external video play from VJ chat - play on TV screen
				console.log('[VJChat] Playing external YouTube video on TV:', videoId, videoTitle);
				setExternalVideo({
					videoId,
					videoTitle,
					thumbnail,
					channelId: 'external'
				});
				setStatusMessage(`🎬 Playing: ${videoTitle}`);
			}}
		/>
		
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
			externalVideo={externalVideo}
			onExternalVideoEnd={() => setExternalVideo(null)}
			onTapHandlerReady={handleTapHandlerReady}
			onFullscreenChange={setIsFullscreen}
			onRemoteEdgeHover={handleRemoteEdgeHover}
			onRemoteMouseLeave={handleRemoteMouseLeave}
			remoteOverlayVisible={remoteOverlayVisible}
			onPowerToggle={handlePowerToggle}
			onChannelUp={handleChannelUp}
			onChannelDown={handleChannelDown}
			onCategoryUp={handleCategoryUp}
			onCategoryDown={handleCategoryDown}
			onVolumeUp={handleVolumeUp}
			onVolumeDown={handleVolumeDown}
			onMute={handleMute}
			galaxyProps={galaxyEnabled ? {
				isActive: power,
				baseSpeed: 0.3,
				density: 400,
				volume: volume,
				isPlaying: power && (playbackInfo?.isPlaying === true) && !isBuffering && !playbackInfo?.isBuffering,
				isBuffering: isBuffering || playbackInfo?.isBuffering,
				videoId: activeVideo?.youtubeId,
			} : null}
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
				<Suspense fallback={<div className="menu-loading">Loading menu...</div>}>
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
				</Suspense>
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
		{surveyOpen && (
			<Suspense fallback={null}>
				<TVSurvey
					isOpen={surveyOpen}
					onClose={() => setSurveyOpen(false)}
					ageGroup={userAgeGroup}
				/>
			</Suspense>
		)}
		
		{/* Easter Egg Popup */}
		{easterEggMessage && (
			<div className="easter-egg-popup">
				<div className="easter-egg-content">
					<span className="easter-egg-emoji">{easterEggMessage.emoji}</span>
					<span className="easter-egg-text">{easterEggMessage.message}</span>
				</div>
			</div>
		)}
		</>
	)
}
