import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useBroadcastPosition } from '../hooks/useBroadcastPosition'
import LocalBroadcastStateManager from '../utils/LocalBroadcastStateManager'

/**
 * TVMenuV2 - Unified with BroadcastPosition
 * 
 * No longer calculates anything. All info comes from:
 * - broadcastPosition hook (contains current video, offset, timeRemaining)
 * - channels prop (for channel list and next videos)
 * - YouTube player state (only for error recovery)
 */
export default function TVMenuV2({
	isOpen,
	onClose,
	channels,
	activeChannelIndex,
	onChannelSelect,
	power,
	playbackInfo = null
}) {
	const [selectedIndex, setSelectedIndex] = useState(activeChannelIndex)
	const [activeTab, setActiveTab] = useState('channels')
	const menuRef = useRef(null)
	const itemRefs = useRef([])

	// Get position for ACTIVE channel (for detailed info)
	const activeChannel = channels[activeChannelIndex]
	const activeChannelItems = activeChannel?.items || []
	const hasActivePlaylist = activeChannelItems.length > 0
	const activeBroadcast = useBroadcastPosition(activeChannel)

	// Calculate positions for ALL channels using global timeline
	// Use useMemo to avoid recalculating on every render
	// Add timestamp to force refresh every second to keep positions updated
	const [refreshTimestamp, setRefreshTimestamp] = useState(Date.now())
	
	useEffect(() => {
		if (!isOpen) return
		
		// Update positions every second when menu is open
		const interval = setInterval(() => {
			setRefreshTimestamp(Date.now())
		}, 1000)
		
		return () => clearInterval(interval)
	}, [isOpen])

	const channelPositions = useMemo(() => {
		return channels.map(channel => {
			if (!channel || !channel.items || channel.items.length === 0) {
				return { channel, position: null }
			}
			try {
				const position = LocalBroadcastStateManager.calculateCurrentPosition(channel)
				return { channel, position }
			} catch (err) {
				console.error(`[TVMenuV2] Error calculating position for ${channel._id}:`, err)
				return { channel, position: null }
			}
		})
	}, [channels, refreshTimestamp])

	// Reset selected index when menu opens
	useEffect(() => {
		if (isOpen) {
			setSelectedIndex(activeChannelIndex)
		}
	}, [isOpen, activeChannelIndex])

	// Auto-scroll to selected item
	useEffect(() => {
		if (itemRefs.current[selectedIndex]) {
			itemRefs.current[selectedIndex].scrollIntoView({
				behavior: 'smooth',
				block: 'nearest'
			})
		}
	}, [selectedIndex])

	// Keyboard navigation
	useEffect(() => {
		if (!isOpen) return

		const handleKeyDown = (e) => {
			switch (e.key) {
				case 'ArrowUp':
					e.preventDefault()
					setSelectedIndex(prev => Math.max(0, prev - 1))
					break
				case 'ArrowDown':
					e.preventDefault()
					setSelectedIndex(prev => Math.min(channels.length - 1, prev + 1))
					break
				case 'ArrowLeft':
					e.preventDefault()
					setActiveTab(prev => {
						const tabs = ['channels', 'queue', 'settings']
						const idx = tabs.indexOf(prev)
						return tabs[Math.max(0, idx - 1)]
					})
					break
				case 'ArrowRight':
					e.preventDefault()
					setActiveTab(prev => {
						const tabs = ['channels', 'queue', 'settings']
						const idx = tabs.indexOf(prev)
						return tabs[Math.min(tabs.length - 1, idx + 1)]
					})
					break
				case 'Enter':
					e.preventDefault()
					if (activeTab === 'channels' && channels[selectedIndex]) {
						onChannelSelect(selectedIndex)
						onClose()
					}
					break
				case 'Escape':
					e.preventDefault()
					onClose()
					break
				default:
					break
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [isOpen, selectedIndex, channels, activeTab, onChannelSelect, onClose])

	const formatTime = (seconds) => {
		const mins = Math.floor(seconds / 60)
		const secs = Math.floor(seconds % 60)
		return `${mins}:${String(secs).padStart(2, '0')}`
	}

	// Always prefer live playback info when available and matching active channel
	const playbackMatchesActive = playbackInfo?.channelId && playbackInfo.channelId === activeChannel?._id
	
	// Use live YouTube metadata when available
	const nowTitle = playbackMatchesActive && playbackInfo?.videoTitle 
		? playbackInfo.videoTitle 
		: activeBroadcast.video?.title || 'Unknown'
	
	const nowVideoId = playbackMatchesActive && playbackInfo?.videoId
		? playbackInfo.videoId
		: activeBroadcast.video?.youtubeId
	
	const nowDuration = playbackMatchesActive && playbackInfo?.duration 
		? playbackInfo.duration 
		: activeBroadcast.video?.duration || 0
	
	const nowOffset = playbackMatchesActive && typeof playbackInfo?.currentTime === 'number'
		? playbackInfo.currentTime
		: activeBroadcast.offset
	
	const nowTimeRemaining = nowDuration ? Math.max(0, nowDuration - nowOffset) : activeBroadcast.timeRemaining
	
	const currentVideoIndex = playbackMatchesActive && typeof playbackInfo?.videoIndex === 'number'
		? playbackInfo.videoIndex
		: activeBroadcast.videoIndex
	
	const computedNextIndex = hasActivePlaylist && currentVideoIndex >= 0
		? (currentVideoIndex + 1) % activeChannelItems.length
		: activeBroadcast.nextVideoIndex
	
	const computedNextVideo = hasActivePlaylist ? activeChannelItems[computedNextIndex] : null

	if (!isOpen || !power) return null

	return (
		<div className="tv-menu-overlay" onClick={onClose}>
			<div className="tv-menu" ref={menuRef} onClick={e => e.stopPropagation()}>
				{/* Menu Header */}
				<div className="tv-menu-header">
					<div className="menu-logo">
						<span className="logo-text">DesiTV™</span>
						<span className="logo-guide">GUIDE</span>
					</div>
					<div className="menu-time">
						{new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
					</div>
					<button className="menu-close-btn" onClick={onClose}>✕</button>
				</div>

				{/* Tab Navigation */}
				<div className="menu-tabs">
					<button 
						className={`tab-btn ${activeTab === 'channels' ? 'active' : ''}`}
						onClick={() => setActiveTab('channels')}
					>
						📺 CHANNELS
					</button>
					<button 
						className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
						onClick={() => setActiveTab('queue')}
					>
						📋 UP NEXT
					</button>
					<button 
						className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
						onClick={() => setActiveTab('settings')}
					>
						⚙️ SETTINGS
					</button>
				</div>

				{/* Menu Content */}
				<div className="menu-content">
					{/* Channels Tab */}
					{activeTab === 'channels' && (
						<div className="channels-grid">
							{channels.map((channel, idx) => {
							const isActive = idx === activeChannelIndex
							const isSelected = idx === selectedIndex
							
							// Get broadcast position for this channel
							const channelPos = channelPositions[idx]?.position
							const channelItems = channel.items || []
							
							// For active channel, use live playback info if available
							// For other channels, use calculated position from global timeline
							let displayTitle = null
							let displayNext = null
							
							if (isActive) {
								// Active channel: prefer live playback info
								displayTitle = nowTitle
								displayNext = computedNextVideo
							} else if (channelPos && channelItems.length > 0) {
								// Other channels: use calculated position from global timeline
								const videoIndex = channelPos.videoIndex
								const nextIndex = (videoIndex + 1) % channelItems.length
								displayTitle = channelItems[videoIndex]?.title || null
								displayNext = channelItems[nextIndex] || null
							}

							return (
									<div
										key={channel._id}
										ref={el => itemRefs.current[idx] = el}
										className={`channel-card ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
										onClick={() => {
											onChannelSelect(idx)
											onClose()
										}}
										onMouseEnter={() => setSelectedIndex(idx)}
									>
										<div className="channel-num">{String(idx + 1).padStart(2, '0')}</div>
										<div className="channel-info">
											<div className="channel-name">{channel.name}</div>
											<div className="now-playing">
												{displayTitle ? (
													<>
														<span className="now-label">NOW:</span>
														<span className="now-title">{displayTitle.substring(0, 30)}...</span>
													</>
												) : (
													<span className="no-content">No content</span>
												)}
											</div>
											<div className="next-up">
												{displayNext && (
													<>
														<span className="next-label">NEXT:</span>
														<span className="next-title">{displayNext.title?.substring(0, 25)}...</span>
													</>
												)}
											</div>
										</div>
										<div className="channel-meta">
											<span className="video-count">{channel.items?.length || 0} videos</span>
											{isActive && <span className="live-badge">● LIVE</span>}
										</div>
									</div>
								)
							})}
						</div>
					)}

					{/* Queue Tab - Shows what's actually playing on current channel */}
					{activeTab === 'queue' && (
						<div className="queue-view">
							<div className="queue-header">
								<h3>📺 {activeChannel?.name || 'No Channel'}</h3>
								<span className="queue-subtitle">What's Playing</span>
							</div>

							{!hasActivePlaylist && (
								<div className="queue-empty">No playlist available for this channel.</div>
							)}

					{/* Now Playing - Always use live data */}
					{hasActivePlaylist && nowTitle && (
							<div className="queue-item now-playing-item">
								<div className="queue-badge now">▶ NOW</div>
								<div className="queue-info">
									<div className="queue-title">{nowTitle}</div>
								</div>
							</div>
						)}					{/* Up Next */}
				{hasActivePlaylist && computedNextVideo && (
						<div className="queue-item next-item">
							<div className="queue-badge next">⏭ NEXT</div>
						<div className="queue-info">
							<div className="queue-title">{computedNextVideo.title}</div>
							</div>
							</div>
						)}							{/* Upcoming (next 3 after next) */}
							{hasActivePlaylist && (
								<>
									<div className="queue-divider">UPCOMING</div>
									{Array.from({ length: 3 }).map((_, i) => {
										const itemsLength = activeChannelItems.length
										if (itemsLength === 0) return null
										const idx = (computedNextIndex + 1 + i) % itemsLength
										const video = activeChannelItems[idx]
										return video ? (
											<div key={`upcoming-${i}`} className="queue-item upcoming-item">
												<div className="queue-badge upcoming">#{i + 3}</div>
												<div className="queue-info">
													<div className="queue-title">{video.title}</div>
												</div>
											</div>
										) : null
									})}
								</>
							)}
						</div>
					)}

					{/* Settings Tab */}
					{activeTab === 'settings' && (
						<div className="settings-view">
							<div className="settings-item">
								<span>📡 Broadcast Info</span>
							<div className="settings-value">
								Total Channels: {channels.length}
								<br />
								Playlist Duration: {formatTime(activeBroadcast.totalPlaylistDuration)}
								<br />
								Current Position: {formatTime(activeBroadcast.cyclePosition)}
								<br />
								{playbackMatchesActive && (
									<>
										<br />
										<span style={{color: '#4a9eff'}}>● LIVE SYNC ACTIVE</span>
										<br />
										Video ID: {nowVideoId?.substring(0, 11)}
									</>
								)}
							</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
