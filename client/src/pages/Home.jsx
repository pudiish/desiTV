import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import TVFrame from '../components/TVFrame'
import ControlPanel from '../components/ControlPanel'
import CategoryList from '../components/CategoryList'
import StaticEffect from '../components/StaticEffect'

export default function Home() {
	const [channels, setChannels] = useState([])
	const [selectedChannels, setSelectedChannels] = useState([])
	const [filteredChannels, setFilteredChannels] = useState([])
	const [activeChannelIndex, setActiveChannelIndex] = useState(0)
	const [power, setPower] = useState(false)
	const [volume, setVolume] = useState(0.5)
	const [staticActive, setStaticActive] = useState(false)
	const [statusMessage, setStatusMessage] = useState('WELCOME BACK! CLICK ON POWER BUTTON TO BEGIN JOURNEY.')
	const uiLoadTimeRef = useRef(null) // Track when UI loads for pseudo-live timing

	const API = import.meta.env.VITE_API_BASE || 'http://localhost:5002'

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

	const activeChannel = filteredChannels[activeChannelIndex] || null

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
		setActiveChannelIndex(prevIndex => {
			const nextIndex = (prevIndex + 1) % filteredChannels.length
			triggerStatic()
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
		// Video ended, will auto-play next in playlist via Player component
		triggerStatic()
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

		</div>
	)
}
