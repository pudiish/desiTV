import React, { useState, useEffect } from 'react'
import HybridStateManager from '../../services/HybridStateManager'
import '../AdminDashboard.css'

export default function SystemHealth() {
	const [health, setHealth] = useState(null)
	const [stats, setStats] = useState({
		channels: 0,
		states: 0,
		uptime: 0,
	})
	const [loading, setLoading] = useState(false)

	const fetchHealth = async () => {
		setLoading(true)
		try {
			// Use hybrid state manager for local caching + backend sync
			// Reduces API calls by serving from cache when available (1 min TTL)
			const healthData = await HybridStateManager.get('health', async () => {
				const healthRes = await fetch('/health')
				return healthRes.json()
			})
			setHealth(healthData)

			const statesData = await HybridStateManager.get('broadcastStates', async () => {
				const statesRes = await fetch('/api/broadcast-state/all')
				return statesRes.json()
			})

			setStats({
				channels: statesData.count || 0,
				states: statesData.count || 0,
				uptime: Math.floor(process.uptime?.() || 0),
			})
		} catch (err) {
			console.error('Health check error:', err)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		// Initial fetch - uses local cache if available (reduces API call)
		fetchHealth()
		
		// Subscribe to cache updates from other components
		const unsubscribeHealth = HybridStateManager.subscribe('health', setHealth)
		const unsubscribeStates = HybridStateManager.subscribe('broadcastStates', (data) => {
			setStats({
				channels: data.count || 0,
				states: data.count || 0,
				uptime: Math.floor(process.uptime?.() || 0),
			})
		})
		
		return () => {
			unsubscribeHealth()
			unsubscribeStates()
		}
	}, [])

	return (
		<div className="section-container">
			<div className="section-header">
				<h3>System Health</h3>
				<button className="btn btn-primary" onClick={fetchHealth} disabled={loading}>
					{loading ? 'Checking...' : 'Check Now'}
				</button>
			</div>

			<div className="health-grid">
				<div className="health-card">
					<div className="health-icon">🟢</div>
					<h4>Server Status</h4>
					<p>{health?.status === 'ok' ? 'Online' : 'Offline'}</p>
				</div>

				<div className="health-card">
					<div className="health-icon">📺</div>
					<h4>Active Channels</h4>
					<p>{stats.channels}</p>
				</div>

				<div className="health-card">
					<div className="health-icon">💾</div>
					<h4>Broadcast States</h4>
					<p>{stats.states}</p>
				</div>

				<div className="health-card">
					<div className="health-icon">⏱️</div>
					<h4>Server Uptime</h4>
					<p>
						{Math.floor(stats.uptime / 3600)}h {Math.floor((stats.uptime % 3600) / 60)}m
					</p>
				</div>
			</div>

			<div className="health-details">
				<h4>System Information</h4>
				<pre>
					{JSON.stringify(
						{
							serverStatus: health?.status,
							timestamp: new Date().toISOString(),
							activeChannels: stats.channels,
						},
						null,
						2
					)}
				</pre>
			</div>
		</div>
	)
}
