import React, { useEffect, useRef, useState, useCallback } from 'react'

/**
 * AmbientGlow - YouTube-style ambient mode
 * Creates a blurred glow effect behind the TV that matches video colors
 */
export default function AmbientGlow({ power, isBuffering, staticActive }) {
	const canvasRef = useRef(null)
	const animationRef = useRef(null)
	const [colors, setColors] = useState({
		tl: '#1a1a3a',
		tr: '#2a1a3a', 
		bl: '#1a2a3a',
		br: '#2a2a4a',
		center: '#252540'
	})

	// Generate dynamic colors based on time (simulating video content)
	const updateColors = useCallback(() => {
		if (!power || staticActive) return

		const time = Date.now() / 4000 // Slow color shift
		const hue1 = (time * 40) % 360
		const hue2 = (hue1 + 45) % 360
		const hue3 = (hue1 + 90) % 360
		const hue4 = (hue1 + 135) % 360

		// Create rich, saturated colors
		const sat = 50 + Math.sin(time) * 15
		const light = 35 + Math.sin(time * 0.7) * 10

		setColors({
			tl: `hsl(${hue1}, ${sat}%, ${light}%)`,
			tr: `hsl(${hue2}, ${sat}%, ${light}%)`,
			bl: `hsl(${hue3}, ${sat}%, ${light}%)`,
			br: `hsl(${hue4}, ${sat}%, ${light}%)`,
			center: `hsl(${hue1}, ${sat + 10}%, ${light + 5}%)`
		})
	}, [power, staticActive])

	// Static noise colors during buffering
	useEffect(() => {
		if (isBuffering || staticActive) {
			const interval = setInterval(() => {
				const gray = () => Math.floor(60 + Math.random() * 40)
				setColors({
					tl: `rgb(${gray()}, ${gray()}, ${gray()})`,
					tr: `rgb(${gray()}, ${gray()}, ${gray()})`,
					bl: `rgb(${gray()}, ${gray()}, ${gray()})`,
					br: `rgb(${gray()}, ${gray()}, ${gray()})`,
					center: `rgb(${gray()}, ${gray()}, ${gray()})`
				})
			}, 100)
			return () => clearInterval(interval)
		}
	}, [isBuffering, staticActive])

	// Animation loop
	useEffect(() => {
		if (!power) return

		const animate = () => {
			updateColors()
			animationRef.current = requestAnimationFrame(animate)
		}

		// Throttle to ~15fps for performance
		const interval = setInterval(() => {
			updateColors()
		}, 66)

		return () => {
			clearInterval(interval)
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current)
			}
		}
	}, [power, updateColors])

	if (!power) return null

	return (
		<div 
			className="ambient-glow-wrapper"
			style={{
				position: 'absolute',
				top: '0',
				left: '50%',
				transform: 'translateX(-50%)',
				width: '100%',
				maxWidth: '900px',
				aspectRatio: '16/10',
				zIndex: 0,
				pointerEvents: 'none',
			}}
		>
			{/* Main glow layer - large blur */}
			<div
				style={{
					position: 'absolute',
					top: '-60px',
					left: '-60px',
					right: '-60px',
					bottom: '-60px',
					background: `
						conic-gradient(
							from 0deg at 50% 50%,
							${colors.tl},
							${colors.tr},
							${colors.br},
							${colors.bl},
							${colors.tl}
						)
					`,
					filter: 'blur(60px)',
					opacity: 0.85,
					borderRadius: '30px',
					transition: 'background 0.3s ease-out',
				}}
			/>

			{/* Secondary glow - extra blur for bloom */}
			<div
				style={{
					position: 'absolute',
					top: '-80px',
					left: '-80px',
					right: '-80px',
					bottom: '-80px',
					background: `
						radial-gradient(ellipse at 25% 25%, ${colors.tl}, transparent 50%),
						radial-gradient(ellipse at 75% 25%, ${colors.tr}, transparent 50%),
						radial-gradient(ellipse at 25% 75%, ${colors.bl}, transparent 50%),
						radial-gradient(ellipse at 75% 75%, ${colors.br}, transparent 50%)
					`,
					filter: 'blur(80px)',
					opacity: 0.7,
					borderRadius: '40px',
					transition: 'background 0.3s ease-out',
				}}
			/>

			{/* Center glow - brighter focus */}
			<div
				style={{
					position: 'absolute',
					top: '-40px',
					left: '-40px',
					right: '-40px',
					bottom: '-40px',
					background: `radial-gradient(ellipse at center, ${colors.center}, transparent 70%)`,
					filter: 'blur(50px)',
					opacity: 0.6,
					borderRadius: '20px',
					transition: 'background 0.3s ease-out',
				}}
			/>

			{/* Outer bloom for light spill */}
			<div
				style={{
					position: 'absolute',
					top: '-100px',
					left: '-100px',
					right: '-100px',
					bottom: '-100px',
					background: `radial-gradient(ellipse at center, ${colors.center}66, transparent 60%)`,
					filter: 'blur(100px)',
					opacity: 0.5,
					borderRadius: '50px',
					transition: 'background 0.5s ease-out',
				}}
			/>
		</div>
	)
}
