import React, { useRef, useEffect } from 'react'
import { setupCanvas, lerp, lerpColor, toRgba, extractColors, createLoop, TAU, clamp } from './utils'
import './Galaxy.css'

/**
 * Jugnu (जुगनू) - Fireflies Background Effect
 * 
 * A mesmerizing bioluminescent firefly simulation that creates
 * a nostalgic Indian summer night atmosphere.
 * 
 * Features:
 * - Organic wandering movement with Perlin-like noise
 * - Soft glowing trails
 * - Music-reactive pulsing
 * - Color-adaptive from video thumbnails
 * - Ambient night atmosphere with fog
 */

// Simplex-like noise for organic movement
const permutation = []
for (let i = 0; i < 256; i++) permutation[i] = i
for (let i = 255; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [permutation[i], permutation[j]] = [permutation[j], permutation[i]]
}
const perm = [...permutation, ...permutation]

const fade = t => t * t * t * (t * (t * 6 - 15) + 10)
const grad = (hash, x, y) => {
  const h = hash & 3
  const u = h < 2 ? x : y
  const v = h < 2 ? y : x
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v)
}

const noise2D = (x, y) => {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  x -= Math.floor(x)
  y -= Math.floor(y)
  const u = fade(x)
  const v = fade(y)
  const A = perm[X] + Y
  const B = perm[X + 1] + Y
  return lerp(
    lerp(grad(perm[A], x, y), grad(perm[B], x - 1, y), u),
    lerp(grad(perm[A + 1], x, y - 1), grad(perm[B + 1], x - 1, y - 1), u),
    v
  )
}

