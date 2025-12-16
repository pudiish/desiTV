import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CacheManager from '../utils/CacheManager'
import './Landing.css'

export default function Landing() {
	const navigate = useNavigate()
	const [isLoading, setIsLoading] = useState(false)
	const [cleanupComplete, setCleanupComplete] = useState(false)
	const [hoveredItem, setHoveredItem] = useState(null)

	const handleEnterTV = async () => {
		setIsLoading(true)
		console.log('[Landing] User entering TV...')

		try {
			// Clean caches before entering TV
			CacheManager.cleanupBeforeTV()
			setCleanupComplete(true)

			// Brief delay to show completion
			setTimeout(() => {
				console.log('[Landing] Navigating to TV...')
				navigate('/tv')
			}, 300)
		} catch (err) {
			console.error('[Landing] Error during cleanup:', err)
			// Still navigate even if cleanup fails
			setTimeout(() => navigate('/tv'), 1000)
		}
	}


	return (
		<div className="landing-container">
			<div className="landing-content-single">
				{/* Hero */}
				<div className="landing-hero">
					<h1 className="hero-title">DesiTV</h1>
					<p className="hero-subtitle">24/7 Indian Entertainment</p>
				</div>

				{/* Features - Minimal */}
				<div className="features-minimal">
					<div 
						className="feature-badge"
						onMouseEnter={() => setHoveredItem('free')}
						onMouseLeave={() => setHoveredItem(null)}
					>
						<span>FREE</span>
						{hoveredItem === 'free' && <div className="tooltip">No subscriptions, no payments</div>}
					</div>
					<div 
						className="feature-badge"
						onMouseEnter={() => setHoveredItem('live')}
						onMouseLeave={() => setHoveredItem(null)}
					>
						<span>LIVE</span>
						{hoveredItem === 'live' && <div className="tooltip">Continuous 24/7 broadcasts</div>}
					</div>
					<div 
						className="feature-badge"
						onMouseEnter={() => setHoveredItem('desi')}
						onMouseLeave={() => setHoveredItem(null)}
					>
						<span>DESI</span>
						{hoveredItem === 'desi' && <div className="tooltip">Indian movies, music, shows</div>}
					</div>
				</div>

				{/* CTA */}
				<div className="landing-cta">
					<button
						className={`tv-button ${isLoading ? 'loading' : ''}`}
						onClick={handleEnterTV}
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<span className="loader"></span>
								{cleanupComplete ? 'LOADING...' : 'PREPARING...'}
							</>
						) : (
							<>▶ TUNE IN</>
						)}
					</button>
				</div>

				{/* Controls Hint */}
				<div className="controls-hint">
					<div className="hint-item">
						<kbd>◄</kbd><kbd>►</kbd> <span>Channels</span>
					</div>
					<div className="hint-item">
						<kbd>+</kbd><kbd>-</kbd> <span>Volume</span>
					</div>
					<div className="hint-item">
						<kbd>ESC</kbd> <span>Menu</span>
					</div>
				</div>

				{/* Legal */}
				<div className="legal-section">
					<details className="legal-details">
						<summary>Disclaimer & Copyright</summary>
						<div className="legal-text">
							<p><strong>Content:</strong> For personal viewing only. Content sourced from public platforms.</p>
							<p><strong>Copyright:</strong> All media belongs to respective owners. Contact for takedown requests.</p>
							<p><strong>India:</strong> Compliant with IT Act 2000 & Copyright Act 1957. Personal, non-commercial use only.</p>
							<p><strong>Contact:</strong> <a href="mailto:legal@desitv.com">legal@desitv.com</a></p>
						</div>
					</details>
				</div>

				{/* Footer */}
				<div className="landing-footer">
					<a href="https://github.com/pudiish/desiTV" target="_blank" rel="noopener noreferrer">GitHub</a>
					<span>•</span>
					<a href="https://www.linkedin.com/in/ishwar-swarnapudi" target="_blank" rel="noopener noreferrer">LinkedIn</a>
					<span>•</span>
					<span>© 2025</span>
				</div>
			</div>
		</div>
	)
}
