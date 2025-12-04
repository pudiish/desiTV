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
	const uiLoadTimeRef = useRef(null) // Track when UI loads for pseudo-live timing
	const originalChannelRef = useRef(null) // Track original channel when playing ads
	const originalIndexRef = useRef(null) // Track original video index when playing ads
	const isPlayingAdRef = useRef(false) // Track if currently playing an ad
	const [shouldAdvanceVideo, setShouldAdvanceVideo] = useState(false) // Signal to advance video after ad
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
				timeline: {
					uiLoadTime: uiLoadTimeRef.current,
				},
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

	// Track UI load time for pseudo-live playback
	useEffect(() => {
		uiLoadTimeRef.current = Date.now()
	}, [])

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
					
					// Restore UI load time if available
					if (savedState.timeline?.uiLoadTime) {
						uiLoadTimeRef.current = savedState.timeline.uiLoadTime
					}
					
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

	// Find Ads channel
	const adsChannel = channels.find(ch => 
		ch.name && (ch.name.toLowerCase() === 'ads' || ch.name.toLowerCase() === 'ad' || ch.name.toLowerCase() === 'advertisements')
	)

	// State for ad channel and playing status
	const [adChannel, setAdChannel] = useState(null)
	const [isPlayingAd, setIsPlayingAd] = useState(false)

	// Get active channel - if playing ad, use ad channel, otherwise use filtered channel
	const activeChannel = isPlayingAd && adChannel ? adChannel : (filteredChannels[activeChannelIndex] || null)

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
		// Reset ad state when manually changing channels
		setIsPlayingAd(false)
		setAdChannel(null)
		originalChannelRef.current = null
		originalIndexRef.current = null
		
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
		// Reset ad state when manually changing channels
		setIsPlayingAd(false)
		setAdChannel(null)
		originalChannelRef.current = null
		originalIndexRef.current = null
		
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
		
		// Reset ad state
		setIsPlayingAd(false)
		setAdChannel(null)
		originalChannelRef.current = null
		originalIndexRef.current = null
		
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
		
		// If we just finished an ad, return to original channel and advance video
		if (isPlayingAd) {
			setIsPlayingAd(false)
			setAdChannel(null)
			
			if (originalChannelRef.current !== null) {
				// Find the original channel in filteredChannels
				const originalChannelName = originalChannelRef.current.name
				const channelIndex = filteredChannels.findIndex(ch => ch.name === originalChannelName)
				if (channelIndex >= 0) {
					setActiveChannelIndex(channelIndex)
					setStatusMessage(`RETURNING TO ${originalChannelName.toUpperCase()}`)
				}
				originalChannelRef.current = null
				originalIndexRef.current = null
			}
			
			// Signal to advance to next video after ad
			setShouldAdvanceVideo(true)
			setTimeout(() => setShouldAdvanceVideo(false), 100)
			return
		}

		// If we finished a regular video (not an ad), play an ad if available
		// Only play ads if we have an ads channel and it's not already the active channel
		if (adsChannel && adsChannel.items && adsChannel.items.length > 0) {
			const isCurrentAd = activeChannel && activeChannel.name && (
				activeChannel.name.toLowerCase() === 'ads' || 
				activeChannel.name.toLowerCase() === 'ad' || 
				activeChannel.name.toLowerCase() === 'advertisements'
			)
			
			if (!isCurrentAd) {
				// Store original channel info before switching to ad
				originalChannelRef.current = activeChannel
				originalIndexRef.current = activeChannelIndex
				isPlayingAdRef.current = true
				
				// Get random ad from the ads channel
				const adItems = adsChannel.items
				const randomAd = adItems[Math.floor(Math.random() * adItems.length)]
				
				// Create temporary ad channel with just one random ad
				const tempAdChannel = {
					...adsChannel,
					items: [randomAd],
					_id: `ad-${Date.now()}`,
					name: 'Ads'
				}
				
				setIsPlayingAd(true)
				setAdChannel(tempAdChannel)
				setStatusMessage('COMMERCIAL BREAK')
			}
		}
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
					shouldAdvanceVideo={shouldAdvanceVideo}
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
