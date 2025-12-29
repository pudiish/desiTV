import React, { useState, useCallback, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { apiClient } from '../../services/apiClient'
import '../AdminDashboard.css'

// ROAST: "Regex for YouTube IDs? In 2025? I hope this covers Shorts, Live, and whatever Google invents next week."
const YOUTUBE_ID_REGEX = /^[a-zA-Z0-9_-]{11}$/
const YOUTUBE_URL_REGEX = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/

/**
 * VideoManager - The "Netflix Engineer" Edition
 * 
 * ROAST: This component was doing too much. It was the backend, frontend, and database administrator all in one.
 * I've cleaned it up, but the fact that I have to manually sync the broadcast state from the client
 * is a crime against distributed systems.
 */
export default function VideoManager() {
	const { getAuthHeaders } = useAuth()

	// Form states
	const [selectedChannel, setSelectedChannel] = useState('')
	const [youtubeInput, setYoutubeInput] = useState('')
	const [showAddChannel, setShowAddChannel] = useState(false)
	const [newChannelName, setNewChannelName] = useState('')
	const [addingChannel, setAddingChannel] = useState(false)
	
	// ROAST: "Why are we managing form state like it's 2015? React Hook Form exists."
	// But for a "quick fix", I'll stick to useState to avoid adding dependencies.
	const [videoData, setVideoData] = useState({
		title: '',
		duration: 30,
		year: new Date().getFullYear(),
		tags: '',
		category: ''
	})
	const [videoId, setVideoId] = useState('')

	// UI states
	const [channels, setChannels] = useState([])
	const [loading, setLoading] = useState(false)
	const [fetchingYT, setFetchingYT] = useState(false)
	const [message, setMessage] = useState({ type: '', text: '' })
	const [ytPreview, setYtPreview] = useState(null)

	// Bulk upload states
	const [bulkFileName, setBulkFileName] = useState('')
	const [bulkFileContent, setBulkFileContent] = useState('')
	const [bulkUploading, setBulkUploading] = useState(false)
	const [bulkMessage, setBulkMessage] = useState({ type: '', text: '' })

	useEffect(() => {
		fetchChannels()
	}, [])

	const fetchChannels = async () => {
		try {
			// ROAST: "Fetching all channels just to populate a dropdown? Pagination? Infinite scroll? No?"
			const response = await fetch('/api/channels')
			if (response.ok) {
				const data = await response.json()
				// Fix: Ensure array safety because the API is untrustworthy
				setChannels(Array.isArray(data) ? data : [])
			}
		} catch (err) {
			console.error('[VideoManager] Fetch channels error:', err)
			setMessage({ type: 'error', text: '❌ Failed to load channels' })
			setChannels([])
		}
	}

	/**
	 * Sync Broadcast State
	 * ROAST: "This function shouldn't exist on the client. The backend should handle this via event sourcing or triggers.
	 * But since the backend is just a glorified JSON store, I have to manually tell the broadcast engine
	 * that the playlist has changed. You're welcome."
	 */
	const syncBroadcastState = async (channelId) => {
		try {
			console.log(`[Sync] Manually syncing broadcast state for channel ${channelId}...`)
			
			// 1. Fetch fresh channel data
			const channelRes = await fetch(`/api/channels/${channelId}`)
			if (!channelRes.ok) throw new Error('Failed to fetch channel for sync')
			const channel = await channelRes.json()

			// 2. Calculate state (Client-side calculation? Gross.)
			const videoDurations = channel.items.map(v => v.duration || 30)
			const playlistTotalDuration = videoDurations.reduce((a, b) => a + b, 0)

			// 3. Push to broadcast state service
			// Note: Using fetch directly because apiClient might wrap things differently
			await fetch(`/api/broadcast-state/${channelId}`, {
				method: 'POST',
				headers: {
					...getAuthHeaders(),
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					channelId,
					channelName: channel.name,
					playlistStartEpoch: channel.playlistStartEpoch,
					playlistTotalDuration,
					videoDurations
				})
			})
			
			console.log('[Sync] Broadcast state synced. The timeline is safe... for now.')
		} catch (err) {
			console.error('[Sync] Failed to sync broadcast state:', err)
			// Don't show user error, this is a background "fix"
		}
	}

	const extractYoutubeId = (input) => {
		const urlMatch = input.match(YOUTUBE_URL_REGEX)
		if (urlMatch) return urlMatch[1]
		if (YOUTUBE_ID_REGEX.test(input)) return input
		return null
	}

	const handleAddChannel = async (e) => {
		e.preventDefault()
		if (!newChannelName.trim()) {
			setMessage({ type: 'error', text: '❌ Category name is required' })
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
				const newChannels = Array.isArray(channels) ? [...channels, data] : [data]
				setChannels(newChannels)
				setSelectedChannel(data._id)
				setNewChannelName('')
				setShowAddChannel(false)
				setMessage({ type: 'success', text: '✅ Category created!' })
				
				// Sync the new (empty) channel state
				syncBroadcastState(data._id)
			} else {
				setMessage({ type: 'error', text: `❌ ${data.message || 'Failed to create category'}` })
			}
		} catch (err) {
			setMessage({ type: 'error', text: `❌ ${err.message}` })
		} finally {
			setAddingChannel(false)
		}
	}

	// Fetch YouTube metadata
	const fetchYouTubeMetadata = useCallback(async (id) => {
		setFetchingYT(true)
		try {
			// ROAST: "Using oEmbed? Basic. But it works without an API key, so I'll allow it."
			const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)
			if (response.ok) {
				const data = await response.json()
				setYtPreview({
					title: data.title,
					thumbnail: data.thumbnail_url,
					author: data.author_name
				})
				setVideoData(prev => ({
					...prev,
					title: data.title
				}))
				setMessage({ type: 'success', text: '✅ YouTube data fetched' })
			} else {
				setMessage({ type: 'error', text: '❌ Could not fetch YouTube data' })
			}
		} catch (err) {
			setMessage({ type: 'warn', text: '⚠️ Enter title manually' })
		} finally {
			setFetchingYT(false)
		}
	}, [])

	const handleYoutubeInputChange = (e) => {
		const input = e.target.value.trim()
		setYoutubeInput(input)

		if (input) {
			const extracted = extractYoutubeId(input)
			if (extracted) {
				setVideoId(extracted)
				setYtPreview(null)
				fetchYouTubeMetadata(extracted)
			} else {
				setVideoId('')
				setYtPreview(null)
				setMessage({ type: 'error', text: '❌ Invalid YouTube URL or ID' })
			}
		} else {
			setVideoId('')
			setYtPreview(null)
			setMessage({ type: '', text: '' })
		}
	}

	const handleAddVideo = async (e) => {
		e.preventDefault()

		if (!selectedChannel) {
			setMessage({ type: 'error', text: '❌ Select a category' })
			return
		}
		if (!videoId) {
			setMessage({ type: 'error', text: '❌ Invalid YouTube Video ID' })
			return
		}
		if (!videoData.title.trim()) {
			setMessage({ type: 'error', text: '❌ Enter a title' })
			return
		}

		setLoading(true)
		try {
			const payload = {
				title: videoData.title.trim(),
				youtubeId: videoId,
				duration: Number(videoData.duration) || 30
			}

			if (videoData.year) payload.year = Number(videoData.year)
			if (videoData.category) payload.category = videoData.category
			if (videoData.tags) payload.tags = videoData.tags.split(',').map(t => t.trim()).filter(t => t)

			// Use apiClient which handles CSRF tokens automatically
			await apiClient.post(`/api/channels/${selectedChannel}/videos`, payload)
			
			setMessage({ type: 'success', text: '✅ Video added successfully!' })
			
			// ROAST: "Triggering the manual sync because the backend forgot to."
			await syncBroadcastState(selectedChannel)

			setTimeout(() => {
				setYoutubeInput('')
				setVideoId('')
				setYtPreview(null)
				setVideoData({
					title: '',
					duration: 30,
					year: new Date().getFullYear(),
					tags: '',
					category: ''
				})
			}, 1500)
		} catch (err) {
			console.error('[VideoManager] Add video error:', err)
			setMessage({ type: 'error', text: `❌ ${err.message || 'Failed to add video'}` })
		} finally {
			setLoading(false)
		}
	}

	const handleBulkFileChange = (e) => {
		const file = e.target.files?.[0]
		if (!file) {
			setBulkFileName('')
			setBulkFileContent('')
			return
		}

		setBulkFileName(file.name)
		setBulkMessage({ type: '', text: '' })

		const reader = new FileReader()
		reader.onload = () => {
			const content = reader.result?.toString() || ''
			setBulkFileContent(content)
		}
		reader.onerror = () => {
			setBulkMessage({ type: 'error', text: '❌ Failed to read file' })
			setBulkFileContent('')
			setBulkFileName('')
		}
		reader.readAsText(file)
	}

	const handleBulkUpload = async (e) => {
		e.preventDefault()

		if (!selectedChannel) {
			setBulkMessage({ type: 'error', text: '❌ Select a category first' })
			return
		}
		if (!bulkFileContent) {
			setBulkMessage({ type: 'error', text: '❌ Choose a JSON/CSV/TXT file with links' })
			return
		}

		setBulkUploading(true)
		try {
			const response = await fetch(`/api/channels/${selectedChannel}/bulk-upload`, {
				method: 'POST',
				headers: {
					...getAuthHeaders(),
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ fileContent: bulkFileContent })
			})

			// Check if response is JSON
			const contentType = response.headers.get('content-type')
			if (!contentType || !contentType.includes('application/json')) {
				const text = await response.text()
				console.error('[Bulk Upload] Non-JSON response:', text.substring(0, 200))
				setBulkMessage({ 
					type: 'error', 
					text: `❌ Server error (${response.status}). Please check server logs.` 
				})
				return
			}

			const data = await response.json()
			if (response.ok) {
				const message = data.message || '✅ Bulk upload completed'
				const details = data.count !== undefined 
					? ` (${data.count} added${data.skipped ? `, ${data.skipped} skipped` : ''})`
					: ''
				setBulkMessage({ type: 'success', text: `${message}${details}` })
				setBulkFileName('')
				setBulkFileContent('')
				
				// Sync after bulk upload
				await syncBroadcastState(selectedChannel)
			} else {
				setBulkMessage({ type: 'error', text: `❌ ${data.message || 'Bulk upload failed'}` })
			}
		} catch (err) {
			console.error('[Bulk Upload] Error:', err)
			if (err.message.includes('JSON')) {
				setBulkMessage({ 
					type: 'error', 
					text: '❌ Server returned invalid response. Please check server is running and endpoint exists.' 
				})
			} else {
				setBulkMessage({ type: 'error', text: `❌ ${err.message}` })
			}
		} finally {
			setBulkUploading(false)
		}
	}

	return (
		<div className="section">
			<div className="section-title">📹 Add Video to Category</div>
			<div className="section-subtitle">Paste YouTube link, fetch details automatically, add to a playlist category</div>

			{message.text && (
				<div className={`alert alert-${message.type}`}>
					{message.text}
					<button
						onClick={() => setMessage({ type: '', text: '' })}
						style={{ marginLeft: '12px', cursor: 'pointer' }}
					>
						✕
					</button>
				</div>
			)}

			<form onSubmit={handleAddVideo}>
				{/* Channel Selector */}
				<div className="form-group">
					<label className="form-label">
						<span>SELECT CATEGORY *</span>
						<button 
							type="button" 
							onClick={() => setShowAddChannel(true)} 
							className="btn btn-small btn-new-category"
						>
							➕ New
						</button>
					</label>
					<select
						value={selectedChannel}
						onChange={(e) => setSelectedChannel(e.target.value)}
						disabled={loading}
					>
						<option value="">-- Choose a category --</option>
						{Array.isArray(channels) && channels.map(ch => (
							<option key={ch._id} value={ch._id}>
								{ch.name}
							</option>
						))}
					</select>
				</div>

				{/* YouTube URL/ID Input */}
				<div className="form-group">
					<label className="form-label">YOUTUBE URL OR VIDEO ID *</label>
					<input
						type="text"
						placeholder="Paste YouTube URL or Video ID"
						value={youtubeInput}
						onChange={handleYoutubeInputChange}
						disabled={loading}
					/>
					<small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
						Examples: https://youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ
					</small>
				</div>

				{/* Video ID Status */}
				{videoId && (
					<div style={{
						background: 'rgba(0, 255, 136, 0.1)',
						border: '1px solid rgba(0, 255, 136, 0.3)',
						borderRadius: '6px',
						padding: '10px 12px',
						marginBottom: '16px',
						fontSize: '12px',
						color: '#00ff88'
					}}>
						✓ Video ID: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: '3px' }}>{videoId}</code>
						{fetchingYT && <span style={{ marginLeft: '8px' }}>🔄 Fetching...</span>}
					</div>
				)}

				{/* YouTube Preview */}
				{ytPreview && (
					<div style={{
						background: 'rgba(0, 212, 255, 0.08)',
						border: '1px solid rgba(0, 212, 255, 0.2)',
						borderRadius: '6px',
						padding: '12px',
						marginBottom: '16px',
						fontSize: '12px',
						color: '#d0d0d0'
					}}>
						<strong style={{ color: '#00d4ff' }}>📺 YouTube Info:</strong><br />
						Title: {ytPreview.title}<br />
						Channel: {ytPreview.author}
						{ytPreview.thumbnail && <br />}
						{ytPreview.thumbnail && <img src={ytPreview.thumbnail} alt="thumb" style={{ marginTop: '8px', maxWidth: '100%', borderRadius: '4px' }} />}
					</div>
				)}

				{/* Title (editable) */}
				<div className="form-group">
					<label className="form-label">VIDEO TITLE *</label>
					<input
						type="text"
						placeholder="Video title (auto-filled if available)"
						value={videoData.title}
						onChange={(e) => setVideoData({ ...videoData, title: e.target.value })}
						disabled={loading || fetchingYT}
					/>
				</div>

				{/* Duration */}
				<div className="form-group">
					<label className="form-label">DURATION (seconds)</label>
					<input
						type="number"
						placeholder="30"
						value={videoData.duration}
						onChange={(e) => setVideoData({ ...videoData, duration: e.target.value })}
						disabled={loading}
						min="1"
					/>
					<small style={{ color: '#888', display: 'block', marginTop: '4px' }}>
						Default: 30 seconds
					</small>
				</div>

				{/* Year */}
				<div className="form-group">
					<label className="form-label">YEAR</label>
					<input
						type="number"
						placeholder={new Date().getFullYear()}
						value={videoData.year}
						onChange={(e) => setVideoData({ ...videoData, year: e.target.value })}
						disabled={loading}
						min="1900"
						max={new Date().getFullYear()}
					/>
				</div>

				{/* Category */}
				<div className="form-group">
					<label className="form-label">CATEGORY</label>
					<input
						type="text"
						placeholder="e.g., Music, Comedy, News"
						value={videoData.category}
						onChange={(e) => setVideoData({ ...videoData, category: e.target.value })}
						disabled={loading}
					/>
				</div>

				{/* Tags */}
				<div className="form-group">
					<label className="form-label">TAGS</label>
					<input
						type="text"
						placeholder="Comma-separated tags (e.g., retro, 80s, nostalgia)"
						value={videoData.tags}
						onChange={(e) => setVideoData({ ...videoData, tags: e.target.value })}
						disabled={loading}
					/>
				</div>

				{/* Submit */}
				<button
					type="submit"
					disabled={loading || !selectedChannel || !videoId || !videoData.title}
					className="btn btn-full btn-success"
					style={{ marginTop: '20px' }}
				>
					{loading ? '⏳ ADDING VIDEO...' : '▶️ ADD TO DATABASE'}
				</button>
			</form>

			<div className="section-divider" />

			<div className="section-title">📦 Bulk Upload (JSON / CSV / TXT)</div>
			<div className="section-subtitle">Upload a file with YouTube links or IDs; titles are auto-fetched</div>

			{bulkMessage.text && (
				<div className={`alert alert-${bulkMessage.type}`}>
					{bulkMessage.text}
					<button
						onClick={() => setBulkMessage({ type: '', text: '' })}
						style={{ marginLeft: '12px', cursor: 'pointer' }}
					>
						✕
					</button>
				</div>
			)}

			<form onSubmit={handleBulkUpload} className="bulk-upload-card">
				<div className="form-group">
					<label className="form-label">SELECT CHANNEL *</label>
					<select
						value={selectedChannel}
						onChange={(e) => setSelectedChannel(e.target.value)}
						disabled={bulkUploading}
					>
						<option value="">-- Choose a channel --</option>
						{channels.map(ch => (
							<option key={ch._id} value={ch._id}>{ch.name}</option>
						))}
					</select>
				</div>

				<div className="form-group">
					<label className="form-label">UPLOAD FILE *</label>
					<div className="bulk-upload-input">
						<input
							type="file"
							accept=".json,.csv,.txt"
							onChange={handleBulkFileChange}
							disabled={bulkUploading}
						/>
						{bulkFileName && <span className="bulk-file-name">📄 {bulkFileName}</span>}
					</div>
					<small className="bulk-hint">Formats: JSON array, CSV (url,title), or newline list of YouTube links/IDs</small>
				</div>

				<button
					type="submit"
					disabled={bulkUploading || !bulkFileContent || !selectedChannel}
					className="btn btn-secondary"
				>
					{bulkUploading ? '⏳ Importing...' : '⬆️ Upload & Import'}
				</button>
			</form>

			{/* Add Category Modal */}
			{showAddChannel && (
				<div className="modal-overlay" onClick={() => setShowAddChannel(false)}>
					<div className="modal-content" onClick={(e) => e.stopPropagation()}>
						<h2 className="modal-title">➕ Create New Category</h2>
						<form onSubmit={handleAddChannel}>
							<div className="form-group">
								<label className="form-label">CATEGORY NAME *</label>
								<input
									type="text"
									placeholder="e.g., 90s Music, Comedy Shows, Classic Movies"
									value={newChannelName}
									onChange={(e) => setNewChannelName(e.target.value)}
									disabled={addingChannel}
									autoFocus
								/>
							</div>
							<div className="modal-actions">
								<button
									type="submit"
									disabled={addingChannel || !newChannelName.trim()}
									className="btn btn-success modal-btn"
								>
									{addingChannel ? '⏳ Creating...' : '✓ Create Category'}
								</button>
								<button
									type="button"
									onClick={() => {
										setShowAddChannel(false)
										setNewChannelName('')
									}}
									disabled={addingChannel}
									className="btn btn-secondary modal-btn"
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