const Jugnu = ({ 
  isActive = true, 
  baseSpeed = 0.3, 
  density = 60, 
  volume = 0.5, 
  isPlaying = false, 
  isBuffering = false,
  videoId = null 
}) => {
  const canvasRef = useRef(null)
  const firefliesRef = useRef([])
  const timeRef = useRef(0)
  const fogParticlesRef = useRef([])
  const loopRef = useRef(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  
  // Firefly colors - warm bioluminescent tones
  const baseGlowColor = useRef({ r: 180, g: 220, b: 80 }) // Yellow-green
  const accentColorRef = useRef({ r: 255, g: 200, b: 100 }) // Warm amber
  const currentColorsRef = useRef([
    { r: 180, g: 220, b: 80 },
    { r: 200, g: 230, b: 90 },
    { r: 160, g: 200, b: 70 },
    { r: 220, g: 240, b: 120 },
    { r: 255, g: 220, b: 100 },
  ])
  const targetColorsRef = useRef([...currentColorsRef.current])
  const colorTransitionRef = useRef(1)

  // Extract colors from video thumbnail
  useEffect(() => {
    if (!videoId) return
    extractColors(videoId).then(colors => {
      if (colors && colors.length >= 3) {
        // Transform extracted colors to warm firefly tones
        const warmColors = colors.map(c => ({
          r: Math.min(255, c.r + 50),
          g: Math.min(255, Math.max(c.g, c.r * 0.8)),
          b: Math.min(c.b, 100) // Keep blue low for warm glow
        }))
        while (warmColors.length < 5) warmColors.push(warmColors[warmColors.length % warmColors.length])
        targetColorsRef.current = warmColors.slice(0, 5)
        colorTransitionRef.current = 0
        
        // Update accent color based on dominant
        accentColorRef.current = {
          r: Math.min(255, colors[0].r + 80),
          g: Math.min(255, colors[0].g + 40),
          b: Math.min(150, colors[0].b)
        }
      }
    })
  }, [videoId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { ctx, width, height } = setupCanvas(canvas)
    sizeRef.current = { width, height }

    // Center of screen (where TV is)
    const cx = width / 2
    const cy = height / 2

    // Create fireflies that emerge from the center (TV screen)
    const createFirefly = (index, randomZ = true) => {
      // Random angle for outward direction
      const angle = Math.random() * TAU
      // Start near center with small offset
      const startOffset = 20 + Math.random() * 40
      
      // Z depth: 0 = at screen, 1 = fully emerged towards viewer
      const z = randomZ ? Math.random() : 0
      
      return {
        // Position relative to center
        x: cx + Math.cos(angle) * startOffset * (1 + z * 3),
        y: cy + Math.sin(angle) * startOffset * (1 + z * 3),
        // Depth (0 = at screen, 1 = close to viewer)
        z: z,
        // Outward direction
        angle: angle + (Math.random() - 0.5) * 0.5, // Slight variation
        outwardSpeed: 0.3 + Math.random() * 0.4, // Speed of emergence
        // Slight wandering
        wanderAngle: 0,
        wanderSpeed: Math.random() * 0.5,
        noiseOffset: Math.random() * 1000,
        // Realistic blink timing (like real fireflies)
        blinkTimer: Math.random() * 5,
        blinkInterval: 2 + Math.random() * 4,
        blinkDuration: 0.3 + Math.random() * 0.4,
        glowIntensity: 0,
        maxGlow: 0.7 + Math.random() * 0.3,
        // Appearance - base size (will scale with z)
        baseSize: 1.5 + Math.random() * 2,
        colorIndex: Math.floor(Math.random() * 5),
        // Trail
        trail: [],
        trailLength: 6 + Math.floor(Math.random() * 6),
      }
    }

    // Initialize fireflies
    const fireflyCount = Math.floor(density * (width * height / 1920000))
    firefliesRef.current = Array.from({ length: Math.max(30, fireflyCount) }, (_, i) => createFirefly(i))

    // Create fog particles
    const fogCount = Math.floor(density * 0.3 * (width * height / 1920000))
    fogParticlesRef.current = Array.from({ length: Math.max(10, fogCount) }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 100 + Math.random() * 200,
      alpha: 0.02 + Math.random() * 0.03,
      vx: (Math.random() - 0.5) * 0.2,
      vy: (Math.random() - 0.5) * 0.1,
    }))

    // Get interpolated color
    const getColor = (index, intensity = 1) => {
      const colors = currentColorsRef.current
      const c = colors[index % colors.length]
      return {
        r: Math.min(255, c.r * intensity),
        g: Math.min(255, c.g * intensity),
        b: Math.min(255, c.b * intensity),
      }
    }

    // Draw a single firefly with realistic glow - scales with depth (z)
    const drawFirefly = (ff) => {
      const intensity = ff.glowIntensity * ff.maxGlow
      if (intensity < 0.01) return // Don't draw if too dim
      
      const color = getColor(ff.colorIndex, 1)
      
      // Scale based on depth - closer (higher z) = larger
      const depthScale = 0.3 + ff.z * 1.5 // 0.3 at screen, 1.8 when close
      const size = ff.baseSize * depthScale
      
      // Depth affects alpha too - closer = more vivid
      const depthAlpha = 0.5 + ff.z * 0.5
      
      // Draw subtle trail when glowing
      if (ff.trail.length > 1 && intensity > 0.1) {
        ctx.beginPath()
        ctx.moveTo(ff.trail[0].x, ff.trail[0].y)
        for (let i = 1; i < ff.trail.length; i++) {
          ctx.lineTo(ff.trail[i].x, ff.trail[i].y)
        }
        const trailGradient = ctx.createLinearGradient(
          ff.trail[0].x, ff.trail[0].y,
          ff.x, ff.y
        )
        trailGradient.addColorStop(0, `rgba(${color.r},${color.g},${color.b},0)`)
        trailGradient.addColorStop(1, `rgba(${color.r},${color.g},${color.b},${intensity * depthAlpha * 0.25})`)
        ctx.strokeStyle = trailGradient
        ctx.lineWidth = size * 0.5
        ctx.lineCap = 'round'
        ctx.stroke()
      }

      // Outer glow (soft ambient) - larger when closer
      const glowSize = size * (6 + intensity * 12)
      const gradient = ctx.createRadialGradient(ff.x, ff.y, 0, ff.x, ff.y, glowSize)
      gradient.addColorStop(0, `rgba(${color.r},${color.g},${color.b},${intensity * depthAlpha * 0.9})`)
      gradient.addColorStop(0.15, `rgba(${color.r},${color.g},${color.b},${intensity * depthAlpha * 0.5})`)
      gradient.addColorStop(0.4, `rgba(${color.r},${color.g},${color.b},${intensity * depthAlpha * 0.15})`)
      gradient.addColorStop(1, 'rgba(0,0,0,0)')
      
      ctx.beginPath()
      ctx.arc(ff.x, ff.y, glowSize, 0, TAU)
      ctx.fillStyle = gradient
      ctx.fill()

      // Inner bright core (the actual firefly light)
      const coreSize = size * (1 + intensity * 0.5)
      const coreGradient = ctx.createRadialGradient(ff.x, ff.y, 0, ff.x, ff.y, coreSize)
      coreGradient.addColorStop(0, `rgba(255,255,220,${intensity * depthAlpha})`)
      coreGradient.addColorStop(0.4, `rgba(${color.r},${color.g},${color.b},${intensity * depthAlpha * 0.9})`)
      coreGradient.addColorStop(1, 'rgba(0,0,0,0)')
      
      ctx.beginPath()
      ctx.arc(ff.x, ff.y, coreSize, 0, TAU)
      ctx.fillStyle = coreGradient
      ctx.fill()
    }

    // Draw fog layer
    const drawFog = () => {
      fogParticlesRef.current.forEach(fog => {
        const gradient = ctx.createRadialGradient(fog.x, fog.y, 0, fog.x, fog.y, fog.size)
        gradient.addColorStop(0, `rgba(30,35,30,${fog.alpha})`)
        gradient.addColorStop(1, 'rgba(20,25,20,0)')
        ctx.beginPath()
        ctx.arc(fog.x, fog.y, fog.size, 0, TAU)
        ctx.fillStyle = gradient
        ctx.fill()
      })
    }

    // Animation loop
    loopRef.current = createLoop((dt, timestamp) => {
      const speedMult = isPlaying ? (1 + volume * 0.3) : 0.5
      const effectiveSpeed = baseSpeed * speedMult
      timeRef.current += dt

      // Color transition
      if (colorTransitionRef.current < 1) {
        colorTransitionRef.current = Math.min(1, colorTransitionRef.current + dt * 0.3)
        const t = colorTransitionRef.current
        for (let i = 0; i < 5; i++) {
          currentColorsRef.current[i] = lerpColor(
            currentColorsRef.current[i],
            targetColorsRef.current[i],
            t * 0.1
          )
        }
      }

      // Clear with pure black background
      ctx.fillStyle = 'rgb(0, 0, 0)'
      ctx.fillRect(0, 0, width, height)

      // Draw very subtle distant stars
      ctx.fillStyle = 'rgba(255,255,255,0.4)'
      for (let i = 0; i < 30; i++) {
        const starX = (i * 137.5) % width
        const starY = (i * 97.3) % (height * 0.6) // Only in upper portion
        const twinkle = (Math.sin(timeRef.current * 1.5 + i) + 1) / 2
        ctx.globalAlpha = 0.05 + twinkle * 0.1
        ctx.beginPath()
        ctx.arc(starX, starY, 0.3 + twinkle * 0.3, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // Draw fog layer (behind fireflies)
      drawFog()
      
      // Subtle glow at center (TV screen source)
      const sourceGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 150)
      sourceGlow.addColorStop(0, 'rgba(180,220,100,0.03)')
      sourceGlow.addColorStop(0.5, 'rgba(150,180,80,0.01)')
      sourceGlow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, 150, 0, TAU)
      ctx.fillStyle = sourceGlow
      ctx.fill()

      // Update and draw fog
      fogParticlesRef.current.forEach(fog => {
        fog.x += fog.vx * effectiveSpeed * 50
        fog.y += fog.vy * effectiveSpeed * 50
        
        // Wrap around
        if (fog.x < -fog.size) fog.x = width + fog.size
        if (fog.x > width + fog.size) fog.x = -fog.size
        if (fog.y < -fog.size) fog.y = height + fog.size
        if (fog.y > height + fog.size) fog.y = -fog.size
      })

      // Update and draw fireflies - sorted by depth (far to near)
      const sortedFireflies = [...firefliesRef.current].sort((a, b) => a.z - b.z)
      
      sortedFireflies.forEach((ff, index) => {
        // Realistic firefly blink pattern
        ff.blinkTimer += dt
        
        // Check if it's time to blink
        if (ff.blinkTimer >= ff.blinkInterval) {
          ff.blinkTimer = 0
          ff.blinkInterval = 2 + Math.random() * 4
        }
        
        // Calculate glow intensity based on blink timing
        const blinkProgress = ff.blinkTimer / ff.blinkInterval
        if (blinkProgress < ff.blinkDuration / ff.blinkInterval) {
          const flashProgress = blinkProgress / (ff.blinkDuration / ff.blinkInterval)
          if (flashProgress < 0.2) {
            ff.glowIntensity = lerp(ff.glowIntensity, 1, dt * 15)
          } else if (flashProgress < 0.5) {
            ff.glowIntensity = lerp(ff.glowIntensity, 1, dt * 5)
          } else {
            ff.glowIntensity = lerp(ff.glowIntensity, 0, dt * 3)
          }
        } else {
          ff.glowIntensity = lerp(ff.glowIntensity, 0.02, dt * 2)
        }
        
        // Outward movement from center (emerging from TV)
        ff.z += ff.outwardSpeed * effectiveSpeed * dt * 0.5
        
        // Slight wandering as they emerge
        ff.wanderAngle += (noise2D(ff.noiseOffset, timeRef.current * 0.2) * 0.5) * dt
        const currentAngle = ff.angle + Math.sin(ff.wanderAngle) * 0.3
        
        // Calculate distance from center based on depth
        const distFromCenter = 30 + ff.z * Math.max(width, height) * 0.6
        
        // Update position - radially outward from center
        ff.x = cx + Math.cos(currentAngle) * distFromCenter
        ff.y = cy + Math.sin(currentAngle) * distFromCenter

        // Trail update
        ff.trail.unshift({ x: ff.x, y: ff.y })
        if (ff.trail.length > ff.trailLength) ff.trail.pop()

        // Respawn when fully emerged (off screen or max depth)
        const maxDist = Math.max(width, height) * 0.8
        const isOffScreen = ff.x < -50 || ff.x > width + 50 || ff.y < -50 || ff.y > height + 50
        if (ff.z > 1 || isOffScreen) {
          // Respawn at center with new angle
          const newAngle = Math.random() * TAU
          ff.z = 0
          ff.angle = newAngle
          ff.wanderAngle = 0
          ff.x = cx + Math.cos(newAngle) * (20 + Math.random() * 30)
          ff.y = cy + Math.sin(newAngle) * (20 + Math.random() * 30)
          ff.outwardSpeed = 0.3 + Math.random() * 0.4
          ff.trail = []
          // Reset blink for fresh emergence
          ff.blinkTimer = Math.random() * 2
          ff.glowIntensity = 0
        }

        // Draw this firefly
        drawFirefly(ff)
      })

      // Subtle ambient glow at bottom
      const ambientGradient = ctx.createLinearGradient(0, height * 0.85, 0, height)
      ambientGradient.addColorStop(0, 'rgba(0,0,0,0)')
      ambientGradient.addColorStop(1, 'rgba(15,20,10,0.2)')
      ctx.fillStyle = ambientGradient
      ctx.fillRect(0, height * 0.85, width, height * 0.15)

    }, isPlaying ? 60 : 30)

    loopRef.current.start()

    const handleResize = () => {
      const { width: w, height: h } = setupCanvas(canvas)
      sizeRef.current = { width: w, height: h }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      if (loopRef.current) loopRef.current.stop()
      window.removeEventListener('resize', handleResize)
    }
  }, [baseSpeed, density, isActive])

  // Update loop FPS based on playback state
  useEffect(() => {
    if (loopRef.current) {
      loopRef.current.setFPS(isPlaying ? 60 : 30)
    }
  }, [isPlaying])

  if (!isActive) return null

  return (
    <canvas
      ref={canvasRef}
      className="galaxy-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: -1,
        pointerEvents: 'none',
      }}
    />
  )
}

export default Jugnu
