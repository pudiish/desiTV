import React, { useEffect, useRef, useState } from 'react'

export default function BlueRaysEffect({ isFullscreen, volume = 0.5 }) {
	const canvasRef = useRef(null)
	const animationRef = useRef(null)
	const [dominantColor, setDominantColor] = useState({ r: 74, g: 158, b: 255 })

	useEffect(() => {
		if (!isFullscreen || !canvasRef.current) return

		const canvas = canvasRef.current
		const ctx = canvas.getContext('2d', { willReadFrequently: true })

		// Get container dimensions
		const container = canvas.parentElement
		if (!container) return

		canvas.width = container.clientWidth
		canvas.height = container.clientHeight

		// HSL to RGB conversion
		const hslToRgb = (h, s, l) => {
			s = s / 100
			l = l / 100
			const k = n => (n + h / 30) % 12
			const a = s * Math.min(l, 1 - l)
			const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
			return {
				r: Math.round(255 * f(0)),
				g: Math.round(255 * f(8)),
				b: Math.round(255 * f(4))
			}
		}

		const updateColor = () => {
			const time = Date.now() / 15000
			const hue = (time % 1) * 360
			setDominantColor(hslToRgb(hue, 85, 60))
		}

		const colorInterval = setInterval(updateColor, 3000)

		const handleResize = () => {
			canvas.width = container.clientWidth
			canvas.height = container.clientHeight
		}

		window.addEventListener('resize', handleResize)

		// Create off-screen buffer for bloom effect
		const bloomCanvas = document.createElement('canvas')
		bloomCanvas.width = canvas.width
		bloomCanvas.height = canvas.height
		const bloomCtx = bloomCanvas.getContext('2d')

		// Simple box blur for better performance
		const simpleBlur = (ctx, x, y, width, height, radius) => {
			const imageData = ctx.getImageData(x, y, width, height)
			const data = imageData.data
			const w = width
			const h = height

			// Horizontal pass
			for (let i = 0; i < h; i++) {
				for (let j = 0; j < w; j++) {
					let r = 0, g = 0, b = 0, a = 0, count = 0

					for (let k = -radius; k <= radius; k++) {
						const idx = (i * w + Math.max(0, Math.min(w - 1, j + k))) * 4
						r += data[idx]
						g += data[idx + 1]
						b += data[idx + 2]
						a += data[idx + 3]
						count++
					}

					const outIdx = (i * w + j) * 4
					data[outIdx] = r / count
					data[outIdx + 1] = g / count
					data[outIdx + 2] = b / count
					data[outIdx + 3] = a / count
				}
			}

			ctx.putImageData(imageData, x, y)
		}

		// Animation loop
		const animate = () => {
			ctx.clearRect(0, 0, canvas.width, canvas.height)
			bloomCtx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height)

			const time = Date.now() / 1000
			const pulse = 0.8 + Math.sin(time * 0.7) * 0.2
			const baseIntensity = 0.35 + volume * 0.35
			const w = canvas.width
			const h = canvas.height

			// Draw bright core on bloom canvas for blur
			const centerX = w / 2
			const centerY = h / 2
			const screenRadius = Math.min(w, h) * 0.25

			// Create main bloom source with exponential falloff
			const bloomGradient = bloomCtx.createRadialGradient(
				centerX, centerY, 0,
				centerX, centerY, screenRadius * 2.5
			)
			bloomGradient.addColorStop(0, `rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, ${baseIntensity * 0.9 * pulse})`)
			bloomGradient.addColorStop(0.2, `rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, ${baseIntensity * 0.7})`)
			bloomGradient.addColorStop(0.4, `rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, ${baseIntensity * 0.4})`)
			bloomGradient.addColorStop(0.7, `rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, ${baseIntensity * 0.15})`)
			bloomGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
			bloomCtx.fillStyle = bloomGradient
			bloomCtx.fillRect(0, 0, w, h)

			// Apply multiple blur passes for smooth bloom
			for (let i = 0; i < 3; i++) {
				simpleBlur(bloomCtx, 0, 0, w, h, 15 + volume * 10)
			}

			// Copy blurred bloom to main canvas
			ctx.drawImage(bloomCanvas, 0, 0)

			// Add directional rays from edges (these create the "bleeding" effect)
			// These should be DARKER and fade inward, not outward from edges
			
			// Top edge - light fades INTO the screen
			const topRayGradient = ctx.createLinearGradient(0, 0, 0, h * 0.2)
			topRayGradient.addColorStop(0, `rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, ${baseIntensity * 0.2})`)
			topRayGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
			ctx.fillStyle = topRayGradient
			ctx.fillRect(0, 0, w, h * 0.2)

			// Bottom edge
			const bottomRayGradient = ctx.createLinearGradient(0, h, 0, h * 0.8)
			bottomRayGradient.addColorStop(0, `rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, ${baseIntensity * 0.2})`)
			bottomRayGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
			ctx.fillStyle = bottomRayGradient
			ctx.fillRect(0, h * 0.8, w, h * 0.2)

			// Left edge
			const leftRayGradient = ctx.createLinearGradient(0, 0, w * 0.2, 0)
			leftRayGradient.addColorStop(0, `rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, ${baseIntensity * 0.2})`)
			leftRayGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
			ctx.fillStyle = leftRayGradient
			ctx.fillRect(0, 0, w * 0.2, h)

			// Right edge
			const rightRayGradient = ctx.createLinearGradient(w, 0, w * 0.8, 0)
			rightRayGradient.addColorStop(0, `rgba(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}, ${baseIntensity * 0.2})`)
			rightRayGradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
			ctx.fillStyle = rightRayGradient
			ctx.fillRect(w * 0.8, 0, w * 0.2, h)

			animationRef.current = requestAnimationFrame(animate)
		}

		animate()

		return () => {
			window.removeEventListener('resize', handleResize)
			clearInterval(colorInterval)
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current)
			}
		}
	}, [isFullscreen, volume])

	if (!isFullscreen) return null

	return (
		<canvas
			ref={canvasRef}
			className="blue-rays-canvas"
			style={{
				position: 'absolute',
				top: 0,
				left: 0,
				width: '100%',
				height: '100%',
				pointerEvents: 'none',
				zIndex: 1,
				background: 'transparent',
				mixBlendMode: 'screen'
			}}
		/>
	)
}
