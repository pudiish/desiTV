import React, { useState, useEffect } from 'react'
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
			const healthRes = await fetch('/health')
			const healthData = await healthRes.json()
			setHealth(healthData)

			const statesRes = await fetch('/api/broadcast-state/all')
			const statesData = await statesRes.json()

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
		fetchHealth()
		const interval = setInterval(fetchHealth, 10000) // Check every 10s
		return () => clearInterval(interval)
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
