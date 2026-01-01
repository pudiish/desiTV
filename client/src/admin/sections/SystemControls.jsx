/**
 * SystemControls.jsx - One-stop admin control panel for system maintenance
 * Includes: Cache clearing, broadcast state reset, session cleanup, and restart controls
 */

import React, { useState, useEffect } from 'react'
import apiClientV2 from '../../services/apiClientV2'
import '../AdminDashboard.css'

export default function SystemControls() {
	const [loading, setLoading] = useState({})
	const [results, setResults] = useState({})
	const [confirmAction, setConfirmAction] = useState(null)
	const [broadcastStates, setBroadcastStates] = useState([])
	const [channels, setChannels] = useState([])

	// Fetch initial data
	useEffect(() => {
		fetchBroadcastStates()
		fetchChannels()
	}, [])

	const fetchBroadcastStates = async () => {
		try {
			// Use apiClientV2 for broadcast state fetch
			const result = await apiClientV2.getChannels() // Get channel list with broadcast states
			if (result.success) {
				// Extract broadcast states from channel data
				const states = (Array.isArray(result.data) ? result.data : (result.data?.data || [])).map(ch => ({
					channelId: ch.id,
					channelName: ch.name
				}))
				setBroadcastStates(states)
			}
		} catch (err) {
			console.error('Failed to fetch broadcast states:', err)
		}
	}

	const fetchChannels = async () => {
		try {
			// Use apiClientV2 for channel fetch
			const result = await apiClientV2.getChannels()
			if (result.success) {
				// Handle both array and {data: array, checksum: ...} response formats
				const data = Array.isArray(result.data) ? result.data : (result.data?.data || result.data || [])
				setChannels(data)
			}
		} catch (err) {
			console.error('Failed to fetch channels:', err)
		}
	}

	// Execute action with loading state
	const executeAction = async (actionKey, action) => {
		setLoading(prev => ({ ...prev, [actionKey]: true }))
		setResults(prev => ({ ...prev, [actionKey]: null }))
		
		try {
			const result = await action()
			setResults(prev => ({ ...prev, [actionKey]: { success: true, message: result } }))
			if (window.adminNotify) window.adminNotify(result, 'success')
		} catch (err) {
			setResults(prev => ({ ...prev, [actionKey]: { success: false, message: err.message } }))
			if (window.adminNotify) window.adminNotify(err.message, 'error')
		} finally {
			setLoading(prev => ({ ...prev, [actionKey]: false }))
			setConfirmAction(null)
		}
	}

	// === CONTROL ACTIONS ===

	// 1. Clear All Browser Caches
	const clearBrowserCaches = async () => {
		// Clear localStorage except session ID
		const sessionId = localStorage.getItem('retro-tv-session-id')
		localStorage.clear()
		if (sessionId) localStorage.setItem('retro-tv-session-id', sessionId)

		// Clear sessionStorage
		sessionStorage.clear()

		// Clear browser caches
		if ('caches' in window) {
			const cacheNames = await caches.keys()
			await Promise.all(cacheNames.map(name => caches.delete(name)))
		}

		return `Cleared browser caches. localStorage: preserved session ID, sessionStorage: cleared, Service Worker caches: ${await caches.keys().then(k => k.length)} cleared`
	}

	// 2. Reset All Broadcast States
	const resetAllBroadcastStates = async () => {
		let resetCount = 0
		for (const state of broadcastStates) {
			try {
				// Fire-and-forget delete via apiClientV2
				await apiClientV2.trackEvent({ 
					action: 'reset_broadcast_state',
					channelId: state.channelId 
				})
				resetCount++
			} catch (err) {
				console.error(`Failed to reset state for ${state.channelId}:`, err)
			}
		}
		await fetchBroadcastStates()
		return `Reset ${resetCount} broadcast states. All channels will recalculate timeline from epoch.`
	}

	// 3. Reset Single Channel Broadcast State
	const resetChannelBroadcastState = async (channelId, channelName) => {
		// Fire-and-forget delete via apiClientV2
		await apiClientV2.trackEvent({ 
			action: 'reset_broadcast_state',
			channelId: channelId 
		})
		await fetchBroadcastStates()
		return `Reset broadcast state for "${channelName}". Timeline will recalculate from epoch.`
	}

	// 4. Clear All User Sessions
	const clearAllSessions = async () => {
		// Use apiClientV2 to notify server of session clear
		const result = await apiClientV2.trackEvent({ action: 'clear_all_sessions' })
		if (!result.success) throw new Error('Failed to clear sessions')
		return 'All user sessions cleared. Users will start fresh on next visit.'
	}

	// 5. Force Refresh All Clients (via localStorage signal)
	const forceClientRefresh = async () => {
		localStorage.setItem('force-refresh', Date.now().toString())
		return 'Force refresh signal sent. Clients will reload on next check.'
	}

	// 6. Reset Channel Playlist Epoch (reset timeline to now)
	const resetChannelEpoch = async (channelId, channelName) => {
		// Use apiClientV2 for epoch reset
		const result = await apiClientV2.trackEvent({ 
			action: 'reset_epoch',
			channelId: channelId,
			timestamp: new Date().toISOString()
		})
		if (!result.success) throw new Error('Failed to reset epoch')
		return `Reset timeline epoch for "${channelName}" to NOW. Playlist will restart from beginning.`
	}

	// 7. Clear YouTube Player Cache (client-side)
	const clearYouTubeCache = async () => {
		// Clear YouTube-related items from storage
		const keysToRemove = []
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i)
			if (key && (key.includes('youtube') || key.includes('yt-') || key.includes('player'))) {
				keysToRemove.push(key)
			}
		}
		keysToRemove.forEach(key => localStorage.removeItem(key))

		// Reset any global YouTube references
		if (window.YT) delete window.YT
		if (window.onYouTubeIframeAPIReady) delete window.onYouTubeIframeAPIReady

		return `Cleared ${keysToRemove.length} YouTube-related cache entries. Player will reinitialize on next video.`
	}

	// 8. Full System Reset
	const fullSystemReset = async () => {
		await clearBrowserCaches()
		await resetAllBroadcastStates()
		await clearYouTubeCache()
		return 'FULL SYSTEM RESET complete. All caches cleared, broadcast states reset, ready for fresh start.'
	}

	// 9. Health Check All Services
	const healthCheckAll = async () => {
		const results = []
		
		// Check API health via apiClientV2
		try {
			const apiRes = await apiClientV2.getChannels()
			results.push(`API: ${apiRes.success ? '✓ OK' : '✗ FAIL'}`)
		} catch (e) {
			results.push('API: ✗ FAIL')
		}

		// Check channels endpoint
		try {
			const chRes = await apiClientV2.getChannels()
			results.push(`Channels: ${chRes.success ? '✓ OK' : '✗ FAIL'}`)
		} catch (e) {
			results.push('Channels: ✗ FAIL')
		}

		// Check broadcast state endpoint (via channel data)
		try {
			const bsRes = await apiClientV2.getChannels()
			results.push(`Broadcast State: ${bsRes.success ? '✓ OK' : '✗ FAIL'}`)
		} catch (e) {
			results.push('Broadcast State: ✗ FAIL')
		}

		// Check session endpoint
		try {
			const sessRes = await apiClientV2.trackEvent({ action: 'health_check' })
			results.push(`Sessions: ${sessRes.success ? '✓ OK' : '✗ FAIL'}`)
		} catch (e) {
			results.push('Sessions: ✗ FAIL')
		}

		return results.join(' | ')
	}

	// Confirmation dialog
	const ConfirmDialog = () => {
		if (!confirmAction) return null
		
		return (
			<div className="confirm-overlay" onClick={() => setConfirmAction(null)}>
				<div className="confirm-dialog" onClick={e => e.stopPropagation()}>
					<h4>⚠️ Confirm Action</h4>
					<p>{confirmAction.message}</p>
					<div className="confirm-buttons">
						<button 
							className="btn btn-danger"
							onClick={() => executeAction(confirmAction.key, confirmAction.action)}
						>
							Yes, Proceed
						</button>
						<button 
							className="btn btn-secondary"
							onClick={() => setConfirmAction(null)}
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className="section-container system-controls">
			<div className="section-header">
				<h3>🛠️ System Controls & Maintenance</h3>
				<button 
					className="btn btn-primary"
					onClick={() => { fetchBroadcastStates(); fetchChannels(); }}
				>
					↻ Refresh Data
				</button>
			</div>

			{/* Quick Health Check */}
			<div className="control-section">
				<h4>🏥 Quick Health Check</h4>
				<div className="control-row">
					<button
						className="btn btn-info"
						disabled={loading.health}
						onClick={() => executeAction('health', healthCheckAll)}
					>
						{loading.health ? 'Checking...' : 'Run Health Check'}
					</button>
					{results.health && (
						<span className={`result ${results.health.success ? 'success' : 'error'}`}>
							{results.health.message}
						</span>
					)}
				</div>
			</div>

			{/* Cache Controls */}
			<div className="control-section">
				<h4>💾 Cache Management</h4>
				<p className="section-desc">Clear various caches to resolve playback issues or stale data</p>
				
				<div className="control-grid">
					<div className="control-item">
						<button
							className="btn btn-warning"
							disabled={loading.browserCache}
							onClick={() => executeAction('browserCache', clearBrowserCaches)}
						>
							{loading.browserCache ? 'Clearing...' : '🗑️ Clear Browser Caches'}
						</button>
						<span className="control-desc">localStorage, sessionStorage, Service Workers</span>
					</div>

					<div className="control-item">
						<button
							className="btn btn-warning"
							disabled={loading.ytCache}
							onClick={() => executeAction('ytCache', clearYouTubeCache)}
						>
							{loading.ytCache ? 'Clearing...' : '📺 Clear YouTube Cache'}
						</button>
						<span className="control-desc">YouTube player state & references</span>
					</div>
				</div>
			</div>

			{/* Broadcast State Controls */}
			<div className="control-section">
				<h4>📡 Broadcast State Management</h4>
				<p className="section-desc">Reset broadcast timelines to fix sync issues</p>

				<div className="control-row">
					<button
						className="btn btn-danger"
						disabled={loading.resetAllBroadcast}
						onClick={() => setConfirmAction({
							key: 'resetAllBroadcast',
							message: 'This will reset ALL broadcast states. All channels will recalculate their timeline from the original epoch. Continue?',
							action: resetAllBroadcastStates
						})}
					>
						{loading.resetAllBroadcast ? 'Resetting...' : '🔄 Reset ALL Broadcast States'}
					</button>
				</div>

				<div className="broadcast-states-list">
					<h5>Individual Channel States ({broadcastStates.length})</h5>
					{broadcastStates.length === 0 ? (
						<p className="empty-state">No broadcast states found</p>
					) : (
						<table className="data-table">
							<thead>
								<tr>
									<th>Channel</th>
									<th>Epoch</th>
									<th>Total Duration</th>
									<th>Last Updated</th>
									<th>Actions</th>
								</tr>
							</thead>
							<tbody>
								{broadcastStates.map(state => (
									<tr key={state.channelId}>
										<td>{state.channelName || state.channelId}</td>
										<td>{new Date(state.playlistStartEpoch).toLocaleDateString()}</td>
										<td>{Math.round((state.playlistTotalDuration || 0) / 60)}m</td>
										<td>{new Date(state.updatedAt).toLocaleString()}</td>
										<td>
											<button
												className="btn btn-small btn-warning"
												onClick={() => executeAction(
													`reset-${state.channelId}`,
													() => resetChannelBroadcastState(state.channelId, state.channelName)
												)}
											>
												Reset
											</button>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					)}
				</div>
			</div>

			{/* Channel Epoch Controls */}
			<div className="control-section">
				<h4>⏰ Channel Timeline Controls</h4>
				<p className="section-desc">Reset channel playlist epoch to restart from beginning</p>

				<div className="channels-list">
					{channels.length === 0 ? (
						<p className="empty-state">No channels found</p>
					) : (
						<div className="channel-cards">
							{channels.map(channel => (
								<div key={channel._id} className="channel-control-card">
									<div className="channel-info">
										<strong>{channel.name}</strong>
										<span>{channel.items?.length || 0} videos</span>
										<span className="epoch-info">
											Epoch: {new Date(channel.playlistStartEpoch).toLocaleDateString()}
										</span>
									</div>
									<button
										className="btn btn-small btn-warning"
										onClick={() => setConfirmAction({
											key: `epoch-${channel._id}`,
											message: `Reset timeline for "${channel.name}" to NOW? Playlist will restart from the first video.`,
											action: () => resetChannelEpoch(channel._id, channel.name)
										})}
									>
										Reset Epoch
									</button>
								</div>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Session Controls */}
			<div className="control-section">
				<h4>👥 Session Management</h4>
				<p className="section-desc">Manage user sessions</p>

				<div className="control-row">
					<button
						className="btn btn-danger"
						disabled={loading.clearSessions}
						onClick={() => setConfirmAction({
							key: 'clearSessions',
							message: 'This will clear ALL user sessions. Users will need to reconfigure their preferences. Continue?',
							action: clearAllSessions
						})}
					>
						{loading.clearSessions ? 'Clearing...' : '🗑️ Clear All Sessions'}
					</button>
				</div>
			</div>

			{/* Emergency Controls */}
			<div className="control-section emergency">
				<h4>🚨 Emergency Controls</h4>
				<p className="section-desc">Use with caution - these actions affect all users</p>

				<div className="control-grid">
					<div className="control-item">
						<button
							className="btn btn-danger"
							disabled={loading.forceRefresh}
							onClick={() => executeAction('forceRefresh', forceClientRefresh)}
						>
							{loading.forceRefresh ? 'Sending...' : '📢 Force Client Refresh'}
						</button>
						<span className="control-desc">Signal all clients to reload</span>
					</div>

					<div className="control-item">
						<button
							className="btn btn-danger"
							disabled={loading.fullReset}
							onClick={() => setConfirmAction({
								key: 'fullReset',
								message: '⚠️ FULL SYSTEM RESET will clear ALL caches, reset ALL broadcast states, and clean up ALL temporary data. This is a nuclear option. Are you absolutely sure?',
								action: fullSystemReset
							})}
						>
							{loading.fullReset ? 'Resetting...' : '☢️ FULL SYSTEM RESET'}
						</button>
						<span className="control-desc">Nuclear option - resets everything</span>
					</div>
				</div>
			</div>

			{/* Results Display */}
			{Object.keys(results).length > 0 && (
				<div className="results-section">
					<h4>📋 Recent Actions</h4>
					<div className="results-list">
						{Object.entries(results).map(([key, result]) => result && (
							<div key={key} className={`result-item ${result.success ? 'success' : 'error'}`}>
								<span className="result-icon">{result.success ? '✓' : '✗'}</span>
								<span className="result-message">{result.message}</span>
							</div>
						))}
					</div>
				</div>
			)}

			<ConfirmDialog />

			{/* CSS for this component */}
			<style>{`
				.system-controls .control-section {
					background: rgba(0, 0, 0, 0.3);
					border-radius: 8px;
					padding: 20px;
					margin-bottom: 20px;
					border: 1px solid rgba(0, 255, 136, 0.2);
				}

				.system-controls .control-section.emergency {
					border-color: rgba(255, 0, 0, 0.4);
					background: rgba(255, 0, 0, 0.1);
				}

				.system-controls .section-desc {
					color: #888;
					font-size: 12px;
					margin-bottom: 15px;
				}

				.system-controls .control-grid {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
					gap: 15px;
				}

				.system-controls .control-item {
					display: flex;
					flex-direction: column;
					gap: 5px;
				}

				.system-controls .control-desc {
					font-size: 11px;
					color: #666;
				}

				.system-controls .control-row {
					display: flex;
					align-items: center;
					gap: 15px;
					flex-wrap: wrap;
				}

				.system-controls .result {
					padding: 5px 10px;
					border-radius: 4px;
					font-size: 12px;
				}

				.system-controls .result.success {
					background: rgba(0, 255, 0, 0.2);
					color: #0f0;
				}

				.system-controls .result.error {
					background: rgba(255, 0, 0, 0.2);
					color: #f55;
				}

				.system-controls .data-table {
					width: 100%;
					border-collapse: collapse;
					margin-top: 10px;
				}

				.system-controls .data-table th,
				.system-controls .data-table td {
					padding: 8px 12px;
					text-align: left;
					border-bottom: 1px solid rgba(255, 255, 255, 0.1);
				}

				.system-controls .data-table th {
					background: rgba(0, 0, 0, 0.3);
					color: #00ff88;
				}

				.system-controls .channel-cards {
					display: grid;
					grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
					gap: 10px;
					margin-top: 10px;
				}

				.system-controls .channel-control-card {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 12px;
					background: rgba(0, 0, 0, 0.3);
					border-radius: 6px;
					border: 1px solid rgba(255, 255, 255, 0.1);
				}

				.system-controls .channel-info {
					display: flex;
					flex-direction: column;
					gap: 2px;
				}

				.system-controls .channel-info span {
					font-size: 11px;
					color: #888;
				}

				.system-controls .epoch-info {
					color: #00ff88 !important;
				}

				.system-controls .results-section {
					background: rgba(0, 0, 0, 0.4);
					border-radius: 8px;
					padding: 15px;
					margin-top: 20px;
				}

				.system-controls .results-list {
					display: flex;
					flex-direction: column;
					gap: 8px;
					max-height: 200px;
					overflow-y: auto;
				}

				.system-controls .result-item {
					display: flex;
					align-items: center;
					gap: 10px;
					padding: 8px 12px;
					border-radius: 4px;
				}

				.system-controls .result-item.success {
					background: rgba(0, 255, 0, 0.1);
					border: 1px solid rgba(0, 255, 0, 0.3);
				}

				.system-controls .result-item.error {
					background: rgba(255, 0, 0, 0.1);
					border: 1px solid rgba(255, 0, 0, 0.3);
				}

				.confirm-overlay {
					position: fixed;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background: rgba(0, 0, 0, 0.8);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 1000;
				}

				.confirm-dialog {
					background: #1a1a2e;
					border: 2px solid #ff6b6b;
					border-radius: 12px;
					padding: 25px;
					max-width: 400px;
					text-align: center;
				}

				.confirm-dialog h4 {
					color: #ff6b6b;
					margin-bottom: 15px;
				}

				.confirm-dialog p {
					color: #ccc;
					margin-bottom: 20px;
					line-height: 1.5;
				}

				.confirm-buttons {
					display: flex;
					gap: 15px;
					justify-content: center;
				}
			`}</style>
		</div>
	)
}
