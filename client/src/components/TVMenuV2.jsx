import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useBroadcastPosition } from '../hooks/useBroadcastPosition'

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
	currentYouTubeTime = 0
}) {
	const [selectedIndex, setSelectedIndex] = useState(activeChannelIndex)
	const [activeTab, setActiveTab] = useState('channels')
	const menuRef = useRef(null)
	const itemRefs = useRef([])

	// Get position for ACTIVE channel only (this is what's ACTUALLY playing)
	const activeChannel = channels[activeChannelIndex]
	const activeBroadcast = useBroadcastPosition(activeChannel)

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
								
								// Only show broadcast info for active channel
								const displayVideo = isActive ? activeBroadcast.video : null
								const displayNext = isActive ? activeBroadcast.nextVideo : null

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
												{displayVideo ? (
													<>
														<span className="now-label">NOW:</span>
														<span className="now-title">{displayVideo.title?.substring(0, 30)}...</span>
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

							{/* Now Playing - From Broadcast Position */}
							{activeBroadcast.video && (
								<div className="queue-item now-playing-item">
									<div className="queue-badge now">▶ NOW</div>
									<div className="queue-info">
										<div className="queue-title">{activeBroadcast.video.title}</div>
										<div className="queue-meta">
											<span className="duration">
												{formatTime(activeBroadcast.timeRemaining)} remaining
											</span>
											{activeBroadcast.video.year && (
												<span className="year">{activeBroadcast.video.year}</span>
											)}
											{activeBroadcast.video.category && (
												<span className="category">{activeBroadcast.video.category}</span>
											)}
										</div>
										<div className="progress-bar">
											<div 
												className="progress-fill"
												style={{ 
													width: `${(activeBroadcast.offset / (activeBroadcast.video.duration || 300)) * 100}%` 
												}}
											></div>
										</div>
									</div>
								</div>
							)}

							{/* Up Next */}
							{activeBroadcast.nextVideo && (
								<div className="queue-item next-item">
									<div className="queue-badge next">⏭ NEXT</div>
									<div className="queue-info">
										<div className="queue-title">{activeBroadcast.nextVideo.title}</div>
										<div className="queue-meta">
											<span className="duration">
												{formatTime(activeBroadcast.nextVideo.duration || 300)}
											</span>
											{activeBroadcast.nextVideo.year && (
												<span className="year">{activeBroadcast.nextVideo.year}</span>
											)}
										</div>
									</div>
								</div>
							)}

							{/* Upcoming (next 3 after next) */}
							<div className="queue-divider">UPCOMING</div>
							{Array.from({ length: 3 }).map((_, i) => {
								const idx = (activeBroadcast.nextVideoIndex + 1 + i) % activeChannel.items.length
								const video = activeChannel?.items[idx]
								return video ? (
									<div key={`upcoming-${i}`} className="queue-item upcoming-item">
										<div className="queue-badge upcoming">#{i + 3}</div>
										<div className="queue-info">
											<div className="queue-title">{video.title}</div>
											<div className="queue-meta">
												<span className="duration">{formatTime(video.duration || 30)}</span>
											</div>
										</div>
									</div>
								) : null
							})}
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
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
