import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './AdminDashboard.css'
import SystemMonitor from './sections/SystemMonitor'
import BroadcastStateMonitor from './sections/BroadcastStateMonitor'
import ChannelManager from './sections/ChannelManager'
import VideoFetcher from './sections/VideoFetcher'
import VideoManager from './sections/VideoManager'
import APIMonitor from './sections/APIMonitor'
import APIHealth from './sections/APIHealth'
import CacheManagerUI from './sections/CacheManagerUI'
import ComponentHealth from './sections/ComponentHealth'
import MonitoringMetrics from './sections/MonitoringMetrics'
import SystemControls from './sections/SystemControls'

export default function AdminDashboard() {
	const navigate = useNavigate()
	const [activeSection, setActiveSection] = useState('videos-channels')
	const [notifications, setNotifications] = useState([])
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
	const [currentTime, setCurrentTime] = useState(new Date())

	// Update time every second
	useEffect(() => {
		const timer = setInterval(() => setCurrentTime(new Date()), 1000)
		return () => clearInterval(timer)
	}, [])

	const sections = [
		// Content Management
		{
			id: 'videos-channels',
			label: 'Add Videos',
			icon: '📹',
			component: <VideoManager />,
			category: 'Content',
			description: 'Add new videos to channels'
		},
		{
			id: 'channels',
			label: 'Channels',
			icon: '📺',
			component: <ChannelManager />,
			category: 'Content',
			description: 'Manage TV channels'
		},
		// Monitoring
		{
			id: 'dashboard',
			label: 'System',
			icon: '🖥️',
			component: <SystemMonitor />,
			category: 'Monitoring',
			description: 'System overview'
		},
		{
			id: 'broadcast',
			label: 'Broadcast',
			icon: '📡',
			component: <BroadcastStateMonitor />,
			category: 'Monitoring',
			description: 'Broadcast state'
		},
		{
			id: 'metrics',
			label: 'Metrics',
			icon: '📊',
			component: <MonitoringMetrics />,
			category: 'Monitoring',
			description: 'Performance metrics'
		},
		// Health
		{
			id: 'health',
			label: 'Components',
			icon: '❤️',
			component: <ComponentHealth />,
			category: 'Health',
			description: 'Component health'
		},
		{
			id: 'api-health',
			label: 'API Status',
			icon: '🔌',
			component: <APIHealth />,
			category: 'Health',
			description: 'API health check'
		},
		{
			id: 'api',
			label: 'API Logs',
			icon: '📋',
			component: <APIMonitor />,
			category: 'Health',
			description: 'API request logs'
		},
		// Tools
		{
			id: 'controls',
			label: 'Controls',
			icon: '🛠️',
			component: <SystemControls />,
			category: 'Tools',
			description: 'System controls'
		},
		{
			id: 'cache',
			label: 'Cache',
			icon: '💾',
			component: <CacheManagerUI />,
			category: 'Tools',
			description: 'Cache management'
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
		window.adminNotify = addNotification
	}, [])

	const activeComponent = sections.find((s) => s.id === activeSection)?.component
	const activeSectionData = sections.find((s) => s.id === activeSection)
	
	// Group sections by category
	const categories = ['Content', 'Monitoring', 'Health', 'Tools']
	const groupedSections = categories.reduce((acc, cat) => {
		acc[cat] = sections.filter(s => s.category === cat)
		return acc
	}, {})

	const categoryIcons = {
		'Content': '📁',
		'Monitoring': '📈',
		'Health': '🏥',
		'Tools': '🔧'
	}

	return (
		<div className={`admin-dashboard ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
			{/* Sidebar */}
			<aside className="admin-sidebar">
				<div className="sidebar-header">
					<div className="logo-section">
						<span className="logo-icon">🎛️</span>
						{!sidebarCollapsed && <span className="logo-text">DesiTV Admin</span>}
					</div>
					<button 
						className="sidebar-toggle"
						onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
						title={sidebarCollapsed ? 'Expand' : 'Collapse'}
					>
						{sidebarCollapsed ? '→' : '←'}
					</button>
				</div>

				<nav className="sidebar-nav">
					{categories.map(category => (
						<div key={category} className="nav-category">
							{!sidebarCollapsed && (
								<div className="category-label">
									<span className="category-icon">{categoryIcons[category]}</span>
									{category}
								</div>
							)}
							<div className="category-items">
								{groupedSections[category].map(section => (
									<button
										key={section.id}
										className={`nav-item ${activeSection === section.id ? 'active' : ''}`}
										onClick={() => setActiveSection(section.id)}
										title={sidebarCollapsed ? section.label : section.description}
									>
										<span className="nav-icon">{section.icon}</span>
										{!sidebarCollapsed && (
											<span className="nav-label">{section.label}</span>
										)}
									</button>
								))}
							</div>
						</div>
					))}
				</nav>

				<div className="sidebar-footer">
					<div className="status-indicator">
						<span className="status-dot online"></span>
						{!sidebarCollapsed && <span>System Online</span>}
					</div>
				</div>
			</aside>

			{/* Main Content */}
			<main className="admin-main">
				{/* Top Bar */}
				<header className="admin-topbar">
					<div className="topbar-left">
						<h1 className="page-title">
							{activeSectionData?.icon} {activeSectionData?.label}
						</h1>
						<span className="page-description">{activeSectionData?.description}</span>
					</div>
					<div className="topbar-right">
						<div className="time-display">
							{currentTime.toLocaleTimeString()}
						</div>
					</div>
				</header>

				{/* Content Area */}
				<div className="admin-content">
					{/* Notifications */}
					<div className="notifications-container">
						{notifications.map((notif) => (
							<div key={notif.id} className={`notification ${notif.type}`}>
								{notif.message}
								<button 
									className="notification-close"
									onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
								>
									×
								</button>
							</div>
						))}
					</div>

					{/* Active Section */}
					<div className="section-wrapper">
						{activeComponent}
					</div>
				</div>
			</main>
		</div>
	)
}
