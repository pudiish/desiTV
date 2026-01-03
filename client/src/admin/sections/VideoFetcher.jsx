import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { apiClient } from '../../services/apiClient'
import apiClientV2 from '../../services/apiClientV2'
import '../AdminDashboard.css'

export default function VideoFetcher() {
	const { getAuthHeaders, isAuthenticated } = useAuth()
	const [searchQuery, setSearchQuery] = useState('')
	const [loading, setLoading] = useState(false)
	const [results, setResults] = useState([])
	const [error, setError] = useState(null)
	const [selectedVideos, setSelectedVideos] = useState([])

	const handleSearch = async () => {
		if (!searchQuery.trim()) {
			setError('Please enter a search query')
			return
		}

		setLoading(true)
		setError(null)
		setResults([])
		try {
			const result = await apiClientV2.searchYouTube({ query: searchQuery })
			if (!result.success) throw new Error('Search failed')
			setResults(result.data?.items || [])
			if (window.adminNotify)
				window.adminNotify(`Found ${(result.data?.items || []).length} videos`, 'success')
		} catch (err) {
			setError(err.message)
			if (window.adminNotify) window.adminNotify(err.message, 'error')
		} finally {
			setLoading(false)
		}
	}

	const toggleVideoSelection = (videoId) => {
		setSelectedVideos((prev) =>
			prev.includes(videoId) ? prev.filter((id) => id !== videoId) : [...prev, videoId]
		)
	}

	const fetchVideoDetails = async (videoId) => {
		try {
			const result = await apiClientV2.getVideoMetadata(videoId)
			if (!result.success) throw new Error('Failed to fetch details')
			return result.data
		} catch (err) {
			if (window.adminNotify) window.adminNotify(err.message, 'error')
			return null
		}
	}

	const addVideosToChannel = async (channelId) => {
		if (selectedVideos.length === 0) {
			setError('Select videos to add')
			return
		}
		
		// Check auth before adding
		if (!isAuthenticated()) {
			if (window.adminNotify) window.adminNotify('Authentication required', 'error')
			return
		}

		setLoading(true)
		try {
			// Fetch details for all selected videos
			const videoDetails = await Promise.all(
				selectedVideos.map((vid) => fetchVideoDetails(vid))
			)

			// Use apiClient which handles CSRF tokens automatically
			await apiClient.post(`/api/channels/${channelId}/add-videos`, {
				videos: videoDetails.filter(Boolean)
			})

			setSelectedVideos([])
			if (window.adminNotify)
				window.adminNotify(`Added ${selectedVideos.length} videos to channel`, 'success')
		} catch (err) {
			if (window.adminNotify) window.adminNotify(err.message, 'error')
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="section-container">
			<div className="section-header">
				<h3>Video Fetcher</h3>
			</div>

			<div className="search-box">
				<input
					type="text"
					placeholder="Search YouTube videos..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
					disabled={loading}
				/>
				<button
					className="btn btn-primary"
					onClick={handleSearch}
					disabled={loading}
				>
					{loading ? 'Searching...' : 'Search'}
				</button>
			</div>

			{error && <div className="error-box">{error}</div>}

			{selectedVideos.length > 0 && (
				<div className="selection-box">
					<span>{selectedVideos.length} videos selected</span>
					<button
						className="btn btn-success"
						onClick={() => {
							// TODO: Show channel selector
							if (window.adminNotify)
								window.adminNotify('Channel selector coming soon', 'info')
						}}
					>
						Add to Channel
					</button>
					<button
						className="btn btn-secondary"
						onClick={() => setSelectedVideos([])}
					>
						Clear
					</button>
				</div>
			)}

			<div className="results-grid">
				{results.length === 0 ? (
					<div className="empty-state">
						{loading ? 'Searching...' : 'Search for videos to get started'}
					</div>
				) : (
					results.map((video) => (
						<div
							key={video.id.videoId}
							className={`result-card ${
								selectedVideos.includes(video.id.videoId) ? 'selected' : ''
							}`}
							onClick={() => toggleVideoSelection(video.id.videoId)}
						>
							<div className="result-thumbnail">
								<img
									src={video.snippet.thumbnails.medium.url}
									alt={video.snippet.title}
								/>
								<div className="selection-overlay">
									<input
										type="checkbox"
										checked={selectedVideos.includes(video.id.videoId)}
										onChange={() => {}}
										onClick={(e) => e.stopPropagation()}
									/>
								</div>
							</div>
							<div className="result-info">
								<h4>{video.snippet.title}</h4>
								<p className="channel-name">
									{video.snippet.channelTitle}
								</p>
								<p className="result-description">
									{video.snippet.description.substring(0, 100)}...
								</p>
								<span className="video-id-badge">
									{video.id.videoId}
								</span>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	)
}
