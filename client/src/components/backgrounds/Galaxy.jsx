/**
 * Galaxy Background Component - VIDEO COLOR REACTIVE 🎨
 * Colors extracted from current video thumbnail
 * - Samples dominant colors from YouTube thumbnail
 * - Smooth 3-second transitions between palettes
 * - Organic flowing particle movement
 */
import React, { useRef, useEffect, useState } from 'react'
import './Galaxy.css'

const Galaxy = ({ 
  isActive = true, 
  baseSpeed = 0.3, 
  density = 200, 
  volume = 0.5, 
  isPlaying = false, 
  isBuffering = false,
  videoId = null 
}) => {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const particlesRef = useRef([])
  const timeRef = useRef(0)
  const intensityRef = useRef(0)
  
  // Color palette state - current and target for smooth transitions
  const currentColorsRef = useRef([
    { r: 100, g: 100, b: 180 },
    { r: 150, g: 100, b: 200 },
    { r: 80, g: 120, b: 200 },
    { r: 120, g: 80, b: 160 },
    { r: 100, g: 150, b: 220 },
  ])
  const targetColorsRef = useRef([...currentColorsRef.current])
  const colorTransitionRef = useRef(1) // 0 = transitioning, 1 = complete

  // Extract colors from video thumbnail
  useEffect(() => {
    if (!videoId) return

    const extractColors = async () => {
      try {
        // Try maxresdefault first, fallback to hqdefault
        const urls = [
          `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        ]

        const img = new Image()
        img.crossOrigin = 'anonymous'
        
        let loaded = false
        for (const url of urls) {
          try {
            await new Promise((resolve, reject) => {
              img.onload = () => {
                // Check if it's a valid thumbnail (not the default gray placeholder)
                if (img.width > 100) {
                  loaded = true
                  resolve()
                } else {
                  reject()
                }
              }
              img.onerror = reject
              img.src = url
            })
            if (loaded) break
          } catch {
            continue
          }
        }

        if (!loaded) return

        // Create canvas to sample colors
        const sampleCanvas = document.createElement('canvas')
        const sampleCtx = sampleCanvas.getContext('2d')
        const sampleSize = 50
        sampleCanvas.width = sampleSize
        sampleCanvas.height = sampleSize
        sampleCtx.drawImage(img, 0, 0, sampleSize, sampleSize)

        const imageData = sampleCtx.getImageData(0, 0, sampleSize, sampleSize)
        const pixels = imageData.data

        // Sample colors and find dominant ones
        const colorBuckets = {}
        const bucketSize = 32 // Group similar colors

        for (let i = 0; i < pixels.length; i += 16) { // Sample every 4th pixel
          const r = Math.floor(pixels[i] / bucketSize) * bucketSize
          const g = Math.floor(pixels[i + 1] / bucketSize) * bucketSize
          const b = Math.floor(pixels[i + 2] / bucketSize) * bucketSize
          
          // Skip very dark or very light colors
          const brightness = (r + g + b) / 3
          if (brightness < 30 || brightness > 240) continue
          
          // Skip gray colors (low saturation)
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          if (max - min < 30) continue

          const key = `${r},${g},${b}`
          colorBuckets[key] = (colorBuckets[key] || 0) + 1
        }

        // Sort by frequency and get top colors
        const sortedColors = Object.entries(colorBuckets)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([key]) => {
            const [r, g, b] = key.split(',').map(Number)
            // Boost saturation slightly for more vibrant effect
            const avg = (r + g + b) / 3
            return {
              r: Math.min(255, Math.round(r + (r - avg) * 0.3)),
              g: Math.min(255, Math.round(g + (g - avg) * 0.3)),
              b: Math.min(255, Math.round(b + (b - avg) * 0.3)),
            }
          })

        if (sortedColors.length >= 3) {
          // Pad to 5 colors if needed
          while (sortedColors.length < 5) {
            sortedColors.push(sortedColors[sortedColors.length % sortedColors.length])
          }
          targetColorsRef.current = sortedColors.slice(0, 5)
          colorTransitionRef.current = 0 // Start transition
        }
      } catch (err) {
        console.log('[Galaxy] Could not extract colors:', err)
      }
    }

    extractColors()
  }, [videoId])

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

    // Noise function for organic movement
    const noise = (x, y, t) => {
      const n1 = Math.sin(x * 0.01 + t) * Math.cos(y * 0.01 + t * 0.7)
      const n2 = Math.sin(x * 0.02 - t * 0.5) * Math.sin(y * 0.015 + t * 0.3)
      const n3 = Math.cos(x * 0.008 + y * 0.008 + t * 0.2)
      return (n1 + n2 + n3) / 3
    }

    // Lerp helper
    const lerp = (a, b, t) => a + (b - a) * t
    const lerpColor = (c1, c2, t) => ({
      r: Math.round(lerp(c1.r, c2.r, t)),
      g: Math.round(lerp(c1.g, c2.g, t)),
      b: Math.round(lerp(c1.b, c2.b, t))
    })

    // Get interpolated color from current palette
    const getColor = (phase) => {
      const colors = currentColorsRef.current
      const p = (phase % 1) * colors.length
      const i1 = Math.floor(p) % colors.length
      const i2 = (i1 + 1) % colors.length
      const t = p - Math.floor(p)
      return lerpColor(colors[i1], colors[i2], t * t * (3 - 2 * t))
    }

    // Create particles
    const createParticles = () => {
      particlesRef.current = []
      for (let i = 0; i < density; i++) {
        const angle = Math.random() * Math.PI * 2
        const dist = Math.pow(Math.random(), 0.5) * Math.max(width, height) * 0.6
        
        particlesRef.current.push({
          x: width / 2 + Math.cos(angle) * dist,
          y: height / 2 + Math.sin(angle) * dist,
          baseX: width / 2 + Math.cos(angle) * dist,
          baseY: height / 2 + Math.sin(angle) * dist,
          size: 1 + Math.random() * 3,
          phaseX: Math.random() * 1000,
          phaseY: Math.random() * 1000,
          phaseSize: Math.random() * Math.PI * 2,
          phaseColor: Math.random(),
          speedMult: 0.3 + Math.random() * 0.7,
          driftAngle: Math.random() * Math.PI * 2,
          driftSpeed: 0.1 + Math.random() * 0.3,
          orbitRadius: 20 + Math.random() * 80,
          orbitSpeed: 0.0005 + Math.random() * 0.002,
          orbitPhase: Math.random() * Math.PI * 2,
        })
      }
    }
    createParticles()

    // Animation
    let lastTime = 0
    const animate = (timestamp) => {
      const dt = Math.min(timestamp - lastTime, 50)
      lastTime = timestamp

      if (!isActive) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      // Smooth color palette transition (~3 seconds)
      if (colorTransitionRef.current < 1) {
        colorTransitionRef.current = Math.min(1, colorTransitionRef.current + dt * 0.0003)
        const t = colorTransitionRef.current * colorTransitionRef.current * (3 - 2 * colorTransitionRef.current) // Ease
        
        currentColorsRef.current = currentColorsRef.current.map((c, i) => 
          lerpColor(c, targetColorsRef.current[i], t * 0.05) // Slow lerp each frame
        )
      }

      const speedMult = isPlaying ? (0.3 + volume * 0.7) : 0.15
      timeRef.current += dt * 0.0008 * speedMult

      // Intensity builds over ~30 second cycle
      const cyclePhase = (timeRef.current % 30) / 30
      const targetIntensity = Math.pow(Math.sin(cyclePhase * Math.PI), 0.7)
      intensityRef.current += (targetIntensity + (isPlaying ? volume * 0.3 : 0) - intensityRef.current) * 0.01

      const t = timeRef.current
      const intensity = intensityRef.current
      const cx = width / 2
      const cy = height / 2

      // Soft fade
      const fadeAmount = 0.02 + (1 - intensity) * 0.04
      ctx.fillStyle = `rgba(5, 5, 15, ${fadeAmount})`
      ctx.fillRect(0, 0, width, height)

      // Background glow with current colors
      const bgColor = getColor(t * 0.02)
      const bgBreath = Math.sin(t * 0.3) * 0.5 + 0.5
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.7)
      bgGrad.addColorStop(0, `rgba(${bgColor.r}, ${bgColor.g}, ${bgColor.b}, ${0.08 * intensity * bgBreath})`)
      bgGrad.addColorStop(0.5, `rgba(${Math.floor(bgColor.r * 0.5)}, ${Math.floor(bgColor.g * 0.5)}, ${Math.floor(bgColor.b * 0.5)}, ${0.03 * intensity})`)
      bgGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, width, height)

      // Draw particles
      particlesRef.current.forEach((p) => {
        const noiseX = noise(p.baseX + p.phaseX, p.baseY, t * p.speedMult) * 100 * (0.5 + intensity * 0.5)
        const noiseY = noise(p.baseX, p.baseY + p.phaseY, t * p.speedMult * 1.1) * 100 * (0.5 + intensity * 0.5)
        
        const orbitAngle = t * p.orbitSpeed * 100 + p.orbitPhase
        const orbitX = Math.cos(orbitAngle) * p.orbitRadius * (0.3 + intensity * 0.7)
        const orbitY = Math.sin(orbitAngle) * p.orbitRadius * (0.3 + intensity * 0.7)
        
        const driftX = Math.cos(p.driftAngle) * t * p.driftSpeed * 10
        const driftY = Math.sin(p.driftAngle) * t * p.driftSpeed * 10

        p.x = p.baseX + noiseX + orbitX + driftX
        p.y = p.baseY + noiseY + orbitY + driftY

        // Wrap
        if (p.x < -100) p.baseX += width + 200
        if (p.x > width + 100) p.baseX -= width + 200
        if (p.y < -100) p.baseY += height + 200
        if (p.y > height + 100) p.baseY -= height + 200

        const sizeBreath = Math.sin(t * 0.5 + p.phaseSize) * 0.3 + 1
        const size = p.size * sizeBreath * (0.8 + intensity * 1.2)

        const colorPhase = (t * 0.05 + p.phaseColor) % 1
        const color = getColor(colorPhase)

        const distFromCenter = Math.sqrt(Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2))
        const maxDist = Math.max(width, height) * 0.7
        const distFade = 1 - Math.min(1, distFromCenter / maxDist)
        const opacity = (0.3 + intensity * 0.7) * distFade * (0.5 + sizeBreath * 0.5)

        const glowSize = size * (3 + intensity * 4)
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize)
        glow.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`)
        glow.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.4})`)
        glow.addColorStop(0.6, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.1})`)
        glow.addColorStop(1, 'transparent')
        
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2)
        ctx.fill()

        if (intensity > 0.5) {
          const coreOpacity = (intensity - 0.5) * 2 * opacity
          ctx.fillStyle = `rgba(255, 255, 255, ${coreOpacity * 0.5})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, size * 0.3, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      // Energy streams at high intensity
      if (intensity > 0.3) {
        for (let s = 0; s < 3; s++) {
          const streamPhase = t * 0.1 + s * (Math.PI * 2 / 3)
          const streamColor = getColor(t * 0.03 + s * 0.33)
          
          ctx.beginPath()
          ctx.strokeStyle = `rgba(${streamColor.r}, ${streamColor.g}, ${streamColor.b}, ${(intensity - 0.3) * 0.15})`
          ctx.lineWidth = 2 + intensity * 3
          ctx.lineCap = 'round'

          for (let p = 0; p < 50; p++) {
            const progress = p / 50
            const angle = streamPhase + progress * Math.PI * 4
            const radius = 50 + progress * Math.max(width, height) * 0.4
            const wobble = Math.sin(progress * 10 + t * 2 + s) * 30 * intensity
            
            const x = cx + Math.cos(angle) * (radius + wobble)
            const y = cy + Math.sin(angle) * (radius + wobble) * 0.6
            
            p === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
      }

      // Central glow
      const coreSize = 30 + intensity * 60
      const coreColor = getColor(t * 0.02)
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize * 3)
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.1 + intensity * 0.4})`)
      coreGrad.addColorStop(0.1, `rgba(${coreColor.r}, ${coreColor.g}, ${coreColor.b}, ${0.2 + intensity * 0.3})`)
      coreGrad.addColorStop(0.4, `rgba(${coreColor.r}, ${coreColor.g}, ${coreColor.b}, ${intensity * 0.1})`)
      coreGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = coreGrad
      ctx.beginPath()
      ctx.arc(cx, cy, coreSize * 3, 0, Math.PI * 2)
      ctx.fill()

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    const handleResize = () => {
      setSize()
      createParticles()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [isActive, baseSpeed, density, isPlaying, volume])

  return (
    <canvas
      ref={canvasRef}
      className={`galaxy-canvas ${isActive ? 'active' : ''}`}
      aria-hidden="true"
    />
  )
}

export default Galaxy
