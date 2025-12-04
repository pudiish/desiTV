import React, { useState, useEffect } from 'react'
import './AdminDashboard.css'
import SystemMonitor from './sections/SystemMonitor'
import BroadcastStateMonitor from './sections/BroadcastStateMonitor'
import ChannelManager from './sections/ChannelManager'
import VideoFetcher from './sections/VideoFetcher'
import APIMonitor from './sections/APIMonitor'
import APIHealth from './sections/APIHealth'
import CacheManagerUI from './sections/CacheManagerUI'
import ComponentHealth from './sections/ComponentHealth'
import MonitoringMetrics from './sections/MonitoringMetrics'
import SystemControls from './sections/SystemControls'

export default function AdminDashboard() {
	const [activeSection, setActiveSection] = useState('dashboard')
	const [sidebarOpen, setSidebarOpen] = useState(true)
	const [notifications, setNotifications] = useState([])

	const sections = [
		{
			id: 'dashboard',
			label: 'System Monitor',
			icon: '🖥️',
			component: <SystemMonitor />,
		},
		{
			id: 'controls',
			label: 'System Controls',
			icon: '🛠️',
			component: <SystemControls />,
		},
		{
			id: 'metrics',
			label: 'Metrics Dashboard',
			icon: '📊',
			component: <MonitoringMetrics />,
		},
		{
			id: 'health',
			label: 'Component Health',
			icon: '❤️',
			component: <ComponentHealth />,
		},
		{
			id: 'api-health',
			label: 'API Health',
			icon: '🔌',
			component: <APIHealth />,
		},
		{
			id: 'cache',
			label: 'Cache Manager',
			icon: '💾',
			component: <CacheManagerUI />,
		},
		{
			id: 'broadcast',
			label: 'Broadcast State',
			icon: '📡',
			component: <BroadcastStateMonitor />,
		},
		{
			id: 'channels',
			label: 'Channels',
			icon: '📺',
			component: <ChannelManager />,
		},
		{
			id: 'videos',
			label: 'Video Fetcher',
			icon: '🎬',
			component: <VideoFetcher />,
		},
		{
			id: 'api',
			label: 'API Monitor',
			icon: '📋',
			component: <APIMonitor />,
		},
	]

	const addNotification = (message, type = 'info') => {
		const id = Date.now()
		setNotifications((prev) => [...prev, { id, message, type }])
		setTimeout(() => {
			setNotifications((prev) => prev.filter((n) => n.id !== id))
		}, 5000)
	}

	useEffect(() => {
		// Make addNotification available globally
		window.adminNotify = addNotification
	}, [])

	const activeComponent = sections.find((s) => s.id === activeSection)?.component

	return (
		<div className="admin-dashboard">
			{/* Sidebar */}
			<div className={`admin-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
				<div className="sidebar-header">
					<h1>🎛️ Admin</h1>
					<button
						className="sidebar-toggle"
						onClick={() => setSidebarOpen(!sidebarOpen)}
					>
						{sidebarOpen ? '◀' : '▶'}
					</button>
				</div>

				<nav className="sidebar-nav">
					{sections.map((section) => (
						<button
							key={section.id}
							className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
							onClick={() => setActiveSection(section.id)}
							title={section.label}
						>
							<span className="nav-icon">{section.icon}</span>
							{sidebarOpen && <span className="nav-label">{section.label}</span>}
						</button>
					))}
				</nav>

				<div className="sidebar-footer">
					<div className="status-indicator">
						<div className="status-dot online"></div>
						<span>Online</span>
					</div>
				</div>
			</div>

			{/* Main Content */}
			<div className="admin-content">
				{/* Top Bar */}
				<div className="admin-topbar">
					<div className="topbar-left">
						<h2>{sections.find((s) => s.id === activeSection)?.label}</h2>
					</div>
					<div className="topbar-right">
						<div className="time-display">
							{new Date().toLocaleTimeString()}
						</div>
					</div>
				</div>

				{/* Content Area */}
				<div className="admin-main">{activeComponent}</div>

				{/* Notifications */}
				<div className="notifications">
					{notifications.map((notif) => (
						<div key={notif.id} className={`notification ${notif.type}`}>
							{notif.message}
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
