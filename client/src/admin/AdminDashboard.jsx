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

	const sections = [
		// Content Management (Priority)
		{
			id: 'videos-channels',
			label: '📹 Videos & Channels',
			icon: '📹',
			component: <VideoManager />,
			category: 'Content'
		},
		{
			id: 'channels',
			label: '📺 Manage Channels',
			icon: '📺',
			component: <ChannelManager />,
			category: 'Content'
		},
		// System Monitoring
		{
			id: 'dashboard',
			label: '🖥️ System Monitor',
			icon: '🖥️',
			component: <SystemMonitor />,
			category: 'System'
		},
		{
			id: 'metrics',
			label: '📊 Metrics',
			icon: '📊',
			component: <MonitoringMetrics />,
			category: 'System'
		},
		{
			id: 'health',
			label: '❤️ Health',
			icon: '❤️',
			component: <ComponentHealth />,
			category: 'System'
		},
		// API & Infrastructure
		{
			id: 'api-health',
			label: '🔌 API Health',
			icon: '🔌',
			component: <APIHealth />,
			category: 'API'
		},
		{
			id: 'api',
			label: '📋 API Monitor',
			icon: '📋',
			component: <APIMonitor />,
			category: 'API'
		},
		// Broadcast & State
		{
			id: 'broadcast',
			label: '📡 Broadcast State',
			icon: '📡',
			component: <BroadcastStateMonitor />,
			category: 'Broadcast'
		},
		// Tools
		{
			id: 'controls',
			label: '🛠️ System Controls',
			icon: '🛠️',
			component: <SystemControls />,
			category: 'Tools'
		},
		{
			id: 'cache',
			label: '💾 Cache Manager',
			icon: '💾',
			component: <CacheManagerUI />,
			category: 'Tools'
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
	const groupedSections = sections.reduce((acc, section) => {
		if (!acc[section.category]) acc[section.category] = []
		acc[section.category].push(section)
		return acc
	}, {})

	return (
		<div className="admin-dashboard">
			<div className="dashboard-header">
				<h1 className="dashboard-logo">🎛️ DesiTV Admin</h1>
				<div className="section-tabs">
					{sections.map((section) => (
						<button
							key={section.id}
							className={`section-tab ${activeSection === section.id ? 'active' : ''}`}
							onClick={() => setActiveSection(section.id)}
							title={section.label}
						>
							{section.icon} {section.label}
						</button>
					))}
				</div>
			</div>

			<div className="dashboard-content">
				{/* Notifications */}
				{notifications.map((notif) => (
					<div key={notif.id} className={`alert alert-${notif.type}`}>
						{notif.message}
					</div>
				))}

				{/* Active Component */}
				{activeComponent}
			</div>
		</div>
	)
}
