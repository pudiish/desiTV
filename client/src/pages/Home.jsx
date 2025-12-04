import React, { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import TVFrame from '../components/TVFrame'
import TVRemote from '../components/TVRemote'
import TVMenu from '../components/TVMenu'
import CategoryList from '../components/CategoryList'
import StaticEffect from '../components/StaticEffect'
import SessionManager from '../utils/SessionManager'

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
	// NOTE: DO NOT use uiLoadTime - broadcast epoch is the single source of truth
	const shutdownSoundRef = useRef(null) // Shutdown sound
	const sessionSaveTimeoutRef = useRef(null) // Debounced session save

	const API = import.meta.env.VITE_API_BASE || 'http://localhost:5002'

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
				// Initialize session manager first
				const sessionResult = await SessionManager.initialize()
				
				// Load channels from API
				const channelsRes = await axios.get(`${API}/api/channels`)
				const allChannels = channelsRes.data || []
				setChannels(allChannels)
				
				// If session was restored, use saved state
				if (sessionResult.restored && sessionResult.state) {
					const savedState = sessionResult.state
					console.log('[Home] Restoring session:', savedState)
					
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
					if (typeof savedState.activeChannelIndex === 'number') {
						setActiveChannelIndex(savedState.activeChannelIndex)
					}
					
					// Restore power state (auto-start if was on)
					if (savedState.isPowerOn) {
						setPower(true)
						setStatusMessage('SESSION RESTORED. RESUMING PLAYBACK...')
					} else {
						setStatusMessage(`SESSION RESTORED. ${allChannels.length} CHANNELS READY.`)
					}
					
					// NOTE: UI load time should NOT be persisted or restored
					// Broadcast epoch is stored in the channel and is the source of truth
					
					setSessionRestored(true)
				} else {
					// Fresh start - auto-select all channels
					const allChannelNames = allChannels.map(ch => ch.name)
					setSelectedChannels(allChannelNames)
					filterChannelsBySelection(allChannels, allChannelNames)
					
					if (allChannels.length > 0) {
						setStatusMessage(`LOADED ${allChannels.length} CHANNELS. READY TO PLAY.`)
					}
					
					setSessionRestored(true)
				}
			} catch (err) {
				console.error('Error initializing app:', err)
				setStatusMessage('ERROR LOADING. PLEASE REFRESH.')
				
				// Try to load channels anyway
				try {
					const channelsRes = await axios.get(`${API}/api/channels`)
					const allChannels = channelsRes.data || []
					setChannels(allChannels)
					
					const allChannelNames = allChannels.map(ch => ch.name)
					setSelectedChannels(allChannelNames)
					filterChannelsBySelection(allChannels, allChannelNames)
					
					setSessionRestored(true)
				} catch (loadErr) {
					console.error('Failed to load channels:', loadErr)
					setStatusMessage('ERROR LOADING CHANNELS. CHECK SERVER CONNECTION.')
				}
			}
		}

		initializeApp()
	}, [API])

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
		if (!power || filteredChannels.length === 0) return
		
		setActiveChannelIndex(prevIndex => {
			const nextIndex = (prevIndex + 1) % filteredChannels.length
			triggerStatic()
			triggerBuffering(`SWITCHING TO ${filteredChannels[nextIndex]?.name || 'UNKNOWN'}...`)
			setStatusMessage(`CHANNEL ${nextIndex + 1}: ${filteredChannels[nextIndex]?.name || 'UNKNOWN'}`)
			return nextIndex
		})
	}

	function handleChannelDown() {
		if (!power || filteredChannels.length === 0) return
		
		setActiveChannelIndex(prevIndex => {
			const newIndex = prevIndex === 0 
				? filteredChannels.length - 1 
				: prevIndex - 1
			triggerStatic()
			triggerBuffering(`SWITCHING TO ${filteredChannels[newIndex]?.name || 'UNKNOWN'}...`)
			setStatusMessage(`CHANNEL ${newIndex + 1}: ${filteredChannels[newIndex]?.name || 'UNKNOWN'}`)
			return newIndex
		})
	}

	function handleVolumeUp() {
		setVolume(prev => {
			const newVol = Math.min(1, prev + 0.1)
			setStatusMessage(`VOLUME: ${Math.round(newVol * 100)}%`)
			return newVol
		})
	}

	function handleVolumeDown() {
		setVolume(prev => {
			const newVol = Math.max(0, prev - 0.1)
			setStatusMessage(`VOLUME: ${Math.round(newVol * 100)}%`)
			return newVol
		})
	}

	function handleMute() {
		if (volume > 0) {
			setPrevVolume(volume)
			setVolume(0)
			setStatusMessage('MUTED')
		} else {
			setVolume(prevVolume || 0.5)
			setStatusMessage(`VOLUME: ${Math.round((prevVolume || 0.5) * 100)}%`)
		}
	}

	function handleChannelDirect(index) {
		if (!power || filteredChannels.length === 0) return
		if (index < 0 || index >= filteredChannels.length) {
			setStatusMessage(`CHANNEL ${index + 1} NOT AVAILABLE`)
			return
		}
		
		triggerStatic()
		triggerBuffering(`SWITCHING TO ${filteredChannels[index]?.name || 'UNKNOWN'}...`)
		setActiveChannelIndex(index)
		setStatusMessage(`CHANNEL ${index + 1}: ${filteredChannels[index]?.name || 'UNKNOWN'}`)
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
					onStaticTrigger={handleChannelChange}
					statusMessage={statusMessage}
				volume={volume}
				staticActive={staticActive}
				uiLoadTime={uiLoadTimeRef.current}
				allChannels={channels}
				onVideoEnd={handleVideoEnd}
				isBuffering={isBuffering}
				bufferErrorMessage={bufferErrorMessage}
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
		<TVMenu
			isOpen={menuOpen}
			onClose={() => setMenuOpen(false)}
			channels={filteredChannels}
			activeChannelIndex={activeChannelIndex}
			onChannelSelect={handleChannelDirect}
			power={power}
		/>			{/* Footer / Status Text */}
			<div className="footer-status">
				<div className="status-text">
					{statusMessage}
				</div>
			</div>

		</div>
	)
}
