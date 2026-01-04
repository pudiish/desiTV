/**
 * Aurora Borealis Background Component - NORTHERN LIGHTS 🌌✨
 * 
 * A mesmerizing canvas animation recreating the magical aurora borealis effect
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Visual Concept: Dancing curtains of light across a starfield
 * - Multiple flowing light bands with wave physics
 * - Particle shimmer creating depth and sparkle
 * - Dynamic color gradients that shift and breathe
 * - Reactive to video playback and volume
 * - Video-thumbnail color extraction for palette adaptation
 * 
 * Technical Features:
 * - Perlin-like simplex noise for organic wave movement
 * - Multiple render layers: stars → aurora bands → shimmer particles
 * - Smooth color interpolation with HSL color space
 * - GPU-friendly rendering with minimal overdraw
 * - 📱 Mobile optimized with reduced complexity
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React, { useRef, useEffect, useState, useCallback } from 'react'
import mobilePerformanceOptimizer from '../../services/mobilePerformanceOptimizer'
import './Galaxy.css'

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

// Default aurora color palette - ethereal greens, purples, and pinks
const DEFAULT_AURORA_COLORS = [
  { h: 140, s: 80, l: 55 },   // Vibrant green
  { h: 160, s: 70, l: 50 },   // Teal green
  { h: 280, s: 65, l: 55 },   // Purple
  { h: 320, s: 70, l: 60 },   // Pink/magenta
  { h: 200, s: 75, l: 50 },   // Cyan/blue
]

// Simplex noise implementation for smooth organic movement
class SimplexNoise {
  constructor(seed = Math.random() * 10000) {
    this.p = new Uint8Array(512)
    this.perm = new Uint8Array(512)
    
    const p = new Uint8Array(256)
    for (let i = 0; i < 256; i++) p[i] = i
    
    // Fisher-Yates shuffle with seed
    let n = 256
    let rng = seed
    while (n > 1) {
      rng = (rng * 16807) % 2147483647
      const k = Math.floor((rng / 2147483647) * n)
      n--
      const temp = p[n]
      p[n] = p[k]
      p[k] = temp
    }
    
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255]
    }
  }
  
  noise2D(x, y) {
    const F2 = 0.5 * (Math.sqrt(3) - 1)
    const G2 = (3 - Math.sqrt(3)) / 6
    
    const s = (x + y) * F2
    const i = Math.floor(x + s)
    const j = Math.floor(y + s)
    const t = (i + j) * G2
    
    const X0 = i - t
    const Y0 = j - t
    const x0 = x - X0
    const y0 = y - Y0
    
    let i1, j1
    if (x0 > y0) { i1 = 1; j1 = 0 }
    else { i1 = 0; j1 = 1 }
    
    const x1 = x0 - i1 + G2
    const y1 = y0 - j1 + G2
    const x2 = x0 - 1 + 2 * G2
    const y2 = y0 - 1 + 2 * G2
    
    const ii = i & 255
    const jj = j & 255
    
    const grad = (hash, x, y) => {
      const h = hash & 7
      const u = h < 4 ? x : y
      const v = h < 4 ? y : x
      return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v)
    }
    
    let n0 = 0, n1 = 0, n2 = 0
    
    let t0 = 0.5 - x0 * x0 - y0 * y0
    if (t0 >= 0) {
      t0 *= t0
      n0 = t0 * t0 * grad(this.perm[ii + this.perm[jj]], x0, y0)
    }
    
    let t1 = 0.5 - x1 * x1 - y1 * y1
    if (t1 >= 0) {
      t1 *= t1
      n1 = t1 * t1 * grad(this.perm[ii + i1 + this.perm[jj + j1]], x1, y1)
    }
    
    let t2 = 0.5 - x2 * x2 - y2 * y2
    if (t2 >= 0) {
      t2 *= t2
      n2 = t2 * t2 * grad(this.perm[ii + 1 + this.perm[jj + 1]], x2, y2)
    }
    
    return 70 * (n0 + n1 + n2)
  }
  
  // Fractal Brownian Motion for layered noise
  fbm(x, y, octaves = 4) {
    let value = 0
    let amplitude = 1
    let frequency = 1
    let maxValue = 0
    
    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise2D(x * frequency, y * frequency)
      maxValue += amplitude
      amplitude *= 0.5
      frequency *= 2
    }
    
    return value / maxValue
  }
}

const Aurora = ({ 
  isActive = true, 
  baseSpeed = 0.3, 
  density = 200, 
  volume = 0.5, 
  isPlaying = false, 
  isBuffering = false,
  videoId = null,
}) => {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const noiseRef = useRef(new SimplexNoise())
  const timeRef = useRef(0)
  const intensityRef = useRef(0.5)
  const lastFrameTimeRef = useRef(0)
  const isActiveRef = useRef(isActive)
  const starsRef = useRef([])
  const shimmerRef = useRef([])
  
  const [performanceSettings, setPerformanceSettings] = useState(() => 
    mobilePerformanceOptimizer.getSettings()
  )
  
  // Color palette state
  const colorsRef = useRef([...DEFAULT_AURORA_COLORS])
  const targetColorsRef = useRef([...DEFAULT_AURORA_COLORS])
  const colorTransitionRef = useRef(1)
  
  // Keep isActiveRef in sync
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])
  
  // Subscribe to performance mode changes
  useEffect(() => {
    const unsubscribe = mobilePerformanceOptimizer.subscribe(setPerformanceSettings)
    return unsubscribe
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // COLOR EXTRACTION FROM VIDEO THUMBNAIL
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!videoId) return

    const extractColors = async () => {
      try {
        const qualities = ['hqdefault', 'mqdefault', 'default']
        let img = null
        let loaded = false
        
        for (const quality of qualities) {
          const url = `https://img.youtube.com/vi/${videoId}/${quality}.jpg`
          try {
            img = await new Promise((resolve, reject) => {
              const testImg = new Image()
              testImg.crossOrigin = 'anonymous'
              testImg.onload = () => {
                if (testImg.width > 100 && testImg.height > 100) {
                  resolve(testImg)
                } else {
                  reject(new Error('Invalid thumbnail'))
                }
              }
              testImg.onerror = () => reject(new Error('Failed to load'))
              testImg.src = url
            })
            loaded = true
            break
          } catch {
            continue
          }
        }

        if (!loaded || !img) return

        // Sample colors from thumbnail
        const sampleCanvas = document.createElement('canvas')
        const sampleCtx = sampleCanvas.getContext('2d')
        const sampleSize = 50
        sampleCanvas.width = sampleSize
        sampleCanvas.height = sampleSize
        sampleCtx.drawImage(img, 0, 0, sampleSize, sampleSize)

        const imageData = sampleCtx.getImageData(0, 0, sampleSize, sampleSize)
        const pixels = imageData.data

        // Extract dominant colors and convert to HSL
        const colorBuckets = {}
        const bucketSize = 32

        for (let i = 0; i < pixels.length; i += 16) {
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          
          // Skip very dark or very light colors
          const brightness = (r + g + b) / 3
          if (brightness < 40 || brightness > 230) continue
          
          // Skip gray colors
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          if (max - min < 40) continue

          const bucketR = Math.floor(r / bucketSize) * bucketSize
          const bucketG = Math.floor(g / bucketSize) * bucketSize
          const bucketB = Math.floor(b / bucketSize) * bucketSize
          
          const key = `${bucketR},${bucketG},${bucketB}`
          colorBuckets[key] = (colorBuckets[key] || 0) + 1
        }

        // Get top colors and convert to HSL
        const sortedColors = Object.entries(colorBuckets)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([key]) => {
            const [r, g, b] = key.split(',').map(Number)
            return rgbToHsl(r, g, b)
          })

        if (sortedColors.length >= 3) {
          // Boost saturation for aurora effect
          const boostedColors = sortedColors.map(c => ({
            h: c.h,
            s: Math.min(100, c.s + 20),
            l: Math.max(40, Math.min(70, c.l))
          }))
          
          // Pad to 5 colors
          while (boostedColors.length < 5) {
            boostedColors.push(boostedColors[boostedColors.length - 1])
          }
          
          targetColorsRef.current = boostedColors
          colorTransitionRef.current = 0
          console.log('[Aurora] 🌌 Colors extracted from video thumbnail')
        }
      } catch (err) {
        console.log('[Aurora] Could not extract colors:', err)
      }
    }

    extractColors()
  }, [videoId])

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN ANIMATION EFFECT
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let width = window.innerWidth
    let height = window.innerHeight
    const noise = noiseRef.current

    const setSize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
      createStars()
      createShimmer()
    }
    
    // ═════════════════════════════════════════════════════════════════════════
    // STAR FIELD CREATION
    // ═════════════════════════════════════════════════════════════════════════
    const createStars = () => {
      starsRef.current = []
      const starCount = mobilePerformanceOptimizer.getParticleCount(Math.floor(density * 0.8))
      
      for (let i = 0; i < starCount; i++) {
        starsRef.current.push({
          x: Math.random() * width,
          y: Math.random() * height,
          size: Math.random() * 1.5 + 0.5,
          brightness: Math.random(),
          twinkleSpeed: 0.5 + Math.random() * 2,
          twinklePhase: Math.random() * Math.PI * 2,
        })
      }
    }
    
    // ═════════════════════════════════════════════════════════════════════════
    // SHIMMER PARTICLES (floating in aurora bands)
    // ═════════════════════════════════════════════════════════════════════════
    const createShimmer = () => {
      shimmerRef.current = []
      const shimmerCount = mobilePerformanceOptimizer.getParticleCount(Math.floor(density * 0.3))
      
      for (let i = 0; i < shimmerCount; i++) {
        shimmerRef.current.push({
          x: Math.random() * width,
          y: height * 0.2 + Math.random() * height * 0.5, // In aurora zone
          size: Math.random() * 3 + 1,
          drift: Math.random() * 2 - 1,
          floatSpeed: 0.2 + Math.random() * 0.5,
          floatPhase: Math.random() * Math.PI * 2,
          colorIndex: Math.floor(Math.random() * 5),
          alpha: Math.random() * 0.5 + 0.3,
        })
      }
    }
    
    setSize()
    
    // ═════════════════════════════════════════════════════════════════════════
    // HELPER FUNCTIONS
    // ═════════════════════════════════════════════════════════════════════════
    const lerp = (a, b, t) => a + (b - a) * t
    
    const lerpHsl = (c1, c2, t) => ({
      h: lerp(c1.h, c2.h, t),
      s: lerp(c1.s, c2.s, t),
      l: lerp(c1.l, c2.l, t),
    })
    
    const hslToString = (h, s, l, a = 1) => 
      `hsla(${h}, ${s}%, ${l}%, ${a})`
    
    const getAuroraColor = (index, alpha = 1) => {
      const colors = colorsRef.current
      const i = Math.floor(index) % colors.length
      const c = colors[i]
      return hslToString(c.h, c.s, c.l, alpha)
    }
    
    const getInterpolatedColor = (phase, alpha = 1) => {
      const colors = colorsRef.current
      const p = (phase % 1) * colors.length
      const i1 = Math.floor(p) % colors.length
      const i2 = (i1 + 1) % colors.length
      const t = p - Math.floor(p)
      const c = lerpHsl(colors[i1], colors[i2], t)
      return hslToString(c.h, c.s, c.l, alpha)
    }
    
    // ═════════════════════════════════════════════════════════════════════════
    // RENDER FUNCTIONS
    // ═════════════════════════════════════════════════════════════════════════
    
    // Draw starfield background
    const drawStars = (t, intensity) => {
      starsRef.current.forEach(star => {
        const twinkle = Math.sin(t * star.twinkleSpeed + star.twinklePhase) * 0.5 + 0.5
        const brightness = star.brightness * twinkle * (0.5 + intensity * 0.5)
        const alpha = brightness * 0.8
        
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size * (0.5 + twinkle * 0.5), 0, Math.PI * 2)
        ctx.fill()
        
        // Add subtle glow to brighter stars
        if (brightness > 0.7) {
          const glow = ctx.createRadialGradient(
            star.x, star.y, 0,
            star.x, star.y, star.size * 4
          )
          glow.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.3})`)
          glow.addColorStop(1, 'transparent')
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(star.x, star.y, star.size * 4, 0, Math.PI * 2)
          ctx.fill()
        }
      })
    }
    
    // Draw aurora curtains - the main effect
    const drawAurora = (t, intensity) => {
      const bandCount = performanceSettings.enableGalaxy ? 5 : 3
      const segments = performanceSettings.enableGalaxy ? 80 : 40
      
      for (let band = 0; band < bandCount; band++) {
        const bandPhase = band / bandCount
        const bandY = height * (0.15 + band * 0.12)
        const colorPhase = (t * 0.05 + bandPhase) % 1
        
        // Aurora band parameters
        const waveAmplitude = 30 + band * 20 + intensity * 40
        const waveFrequency = 0.003 + band * 0.001
        const curtainHeight = 150 + band * 50 + intensity * 100
        
        ctx.beginPath()
        
        // Draw the aurora curtain shape
        const points = []
        for (let i = 0; i <= segments; i++) {
          const x = (i / segments) * (width + 200) - 100
          
          // Multiple noise layers for organic movement
          const n1 = noise.fbm(x * waveFrequency + t * 0.2, band * 10, 3)
          const n2 = noise.fbm(x * waveFrequency * 0.5 + t * 0.1, band * 10 + 100, 2)
          const n3 = noise.noise2D(x * 0.002 + t * 0.3, band)
          
          const waveY = bandY + 
            n1 * waveAmplitude + 
            n2 * waveAmplitude * 0.5 +
            Math.sin(x * 0.01 + t * 0.5 + band) * 20 * intensity
          
          // Curtain drape height varies
          const drapeNoise = noise.noise2D(x * 0.005, t * 0.2 + band)
          const drapeHeight = curtainHeight * (0.5 + drapeNoise * 0.5 + n3 * 0.3)
          
          points.push({ x, y: waveY, height: drapeHeight })
        }
        
        // Create gradient for this band
        const gradient = ctx.createLinearGradient(0, bandY - 50, 0, bandY + curtainHeight)
        const baseAlpha = (0.15 + intensity * 0.25) * (1 - band * 0.15)
        
        gradient.addColorStop(0, getInterpolatedColor(colorPhase, 0))
        gradient.addColorStop(0.1, getInterpolatedColor(colorPhase, baseAlpha * 0.3))
        gradient.addColorStop(0.3, getInterpolatedColor(colorPhase + 0.1, baseAlpha * 0.8))
        gradient.addColorStop(0.5, getInterpolatedColor(colorPhase + 0.2, baseAlpha))
        gradient.addColorStop(0.7, getInterpolatedColor(colorPhase + 0.3, baseAlpha * 0.6))
        gradient.addColorStop(0.9, getInterpolatedColor(colorPhase + 0.4, baseAlpha * 0.2))
        gradient.addColorStop(1, 'transparent')
        
        // Draw the curtain path
        ctx.moveTo(points[0].x, points[0].y)
        
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y)
        }
        
        // Close the bottom of the curtain
        for (let i = points.length - 1; i >= 0; i--) {
          ctx.lineTo(points[i].x, points[i].y + points[i].height)
        }
        
        ctx.closePath()
        ctx.fillStyle = gradient
        ctx.fill()
        
        // Add glowing edge at top of curtain
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y)
        }
        
        ctx.strokeStyle = getInterpolatedColor(colorPhase, baseAlpha * 1.5)
        ctx.lineWidth = 2 + intensity * 3
        ctx.lineCap = 'round'
        ctx.shadowColor = getInterpolatedColor(colorPhase, 1)
        ctx.shadowBlur = 15 + intensity * 20
        ctx.stroke()
        ctx.shadowBlur = 0
      }
    }
    
    // Draw shimmer particles floating in aurora
    const drawShimmer = (t, intensity) => {
      shimmerRef.current.forEach(particle => {
        // Update position
        particle.x += particle.drift * 0.3
        particle.y += Math.sin(t * particle.floatSpeed + particle.floatPhase) * 0.5
        
        // Wrap around
        if (particle.x < -10) particle.x = width + 10
        if (particle.x > width + 10) particle.x = -10
        
        const pulseAlpha = particle.alpha * (0.5 + Math.sin(t * 2 + particle.floatPhase) * 0.5)
        const alpha = pulseAlpha * intensity
        
        // Draw shimmer with glow
        const color = colorsRef.current[particle.colorIndex]
        const glow = ctx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.size * 3
        )
        glow.addColorStop(0, hslToString(color.h, color.s, Math.min(90, color.l + 30), alpha))
        glow.addColorStop(0.3, hslToString(color.h, color.s, color.l, alpha * 0.5))
        glow.addColorStop(1, 'transparent')
        
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size * 3, 0, Math.PI * 2)
        ctx.fill()
        
        // Bright core
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size * 0.5, 0, Math.PI * 2)
        ctx.fill()
      })
    }
    
    // Draw horizon glow
    const drawHorizonGlow = (t, intensity) => {
      const glowY = height * 0.85
      const glowHeight = height * 0.25
      
      // Multiple color bands at horizon
      for (let i = 0; i < 3; i++) {
        const colorPhase = (t * 0.03 + i * 0.2) % 1
        const color = colorsRef.current[Math.floor(colorPhase * colorsRef.current.length)]
        
        const glow = ctx.createRadialGradient(
          width / 2 + Math.sin(t + i) * 100, 
          glowY,
          0,
          width / 2, 
          glowY,
          width * 0.6
        )
        
        glow.addColorStop(0, hslToString(color.h, color.s * 0.8, color.l, 0.1 * intensity))
        glow.addColorStop(0.5, hslToString(color.h, color.s * 0.6, color.l * 0.8, 0.05 * intensity))
        glow.addColorStop(1, 'transparent')
        
        ctx.fillStyle = glow
        ctx.fillRect(0, glowY - glowHeight, width, glowHeight * 2)
      }
    }
    
    // ═════════════════════════════════════════════════════════════════════════
    // MAIN ANIMATION LOOP
    // ═════════════════════════════════════════════════════════════════════════
    let lastTime = 0
    
    const animate = (timestamp) => {
      // Skip if not active or disabled for performance
      if (!performanceSettings.enableGalaxy || !isActiveRef.current) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }
      
      // FPS throttling for mobile
      const targetFPS = performanceSettings.animationFPS
      if (targetFPS > 0 && targetFPS < 60) {
        const frameInterval = 1000 / targetFPS
        if (timestamp - lastFrameTimeRef.current < frameInterval) {
          animationRef.current = requestAnimationFrame(animate)
          return
        }
        lastFrameTimeRef.current = timestamp
      }
      
      const dt = Math.min(timestamp - lastTime, 50)
      lastTime = timestamp
      
      // Smooth color palette transition
      if (colorTransitionRef.current < 1) {
        colorTransitionRef.current = Math.min(1, colorTransitionRef.current + dt * 0.0005)
        const t = colorTransitionRef.current
        colorsRef.current = colorsRef.current.map((c, i) => 
          lerpHsl(c, targetColorsRef.current[i], t * 0.1)
        )
      }
      
      // Update time and intensity
      const speedMult = isPlaying ? (0.5 + volume * 0.5) : 0.3
      timeRef.current += dt * 0.001 * speedMult
      
      // Intensity responds to playback and volume
      const targetIntensity = isPlaying 
        ? 0.5 + volume * 0.5 
        : 0.4
      intensityRef.current += (targetIntensity - intensityRef.current) * 0.02
      
      const t = timeRef.current
      const intensity = intensityRef.current
      
      // Clear with dark sky gradient
      const skyGradient = ctx.createLinearGradient(0, 0, 0, height)
      skyGradient.addColorStop(0, '#0a0a15')
      skyGradient.addColorStop(0.5, '#0d0d1a')
      skyGradient.addColorStop(1, '#111122')
      ctx.fillStyle = skyGradient
      ctx.fillRect(0, 0, width, height)
      
      // Render layers in order
      drawStars(t, intensity)
      drawHorizonGlow(t, intensity)
      drawAurora(t, intensity)
      drawShimmer(t, intensity)
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animationRef.current = requestAnimationFrame(animate)
    
    const handleResize = () => {
      setSize()
    }
    window.addEventListener('resize', handleResize)
    
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [isPlaying, volume, performanceSettings.enableGalaxy, performanceSettings.animationFPS, density])

  // Don't render if disabled for performance
  if (!performanceSettings.enableGalaxy) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      className={`galaxy-canvas ${isActive ? 'active' : ''}`}
      aria-hidden="true"
    />
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

// Convert RGB to HSL
function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h, s
  const l = (max + min) / 2
  
  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
      default:
        h = 0
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

export default Aurora
