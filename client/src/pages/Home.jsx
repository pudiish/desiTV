import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import TVFrame from '../components/TVFrame'
import ControlPanel from '../components/ControlPanel'
import CategoryList from '../components/CategoryList'
import StaticEffect from '../components/StaticEffect'
import bufferCache from '../utils/bufferCache'

export default function Home() {
	const [channels, setChannels] = useState([])
	const [selectedChannels, setSelectedChannels] = useState([])
	const [filteredChannels, setFilteredChannels] = useState([])
	const [activeChannelIndex, setActiveChannelIndex] = useState(0)
	const [power, setPower] = useState(false)
	const [volume, setVolume] = useState(0.5)
	const [staticActive, setStaticActive] = useState(false)
	const [statusMessage, setStatusMessage] = useState('WELCOME BACK! CLICK ON POWER BUTTON TO BEGIN JOURNEY.')
	const [debugMode, setDebugMode] = useState(false) // Debug mode for cache stats
	const [cacheStats, setCacheStats] = useState(null) // Cache statistics
	const uiLoadTimeRef = useRef(null) // Track when UI loads for pseudo-live timing
	const originalChannelRef = useRef(null) // Track original channel when playing ads
	const originalIndexRef = useRef(null) // Track original video index when playing ads
	const isPlayingAdRef = useRef(false) // Track if currently playing an ad
	const [shouldAdvanceVideo, setShouldAdvanceVideo] = useState(false) // Signal to advance video after ad

	const API = import.meta.env.VITE_API_BASE || 'http://localhost:5002'

	// Track UI load time for pseudo-live playback
	useEffect(() => {
		uiLoadTimeRef.current = Date.now()
	}, [])

	// Update cache stats periodically for debug mode
	useEffect(() => {
		const interval = setInterval(() => {
			if (debugMode) {
				setCacheStats(bufferCache.getStats())
			}
		}, 1000)
		return () => clearInterval(interval)
	}, [debugMode])

	// Toggle debug mode with keyboard shortcut (Ctrl+Shift+D)
	useEffect(() => {
		const handleKeyPress = (e) => {
			if (e.ctrlKey && e.shiftKey && e.key === 'D') {
				setDebugMode(prev => {
					const newMode = !prev
					console.log(`[Debug Mode] ${newMode ? 'ENABLED' : 'DISABLED'}`)
					if (newMode) {
						bufferCache.printStats()
					}
					return newMode
				})
			}
		}
		window.addEventListener('keydown', handleKeyPress)
		return () => window.removeEventListener('keydown', handleKeyPress)
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

	// Load channels
	useEffect(() => {
		axios.get(`${API}/api/channels`)
			.then(channelsRes => {
				const allChannels = channelsRes.data || []
				setChannels(allChannels)
				
				// Auto-select all channels initially
				const allChannelNames = allChannels.map(ch => ch.name)
				setSelectedChannels(allChannelNames)
				filterChannelsBySelection(allChannels, allChannelNames)
				
				if (allChannels.length > 0) {
					setStatusMessage(`LOADED ${allChannels.length} CHANNELS. READY TO PLAY.`)
				}
			})
			.catch(err => {
				console.error('Error loading data:', err)
				setStatusMessage('ERROR LOADING CHANNELS. CHECK SERVER CONNECTION.')
			})
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
		setPower(newPower)
		setStatusMessage(newPower 
			? `TV ON. PLAYING ${activeChannel?.name || 'CHANNEL'}.`
			: 'TV OFF. CLICK POWER TO START.'
		)
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
			setStatusMessage(`CHANNEL ${newIndex + 1}: ${filteredChannels[newIndex]?.name || 'UNKNOWN'}`)
			return newIndex
		})
	}

	function handleVolumeUp() {
		setVolume(prev => Math.min(1, prev + 0.1))
		setStatusMessage(`VOLUME: ${Math.round((volume + 0.1) * 100)}%`)
	}

	function handleVolumeDown() {
		setVolume(prev => Math.max(0, prev - 0.1))
		setStatusMessage(`VOLUME: ${Math.round((volume - 0.1) * 100)}%`)
	}

	function triggerStatic() {
		setStaticActive(true)
		setTimeout(() => setStaticActive(false), 300)
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
				/>

				{/* Right Side - Controls and Categories */}
				<div className="right-panel">
					<ControlPanel
						power={power}
						onPowerToggle={handlePowerToggle}
						onChannelUp={handleChannelUp}
						onChannelDown={handleChannelDown}
						volume={volume}
						onVolumeUp={handleVolumeUp}
						onVolumeDown={handleVolumeDown}
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

			{/* Footer / Status Text */}
			<div className="footer-status">
				<div className="status-text">
					{statusMessage}
				</div>
			</div>

			{/* Debug Cache Stats Panel */}
			{debugMode && cacheStats && (
				<div style={{
					position: 'fixed',
					bottom: '20px',
					right: '20px',
					background: 'rgba(0, 0, 0, 0.9)',
					border: '2px solid #00d4ff',
					borderRadius: '8px',
					padding: '15px',
					color: '#00f5a0',
					fontSize: '12px',
					fontFamily: 'monospace',
					maxWidth: '300px',
					zIndex: 999,
					boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)'
				}}>
					<div style={{fontWeight: 'bold', marginBottom: '10px', color: '#00d4ff'}}>📊 BUFFER CACHE STATS</div>
					<div>Cache Size: {cacheStats.size}/{cacheStats.maxSize}</div>
					<div>Hits: {cacheStats.hits}</div>
					<div>Misses: {cacheStats.misses}</div>
					<div>Hit Rate: {cacheStats.hitRate}</div>
					<div>Evictions: {cacheStats.evictions}</div>
					<div>Est. Memory: {cacheStats.memoryEstimate}</div>
					<div style={{marginTop: '10px', color: '#ffaa00', fontSize: '10px'}}>
						Press Ctrl+Shift+D to toggle debug mode
					</div>
				</div>
			)}

		</div>
	)
}
