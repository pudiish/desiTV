import React, { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import HybridStateManager from '../../services/HybridStateManager'
import '../AdminDashboard.css'

// Error Boundary for ChannelManager
class ChannelManagerErrorBoundary extends React.Component {
	constructor(props) {
		super(props)
		this.state = { hasError: false }
	}

	static getDerivedStateFromError(error) {
		return { hasError: true }
	}

	componentDidCatch(error, errorInfo) {
		console.error('[ChannelManager] Error boundary caught:', error, errorInfo)
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="section">
					<div className="section-title">📺 Manage Channels</div>
					<div className="alert alert-error" style={{ marginTop: '16px' }}>
						❌ An error occurred loading channels. Please refresh the page.
					</div>
					<button 
						onClick={() => window.location.reload()} 
						className="btn btn-secondary"
					>
						🔄 Reload Page
					</button>
				</div>
			)
		}

		return this.props.children
	}
}

function ChannelManagerContent() {
	const { getAuthHeaders, isAuthenticated } = useAuth()
	const [channels, setChannels] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [selectedChannel, setSelectedChannel] = useState(null)
	const [deletingVideo, setDeletingVideo] = useState(null)
	const [showAddChannel, setShowAddChannel] = useState(false)
	const [newChannelName, setNewChannelName] = useState('')
	const [addingChannel, setAddingChannel] = useState(false)

	const fetchChannels = async () => {
		setLoading(true)
		try {
			// Use hybrid state manager for local caching + backend sync
			// Reduces API calls by serving from cache when available (5 min TTL)
			const data = await HybridStateManager.get('channels', async () => {
				const response = await fetch('/api/channels')
				if (!response.ok) throw new Error('Failed to fetch channels')
				return response.json()
			})
			setChannels(data)
			setError(null)
		} catch (err) {
			console.error('[ChannelManager] Fetch channels error:', err)
			setError(err.message)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		// Initial fetch - uses local cache if available (reduces API call)
		fetchChannels()
		
		// Subscribe to cache updates from other components
		const unsubscribe = HybridStateManager.subscribe('channels', setChannels)
		
		return () => unsubscribe()
	}, [])

	const deleteChannel = async (id) => {
		if (!window.confirm('Delete this channel?')) return
		
		if (!isAuthenticated) {
			setError('Authentication required')
			return
		}

		try {
			const response = await fetch(`/api/channels/${id}`, { 
				method: 'DELETE',
				headers: {
					...getAuthHeaders(),
					'Content-Type': 'application/json'
				}
			})
			if (!response.ok) {
				const data = await response.json()
				throw new Error(data.message || 'Failed to delete channel')
			}
			setChannels((prev) => prev.filter((c) => c._id !== id))
			setSelectedChannel(null)
			setError(null)
		} catch (err) {
			console.error('[ChannelManager] Delete channel error:', err)
			setError(err.message)
		}
	}

	const deleteVideo = async (channelId, videoId) => {
		if (!window.confirm('Delete this video?')) return
		
		if (!isAuthenticated) {
			setError('Authentication required')
			return
		}

		setDeletingVideo(videoId)
		try {
			const response = await fetch(`/api/channels/${channelId}/videos/${videoId}`, { 
				method: 'DELETE',
				headers: {
					...getAuthHeaders(),
					'Content-Type': 'application/json'
				}
			})
			if (!response.ok) {
				const data = await response.json()
				throw new Error(data.message || 'Failed to delete video')
			}
			// Update selected channel
			setSelectedChannel(prev => ({
				...prev,
				items: prev.items.filter(v => v._id !== videoId && v.youtubeId !== videoId)
			}))
			// Refresh channels list
			fetchChannels()
			// Clear error on success
			setError(null)
		} catch (err) {
			// Log error but don't crash - admin errors should be isolated
			console.error('[ChannelManager] Delete video error:', err)
			setError(err.message)
		} finally {
			setDeletingVideo(null)
		}
	}

	const getYoutubeThumbnail = (youtubeId) => {
		return `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg`
	}

	const handleAddChannel = async (e) => {
		e.preventDefault()
		if (!newChannelName.trim()) {
			setError('Channel name is required')
			return
		}

		setAddingChannel(true)
		try {
			const response = await fetch('/api/channels', {
				method: 'POST',
				headers: {
					...getAuthHeaders(),
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ name: newChannelName.trim() })
			})

			const data = await response.json()
			if (response.ok) {
				setChannels([...channels, data])
				setNewChannelName('')
				setShowAddChannel(false)
				setError(null)
			} else {
				setError(data.message || 'Failed to create channel')
			}
		} catch (err) {
			setError(err.message)
		} finally {
			setAddingChannel(false)
		}
	}

	return (
		<div className="section">
			<div className="section-title">📺 Manage Channels</div>
			<div className="section-subtitle">View and manage all channels with their videos</div>

			{error && (
				<div className="alert alert-error" style={{ marginBottom: '16px' }}>
					❌ {error}
					<button 
						onClick={() => setError(null)} 
						style={{ marginLeft: '12px', cursor: 'pointer', color: '#ff9999' }}
					>
						✕
					</button>
				</div>
			)}

			{channels.length === 0 ? (
				<div style={{
					textAlign: 'center',
					padding: '40px',
					color: '#888'
				}}>
					{loading ? '🔄 Loading channels...' : '📭 No channels found'}
					<br />
					<button
						onClick={() => setShowAddChannel(true)}
						className="btn btn-success"
						style={{ marginTop: '16px' }}
					>
						➕ Create First Channel
					</button>
				</div>
			) : (
				<div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', minHeight: '600px' }}>
					{/* Channels List */}
					<div style={{
						background: 'rgba(0, 0, 0, 0.3)',
						border: '1px solid rgba(0, 212, 255, 0.2)',
						borderRadius: '8px',
						overflow: 'hidden',
						display: 'flex',
						flexDirection: 'column'
					}}>
						<div style={{
							padding: '12px 16px',
							borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
							background: 'rgba(0, 212, 255, 0.1)',
							fontWeight: 'bold',
							color: '#00d4ff',
							fontSize: '13px'
						}}>
							CHANNELS ({channels.length})
						</div>
						<div style={{ overflow: 'auto', flex: 1 }}>
							{channels.map((channel) => (
								<div
									key={channel._id}
									onClick={() => setSelectedChannel(channel)}
									style={{
										padding: '12px 16px',
										borderBottom: '1px solid rgba(0, 212, 255, 0.1)',
										cursor: 'pointer',
										background: selectedChannel?._id === channel._id 
											? 'rgba(0, 212, 255, 0.15)' 
											: 'transparent',
										borderLeft: selectedChannel?._id === channel._id 
											? '3px solid #00d4ff' 
											: '3px solid transparent',
										transition: 'all 0.2s ease',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'space-between'
									}}
									onMouseEnter={(e) => {
										if (selectedChannel?._id !== channel._id) {
											e.currentTarget.style.background = 'rgba(0, 212, 255, 0.08)'
										}
									}}
									onMouseLeave={(e) => {
										if (selectedChannel?._id !== channel._id) {
											e.currentTarget.style.background = 'transparent'
										}
									}}
								>
									<div>
										<div style={{ color: '#00d4ff', fontSize: '13px', fontWeight: '600' }}>
											{channel.name}
										</div>
										<div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>
											{channel.items?.length || 0} videos
										</div>
									</div>
									<button
										onClick={(e) => {
											e.stopPropagation()
											deleteChannel(channel._id)
										}}
										className="btn btn-danger"
										style={{ padding: '4px 8px', fontSize: '11px' }}
									>
										🗑️
									</button>
								</div>
							))}
						</div>
					</div>

					{/* Videos List */}
					{selectedChannel ? (
						<div style={{
							background: 'rgba(0, 0, 0, 0.3)',
							border: '1px solid rgba(0, 212, 255, 0.2)',
							borderRadius: '8px',
							overflow: 'hidden',
							display: 'flex',
							flexDirection: 'column'
						}}>
							<div style={{
								padding: '12px 16px',
								borderBottom: '1px solid rgba(0, 212, 255, 0.2)',
								background: 'rgba(0, 212, 255, 0.1)',
								fontWeight: 'bold',
								color: '#00d4ff',
								fontSize: '13px'
							}}>
								📹 VIDEOS IN "{selectedChannel.name.toUpperCase()}" ({selectedChannel.items?.length || 0})
							</div>
							<div style={{
								overflow: 'auto',
								flex: 1,
								padding: '12px'
							}}>
								{selectedChannel.items?.length === 0 ? (
									<div style={{ textAlign: 'center', color: '#888', padding: '40px 20px' }}>
										📭 No videos in this channel
									</div>
								) : (
									<div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
										{selectedChannel.items.map((video, idx) => (
											<div
												key={video._id || video.youtubeId}
												style={{
													display: 'grid',
													gridTemplateColumns: '80px 1fr auto',
													gap: '12px',
													background: 'rgba(0, 212, 255, 0.08)',
													border: '1px solid rgba(0, 212, 255, 0.2)',
													borderRadius: '6px',
													padding: '10px',
													alignItems: 'start',
													transition: 'all 0.2s ease'
												}}
												onMouseEnter={(e) => {
													e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)'
													e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.4)'
												}}
												onMouseLeave={(e) => {
													e.currentTarget.style.background = 'rgba(0, 212, 255, 0.08)'
													e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.2)'
												}}
											>
												{/* Thumbnail */}
												<img
													src={getYoutubeThumbnail(video.youtubeId)}
													alt={video.title}
													style={{
														width: '80px',
														height: '60px',
														borderRadius: '4px',
														objectFit: 'cover',
														border: '1px solid rgba(0, 212, 255, 0.3)'
													}}
													onError={(e) => {
														e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 60"%3E%3Crect fill="%23333" width="80" height="60"/%3E%3C/svg%3E'
													}}
												/>

												{/* Video Info */}
												<div style={{ minWidth: 0 }}>
													<div style={{
														color: '#00d4ff',
														fontSize: '12px',
														fontWeight: '600',
														marginBottom: '4px',
														overflow: 'hidden',
														textOverflow: 'ellipsis',
														whiteSpace: 'nowrap'
													}}>
														#{idx + 1} {video.title}
													</div>
													<div style={{
														color: '#888',
														fontSize: '11px',
														marginBottom: '2px'
													}}>
														YT ID: {video.youtubeId}
													</div>
													<div style={{
														color: '#666',
														fontSize: '10px'
													}}>
														⏱️ {video.duration}s
														{video.year && ` • 📅 ${video.year}`}
														{video.category && ` • 🏷️ ${video.category}`}
													</div>
												</div>

												{/* Delete Button */}
												<button
													onClick={() => deleteVideo(selectedChannel._id, video._id || video.youtubeId)}
													disabled={deletingVideo === (video._id || video.youtubeId)}
													className="btn btn-danger"
													style={{
														padding: '6px 10px',
														fontSize: '11px',
														whiteSpace: 'nowrap'
													}}
												>
													{deletingVideo === (video._id || video.youtubeId) ? '⏳' : '🗑️ Delete'}
												</button>
											</div>
										))}
									</div>
								)}
							</div>
						</div>
					) : (
						<div style={{
							background: 'rgba(0, 0, 0, 0.3)',
							border: '1px solid rgba(0, 212, 255, 0.2)',
							borderRadius: '8px',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'center',
							color: '#888',
							textAlign: 'center',
							padding: '40px'
						}}>
							👈 Select a channel to view videos
						</div>
					)}
				</div>
			)}

			{/* Add Channel Modal */}
			{showAddChannel && (
				<div style={{
					position: 'fixed',
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: 'rgba(0, 0, 0, 0.7)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: 1000
				}}>
					<div style={{
						background: 'rgba(0, 0, 0, 0.9)',
						border: '2px solid #00d4ff',
						borderRadius: '8px',
						padding: '24px',
						minWidth: '400px',
						boxShadow: '0 0 20px rgba(0, 212, 255, 0.3)'
					}}>
						<h2 style={{ color: '#00d4ff', marginBottom: '16px' }}>➕ Create New Channel</h2>
						<form onSubmit={handleAddChannel}>
							<div className="form-group">
								<label className="form-label">CHANNEL NAME *</label>
								<input
									type="text"
									placeholder="e.g., Music Videos, Comedy"
									value={newChannelName}
									onChange={(e) => setNewChannelName(e.target.value)}
									disabled={addingChannel}
									autoFocus
								/>
							</div>
							<div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
								<button
									type="submit"
									disabled={addingChannel || !newChannelName.trim()}
									className="btn btn-success"
									style={{ flex: 1 }}
								>
									{addingChannel ? '⏳ Creating...' : '✓ Create Channel'}
								</button>
								<button
									type="button"
									onClick={() => {
										setShowAddChannel(false)
										setNewChannelName('')
										setError(null)
									}}
									disabled={addingChannel}
									className="btn btn-secondary"
									style={{ flex: 1 }}
								>
									✕ Cancel
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</div>
	)
}

export default function ChannelManager() {
	return (
		<ChannelManagerErrorBoundary>
			<ChannelManagerContent />
		</ChannelManagerErrorBoundary>
	)
}
