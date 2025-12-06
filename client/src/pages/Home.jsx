import React, { useState, useEffect, useRef, useCallback } from 'react'
import TVFrame from '../components/TVFrame'
import TVRemote from '../components/TVRemote'
import TVMenuV2 from '../components/TVMenuV2'
import CategoryList from '../components/CategoryList'
import StaticEffect from '../components/StaticEffect'
import CRTInfoOverlay from '../components/CRTInfoOverlay'
import SessionManager from '../utils/SessionManager'
import channelManager from '../logic/channelManager'
import { channelSwitchPipeline } from '../logic/effects'

export default function Home() {
	const [channels, setChannels] = useState([])
	const [selectedChannels, setSelectedChannels] = useState([])
	const [filteredChannels, setFilteredChannels] = useState([])
	const [activeChannelIndex, setActiveChannelIndex] = useState(0)
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
	const lastPlaybackInfoRef = useRef(null) // Throttle updates to UI
	// NOTE: DO NOT use uiLoadTime - broadcast epoch is the single source of truth
	const shutdownSoundRef = useRef(null) // Shutdown sound
	const sessionSaveTimeoutRef = useRef(null) // Debounced session save
	const tapTriggerRef = useRef(null) // iOS gesture unlock handler from Player
	const powerCycleInProgress = useRef(false) // Track power cycle animation

	// Store tap handler from Player (passed through TVFrame)
	const handleTapHandlerReady = (handler) => {
		tapTriggerRef.current = handler
	}

	// Trigger tap for remote buttons and screen clicks
	const handleTapTrigger = () => {
		if (tapTriggerRef.current) {
			tapTriggerRef.current()
		}
	}

	// Power cycle animation for channel switch
	const performPowerCycle = useCallback((callback) => {
		if (powerCycleInProgress.current) return
		powerCycleInProgress.current = true

		// Step 1: Power OFF (300ms)
		setPower(false)
		setIsBuffering(true)
		setBufferErrorMessage('SWITCHING CHANNEL...')

		setTimeout(() => {
			// Step 2: Execute channel switch callback
			if (callback) callback()

			setTimeout(() => {
				// Step 3: Power ON (200ms after switch)
				setPower(true)
				setBufferErrorMessage('POWERING ON...')

				setTimeout(() => {
					// Step 4: Auto-tap to start playback (400ms after power on)
					setIsBuffering(false)
					setBufferErrorMessage('')
					
					if (tapTriggerRef.current) {
						tapTriggerRef.current()
					}
					powerCycleInProgress.current = false
				}, 400)
			}, 200)
		}, 300)
	}, [])


	// ===== SESSION MANAGEMENT =====
	
	// Save session state (debounced)
	const saveSessionState = useCallback(() => {
		if (sessionSaveTimeoutRef.current) {
			clearTimeout(sessionSaveTimeoutRef.current)
		}
		
		sessionSaveTimeoutRef.current = setTimeout(() => {
			const activeChannel = filteredChannels[activeChannelIndex]
			SessionManager.updateState({
				activeChannelId: activeChannel?._id,
				activeChannelIndex,
				volume,
				isPowerOn: power,
				selectedChannels,
			})
		}, 500) // 500ms debounce
	}, [filteredChannels, activeChannelIndex, volume, power, selectedChannels])

	// Save session on page unload
	useEffect(() => {
		const handleBeforeUnload = () => {
			SessionManager.forceSave()
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
	}, [power, volume, activeChannelIndex, selectedChannels, sessionRestored, saveSessionState])

	// Initialize shutdown sound
	useEffect(() => {
		shutdownSoundRef.current = new Audio('/sounds/tv-shutdown-386167.mp3')
		shutdownSoundRef.current.volume = 0.5
	}, [])

	// NOTE: Broadcast epoch (stored in channel) is the timing reference
	// Do NOT create any local timing references - they break on reload

	function filterChannelsBySelection(channelList, selectedChannelNames) {
		// If no channels selected, show all channels
		if (selectedChannelNames.length === 0) {
			setFilteredChannels(channelList)
			if (activeChannelIndex >= channelList.length) {
				setActiveChannelIndex(0)
			}
			return
		}

		// Filter channels: show only selected channels
		const filtered = channelList.filter(channel => {
			return selectedChannelNames.includes(channel.name)
		})

		setFilteredChannels(filtered)
		
		// Reset to first channel if current index is out of bounds
		if (activeChannelIndex >= filtered.length) {
			setActiveChannelIndex(0)
		}
	}

	// Load channels and restore session
	useEffect(() => {
		const initializeApp = async () => {
			try {
				// Initialize session manager (loads from localStorage)
				const sessionResult = await SessionManager.initialize()
				
				// Load channels from JSON only (no server dependency)
				const allChannels = await channelManager.loadChannels()
				setChannels(allChannels)
				
				if (allChannels.length === 0) {
					setStatusMessage('NO CHANNELS FOUND. PLEASE CHECK CHANNELS.JSON FILE.')
					setSessionRestored(true)
					return
				}
				
				// If session was restored, use saved state
				if (sessionResult.restored && sessionResult.state) {
					const savedState = sessionResult.state
					console.log('[Home] Restoring session from localStorage:', savedState)
					
					// Restore selected channels
					if (savedState.selectedChannels && savedState.selectedChannels.length > 0) {
						setSelectedChannels(savedState.selectedChannels)
						filterChannelsBySelection(allChannels, savedState.selectedChannels)
					} else {
						const allChannelNames = allChannels.map(ch => ch.name)
						setSelectedChannels(allChannelNames)
						filterChannelsBySelection(allChannels, allChannelNames)
					}
					
					// Restore volume
					if (typeof savedState.volume === 'number') {
						setVolume(savedState.volume)
						setPrevVolume(savedState.volume)
					}
					
					// Restore active channel index
					if (typeof savedState.activeChannelIndex === 'number' && savedState.activeChannelIndex < allChannels.length) {
						setActiveChannelIndex(savedState.activeChannelIndex)
					}
					
					// Restore power state (auto-start if was on)
					if (savedState.isPowerOn) {
						setPower(true)
						setStatusMessage('SESSION RESTORED. RESUMING PLAYBACK...')
					} else {
						setStatusMessage(`SESSION RESTORED. ${allChannels.length} CHANNELS READY.`)
					}
					
					setSessionRestored(true)
				} else {
					// Fresh start - auto-select all channels
					const allChannelNames = allChannels.map(ch => ch.name)
					setSelectedChannels(allChannelNames)
					filterChannelsBySelection(allChannels, allChannelNames)
					
					setStatusMessage(`LOADED ${allChannels.length} CHANNELS. READY TO PLAY.`)
					setSessionRestored(true)
				}
			} catch (err) {
				console.error('Error initializing app:', err)
				setStatusMessage('ERROR LOADING. PLEASE REFRESH.')
				
				// Try to load channels anyway
				try {
					const allChannels = await channelManager.loadChannels()
					setChannels(allChannels)
					
					if (allChannels.length > 0) {
						const allChannelNames = allChannels.map(ch => ch.name)
						setSelectedChannels(allChannelNames)
						filterChannelsBySelection(allChannels, allChannelNames)
						setStatusMessage(`LOADED ${allChannels.length} CHANNELS.`)
					} else {
						setStatusMessage('NO CHANNELS FOUND IN JSON FILE.')
					}
					
					setSessionRestored(true)
				} catch (loadErr) {
					console.error('Failed to load channels:', loadErr)
					setStatusMessage('ERROR LOADING CHANNELS FROM JSON FILE.')
				}
			}
		}

		initializeApp()
	}, [])

	// Filter channels when selection changes
	useEffect(() => {
		filterChannelsBySelection(channels, selectedChannels)
	}, [selectedChannels, channels])

	// Active channel - simply the filtered channel at current index
	const activeChannel = filteredChannels[activeChannelIndex] || null

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
			setStatusMessage(`TV ON. PLAYING ${activeChannel?.name || 'CHANNEL'}.`)
		} else {
			setStatusMessage('TV OFF. CLICK POWER TO START.')
			setIsBuffering(false)
			setBufferErrorMessage('')
			setMenuOpen(false) // Close menu when TV turns off
		}
	}

	function handleChannelUp() {
		if (!power || filteredChannels.length === 0 || powerCycleInProgress.current) return
		
		const nextIndex = (activeChannelIndex + 1) % filteredChannels.length
		performPowerCycle(() => {
			setActiveChannelIndex(nextIndex)
			switchChannel(nextIndex)
		})
	}

	function handleChannelDown() {
		if (!power || filteredChannels.length === 0 || powerCycleInProgress.current) return
		
		const newIndex = activeChannelIndex === 0 
			? filteredChannels.length - 1 
			: activeChannelIndex - 1
		performPowerCycle(() => {
			setActiveChannelIndex(newIndex)
			switchChannel(newIndex)
		})
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
		if (!power || filteredChannels.length === 0 || powerCycleInProgress.current) return
		if (index < 0 || index >= filteredChannels.length) {
			setStatusMessage(`CHANNEL ${index + 1} NOT AVAILABLE`)
			return
		}
		
		performPowerCycle(() => {
			setActiveChannelIndex(index)
			switchChannel(index)
		})
	}

	function handleMenuToggle() {
		setMenuOpen(prev => !prev)
	}

	function triggerStatic() {
		setStaticActive(true)
		setTimeout(() => setStaticActive(false), 300)
	}

	function triggerBuffering(errorMsg = '') {
		setIsBuffering(true)
		setBufferErrorMessage(errorMsg)
		setTimeout(() => {
			setIsBuffering(false)
			setBufferErrorMessage('')
		}, 2000)
	}

	function handleVideoEnd() {
		triggerStatic()
		// Videos now auto-advance in Player component
	}

	function handleChannelChange() {
		triggerStatic()
	}

	/**
	 * Channel switching with Retro-TV animation pipeline
	 */
	async function switchChannel(index) {
		if (index < 0 || index >= filteredChannels.length) return
		
		const channel = filteredChannels[index]
		if (!channel) return

		// Execute channel switch pipeline
		channelSwitchPipeline.on('onStaticStart', () => {
			setStaticActive(true)
		})
		
		channelSwitchPipeline.on('onStaticEnd', () => {
			setStaticActive(false)
		})
		
		channelSwitchPipeline.on('onBlackScreen', () => {
			setIsBuffering(true)
			setBufferErrorMessage(`SWITCHING TO ${channel.name}...`)
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
			setStatusMessage(`CHANNEL ${index + 1}: ${channel.name}`)
		})

		await channelSwitchPipeline.execute()
	}

	function handleToggleChannel(channelName) {
		setSelectedChannels(prev => 
			prev.includes(channelName)
				? prev.filter(c => c !== channelName)
				: [...prev, channelName]
		)
	}

	function handleSelectAll() {
		const allNames = channels.map(c => c.name)
		setSelectedChannels(allNames)
		setStatusMessage('ALL CHANNELS SELECTED.')
	}

	function handleSelectNone() {
		setSelectedChannels([])
		setStatusMessage('NO CHANNELS SELECTED.')
	}

		return (
		<div className="main-container">
			<div className="content-wrapper">
				{/* Left Side - TV Frame */}
		<TVFrame 
			power={power}
			activeChannel={activeChannel}
			activeChannelIndex={activeChannelIndex}
			channels={filteredChannels}
			onStaticTrigger={handleChannelChange}
			statusMessage={statusMessage}
			volume={volume}
			staticActive={staticActive}
			allChannels={channels}
			onVideoEnd={handleVideoEnd}
			isBuffering={isBuffering}
			bufferErrorMessage={bufferErrorMessage}
			playbackInfo={playbackInfo}
			onTapHandlerReady={handleTapHandlerReady}
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
				}}
				/>

				{/* Right Side - Remote Control and Categories */}
				<div className="right-panel">
					<TVRemote
						power={power}
						onPowerToggle={handlePowerToggle}
						onChannelUp={handleChannelUp}
						onChannelDown={handleChannelDown}
						onChannelDirect={handleChannelDirect}
						volume={volume}
						onVolumeUp={handleVolumeUp}
						onVolumeDown={handleVolumeDown}
						onMute={handleMute}
						onMenuToggle={handleMenuToggle}
						activeChannelIndex={activeChannelIndex}
						totalChannels={filteredChannels.length}
						menuOpen={menuOpen}
						onTapTrigger={handleTapTrigger}
					/>

					<CategoryList
						channels={channels}
						selectedChannels={selectedChannels}
						onToggleChannel={handleToggleChannel}
						onSelectAll={handleSelectAll}
						onSelectNone={handleSelectNone}
					/>
				</div>
			</div>

		{/* TV Menu Overlay */}
		<TVMenuV2
			isOpen={menuOpen}
			onClose={() => setMenuOpen(false)}
			channels={filteredChannels}
			activeChannelIndex={activeChannelIndex}
			onChannelSelect={handleChannelDirect}
			power={power}
			playbackInfo={playbackInfo}
		/>

		{/* CRT Info Overlay - Volume and Channel Display */}
		<CRTInfoOverlay 
			activeChannelIndex={activeChannelIndex}
			channels={filteredChannels}
			volume={crtVolume}
			isMuted={crtIsMuted}
		/>

		{/* Footer / Status Text */}
			<div className="footer-status">
				<div className="status-text">
					{statusMessage}
				</div>
			</div>

		</div>
	)
}
