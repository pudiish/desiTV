import React, { useState, useEffect } from 'react'
import '../AdminDashboard.css'

export default function ChannelManager() {
	const [channels, setChannels] = useState([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState(null)
	const [selectedChannel, setSelectedChannel] = useState(null)

	const fetchChannels = async () => {
		setLoading(true)
		setError(null)
		try {
			const response = await fetch('/api/channels')
			if (!response.ok) throw new Error('Failed to fetch channels')
			const data = await response.json()
			setChannels(data)
		} catch (err) {
			setError(err.message)
			if (window.adminNotify) window.adminNotify(err.message, 'error')
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchChannels()
		const interval = setInterval(fetchChannels, 10000)
		return () => clearInterval(interval)
	}, [])

	const deleteChannel = async (id) => {
		if (!window.confirm('Delete this channel?')) return

		try {
			const response = await fetch(`/api/channels/${id}`, { method: 'DELETE' })
			if (!response.ok) throw new Error('Failed to delete channel')
			setChannels((prev) => prev.filter((c) => c._id !== id))
			if (window.adminNotify) window.adminNotify('Channel deleted', 'success')
		} catch (err) {
			if (window.adminNotify) window.adminNotify(err.message, 'error')
		}
	}

	return (
		<div className="section-container">
			<div className="section-header">
				<h3>Channel Manager</h3>
				<button className="btn btn-primary" onClick={fetchChannels} disabled={loading}>
					{loading ? 'Loading...' : 'Refresh'}
				</button>
			</div>

			{error && <div className="error-box">{error}</div>}

			{channels.length === 0 ? (
				<div className="empty-state">No channels found</div>
			) : (
				<div className="channels-list">
					{channels.map((channel) => (
						<div
							key={channel._id}
							className="channel-row"
							onClick={() => setSelectedChannel(channel)}
						>
							<div className="channel-info">
								<h4>{channel.name}</h4>
								<p>{channel.items?.length || 0} videos</p>
							</div>
							<div className="channel-actions">
								<button
									className="btn btn-small btn-danger"
									onClick={(e) => {
										e.stopPropagation()
										deleteChannel(channel._id)
									}}
								>
									Delete
								</button>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Channel Detail Modal */}
			{selectedChannel && (
				<div className="modal-overlay" onClick={() => setSelectedChannel(null)}>
					<div className="modal-content" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<h3>{selectedChannel.name}</h3>
							<button
								className="close-btn"
								onClick={() => setSelectedChannel(null)}
							>
								✕
							</button>
						</div>
						<div className="modal-body">
							<div className="info-section">
								<h4>Channel Details</h4>
								<table className="detail-table">
									<tbody>
										<tr>
											<td>ID</td>
											<td>{selectedChannel._id}</td>
										</tr>
										<tr>
											<td>Name</td>
											<td>{selectedChannel.name}</td>
										</tr>
										<tr>
											<td>Total Videos</td>
											<td>{selectedChannel.items?.length || 0}</td>
										</tr>
										<tr>
											<td>Created</td>
											<td>
												{new Date(selectedChannel.createdAt).toLocaleString()}
											</td>
										</tr>
										<tr>
											<td>Updated</td>
											<td>
												{new Date(selectedChannel.updatedAt).toLocaleString()}
											</td>
										</tr>
									</tbody>
								</table>
							</div>

							<div className="info-section">
								<h4>Videos ({selectedChannel.items?.length || 0})</h4>
								<div className="videos-list">
									{selectedChannel.items?.map((video, idx) => (
										<div key={idx} className="video-item">
											<span className="video-num">{idx + 1}</span>
											<span className="video-title">{video.title}</span>
											<span className="video-duration">
												{video.duration}s
											</span>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
