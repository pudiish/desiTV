import React, { useState, useEffect, useRef } from 'react'
import '../AdminDashboard.css'

export default function APIMonitor() {
	const [logs, setLogs] = useState([])
	const [filter, setFilter] = useState('all')
	const [autoScroll, setAutoScroll] = useState(true)
	const logsEndRef = useRef(null)

	// Original fetch to setup monitoring
	useEffect(() => {
		// This would require backend support for API logging
		// For now, we'll simulate with localStorage and interceptor setup
		const setupApiLogging = () => {
			if (!window.__apiLogs) {
				window.__apiLogs = []
			}

			// Intercept fetch requests
			const originalFetch = window.fetch
			window.fetch = function (...args) {
				const startTime = performance.now()
				const url = args[0]
				const method = (args[1]?.method || 'GET').toUpperCase()

				return originalFetch.apply(this, args).then((response) => {
					const duration = performance.now() - startTime
					const status = response.status

					const log = {
						id: Date.now() + Math.random(),
						timestamp: new Date().toISOString(),
						method,
						url: typeof url === 'string' ? url : url.toString(),
						status,
						duration: Math.round(duration),
						statusType:
							status >= 200 && status < 300
								? 'success'
								: status >= 400
									? 'error'
									: 'warning',
					}

					window.__apiLogs.push(log)
					if (window.__apiLogs.length > 100) {
						window.__apiLogs.shift()
					}

					setLogs([...window.__apiLogs])
					return response
				})
			}
		}

		setupApiLogging()

		// Refresh logs every 1 second
		const interval = setInterval(() => {
			if (window.__apiLogs) {
				setLogs([...window.__apiLogs])
			}
		}, 1000)

		return () => clearInterval(interval)
	}, [])

	// Auto-scroll to bottom
	useEffect(() => {
		if (autoScroll && logsEndRef.current) {
			logsEndRef.current.scrollIntoView({ behavior: 'smooth' })
		}
	}, [logs, autoScroll])

	const filteredLogs = logs.filter((log) => {
		if (filter === 'all') return true
		return log.statusType === filter
	})

	const clearLogs = () => {
		window.__apiLogs = []
		setLogs([])
	}

	const getStatusBadge = (statusType) => {
		const badges = {
			success: '✓',
			error: '✕',
			warning: '⚠',
		}
		return badges[statusType] || '?'
	}

	return (
		<div className="section-container api-monitor">
			<div className="section-header">
				<h3>API Monitor</h3>
				<div className="monitor-controls">
					<select
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
						className="filter-select"
					>
						<option value="all">All Requests</option>
						<option value="success">Success Only</option>
						<option value="error">Errors Only</option>
						<option value="warning">Warnings Only</option>
					</select>
					<label className="checkbox-label">
						<input
							type="checkbox"
							checked={autoScroll}
							onChange={(e) => setAutoScroll(e.target.checked)}
						/>
						Auto-scroll
					</label>
					<button className="btn btn-secondary btn-small" onClick={clearLogs}>
						Clear
					</button>
				</div>
			</div>

			<div className="api-stats">
				<div className="stat-box">
					<span className="stat-label">Total Requests:</span>
					<span className="stat-value">{logs.length}</span>
				</div>
				<div className="stat-box">
					<span className="stat-label">Success:</span>
					<span className="stat-value success">
						{logs.filter((l) => l.statusType === 'success').length}
					</span>
				</div>
				<div className="stat-box">
					<span className="stat-label">Errors:</span>
					<span className="stat-value error">
						{logs.filter((l) => l.statusType === 'error').length}
					</span>
				</div>
				<div className="stat-box">
					<span className="stat-label">Avg Duration:</span>
					<span className="stat-value">
						{logs.length === 0
							? '0ms'
							: Math.round(
									logs.reduce((sum, l) => sum + l.duration, 0) / logs.length
								) + 'ms'}
					</span>
				</div>
			</div>

			<div className="logs-container">
				<div className="logs-header">
					<div className="col-status">Status</div>
					<div className="col-method">Method</div>
					<div className="col-url">URL</div>
					<div className="col-duration">Duration</div>
					<div className="col-time">Time</div>
				</div>
				<div className="logs-list">
					{filteredLogs.length === 0 ? (
						<div className="empty-state">
							{filter === 'all'
								? 'No API requests yet'
								: `No ${filter} requests found`}
						</div>
					) : (
						filteredLogs.map((log) => (
							<div key={log.id} className={`log-row ${log.statusType}`}>
								<div className="col-status">
									<span className={`badge ${log.statusType}`}>
										{getStatusBadge(log.statusType)}
									</span>
								</div>
								<div className="col-method">
									<span className="method-badge">{log.method}</span>
								</div>
								<div className="col-url">
									<code>{log.url}</code>
								</div>
								<div className="col-duration">
									<span className={log.duration > 500 ? 'slow' : ''}>
										{log.duration}ms
									</span>
								</div>
								<div className="col-time">
									{new Date(log.timestamp).toLocaleTimeString()}
								</div>
							</div>
						))
					)}
					<div ref={logsEndRef} />
				</div>
			</div>
		</div>
	)
}
