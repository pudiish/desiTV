import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import CacheManager from '../utils/CacheManager'
import './Landing.css'

export default function Landing() {
	const navigate = useNavigate()
	const [isLoading, setIsLoading] = useState(false)
	const [cleanupComplete, setCleanupComplete] = useState(false)

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
			{/* Retro scanlines background */}
			<div className="landing-scanlines"></div>

			<div className="landing-content">
				{/* Logo/Title */}
				<div className="landing-header">
					<h1 className="retro-title">📺 RETRO TV</h1>
					<div className="title-glow"></div>
				</div>

				{/* Creator Info Section */}
				<div className="landing-info">
					<div className="info-card">
						<h2>Welcome to Retro TV</h2>

						<div className="info-section">
							<h3>✨ Created by</h3>
							<p className="creator-name">Ishwar Swarnapudi</p>
							<p className="creator-title">Full Stack Developer</p>
						</div>

						<div className="info-section">
							<h3>🎬 About This Project</h3>
							<p>
								A nostalgic pseudo-live TV broadcast application built with modern web technologies.
								Experience continuous video playback that never stops, just like a real TV channel.
							</p>
						</div>

						<div className="info-section">
							<h3>🛠️ Technology Stack</h3>
							<div className="tech-stack">
								<span className="tech-badge">React 18</span>
								<span className="tech-badge">Express.js</span>
								<span className="tech-badge">MongoDB</span>
								<span className="tech-badge">Vite</span>
								<span className="tech-badge">YouTube API</span>
							</div>
						</div>

						<div className="info-section">
							<h3>✨ Features</h3>
							<ul className="features-list">
								<li>🎥 Pseudo-live continuous broadcast timeline</li>
								<li>📱 Multi-channel support with smooth transitions</li>
								<li>💾 Session persistence with MongoDB</li>
								<li>🎨 Retro TV aesthetic with scanlines and CRT effects</li>
								<li>🔊 Dynamic audio and visual effects</li>
								<li>⚙️ Admin dashboard for channel management</li>
								<li>🌍 Responsive design for all devices</li>
							</ul>
						</div>

						<div className="info-section">
							<h3>🔗 Links</h3>
							<div className="links-container">
								<a
									href="https://github.com/pudiish/retro-tv-mern"
									target="_blank"
									rel="noopener noreferrer"
									className="info-link"
								>
									GitHub Repository
								</a>
								<a
									href="https://www.linkedin.com/in/ishwar-swarnapudi"
									target="_blank"
									rel="noopener noreferrer"
									className="info-link"
								>
									LinkedIn Profile
								</a>
								<a
									href="https://portfolio.example.com"
									target="_blank"
									rel="noopener noreferrer"
									className="info-link"
								>
									Portfolio
								</a>
							</div>
						</div>
					</div>
				</div>

				{/* Enter Button */}
				<div className="landing-action">
					<button
						className={`enter-button ${isLoading ? 'loading' : ''} ${
							cleanupComplete ? 'complete' : ''
						}`}
						onClick={handleEnterTV}
						disabled={isLoading}
					>
						{isLoading ? (
							<>
								<span className="loader"></span>
								{cleanupComplete ? 'Entering TV...' : 'Preparing...'}
							</>
						) : (
							<>
								<span className="button-icon">▶</span>
								Enter Retro TV
							</>
						)}
					</button>

					{isLoading && (
						<div className="cleanup-status">
							<p className="status-text">
								{cleanupComplete
									? '✓ Cache cleaned, loading TV...'
									: '⟳ Cleaning cache & preparing...'}
							</p>
						</div>
					)}
				</div>

				{/* Footer */}
				<div className="landing-footer">
					<p>🎬 Enjoy your retro TV experience! 📺</p>
					<p className="version">v1.0.0 • 2025</p>
				</div>
			</div>

			{/* Retro CRT effect */}
			<div className="landing-crt-effect"></div>
		</div>
	)
}
