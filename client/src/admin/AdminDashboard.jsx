import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AdminDashboard.css'
import ChannelManager from './sections/ChannelManager'
import VideoFetcher from './sections/VideoFetcher'
import VideoManager from './sections/VideoManager'
import CacheManagerUI from './sections/CacheManagerUI'
import SystemControls from './sections/SystemControls'

export default function AdminDashboard() {
	const navigate = useNavigate()
	const { logout, user } = useAuth()
	const [activeSection, setActiveSection] = useState('videos-channels')
	const [notifications, setNotifications] = useState([])
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
	const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false)
	const [currentTime, setCurrentTime] = useState(new Date())

	const handleLogout = async () => {
		await logout()
		navigate('/admin/login', { replace: true })
	}

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
			description: 'Add YouTube videos to categories'
		},
		{
			id: 'channels',
			label: 'Categories',
			icon: '📂',
			component: <ChannelManager />,
			category: 'Content',
			description: 'Manage playlist categories'
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
	const categories = ['Content', 'Tools']
	const groupedSections = categories.reduce((acc, cat) => {
		acc[cat] = sections.filter(s => s.category === cat)
		return acc
	}, {})

	const categoryIcons = {
		'Content': '📁',
		'Tools': '🔧'
	}

	return (
		<div className={`admin-dashboard ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${mobileMenuOpen ? 'mobile-menu-open' : ''}`}>
			{/* Mobile Overlay */}
			{mobileMenuOpen && (
				<div 
					className="mobile-overlay"
					onClick={() => setMobileMenuOpen(false)}
				/>
			)}

			{/* Sidebar */}
			<aside className={`admin-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
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
										onClick={() => {
											setActiveSection(section.id)
											setMobileMenuOpen(false) // Close mobile menu on selection
										}}
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
						<button 
							className="mobile-menu-toggle"
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							aria-label="Toggle menu"
						>
							☰
						</button>
						<h1 className="page-title">
							{activeSectionData?.icon} {activeSectionData?.label}
						</h1>
						<span className="page-description">{activeSectionData?.description}</span>
					</div>
					<div className="topbar-right">
						<div className="time-display">
							{currentTime.toLocaleTimeString()}
						</div>
						<div className="mobile-user-menu">
							<button 
								className="mobile-dropdown-toggle"
								onClick={() => setMobileDropdownOpen(!mobileDropdownOpen)}
								aria-label="User menu"
							>
								👤 {user?.username || 'Admin'}
							</button>
							{mobileDropdownOpen && (
								<div className="mobile-dropdown-menu">
									<button
										className="mobile-dropdown-item"
										onClick={() => {
											navigate('/')
											setMobileDropdownOpen(false)
										}}
									>
										📺 TV
									</button>
									<button
										className="mobile-dropdown-item mobile-dropdown-item-danger"
										onClick={() => {
											handleLogout()
											setMobileDropdownOpen(false)
										}}
									>
										🚪 Logout
									</button>
								</div>
							)}
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
