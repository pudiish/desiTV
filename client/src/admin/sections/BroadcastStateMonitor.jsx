import React, { useState, useEffect } from 'react'
import HybridStateManager from '../../services/HybridStateManager'
import '../AdminDashboard.css'

export default function BroadcastStateMonitor() {
	const [states, setStates] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [selectedState, setSelectedState] = useState(null)

	const fetchStates = async () => {
		setLoading(true)
		setError(null)
		try {
			// Use hybrid state manager for local caching + backend sync
			// Reduces API calls by serving from cache when available (1 min TTL)
			const data = await HybridStateManager.get('broadcastStates', async () => {
				const response = await fetch('/api/broadcast-state/all')
				if (!response.ok) throw new Error('Failed to fetch states')
				return response.json()
			})
			setStates(data.states || [])
		} catch (err) {
			setError(err.message)
			if (window.adminNotify) window.adminNotify(err.message, 'error')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		// Initial fetch - uses local cache if available (reduces API call)
		fetchStates()
		
		// Subscribe to cache updates from other components
		const unsubscribe = HybridStateManager.subscribe('broadcastStates', (data) => {
			setStates(data.states || [])
		})
		
		return () => unsubscribe()
	}, [])

	return (
		<div className="section-container">
			<div className="section-header">
				<h3>Broadcast State Monitor</h3>
				<button
					className="btn btn-primary"
					onClick={fetchStates}
					disabled={loading}
				>
					{loading ? 'Refreshing...' : 'Refresh'}
				</button>
			</div>

			{error && <div className="error-box">{error}</div>}

			{states.length === 0 ? (
				<div className="empty-state">No broadcast states found</div>
			) : (
				<div className="states-grid">
					{states.map((state) => (
						<div
							key={state.channelId}
							className="state-card"
							onClick={() => setSelectedState(state)}
						>
							<div className="card-header">
								<h4>{state.channelName || state.channelId}</h4>
								<span className="card-status">●</span>
							</div>
							<div className="card-body">
								<div className="info-row">
									<span className="label">Video Index:</span>
									<span className="value">{state.videoIndex || 0}</span>
								</div>
								<div className="info-row">
									<span className="label">Current Time:</span>
									<span className="value">
										{state.currentTime?.toFixed(1) || 0}s
									</span>
								</div>
								<div className="info-row">
									<span className="label">Playlist Duration:</span>
									<span className="value">{state.playlistTotalDuration}s</span>
								</div>
								<div className="info-row">
									<span className="label">Last Update:</span>
									<span className="value">
										{new Date(state.updatedAt).toLocaleTimeString()}
									</span>
								</div>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Detail Modal */}
			{selectedState && (
				<div className="modal-overlay" onClick={() => setSelectedState(null)}>
					<div className="modal-content" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h3>{selectedState.channelName}</h3>
							<button
								className="close-btn"
								onClick={() => setSelectedState(null)}
							>
								✕
							</button>
						</div>
						<div className="modal-body">
							<table className="detail-table">
								<tbody>
									<tr>
										<td>Channel ID</td>
										<td>{selectedState.channelId}</td>
									</tr>
									<tr>
										<td>Channel Name</td>
										<td>{selectedState.channelName}</td>
									</tr>
									<tr>
										<td>Current Video</td>
										<td>{selectedState.currentVideoIndex}</td>
									</tr>
									<tr>
										<td>Current Time</td>
										<td>{selectedState.currentTime?.toFixed(2)}s</td>
									</tr>
									<tr>
										<td>Cycle Position</td>
										<td>{selectedState.cyclePosition?.toFixed(2)}s</td>
									</tr>
									<tr>
										<td>Playlist Duration</td>
										<td>{selectedState.playlistTotalDuration}s</td>
									</tr>
									<tr>
										<td>Video Durations</td>
										<td>{selectedState.videoDurations?.join(', ')}</td>
									</tr>
									<tr>
										<td>Playback Rate</td>
										<td>{selectedState.playbackRate}x</td>
									</tr>
									<tr>
										<td>Virtual Elapsed</td>
										<td>{selectedState.virtualElapsedTime?.toFixed(1)}s</td>
									</tr>
									<tr>
										<td>Cycle Count</td>
										<td>{selectedState.playlistCycleCount}</td>
									</tr>
									<tr>
										<td>Last Session End</td>
										<td>
											{new Date(selectedState.lastSessionEndTime).toLocaleString()}
										</td>
									</tr>
									<tr>
										<td>Last Updated</td>
										<td>{new Date(selectedState.updatedAt).toLocaleString()}</td>
									</tr>
									<tr>
										<td>Created</td>
										<td>{new Date(selectedState.createdAt).toLocaleString()}</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
