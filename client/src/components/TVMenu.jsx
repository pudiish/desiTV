import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getPseudoLiveItem } from '../utils/pseudoLive'

/**
 * TVMenu - Retro TV on-screen menu with channel guide and what's next
 * Keyboard navigable, shows queue preview
 */
export default function TVMenu({
	isOpen,
	onClose,
	channels,
	activeChannelIndex,
	onChannelSelect,
	currentVideoIndex,
	power
}) {
	const [selectedIndex, setSelectedIndex] = useState(activeChannelIndex)
	const [activeTab, setActiveTab] = useState('channels') // 'channels', 'queue', 'settings'
	const menuRef = useRef(null)
	const itemRefs = useRef([])

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

	// Get what's playing now and next for a channel
	const getChannelSchedule = useCallback((channel) => {
		if (!channel || !channel.items || channel.items.length === 0) {
			return { now: null, next: null, upcoming: [] }
		}

		const live = getPseudoLiveItem(channel.items, channel.playlistStartEpoch)
		const currentIdx = live?.videoIndex ?? 0
		const now = channel.items[currentIdx]
		const next = channel.items[(currentIdx + 1) % channel.items.length]
		const upcoming = []

		for (let i = 2; i <= 4; i++) {
			const idx = (currentIdx + i) % channel.items.length
			upcoming.push(channel.items[idx])
		}

		return {
			now,
			next,
			upcoming,
			offset: live?.offset || 0,
			duration: now?.duration || 300
		}
	}, [])

	// Get active channel's queue
	const activeChannel = channels[activeChannelIndex]
	const activeSchedule = activeChannel ? getChannelSchedule(activeChannel) : { now: null, next: null, upcoming: [] }

	if (!isOpen || !power) return null

	return (
		<div className="tv-menu-overlay" onClick={onClose}>
			<div className="tv-menu" ref={menuRef} onClick={e => e.stopPropagation()}>
				{/* Menu Header */}
				<div className="tv-menu-header">
					<div className="menu-logo">
						<span className="logo-text">desiTV</span>
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
								const schedule = getChannelSchedule(channel)
								const isActive = idx === activeChannelIndex
								const isSelected = idx === selectedIndex

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
												{schedule.now ? (
													<>
														<span className="now-label">NOW:</span>
														<span className="now-title">{schedule.now.title?.substring(0, 30)}...</span>
													</>
												) : (
													<span className="no-content">No content</span>
												)}
											</div>
											<div className="next-up">
												{schedule.next && (
													<>
														<span className="next-label">NEXT:</span>
														<span className="next-title">{schedule.next.title?.substring(0, 25)}...</span>
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

					{/* Queue Tab */}
					{activeTab === 'queue' && (
						<div className="queue-view">
							<div className="queue-header">
								<h3>📺 {activeChannel?.name || 'No Channel'}</h3>
								<span className="queue-subtitle">What's Playing</span>
							</div>

							{/* Now Playing */}
							{activeSchedule.now && (
								<div className="queue-item now-playing-item">
									<div className="queue-badge now">▶ NOW</div>
									<div className="queue-info">
										<div className="queue-title">{activeSchedule.now.title}</div>
										<div className="queue-meta">
											<span className="duration">
												{Math.floor((activeSchedule.duration - activeSchedule.offset) / 60)}:{String(Math.floor((activeSchedule.duration - activeSchedule.offset) % 60)).padStart(2, '0')} remaining
											</span>
											{activeSchedule.now.year && <span className="year">{activeSchedule.now.year}</span>}
										</div>
										<div className="progress-bar">
											<div 
												className="progress-fill"
												style={{ width: `${(activeSchedule.offset / activeSchedule.duration) * 100}%` }}
											></div>
										</div>
									</div>
								</div>
							)}

							{/* Up Next */}
							{activeSchedule.next && (
								<div className="queue-item next-item">
									<div className="queue-badge next">⏭ NEXT</div>
									<div className="queue-info">
										<div className="queue-title">{activeSchedule.next.title}</div>
										<div className="queue-meta">
											<span className="duration">{Math.floor((activeSchedule.next.duration || 300) / 60)} min</span>
											{activeSchedule.next.year && <span className="year">{activeSchedule.next.year}</span>}
										</div>
									</div>
								</div>
							)}

							{/* Upcoming */}
							<div className="upcoming-section">
								<h4>COMING UP</h4>
								{activeSchedule.upcoming.map((video, idx) => (
									<div key={idx} className="queue-item upcoming-item">
										<div className="queue-position">{idx + 3}</div>
										<div className="queue-info">
											<div className="queue-title">{video?.title || 'Unknown'}</div>
											<div className="queue-meta">
												<span className="duration">{Math.floor((video?.duration || 300) / 60)} min</span>
											</div>
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Settings Tab */}
					{activeTab === 'settings' && (
						<div className="settings-view">
							<div className="settings-section">
								<h4>⌨️ KEYBOARD SHORTCUTS</h4>
								<div className="shortcuts-grid">
									<div className="shortcut">
										<kbd>↑</kbd><kbd>↓</kbd>
										<span>Channel Up/Down</span>
									</div>
									<div className="shortcut">
										<kbd>←</kbd><kbd>→</kbd>
										<span>Volume Down/Up</span>
									</div>
									<div className="shortcut">
										<kbd>0-9</kbd>
										<span>Direct Channel</span>
									</div>
									<div className="shortcut">
										<kbd>M</kbd>
										<span>Mute</span>
									</div>
									<div className="shortcut">
										<kbd>Space</kbd>
										<span>Power</span>
									</div>
									<div className="shortcut">
										<kbd>Esc</kbd>
										<span>Open/Close Menu</span>
									</div>
								</div>
							</div>

							<div className="settings-section">
								<h4>📺 ABOUT</h4>
								<p>desiTV - Retro Television Experience</p>
								<p className="version">Version 1.0.0</p>
							</div>
						</div>
					)}
				</div>

				{/* Menu Footer */}
				<div className="menu-footer">
					<div className="hint-text">
						<span>↑↓ Navigate</span>
						<span>←→ Tabs</span>
						<span>Enter Select</span>
						<span>Esc Close</span>
					</div>
				</div>
			</div>
		</div>
	)
}
