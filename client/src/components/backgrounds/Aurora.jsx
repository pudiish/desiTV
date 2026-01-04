/**
 * Aurora Borealis Background Component - BASS-REACTIVE NORTHERN LIGHTS 🌌✨🔊
 * 
 * A mesmerizing canvas animation with BASS-REACTIVE SHAKE and PULSE effects
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Visual Concept: Dancing curtains of light that SHAKE on bass hits
 * - Multiple flowing light bands with wave physics
 * - 🔊 SCREEN SHAKE on bass drops with spring physics
 * - 🔊 AURORA PULSE - curtains expand and brighten on downbeats  
 * - 🔊 WAVE PROPAGATION - ripples spread through curtains
 * - 🔊 SHIMMER BURST - particles explode on beats
 * - 🔊 HORIZON FLASH - ground glow pulses with bass
 * 
 * Technical Features:
 * - Synthetic beat detection (BPM-based with multi-band simulation)
 * - Spring physics for natural shake decay
 * - Perlin-like simplex noise for organic wave movement
 * - Multiple render layers: stars → aurora bands → shimmer particles
 * - 📱 Mobile optimized with reduced complexity
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React, { useRef, useEffect, useState } from 'react'
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
  
  // ═══════════════════════════════════════════════════════════════════════════
  // 🔊 BASS DETECTION STATE - Synthetic beat detection with multi-band simulation
  // Research-based: Clubber.js-style adaptive smoothing + MDN smoothingTimeConstant
  // ═══════════════════════════════════════════════════════════════════════════
  const bassRef = useRef({
    // Beat timing
    bpm: 120,                    // Base BPM (typical music tempo)
    beatInterval: 500,           // ms between beats
    accumulator: 0,              // Beat phase accumulator
    lastTrigger: 0,              // Last beat trigger timestamp
    beatIndex: 0,                // Current beat in 4-beat pattern
    
    // Multi-band frequency simulation (like Web Audio API analyser)
    bands: {
      low: 0,                    // Sub-bass / kick drum (20-60 Hz)
      lowTarget: 0,
      mid: 0,                    // Mid frequencies / snare (200-2000 Hz)  
      midTarget: 0,
      high: 0,                   // High frequencies / hi-hats (4000+ Hz)
      highTarget: 0,
    },
    
    // Energy history for normalized response (Clubber.js adaptive threshold)
    energyHistory: [],
    energyHistoryMax: 8,         // Keep 8 beats of history (2 bars)
    normalizedEnergy: 0,
    
    // 🔊 SCREEN SHAKE - Spring physics based camera shake
    shake: {
      x: 0,                      // Current X offset
      y: 0,                      // Current Y offset
      targetX: 0,                // Target X (set on bass hit)
      targetY: 0,                // Target Y
      velocityX: 0,              // X velocity for spring physics
      velocityY: 0,              // Y velocity
      intensity: 0,              // Current shake intensity (0-1)
      rotation: 0,               // Slight rotation shake
      rotationTarget: 0,
      rotationVelocity: 0,
    },
    
    // 🔊 AURORA PULSE - Curtains expand on bass
    auroraPulse: {
      intensity: 0,              // Current pulse intensity (0-1)
      target: 0,                 // Target intensity
      velocity: 0,               // For spring physics
      expansion: 0,              // How much curtains expand
      brightness: 0,             // Extra brightness on pulse
    },
    
    // 🔊 WAVE PROPAGATION - Ripples through aurora
    waves: [],                   // Array of expanding wave pulses
    wavePhase: 0,                // Global wave phase for sync
    
    // 🔊 HORIZON FLASH - Ground glow pulse
    horizonFlash: {
      intensity: 0,
      target: 0,
      velocity: 0,
    },
    
    // 🔊 SHIMMER BURST - Particle explosion on beats
    shimmerBurst: {
      active: false,
      intensity: 0,
      velocities: [],            // Individual particle burst velocities
    },
    
    // 💥 BOOM - Expanding shockwave rings on heavy bass
    boom: {
      rings: [],                 // Array of expanding ring shockwaves
      centerFlash: 0,            // Bright center flash intensity
      screenFlash: 0,            // Full screen white flash
    },
  })
  
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
          
          const brightness = (r + g + b) / 3
          if (brightness < 40 || brightness > 230) continue
          
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          if (max - min < 40) continue

          const bucketR = Math.floor(r / bucketSize) * bucketSize
          const bucketG = Math.floor(g / bucketSize) * bucketSize
          const bucketB = Math.floor(b / bucketSize) * bucketSize
          
          const key = `${bucketR},${bucketG},${bucketB}`
          colorBuckets[key] = (colorBuckets[key] || 0) + 1
        }

        const sortedColors = Object.entries(colorBuckets)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([key]) => {
            const [r, g, b] = key.split(',').map(Number)
            return rgbToHsl(r, g, b)
          })

        if (sortedColors.length >= 3) {
          const boostedColors = sortedColors.map(c => ({
            h: c.h,
            s: Math.min(100, c.s + 20),
            l: Math.max(40, Math.min(70, c.l))
          }))
          
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
          baseX: Math.random() * width,
          baseY: Math.random() * height,
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
      const shimmerCount = mobilePerformanceOptimizer.getParticleCount(Math.floor(density * 0.4))
      
      for (let i = 0; i < shimmerCount; i++) {
        shimmerRef.current.push({
          x: Math.random() * width,
          y: height * 0.15 + Math.random() * height * 0.55,
          baseX: Math.random() * width,
          baseY: height * 0.15 + Math.random() * height * 0.55,
          size: Math.random() * 3 + 1,
          drift: Math.random() * 2 - 1,
          floatSpeed: 0.2 + Math.random() * 0.5,
          floatPhase: Math.random() * Math.PI * 2,
          colorIndex: Math.floor(Math.random() * 5),
          alpha: Math.random() * 0.5 + 0.3,
          // Burst velocity (set on bass hit)
          burstVelX: 0,
          burstVelY: 0,
        })
      }
      
      // Initialize burst velocities in bass ref
      bassRef.current.shimmerBurst.velocities = shimmerRef.current.map(() => ({
        vx: 0, vy: 0
      }))
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
    
    const getInterpolatedColor = (phase, alpha = 1) => {
      const colors = colorsRef.current
      const p = (phase % 1) * colors.length
      const i1 = Math.floor(p) % colors.length
      const i2 = (i1 + 1) % colors.length
      const t = p - Math.floor(p)
      const c = lerpHsl(colors[i1], colors[i2], t)
      return hslToString(c.h, c.s, c.l, alpha)
    }
    
    // Spring physics helper - natural bounce/decay
    const springSmooth = (current, target, velocity, stiffness, damping, dt) => {
      const force = (target - current) * stiffness
      const newVelocity = (velocity + force * dt) * damping
      const newValue = current + newVelocity * dt
      return { value: newValue, velocity: newVelocity }
    }
    
    // Exponential smoothing (like Web Audio smoothingTimeConstant)
    const expSmooth = (current, target, smoothing, dt) => {
      const factor = Math.pow(smoothing, dt / 16.67)
      return current * factor + target * (1 - factor)
    }
    
    // ═════════════════════════════════════════════════════════════════════════
    // 🔊 BASS DETECTION & PHYSICS UPDATE
    // ═════════════════════════════════════════════════════════════════════════
    const updateBass = (timestamp, dt) => {
      const bass = bassRef.current
      
      if (isPlaying && volume > 0.1) {
        // Subtle BPM variation for human feel
        const bpmVariation = Math.sin(timestamp * 0.00003) * 5 + Math.sin(timestamp * 0.00007) * 3
        bass.bpm = 118 + bpmVariation  // Slightly slower for more impact
        bass.beatInterval = 60000 / bass.bpm
        
        // Update global wave phase
        bass.wavePhase += dt * 0.003 * (bass.bpm / 120)
        
        // Accumulate time toward next beat
        bass.accumulator += dt
        
        // Check if it's time for a beat
        if (bass.accumulator >= bass.beatInterval) {
          bass.accumulator = bass.accumulator % bass.beatInterval
          bass.beatIndex = (bass.beatIndex + 1) % 4
          
          const isDownbeat = bass.beatIndex === 0    // Beat 1 = strongest (KICK)
          const isAccent = bass.beatIndex === 2      // Beat 3 = secondary (SNARE)
          
          // 🔊 MULTI-BAND FREQUENCY SIMULATION
          let lowBeat, midBeat, highBeat
          
          if (isDownbeat) {
            // KICK DRUM - heavy low end
            lowBeat = 0.85 + Math.random() * 0.15
            midBeat = 0.25 + Math.random() * 0.15
            highBeat = 0.15 + Math.random() * 0.1
          } else if (isAccent) {
            // SNARE - mid focused
            lowBeat = 0.35 + Math.random() * 0.15
            midBeat = 0.7 + Math.random() * 0.2
            highBeat = 0.45 + Math.random() * 0.2
          } else {
            // OFF-BEATS - hi-hats
            lowBeat = 0.1 + Math.random() * 0.1
            midBeat = 0.2 + Math.random() * 0.15
            highBeat = 0.55 + Math.random() * 0.25
          }
          
          bass.bands.lowTarget = lowBeat * volume
          bass.bands.midTarget = midBeat * volume
          bass.bands.highTarget = highBeat * volume
          
          // Combined beat strength (weighted toward low for bass impact)
          const beatStrength = lowBeat * 0.65 + midBeat * 0.25 + highBeat * 0.1
          
          // Track energy history for normalized response
          bass.energyHistory.push(beatStrength * volume)
          if (bass.energyHistory.length > bass.energyHistoryMax) {
            bass.energyHistory.shift()
          }
          const avgEnergy = bass.energyHistory.reduce((a, b) => a + b, 0) / bass.energyHistory.length
          bass.normalizedEnergy = avgEnergy > 0.01 ? (beatStrength * volume) / avgEnergy : beatStrength * volume
          
          // 🔊 TRIGGER EFFECTS ON BASS HITS
          const bassThreshold = 0.5
          const bassStrength = lowBeat * volume
          
          if (isDownbeat && bassStrength > bassThreshold && timestamp - bass.lastTrigger > 380) {
            bass.lastTrigger = timestamp
            const impactIntensity = Math.min(1, (bassStrength - bassThreshold) / 0.5)
            
            // 🔊 SCREEN SHAKE - Random direction with intensity
            const shakeAngle = Math.random() * Math.PI * 2
            const shakeMagnitude = 8 + impactIntensity * 20  // 8-28 pixels
            bass.shake.targetX = Math.cos(shakeAngle) * shakeMagnitude
            bass.shake.targetY = Math.sin(shakeAngle) * shakeMagnitude
            bass.shake.rotationTarget = (Math.random() - 0.5) * 0.02 * impactIntensity
            bass.shake.intensity = impactIntensity
            
            // 🔊 AURORA PULSE - Expand and brighten
            bass.auroraPulse.target = impactIntensity
            bass.auroraPulse.expansion = impactIntensity * 0.3  // 30% expansion
            bass.auroraPulse.brightness = impactIntensity * 0.4 // Extra brightness
            
            // 🔊 HORIZON FLASH
            bass.horizonFlash.target = impactIntensity * 0.8
            
            // 🔊 SPAWN WAVE RIPPLE
            bass.waves.push({
              y: height * 0.3,  // Start from aurora center
              speed: 2 + impactIntensity * 3,
              intensity: impactIntensity,
              age: 0,
              maxAge: 800,
            })
            
            // 🔊 SHIMMER BURST - Give particles outward velocity
            bass.shimmerBurst.active = true
            bass.shimmerBurst.intensity = impactIntensity
            shimmerRef.current.forEach((particle, i) => {
              const burstAngle = Math.random() * Math.PI * 2
              const burstSpeed = (2 + Math.random() * 4) * impactIntensity
              if (bass.shimmerBurst.velocities[i]) {
                bass.shimmerBurst.velocities[i].vx = Math.cos(burstAngle) * burstSpeed
                bass.shimmerBurst.velocities[i].vy = Math.sin(burstAngle) * burstSpeed
              }
            })
            
            // 💥 BOOM - Spawn expanding shockwave ring
            bass.boom.rings.push({
              x: width / 2,              // Center of screen
              y: height * 0.4,           // Aurora center height
              radius: 0,                 // Start small
              maxRadius: Math.max(width, height) * 0.8,
              speed: 8 + impactIntensity * 12,  // Expansion speed
              intensity: impactIntensity,
              thickness: 3 + impactIntensity * 8,  // Ring thickness
              colorPhase: Math.random(),
              age: 0,
            })
            
            // 💥 Center flash and screen flash
            bass.boom.centerFlash = impactIntensity
            bass.boom.screenFlash = impactIntensity * 0.4
          }
        }
        
        // 🔊 SMOOTH BAND DECAY with different characteristics
        // Low = slow decay (rumble), Mid = medium, High = fast (transients)
        bass.bands.low = expSmooth(bass.bands.low, bass.bands.lowTarget, 0.92, dt)
        bass.bands.mid = expSmooth(bass.bands.mid, bass.bands.midTarget, 0.88, dt)
        bass.bands.high = expSmooth(bass.bands.high, bass.bands.highTarget, 0.82, dt)
        
        bass.bands.lowTarget *= 0.97
        bass.bands.midTarget *= 0.95
        bass.bands.highTarget *= 0.92
        
      } else {
        // Not playing - decay everything
        bass.bands.low *= 0.95
        bass.bands.mid *= 0.95
        bass.bands.high *= 0.95
      }
      
      // 🔊 SHAKE SPRING PHYSICS - Smooth decay back to center
      const shakeSpring = springSmooth(bass.shake.x, 0, bass.shake.velocityX, 0.15, 0.85, dt)
      bass.shake.x = shakeSpring.value
      bass.shake.velocityX = shakeSpring.velocity
      // Add target impulse
      bass.shake.x += bass.shake.targetX * 0.3
      bass.shake.targetX *= 0.7
      
      const shakeSpringY = springSmooth(bass.shake.y, 0, bass.shake.velocityY, 0.15, 0.85, dt)
      bass.shake.y = shakeSpringY.value
      bass.shake.velocityY = shakeSpringY.velocity
      bass.shake.y += bass.shake.targetY * 0.3
      bass.shake.targetY *= 0.7
      
      const rotSpring = springSmooth(bass.shake.rotation, 0, bass.shake.rotationVelocity, 0.1, 0.9, dt)
      bass.shake.rotation = rotSpring.value
      bass.shake.rotationVelocity = rotSpring.velocity
      bass.shake.rotation += bass.shake.rotationTarget * 0.2
      bass.shake.rotationTarget *= 0.8
      
      bass.shake.intensity *= 0.92
      
      // 🔊 AURORA PULSE SPRING
      const pulseSpring = springSmooth(bass.auroraPulse.intensity, bass.auroraPulse.target, bass.auroraPulse.velocity, 0.2, 0.88, dt)
      bass.auroraPulse.intensity = Math.max(0, pulseSpring.value)
      bass.auroraPulse.velocity = pulseSpring.velocity
      bass.auroraPulse.target *= 0.9
      bass.auroraPulse.expansion *= 0.92
      bass.auroraPulse.brightness *= 0.9
      
      // 🔊 HORIZON FLASH SPRING
      const horizonSpring = springSmooth(bass.horizonFlash.intensity, bass.horizonFlash.target, bass.horizonFlash.velocity, 0.25, 0.85, dt)
      bass.horizonFlash.intensity = Math.max(0, horizonSpring.value)
      bass.horizonFlash.velocity = horizonSpring.velocity
      bass.horizonFlash.target *= 0.88
      
      // 🔊 UPDATE WAVES
      bass.waves = bass.waves.filter(wave => {
        wave.age += dt
        wave.y += wave.speed
        wave.intensity *= 0.985
        return wave.age < wave.maxAge && wave.intensity > 0.01
      })
      
      // 🔊 SHIMMER BURST DECAY
      if (bass.shimmerBurst.active) {
        bass.shimmerBurst.intensity *= 0.92
        bass.shimmerBurst.velocities.forEach(v => {
          v.vx *= 0.94
          v.vy *= 0.94
        })
        if (bass.shimmerBurst.intensity < 0.01) {
          bass.shimmerBurst.active = false
        }
      }
      
      // 💥 BOOM RING UPDATE - Expand and fade
      bass.boom.rings = bass.boom.rings.filter(ring => {
        ring.age += dt
        ring.radius += ring.speed * (dt / 16.67)
        ring.intensity *= 0.97
        ring.thickness *= 0.995
        return ring.radius < ring.maxRadius && ring.intensity > 0.02
      })
      
      // 💥 BOOM FLASH DECAY
      bass.boom.centerFlash *= 0.88
      bass.boom.screenFlash *= 0.85
    }
    
    // ═════════════════════════════════════════════════════════════════════════
    // RENDER FUNCTIONS
    // ═════════════════════════════════════════════════════════════════════════
    
    // Draw starfield background (with shake)
    const drawStars = (t, intensity, shakeX, shakeY) => {
      starsRef.current.forEach(star => {
        const twinkle = Math.sin(t * star.twinkleSpeed + star.twinklePhase) * 0.5 + 0.5
        const brightness = star.brightness * twinkle * (0.5 + intensity * 0.5)
        const alpha = brightness * 0.8
        
        // Apply shake offset
        const x = star.baseX + shakeX * 0.3  // Stars shake less (parallax)
        const y = star.baseY + shakeY * 0.3
        
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.beginPath()
        ctx.arc(x, y, star.size * (0.5 + twinkle * 0.5), 0, Math.PI * 2)
        ctx.fill()
        
        if (brightness > 0.7) {
          const glow = ctx.createRadialGradient(x, y, 0, x, y, star.size * 4)
          glow.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.3})`)
          glow.addColorStop(1, 'transparent')
          ctx.fillStyle = glow
          ctx.beginPath()
          ctx.arc(x, y, star.size * 4, 0, Math.PI * 2)
          ctx.fill()
        }
      })
    }
    
    // Draw aurora curtains with bass pulse
    const drawAurora = (t, intensity, shakeX, shakeY, pulse, waves) => {
      const bandCount = performanceSettings.enableGalaxy ? 5 : 3
      const segments = performanceSettings.enableGalaxy ? 80 : 40
      
      // Pulse affects scale and brightness
      const pulseScale = 1 + pulse.expansion
      const pulseBrightness = 1 + pulse.brightness
      
      for (let band = 0; band < bandCount; band++) {
        const bandPhase = band / bandCount
        const bandY = height * (0.15 + band * 0.12) + shakeY * (0.8 + band * 0.1)
        const colorPhase = (t * 0.05 + bandPhase) % 1
        
        // Aurora band parameters - affected by pulse
        const baseWaveAmplitude = 30 + band * 20 + intensity * 40
        const waveAmplitude = baseWaveAmplitude * pulseScale
        const waveFrequency = 0.003 + band * 0.001
        const baseCurtainHeight = 150 + band * 50 + intensity * 100
        const curtainHeight = baseCurtainHeight * pulseScale
        
        ctx.beginPath()
        
        const points = []
        for (let i = 0; i <= segments; i++) {
          const x = (i / segments) * (width + 200) - 100 + shakeX
          
          // Multiple noise layers + wave influence
          const n1 = noise.fbm(x * waveFrequency + t * 0.2, band * 10, 3)
          const n2 = noise.fbm(x * waveFrequency * 0.5 + t * 0.1, band * 10 + 100, 2)
          const n3 = noise.noise2D(x * 0.002 + t * 0.3, band)
          
          // Add wave ripple effect
          let waveInfluence = 0
          waves.forEach(wave => {
            const waveY = wave.y
            const distToWave = Math.abs(bandY - waveY)
            if (distToWave < 100) {
              const waveFactor = (1 - distToWave / 100) * wave.intensity
              waveInfluence += Math.sin(x * 0.02 + wave.age * 0.01) * 15 * waveFactor
            }
          })
          
          const waveY = bandY + 
            n1 * waveAmplitude + 
            n2 * waveAmplitude * 0.5 +
            Math.sin(x * 0.01 + t * 0.5 + band) * 20 * intensity +
            waveInfluence
          
          const drapeNoise = noise.noise2D(x * 0.005, t * 0.2 + band)
          const drapeHeight = curtainHeight * (0.5 + drapeNoise * 0.5 + n3 * 0.3)
          
          points.push({ x, y: waveY, height: drapeHeight })
        }
        
        // Gradient with pulse brightness boost
        const gradient = ctx.createLinearGradient(0, bandY - 50, 0, bandY + curtainHeight)
        const baseAlpha = (0.15 + intensity * 0.25) * (1 - band * 0.12) * pulseBrightness
        
        gradient.addColorStop(0, getInterpolatedColor(colorPhase, 0))
        gradient.addColorStop(0.1, getInterpolatedColor(colorPhase, baseAlpha * 0.3))
        gradient.addColorStop(0.3, getInterpolatedColor(colorPhase + 0.1, baseAlpha * 0.8))
        gradient.addColorStop(0.5, getInterpolatedColor(colorPhase + 0.2, baseAlpha))
        gradient.addColorStop(0.7, getInterpolatedColor(colorPhase + 0.3, baseAlpha * 0.6))
        gradient.addColorStop(0.9, getInterpolatedColor(colorPhase + 0.4, baseAlpha * 0.2))
        gradient.addColorStop(1, 'transparent')
        
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y)
        }
        for (let i = points.length - 1; i >= 0; i--) {
          ctx.lineTo(points[i].x, points[i].y + points[i].height)
        }
        ctx.closePath()
        ctx.fillStyle = gradient
        ctx.fill()
        
        // Glowing edge with pulse
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y)
        }
        
        ctx.strokeStyle = getInterpolatedColor(colorPhase, baseAlpha * 1.5 * pulseBrightness)
        ctx.lineWidth = (2 + intensity * 3) * pulseScale
        ctx.lineCap = 'round'
        ctx.shadowColor = getInterpolatedColor(colorPhase, 1)
        ctx.shadowBlur = (15 + intensity * 20) * pulseBrightness
        ctx.stroke()
        ctx.shadowBlur = 0
      }
    }
    
    // Draw shimmer particles with burst effect
    const drawShimmer = (t, intensity, shakeX, shakeY, burstVelocities, burstIntensity) => {
      shimmerRef.current.forEach((particle, idx) => {
        // Apply burst velocity
        const burst = burstVelocities[idx] || { vx: 0, vy: 0 }
        particle.x += particle.drift * 0.3 + burst.vx
        particle.y += Math.sin(t * particle.floatSpeed + particle.floatPhase) * 0.5 + burst.vy
        
        // Wrap around
        if (particle.x < -10) particle.x = width + 10
        if (particle.x > width + 10) particle.x = -10
        if (particle.y < height * 0.1) particle.y = height * 0.6
        if (particle.y > height * 0.7) particle.y = height * 0.15
        
        const pulseAlpha = particle.alpha * (0.5 + Math.sin(t * 2 + particle.floatPhase) * 0.5)
        // Burst makes particles brighter
        const burstBoost = 1 + burstIntensity * 0.5
        const alpha = pulseAlpha * intensity * burstBoost
        
        const x = particle.x + shakeX
        const y = particle.y + shakeY
        
        const color = colorsRef.current[particle.colorIndex]
        const glowSize = particle.size * 3 * (1 + burstIntensity * 0.3)
        
        const glow = ctx.createRadialGradient(x, y, 0, x, y, glowSize)
        glow.addColorStop(0, hslToString(color.h, color.s, Math.min(90, color.l + 30), alpha))
        glow.addColorStop(0.3, hslToString(color.h, color.s, color.l, alpha * 0.5))
        glow.addColorStop(1, 'transparent')
        
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(x, y, glowSize, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`
        ctx.beginPath()
        ctx.arc(x, y, particle.size * 0.5, 0, Math.PI * 2)
        ctx.fill()
      })
    }
    
    // 💥 Draw BOOM shockwave rings and flashes
    const drawBoom = (boom, shakeX, shakeY) => {
      // Draw expanding shockwave rings
      boom.rings.forEach(ring => {
        const x = ring.x + shakeX
        const y = ring.y + shakeY
        const alpha = ring.intensity * 0.8
        
        // Outer glow ring
        const glowSize = ring.thickness * 3
        const color = colorsRef.current[Math.floor(ring.colorPhase * colorsRef.current.length)]
        
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        
        // Main shockwave ring with gradient
        const ringGrad = ctx.createRadialGradient(
          x, y, Math.max(0, ring.radius - ring.thickness),
          x, y, ring.radius + ring.thickness
        )
        ringGrad.addColorStop(0, 'transparent')
        ringGrad.addColorStop(0.3, hslToString(color.h, color.s, color.l + 20, alpha * 0.3))
        ringGrad.addColorStop(0.5, hslToString(color.h, color.s, Math.min(95, color.l + 40), alpha))
        ringGrad.addColorStop(0.7, hslToString(color.h, color.s, color.l + 20, alpha * 0.3))
        ringGrad.addColorStop(1, 'transparent')
        
        ctx.fillStyle = ringGrad
        ctx.beginPath()
        ctx.arc(x, y, ring.radius + ring.thickness, 0, Math.PI * 2)
        ctx.fill()
        
        // Bright inner edge
        ctx.strokeStyle = hslToString(color.h, color.s * 0.5, 90, alpha * 1.2)
        ctx.lineWidth = Math.max(1, ring.thickness * 0.3)
        ctx.shadowColor = hslToString(color.h, color.s, color.l, 1)
        ctx.shadowBlur = glowSize
        ctx.beginPath()
        ctx.arc(x, y, ring.radius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.shadowBlur = 0
        
        // Secondary outer ring (echo effect)
        if (ring.intensity > 0.3) {
          ctx.strokeStyle = hslToString(color.h, color.s, color.l, alpha * 0.3)
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(x, y, ring.radius * 1.15, 0, Math.PI * 2)
          ctx.stroke()
        }
        
        ctx.restore()
      })
      
      // 💥 Center flash - bright burst at origin
      if (boom.centerFlash > 0.05) {
        const cx = width / 2 + shakeX
        const cy = height * 0.4 + shakeY
        const flashRadius = 50 + boom.centerFlash * 150
        
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        
        const flashGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, flashRadius)
        const primaryColor = colorsRef.current[0]
        flashGrad.addColorStop(0, `rgba(255, 255, 255, ${boom.centerFlash * 0.9})`)
        flashGrad.addColorStop(0.2, hslToString(primaryColor.h, primaryColor.s * 0.3, 95, boom.centerFlash * 0.7))
        flashGrad.addColorStop(0.5, hslToString(primaryColor.h, primaryColor.s, primaryColor.l + 20, boom.centerFlash * 0.4))
        flashGrad.addColorStop(1, 'transparent')
        
        ctx.fillStyle = flashGrad
        ctx.beginPath()
        ctx.arc(cx, cy, flashRadius, 0, Math.PI * 2)
        ctx.fill()
        
        ctx.restore()
      }
      
      // 💥 Screen flash - subtle full screen white overlay
      if (boom.screenFlash > 0.05) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.fillStyle = `rgba(255, 255, 255, ${boom.screenFlash * 0.15})`
        ctx.fillRect(-50, -50, width + 100, height + 100)
        ctx.restore()
      }
    }
    
    // Draw horizon glow with flash
    const drawHorizonGlow = (t, intensity, shakeY, flashIntensity) => {
      const glowY = height * 0.85 + shakeY * 0.5
      const glowHeight = height * 0.25
      
      // Flash effect adds extra brightness
      const flashBoost = 1 + flashIntensity * 2
      
      for (let i = 0; i < 3; i++) {
        const colorPhase = (t * 0.03 + i * 0.2) % 1
        const color = colorsRef.current[Math.floor(colorPhase * colorsRef.current.length)]
        
        const glow = ctx.createRadialGradient(
          width / 2 + Math.sin(t + i) * 100, 
          glowY,
          0,
          width / 2, 
          glowY,
          width * 0.7
        )
        
        const baseAlpha = (0.1 + flashIntensity * 0.4) * intensity * flashBoost
        glow.addColorStop(0, hslToString(color.h, color.s * 0.8, color.l, baseAlpha))
        glow.addColorStop(0.5, hslToString(color.h, color.s * 0.6, color.l * 0.8, baseAlpha * 0.4))
        glow.addColorStop(1, 'transparent')
        
        ctx.fillStyle = glow
        ctx.fillRect(0, glowY - glowHeight, width, glowHeight * 2)
      }
      
      // Extra flash overlay
      if (flashIntensity > 0.1) {
        const flashGrad = ctx.createLinearGradient(0, height * 0.7, 0, height)
        const primaryColor = colorsRef.current[0]
        flashGrad.addColorStop(0, 'transparent')
        flashGrad.addColorStop(0.5, hslToString(primaryColor.h, primaryColor.s, primaryColor.l + 20, flashIntensity * 0.3))
        flashGrad.addColorStop(1, hslToString(primaryColor.h, primaryColor.s, primaryColor.l, flashIntensity * 0.15))
        ctx.fillStyle = flashGrad
        ctx.fillRect(0, height * 0.7, width, height * 0.3)
      }
    }
    
    // ═════════════════════════════════════════════════════════════════════════
    // MAIN ANIMATION LOOP
    // ═════════════════════════════════════════════════════════════════════════
    let lastTime = 0
    
    const animate = (timestamp) => {
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
      
      // 🔊 UPDATE BASS DETECTION & PHYSICS
      updateBass(timestamp, dt)
      const bass = bassRef.current
      
      // Smooth color palette transition
      if (colorTransitionRef.current < 1) {
        colorTransitionRef.current = Math.min(1, colorTransitionRef.current + dt * 0.0005)
        const tr = colorTransitionRef.current
        colorsRef.current = colorsRef.current.map((c, i) => 
          lerpHsl(c, targetColorsRef.current[i], tr * 0.1)
        )
      }
      
      // Update time and base intensity
      const speedMult = isPlaying ? (0.5 + volume * 0.5) : 0.3
      timeRef.current += dt * 0.001 * speedMult
      
      const targetIntensity = isPlaying ? 0.5 + volume * 0.5 : 0.4
      intensityRef.current += (targetIntensity - intensityRef.current) * 0.02
      
      const t = timeRef.current
      const intensity = intensityRef.current
      
      // Get shake values
      const shakeX = bass.shake.x
      const shakeY = bass.shake.y
      const rotation = bass.shake.rotation
      
      // Apply canvas transform for shake
      ctx.save()
      if (Math.abs(rotation) > 0.001) {
        ctx.translate(width / 2, height / 2)
        ctx.rotate(rotation)
        ctx.translate(-width / 2, -height / 2)
      }
      
      // Clear with dark sky gradient
      const skyGradient = ctx.createLinearGradient(0, 0, 0, height)
      skyGradient.addColorStop(0, '#0a0a15')
      skyGradient.addColorStop(0.5, '#0d0d1a')
      skyGradient.addColorStop(1, '#111122')
      ctx.fillStyle = skyGradient
      ctx.fillRect(-50, -50, width + 100, height + 100)  // Extra to cover shake
      
      // Render layers with shake offsets
      drawStars(t, intensity, shakeX, shakeY)
      drawHorizonGlow(t, intensity, shakeY, bass.horizonFlash.intensity)
      drawAurora(t, intensity, shakeX, shakeY, bass.auroraPulse, bass.waves)
      drawShimmer(t, intensity, shakeX, shakeY, bass.shimmerBurst.velocities, bass.shimmerBurst.intensity)
      
      // 💥 BOOM - Draw shockwave rings and flashes on top
      drawBoom(bass.boom, shakeX, shakeY)
      
      ctx.restore()
      
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
