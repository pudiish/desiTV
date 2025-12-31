import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import CacheManager from '../utils/CacheManager'
import './Landing.css'

export default function Landing() {
	const navigate = useNavigate()
	const [isLoading, setIsLoading] = useState(false)
	const [cleanupComplete, setCleanupComplete] = useState(false)
	const [hoveredItem, setHoveredItem] = useState(null)
	const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })
	const [isHovering, setIsHovering] = useState(false)
	const canvasRef = useRef(null)
	const animationRef = useRef(null)
	const eyesRef = useRef([])
	const timeRef = useRef(0)

	// Track mouse position normalized 0-1
	const handleMouseMove = useCallback((e) => {
		const x = e.clientX / window.innerWidth
		const y = e.clientY / window.innerHeight
		setMousePos({ x, y })
	}, [])

	// Initialize floating eyes canvas
	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext('2d')
		let width = window.innerWidth
		let height = window.innerHeight

		const setSize = () => {
			width = window.innerWidth
			height = window.innerHeight
			canvas.width = width
			canvas.height = height
		}
		setSize()

		// Create floating eyes
		const createEyes = () => {
			eyesRef.current = []
			const eyeCount = Math.min(15, Math.floor((width * height) / 80000))
			
			for (let i = 0; i < eyeCount; i++) {
				eyesRef.current.push({
					x: Math.random() * width,
					y: Math.random() * height,
					size: 30 + Math.random() * 50,
					vx: (Math.random() - 0.5) * 0.5,
					vy: (Math.random() - 0.5) * 0.5,
					blinkTimer: Math.random() * 500,
					blinkState: 0, // 0 = open, 1 = closing, 2 = closed, 3 = opening
					pupilOffset: { x: 0, y: 0 },
					hue: Math.random() * 60 + 20, // Gold-amber range
				})
			}
		}
		createEyes()

		// Animation
		let lastTime = 0
		const animate = (timestamp) => {
			const dt = Math.min(timestamp - lastTime, 50)
			lastTime = timestamp
			timeRef.current += dt * 0.001

			// Clear with fade trail
			ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'
			ctx.fillRect(0, 0, width, height)

			// Get normalized mouse position
			const mx = mousePos.x * width
			const my = mousePos.y * height

			eyesRef.current.forEach((eye) => {
				// Float movement
				eye.x += eye.vx + Math.sin(timeRef.current + eye.size) * 0.3
				eye.y += eye.vy + Math.cos(timeRef.current * 0.7 + eye.size) * 0.3

				// Wrap around screen
				if (eye.x < -eye.size) eye.x = width + eye.size
				if (eye.x > width + eye.size) eye.x = -eye.size
				if (eye.y < -eye.size) eye.y = height + eye.size
				if (eye.y > height + eye.size) eye.y = -eye.size

				// Blink logic
				eye.blinkTimer -= dt
				if (eye.blinkTimer <= 0) {
					if (eye.blinkState === 0) {
						eye.blinkState = 1
						eye.blinkTimer = 80
					} else if (eye.blinkState === 1) {
						eye.blinkState = 2
						eye.blinkTimer = 50
					} else if (eye.blinkState === 2) {
						eye.blinkState = 3
						eye.blinkTimer = 80
					} else {
						eye.blinkState = 0
						eye.blinkTimer = 2000 + Math.random() * 4000
					}
				}

				// Pupil follows mouse
				const dx = mx - eye.x
				const dy = my - eye.y
				const dist = Math.sqrt(dx * dx + dy * dy)
				const maxPupilMove = eye.size * 0.2
				const targetX = (dx / (dist + 100)) * maxPupilMove
				const targetY = (dy / (dist + 100)) * maxPupilMove
				eye.pupilOffset.x += (targetX - eye.pupilOffset.x) * 0.1
				eye.pupilOffset.y += (targetY - eye.pupilOffset.y) * 0.1

				// Calculate blink squish
				let blinkSquish = 1
				if (eye.blinkState === 1) blinkSquish = 1 - (80 - eye.blinkTimer) / 80
				else if (eye.blinkState === 2) blinkSquish = 0.1
				else if (eye.blinkState === 3) blinkSquish = eye.blinkTimer / 80

				// Draw eye
				ctx.save()
				ctx.translate(eye.x, eye.y)

				// Outer glow
				const glowGrad = ctx.createRadialGradient(0, 0, eye.size * 0.3, 0, 0, eye.size * 1.5)
				glowGrad.addColorStop(0, `hsla(${eye.hue}, 70%, 50%, 0.2)`)
				glowGrad.addColorStop(1, 'transparent')
				ctx.fillStyle = glowGrad
				ctx.beginPath()
				ctx.arc(0, 0, eye.size * 1.5, 0, Math.PI * 2)
				ctx.fill()

				// Eye white (sclera)
				ctx.scale(1, blinkSquish)
				const scleraGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, eye.size)
				scleraGrad.addColorStop(0, '#fff')
				scleraGrad.addColorStop(0.7, '#f5f0e8')
				scleraGrad.addColorStop(1, '#d4c4b0')
				ctx.fillStyle = scleraGrad
				ctx.beginPath()
				ctx.ellipse(0, 0, eye.size, eye.size * 0.7, 0, 0, Math.PI * 2)
				ctx.fill()

				// Iris
				if (blinkSquish > 0.2) {
					const irisSize = eye.size * 0.45
					const irisGrad = ctx.createRadialGradient(
						eye.pupilOffset.x, eye.pupilOffset.y, 0,
						eye.pupilOffset.x, eye.pupilOffset.y, irisSize
					)
					irisGrad.addColorStop(0, `hsl(${eye.hue + 20}, 60%, 35%)`)
					irisGrad.addColorStop(0.5, `hsl(${eye.hue}, 70%, 25%)`)
					irisGrad.addColorStop(1, `hsl(${eye.hue - 10}, 80%, 15%)`)
					ctx.fillStyle = irisGrad
					ctx.beginPath()
					ctx.arc(eye.pupilOffset.x, eye.pupilOffset.y, irisSize, 0, Math.PI * 2)
					ctx.fill()

					// Pupil
					const pupilSize = irisSize * 0.5
					ctx.fillStyle = '#000'
					ctx.beginPath()
					ctx.arc(eye.pupilOffset.x, eye.pupilOffset.y, pupilSize, 0, Math.PI * 2)
					ctx.fill()

					// Highlight
					ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
					ctx.beginPath()
					ctx.arc(
						eye.pupilOffset.x - pupilSize * 0.3,
						eye.pupilOffset.y - pupilSize * 0.3,
						pupilSize * 0.3,
						0, Math.PI * 2
					)
					ctx.fill()
				}

				// Eyelid shadow
				ctx.fillStyle = `rgba(20, 15, 10, ${0.3 * (1 - blinkSquish)})`
				ctx.beginPath()
				ctx.ellipse(0, 0, eye.size, eye.size * 0.7, 0, 0, Math.PI * 2)
				ctx.fill()

				ctx.restore()
			})

			animationRef.current = requestAnimationFrame(animate)
		}

		animationRef.current = requestAnimationFrame(animate)

		const handleResize = () => {
			setSize()
			createEyes()
		}
		window.addEventListener('resize', handleResize)
		window.addEventListener('mousemove', handleMouseMove)

		return () => {
			if (animationRef.current) cancelAnimationFrame(animationRef.current)
			window.removeEventListener('resize', handleResize)
			window.removeEventListener('mousemove', handleMouseMove)
		}
	}, [mousePos.x, mousePos.y, handleMouseMove])

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
		<div className="landing-container" onMouseMove={handleMouseMove}>
			{/* Animated Eyes Background */}
			<canvas ref={canvasRef} className="eyes-canvas" />
			
			{/* Gradient Overlay */}
			<div className="landing-overlay" />

			<div className="landing-content-single">
				{/* Hero */}
				<div className="landing-hero">
					<h1 className="hero-title glitch" data-text="DesiTV™">DesiTV™</h1>
					<p className="hero-subtitle">Purana Zamana, Naya Andaaz</p>
					<p className="hero-tagline">🎬 Retro Indian Entertainment</p>
				</div>

				{/* Features - Minimal */}
				<div className="features-minimal">
					<div 
						className="feature-badge"
						onMouseEnter={() => { setHoveredItem('free'); setIsHovering(true) }}
						onMouseLeave={() => { setHoveredItem(null); setIsHovering(false) }}
					>
						<span>MUFT MEIN</span>
						{hoveredItem === 'free' && <div className="tooltip">Bilkul free, koi subscription nahi</div>}
					</div>
					<div 
						className="feature-badge"
						onMouseEnter={() => { setHoveredItem('live'); setIsHovering(true) }}
						onMouseLeave={() => { setHoveredItem(null); setIsHovering(false) }}
					>
						<span>24/7 LIVE</span>
						{hoveredItem === 'live' && <div className="tooltip">Din raat non-stop entertainment</div>}
					</div>
					<div 
						className="feature-badge"
						onMouseEnter={() => { setHoveredItem('desi'); setIsHovering(true) }}
						onMouseLeave={() => { setHoveredItem(null); setIsHovering(false) }}
					>
						<span>FULL DESI</span>
						{hoveredItem === 'desi' && <div className="tooltip">Bollywood, Indie, Classics sab kuch</div>}
					</div>
				</div>

				{/* CTA */}
				<div className="landing-cta">
					<button
						className={`tv-button ${isLoading ? 'loading' : ''}`}
						onClick={handleEnterTV}
						disabled={isLoading}
						onMouseEnter={() => setIsHovering(true)}
						onMouseLeave={() => setIsHovering(false)}
					>
						{isLoading ? (
							<>
								<span className="loader"></span>
								{cleanupComplete ? 'CHALO...' : 'TAIYAAR HO RAHE HAIN...'}
							</>
						) : (
							<>👁️ TUNE KARO</>
						)}
					</button>
				</div>

				{/* Controls Hint */}
				<div className="controls-hint">
					<div className="hint-item">
						<kbd>↑</kbd><kbd>↓</kbd> <span>Channel Badlo</span>
					</div>
					<div className="hint-item">
						<kbd>←</kbd><kbd>→</kbd> <span>Volume</span>
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
					<a href="https:// github.com/pudiish/desiTV" target="_blank" rel="noopener noreferrer">GitHub</a>
					<span>•</span>
					<a href="https:// www.linkedin.com/in/ishwar-swarnapudi" target="_blank" rel="noopener noreferrer">LinkedIn</a>
					<span>•</span>
					<span>© 2025</span>
				</div>
			</div>
		</div>
	)
}
