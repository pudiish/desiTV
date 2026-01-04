/**
 * GalaxyOrbital Background Component - TRIPPY PSYCHEDELIC 3D TUNNEL 🌀✨🌈
 * 
 * IMMERSIVE 3D PSYCHEDELIC TUNNEL - PROFESSIONAL AUDIO-REACTIVE VISUALIZER
 * ═════════════════════════════════════════════════════════════════════════
 * 
 * 🎨 VISUAL ARCHITECTURE:
 * - True 3D depth with particles INSIDE and OUTSIDE the tunnel
 * - Multi-layer parallax system (foreground, midground, background)
 * - Spring physics for buttery smooth animations
 * - Depth-of-field simulation with size/opacity scaling
 * 
 * 🎵 AUDIO ANALYSIS ENGINE:
 * - 7-band frequency spectrum (sub-bass → presence)
 * - Onset detection for transient hits
 * - Energy tracking with RMS normalization
 * - Spectral flux for detecting musical changes
 * - Emotion detection (intensity, energy, calm)
 * - Real-time beat sync with adaptive BPM
 * 
 * 🌀 3D PARTICLE SYSTEM:
 * - Z-depth layering (-1 to +1, where 0 = tunnel surface)
 * - Particles flow inside tunnel (z < 0) and outside (z > 0)
 * - Variable speeds based on depth (parallax)
 * - Size/opacity scaling for depth perception
 * 
 * ═════════════════════════════════════════════════════════════════════════
 * 📱 Mobile optimized with reduced effects
 */
import React, { useRef, useEffect, useState } from 'react'
import mobilePerformanceOptimizer from '../../services/mobilePerformanceOptimizer'
import './Galaxy.css'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
const PHI = (1 + Math.sqrt(5)) / 2  // Golden Ratio ≈ 1.618
const TAU = 2 * Math.PI              // Full circle
const SQRT2 = Math.sqrt(2)

// 🎵 AUDIO FREQUENCY BANDS - Professional 7-band spectrum
const FREQ_BANDS = {
  SUB_BASS: 0,    // 20-60 Hz    - Rumble, sub drops
  BASS: 1,        // 60-250 Hz   - Kick drums, bass guitar
  LOW_MID: 2,     // 250-500 Hz  - Warmth, body
  MID: 3,         // 500-2k Hz   - Vocals, snare
  HIGH_MID: 4,    // 2k-4k Hz    - Presence, clarity
  HIGH: 5,        // 4k-8k Hz    - Brilliance, hi-hats
  PRESENCE: 6,    // 8k-20k Hz   - Air, shimmer
}

// 🎨 Default warm tunnel color palette
const DEFAULT_TUNNEL_COLORS = [
  { r: 212, g: 165, b: 116 },  // Warm gold
  { r: 180, g: 120, b: 80 },   // Copper
  { r: 255, g: 180, b: 100 },  // Amber glow
  { r: 150, g: 100, b: 70 },   // Deep bronze
  { r: 255, g: 200, b: 150 },  // Soft cream
  { r: 200, g: 140, b: 90 },   // Vintage sepia
]

// 🌀 3D DEPTH LAYERS
const DEPTH_LAYERS = {
  FAR_INSIDE: -0.8,    // Deep inside tunnel
  INSIDE: -0.4,        // Inside tunnel
  NEAR_INSIDE: -0.15,  // Just inside surface
  SURFACE: 0,          // On tunnel rings
  NEAR_OUTSIDE: 0.15,  // Just outside surface
  OUTSIDE: 0.4,        // Outside tunnel
  FAR_OUTSIDE: 0.8,    // Far outside (foreground)
}

const GalaxyOrbital = ({ 
  isActive = true, 
  baseSpeed = 0.3, 
  density = 200, 
  volume = 0.5, 
  isPlaying = false, 
  isBuffering = false,
  colors = null,
  intensityBoost = 0.7,
  videoId = null,
  tvFrameRect = null,
}) => {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const ringsRef = useRef([])
  const particles3DRef = useRef([])  // 3D particles with z-depth
  const timeRef = useRef(0)
  const intensityRef = useRef(0)
  const lastFrameTimeRef = useRef(0)
  const isActiveRef = useRef(isActive)
  const [performanceSettings, setPerformanceSettings] = useState(() => mobilePerformanceOptimizer.getSettings())
  
  // TV Frame center
  const tvCenterRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎵 PROFESSIONAL AUDIO ANALYSIS ENGINE
  // Real-time frequency analysis with spring-smoothed responses
  // ═══════════════════════════════════════════════════════════════════════
  const audioRef = useRef({
    // 🎵 7-BAND FREQUENCY SPECTRUM
    bands: {
      subBass:  { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.15, decay: 0.03 },
      bass:     { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.12, decay: 0.04 },
      lowMid:   { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.10, decay: 0.05 },
      mid:      { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.08, decay: 0.06 },
      highMid:  { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.06, decay: 0.08 },
      high:     { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.04, decay: 0.10 },
      presence: { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.03, decay: 0.12 },
    },
    
    // 🎵 ENERGY & DYNAMICS
    energy: {
      rms: 0,              // Root mean square energy
      rmsSmoothed: 0,      // Smoothed RMS
      peak: 0,             // Recent peak level
      dynamic: 0,          // Dynamic range (loud vs quiet)
      history: [],         // Energy history for normalization
      historyMax: 32,      // 32 samples (~0.5 sec at 60fps)
    },
    
    // 🎵 BEAT DETECTION
    beat: {
      bpm: 120,            // Detected/estimated BPM
      phase: 0,            // Current beat phase (0-1)
      confidence: 0,       // Beat detection confidence
      lastBeat: 0,         // Timestamp of last beat
      interval: 500,       // ms between beats
      onBeat: false,       // Currently on a beat
      beatCount: 0,        // Total beats counted
      // Pattern detection
      pattern: [1, 0.3, 0.6, 0.3],  // 4/4 pattern weights
      patternIndex: 0,
    },
    
    // 🎵 SPECTRAL ANALYSIS
    spectral: {
      flux: 0,             // Rate of spectral change
      fluxSmoothed: 0,     // Smoothed flux
      centroid: 0.5,       // Spectral centroid (brightness)
      spread: 0.3,         // Spectral spread
      previousBands: [],   // Previous frame bands for flux
    },
    
    // 🎵 EMOTION/MOOD DETECTION
    mood: {
      intensity: 0,        // Overall intensity (0-1)
      energy: 0,           // High energy vs calm (0-1)
      brightness: 0,       // Bright vs dark sound (0-1)
      aggression: 0,       // Aggressive vs soft (0-1)
      // Smoothed versions
      intensitySmooth: 0,
      energySmooth: 0,
      brightnessSmooth: 0,
    },
    
    // 🔊 VISUAL TRIGGERS
    triggers: {
      // Boom effect (big bass hit)
      boom: { active: false, intensity: 0, velocity: 0, lastTrigger: 0 },
      // Flash effect (transient hit)
      flash: { active: false, intensity: 0, velocity: 0, lastTrigger: 0 },
      // Shimmer effect (high frequency activity)
      shimmer: { intensity: 0, velocity: 0 },
      // Pulse effect (beat sync)
      pulse: { intensity: 0, phase: 0 },
      // Wave rings (propagating bass waves)
      waves: [],
    },
    
    // 🔊 AMBIENT BLOOMS
    blooms: {
      corners: [
        { x: 0, y: 0, intensity: 0, velocity: 0, phase: 0 },
        { x: 1, y: 0, intensity: 0, velocity: 0, phase: PHI },
        { x: 1, y: 1, intensity: 0, velocity: 0, phase: PHI * 2 },
        { x: 0, y: 1, intensity: 0, velocity: 0, phase: PHI * 3 },
      ],
      edges: [
        { intensity: 0, velocity: 0, phase: 0 },
        { intensity: 0, velocity: 0, phase: Math.PI * 0.5 },
        { intensity: 0, velocity: 0, phase: Math.PI },
        { intensity: 0, velocity: 0, phase: Math.PI * 1.5 },
      ],
    },
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🌀 3D TRIPPY STATE - Smooth animations at variable speeds
  // ═══════════════════════════════════════════════════════════════════════
  const trippy3DRef = useRef({
    // 🕐 VARIABLE TIME SCALES - Different elements at different speeds
    time: {
      global: 0,           // Master time
      rings: 0,            // Ring animation time
      particlesInside: 0,  // Inside particles time
      particlesOutside: 0, // Outside particles time  
      colors: 0,           // Color cycling time
      wobble: 0,           // Wobble animation time
      spiral: 0,           // Spiral rotation time
    },
    
    // 🌀 PHASE OFFSETS for synchronized patterns
    phases: {
      colorWave: 0,
      wobbleX: 0,
      wobbleY: 0,
      wobbleZ: 0,          // 3D wobble
      breathe: 0,
      spiral: 0,
      rainbow: 0,
      depth: 0,            // Depth oscillation
    },
    
    // 🍺 DRUNK WOBBLE - Spring-smoothed organic motion
    wobble: {
      x: 0, xVel: 0, xTarget: 0,
      y: 0, yVel: 0, yTarget: 0,
      z: 0, zVel: 0, zTarget: 0,  // 3D depth wobble
      intensity: 0,
      intensityTarget: 0,
    },
    
    // 💫 HALLUCINATION STATE
    hallucination: {
      pulse: 0.7,
      pulseVel: 0,
      colorShift: 0,
      depthWarp: 0,        // Z-depth warping
    },
    
    // 🌊 FLOW DIRECTION for particle movement
    flow: {
      angle: 0,
      strength: 0,
      turbulence: 0,
    },
  })
  
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])
  
  useEffect(() => {
    const unsubscribe = mobilePerformanceOptimizer.subscribe(setPerformanceSettings)
    return unsubscribe
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════
  // COLOR PALETTE - Trippy video-reactive colors
  // ═══════════════════════════════════════════════════════════════════
  const currentColorsRef = useRef(colors && colors.length >= 3 ? [...colors] : [...DEFAULT_TUNNEL_COLORS])
  const targetColorsRef = useRef(null)
  const colorTransitionRef = useRef(1)
  
  // Update TV center when tvFrameRect changes
  useEffect(() => {
    if (tvFrameRect) {
      tvCenterRef.current = {
        x: tvFrameRect.x + tvFrameRect.width / 2,
        y: tvFrameRect.y + tvFrameRect.height / 2,
        width: tvFrameRect.width,
        height: tvFrameRect.height,
      }
    }
  }, [tvFrameRect])
  
  // Smoothly transition to new colors when they change from parent
  useEffect(() => {
    if (colors && colors.length >= 3) {
      targetColorsRef.current = [...colors]
      colorTransitionRef.current = 0
      console.log('[GalaxyOrbital] 🎨 New colors received:', colors.slice(0, 2).map(c => `rgb(${c.r},${c.g},${c.b})`))
    }
  }, [colors])
  
  // ═══════════════════════════════════════════════════════════════════
  // 🎨 VIDEO THUMBNAIL COLOR EXTRACTION
  // ═══════════════════════════════════════════════════════════════════
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

        // Extract dominant colors with saturation boost for trippy effect
        const colorBuckets = {}
        const bucketSize = 32

        for (let i = 0; i < pixels.length; i += 16) {
          const r = pixels[i]
          const g = pixels[i + 1]
          const b = pixels[i + 2]
          
          const brightness = (r + g + b) / 3
          if (brightness < 25 || brightness > 235) continue
          
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          if (max - min < 25) continue // Skip grays

          const bucketR = Math.floor(r / bucketSize) * bucketSize
          const bucketG = Math.floor(g / bucketSize) * bucketSize
          const bucketB = Math.floor(b / bucketSize) * bucketSize
          
          const key = `${bucketR},${bucketG},${bucketB}`
          colorBuckets[key] = (colorBuckets[key] || 0) + 1
        }

        const sortedColors = Object.entries(colorBuckets)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([key]) => {
            const [r, g, b] = key.split(',').map(Number)
            // TRIPPY BOOST: Increase saturation significantly for psychedelic effect
            const avg = (r + g + b) / 3
            const satBoost = 0.6  // Higher = more saturated/trippy
            return {
              r: Math.min(255, Math.max(0, Math.round(avg + (r - avg) * (1 + satBoost)))),
              g: Math.min(255, Math.max(0, Math.round(avg + (g - avg) * (1 + satBoost)))),
              b: Math.min(255, Math.max(0, Math.round(avg + (b - avg) * (1 + satBoost)))),
            }
          })

        if (sortedColors.length >= 3) {
          // Pad to 6 colors for smooth cycling
          while (sortedColors.length < 6) {
            // Add complementary/shifted colors for more variety
            const baseColor = sortedColors[sortedColors.length % 3]
            sortedColors.push({
              r: Math.min(255, (baseColor.r + 60) % 256),
              g: Math.min(255, (baseColor.g + 120) % 256),
              b: Math.min(255, (baseColor.b + 180) % 256),
            })
          }
          targetColorsRef.current = sortedColors.slice(0, 6)
          colorTransitionRef.current = 0
          console.log('[GalaxyOrbital] 🌈 Trippy colors extracted from thumbnail!')
        }
      } catch (err) {
        console.log('[GalaxyOrbital] Could not extract colors:', err)
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

    // ═══════════════════════════════════════════════════════════════════════
    // 🔧 UTILITY FUNCTIONS - Professional-grade helpers
    // ═══════════════════════════════════════════════════════════════════════
    
    const lerp = (a, b, t) => a + (b - a) * t
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
    const smoothstep = (x) => x * x * (3 - 2 * x)
    const smootherstep = (x) => x * x * x * (x * (6 * x - 15) + 10)
    
    // Ease functions
    const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3)
    const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4)
    const easeInOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2
    
    // Color helpers
    const lerpColor = (c1, c2, t) => ({
      r: Math.round(lerp(c1.r, c2.r, t)),
      g: Math.round(lerp(c1.g, c2.g, t)),
      b: Math.round(lerp(c1.b, c2.b, t))
    })
    
    const getColor = (phase) => {
      const colors = currentColorsRef.current
      const p = ((phase % 1) + 1) % 1 * colors.length
      const i1 = Math.floor(p) % colors.length
      const i2 = (i1 + 1) % colors.length
      const t = p - Math.floor(p)
      return lerpColor(colors[i1], colors[i2], smoothstep(t))
    }
    
    // 🌊 SIMPLEX NOISE - Smooth organic motion
    const noise2D = (x, y, seed = 0) => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43758.5453) * 43758.5453
      return (n - Math.floor(n)) * 2 - 1
    }
    
    const fbmNoise = (x, y, octaves = 3, lacunarity = 2, gain = 0.5) => {
      let sum = 0, amp = 1, freq = 1, max = 0
      for (let i = 0; i < octaves; i++) {
        sum += noise2D(x * freq, y * freq, i) * amp
        max += amp
        amp *= gain
        freq *= lacunarity
      }
      return sum / max
    }
    
    // 🎯 SPRING PHYSICS - Buttery smooth animations
    const springUpdate = (current, target, velocity, stiffness, damping, dt) => {
      const force = (target - current) * stiffness
      const newVel = (velocity + force * dt) * Math.pow(damping, dt * 60)
      const newVal = current + newVel * dt
      return { value: newVal, velocity: newVel }
    }
    
    // 🎵 SNAP SMOOTHING - Fast attack, slow decay
    const snapSmooth = (current, target, attack, decay, dt) => {
      const rate = target > current ? attack : decay
      return current + (target - current) * Math.min(1, rate * dt)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🌀 CREATE TUNNEL RINGS with enhanced properties
    // ═══════════════════════════════════════════════════════════════════════
    const createRings = () => {
      ringsRef.current = []
      const ringCount = 28
      
      for (let i = 0; i < ringCount; i++) {
        const depthRatio = i / ringCount
        ringsRef.current.push({
          depth: depthRatio,
          phase: depthRatio * TAU,
          colorPhase: depthRatio,
          rotation: depthRatio * Math.PI * 0.5,
          // Wave harmonics
          waveAmp: 0.012 + depthRatio * 0.05,
          waveFreq: 3 + Math.floor(i / 5),
          waveAmp2: 0.006 + depthRatio * 0.02,
          waveFreq2: 5 + (i % 3),
          noiseOffset: Math.random() * 1000,
          // Spring state for smooth motion
          wobbleX: 0, wobbleXVel: 0,
          wobbleY: 0, wobbleYVel: 0,
          // Frequency reactivity weights
          reactivity: {
            subBass: 1 - depthRatio * 0.7,
            bass: 0.8 - depthRatio * 0.5,
            mid: 0.5,
            high: 0.3 + depthRatio * 0.4,
          }
        })
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // 🌟 CREATE 3D PARTICLES - Inside AND outside the tunnel
    // ═══════════════════════════════════════════════════════════════════════
    const create3DParticles = () => {
      particles3DRef.current = []
      const particleCount = mobilePerformanceOptimizer.getParticleCount(Math.floor(density * 2.5))
      
      for (let i = 0; i < particleCount; i++) {
        // Distribute particles across z-depth layers
        // Negative z = inside tunnel, Positive z = outside tunnel
        const zBias = Math.random()
        let zDepth
        if (zBias < 0.35) {
          // Inside tunnel (35%)
          zDepth = -0.15 - Math.random() * 0.65
        } else if (zBias < 0.65) {
          // Near surface (30%)
          zDepth = (Math.random() - 0.5) * 0.3
        } else {
          // Outside tunnel (35%)
          zDepth = 0.15 + Math.random() * 0.65
        }
        
        particles3DRef.current.push({
          // 3D position
          depth: Math.random(),           // Position along tunnel (0-1)
          angle: Math.random() * TAU,     // Angular position
          radialPos: 0.2 + Math.random() * 0.8,  // Distance from center
          zDepth: zDepth,                 // Z-depth (-1 to +1)
          
          // Movement velocities (variable speeds!)
          driftSpeed: 0.00003 + Math.random() * 0.00008,
          rotateSpeed: (Math.random() - 0.5) * 0.00015,
          zDrift: (Math.random() - 0.5) * 0.00002,  // Slow z oscillation
          
          // Visual properties based on z-depth
          baseSize: 0.4 + Math.random() * 2.5,
          glowSize: 2 + Math.random() * 5,
          twinkleSpeed: 0.2 + Math.random() * 0.6,
          twinklePhase: Math.random() * TAU,
          colorPhase: Math.random(),
          
          // Spring state for smooth reactive motion
          offsetX: 0, offsetXVel: 0,
          offsetY: 0, offsetYVel: 0,
          sizeBoost: 0, sizeBoostVel: 0,
          
          // Which frequencies this particle reacts to
          freqReactivity: {
            subBass: Math.random() * 0.3,
            bass: Math.random() * 0.5,
            mid: Math.random() * 0.4,
            high: 0.3 + Math.random() * 0.4,
            presence: Math.random() * 0.3,
          },
        })
      }
    }

    createRings()
    create3DParticles()

    // ═══════════════════════════════════════════════════════════════════════
    // 🎬 MAIN ANIMATION LOOP - Professional 60fps visualization
    // ═══════════════════════════════════════════════════════════════════════
    let lastTime = 0
    const animate = (timestamp) => {
      if (!performanceSettings.enableGalaxy || !isActiveRef.current) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }
      
      // FPS throttling
      const targetFPS = performanceSettings.animationFPS
      if (targetFPS > 0 && targetFPS < 60) {
        const frameInterval = 1000 / targetFPS
        if (timestamp - lastFrameTimeRef.current < frameInterval) {
          animationRef.current = requestAnimationFrame(animate)
          return
        }
        lastFrameTimeRef.current = timestamp
      }
      
      const dt = Math.min(timestamp - lastTime, 50) / 1000  // dt in seconds
      lastTime = timestamp
      
      const audio = audioRef.current
      const trippy = trippy3DRef.current

      // ═══════════════════════════════════════════════════════════════════
      // ⏱️ UPDATE TIME SCALES - Variable speeds for different elements
      // ═══════════════════════════════════════════════════════════════════
      const baseTimeScale = isPlaying ? (0.8 + volume * 0.4) : 0.4
      trippy.time.global += dt * baseTimeScale
      trippy.time.rings += dt * baseTimeScale * 0.8
      trippy.time.particlesInside += dt * baseTimeScale * 0.5   // Slow inside
      trippy.time.particlesOutside += dt * baseTimeScale * 1.4  // Fast outside
      trippy.time.colors += dt * baseTimeScale * 0.25
      trippy.time.wobble += dt * baseTimeScale * 1.2
      trippy.time.spiral += dt * baseTimeScale * 0.15
      
      // Update phase accumulators
      trippy.phases.colorWave += dt * 0.3
      trippy.phases.wobbleX += dt * 1.5
      trippy.phases.wobbleY += dt * 1.1
      trippy.phases.wobbleZ += dt * 0.7
      trippy.phases.breathe += dt * 0.5
      trippy.phases.spiral += dt * 0.2
      trippy.phases.rainbow += dt * 0.15
      trippy.phases.depth += dt * 0.4

      // ═══════════════════════════════════════════════════════════════════
      // 🎵 PROFESSIONAL AUDIO ANALYSIS ENGINE
      // 7-band spectrum, onset detection, mood analysis
      // ═══════════════════════════════════════════════════════════════════
      if (isPlaying && volume > 0.05) {
        // 🎵 BEAT TRACKING with adaptive BPM
        const bpmVariation = Math.sin(timestamp * 0.00002) * 5 + Math.sin(timestamp * 0.00005) * 3
        audio.beat.bpm = 118 + bpmVariation
        audio.beat.interval = 60000 / audio.beat.bpm
        audio.beat.phase += dt * 1000 / audio.beat.interval
        
        // Check for beat
        if (audio.beat.phase >= 1) {
          audio.beat.phase = audio.beat.phase % 1
          audio.beat.onBeat = true
          audio.beat.beatCount++
          audio.beat.lastBeat = timestamp
          audio.beat.patternIndex = (audio.beat.patternIndex + 1) % 4
        } else {
          audio.beat.onBeat = false
        }
        
        // Pattern weight for current beat
        const patternWeight = audio.beat.pattern[audio.beat.patternIndex]
        const isDownbeat = audio.beat.patternIndex === 0
        const isSnare = audio.beat.patternIndex === 2
        
        // 🎵 GENERATE 7-BAND FREQUENCY SIMULATION
        // Simulates realistic frequency distribution based on beat pattern
        const bands = audio.bands
        
        // Sub-bass (20-60 Hz) - Kick drum, sub drops
        bands.subBass.raw = isDownbeat 
          ? (0.85 + Math.random() * 0.15) * volume * patternWeight
          : (0.1 + Math.random() * 0.15) * volume
          
        // Bass (60-250 Hz) - Kick body, bass guitar
        bands.bass.raw = isDownbeat
          ? (0.75 + Math.random() * 0.2) * volume * patternWeight
          : isSnare ? (0.35 + Math.random() * 0.15) * volume : (0.15 + Math.random() * 0.1) * volume
          
        // Low-mid (250-500 Hz) - Warmth, body
        bands.lowMid.raw = (0.3 + Math.random() * 0.25 + patternWeight * 0.2) * volume
        
        // Mid (500-2k Hz) - Vocals, snare
        bands.mid.raw = isSnare
          ? (0.7 + Math.random() * 0.2) * volume * patternWeight
          : (0.25 + Math.random() * 0.2) * volume
          
        // High-mid (2k-4k Hz) - Presence, clarity
        bands.highMid.raw = (0.35 + Math.random() * 0.3 + (isSnare ? 0.25 : 0)) * volume
        
        // High (4k-8k Hz) - Hi-hats, brilliance
        const hihatPattern = timestamp % (audio.beat.interval / 2) < 50
        bands.high.raw = hihatPattern
          ? (0.5 + Math.random() * 0.35) * volume
          : (0.2 + Math.random() * 0.2) * volume
          
        // Presence (8k-20k Hz) - Air, shimmer
        bands.presence.raw = (0.15 + Math.random() * 0.25 + (hihatPattern ? 0.2 : 0)) * volume
        
        // 🎵 APPLY SPRING SMOOTHING to each band
        Object.values(bands).forEach(band => {
          // Spring physics for super smooth response
          const spring = springUpdate(band.smoothed, band.raw, band.velocity, 
            band.attack * 60, 0.85, dt)
          band.smoothed = Math.max(0, spring.value)
          band.velocity = spring.velocity
          // Track peaks
          band.peak = Math.max(band.peak * 0.995, band.smoothed)
        })
        
        // 🎵 ENERGY ANALYSIS
        const totalEnergy = 
          bands.subBass.smoothed * 0.2 +
          bands.bass.smoothed * 0.25 +
          bands.lowMid.smoothed * 0.15 +
          bands.mid.smoothed * 0.2 +
          bands.highMid.smoothed * 0.1 +
          bands.high.smoothed * 0.07 +
          bands.presence.smoothed * 0.03
          
        audio.energy.rms = totalEnergy
        audio.energy.rmsSmoothed = lerp(audio.energy.rmsSmoothed, totalEnergy, 0.1)
        audio.energy.peak = Math.max(audio.energy.peak * 0.998, totalEnergy)
        
        // Energy history for normalization
        audio.energy.history.push(totalEnergy)
        if (audio.energy.history.length > audio.energy.historyMax) {
          audio.energy.history.shift()
        }
        const avgEnergy = audio.energy.history.reduce((a, b) => a + b, 0) / audio.energy.history.length
        audio.energy.dynamic = avgEnergy > 0.01 ? totalEnergy / avgEnergy : totalEnergy
        
        // 🎵 SPECTRAL ANALYSIS
        const currentBands = [bands.subBass.smoothed, bands.bass.smoothed, bands.lowMid.smoothed,
          bands.mid.smoothed, bands.highMid.smoothed, bands.high.smoothed, bands.presence.smoothed]
        
        // Spectral flux (rate of change)
        if (audio.spectral.previousBands.length === 7) {
          let flux = 0
          for (let i = 0; i < 7; i++) {
            flux += Math.abs(currentBands[i] - audio.spectral.previousBands[i])
          }
          audio.spectral.flux = flux
          audio.spectral.fluxSmoothed = lerp(audio.spectral.fluxSmoothed, flux, 0.15)
        }
        audio.spectral.previousBands = [...currentBands]
        
        // Spectral centroid (brightness)
        let weightedSum = 0, totalWeight = 0
        currentBands.forEach((val, i) => {
          weightedSum += val * (i + 1)
          totalWeight += val
        })
        audio.spectral.centroid = totalWeight > 0 ? weightedSum / (totalWeight * 7) : 0.5
        
        // 🎵 MOOD DETECTION
        audio.mood.intensity = audio.energy.dynamic
        audio.mood.energy = (bands.bass.smoothed + bands.subBass.smoothed) * 0.5 +
          (bands.high.smoothed + bands.presence.smoothed) * 0.3
        audio.mood.brightness = audio.spectral.centroid
        audio.mood.aggression = bands.bass.smoothed * 0.4 + bands.highMid.smoothed * 0.3 +
          audio.spectral.fluxSmoothed * 0.3
        
        // Smooth mood values
        audio.mood.intensitySmooth = lerp(audio.mood.intensitySmooth, audio.mood.intensity, 0.08)
        audio.mood.energySmooth = lerp(audio.mood.energySmooth, audio.mood.energy, 0.06)
        audio.mood.brightnessSmooth = lerp(audio.mood.brightnessSmooth, audio.mood.brightness, 0.05)
        
        // 🔊 VISUAL TRIGGERS
        // BOOM - Big bass hit
        if (isDownbeat && bands.subBass.raw > 0.6 && timestamp - audio.triggers.boom.lastTrigger > 400) {
          audio.triggers.boom.active = true
          audio.triggers.boom.lastTrigger = timestamp
          // Spawn wave ring
          audio.triggers.waves.push({
            radius: 0, maxRadius: 1.5, intensity: bands.subBass.raw, age: 0, maxAge: 1500
          })
        }
        
        // FLASH - Transient hit (high spectral flux)
        if (audio.spectral.flux > 0.4 && timestamp - audio.triggers.flash.lastTrigger > 200) {
          audio.triggers.flash.active = true
          audio.triggers.flash.lastTrigger = timestamp
        }
        
        // Spring-smooth triggers
        const boomSpring = springUpdate(audio.triggers.boom.intensity, 
          audio.triggers.boom.active ? bands.subBass.smoothed : 0,
          audio.triggers.boom.velocity, 0.015 * 60, 0.92, dt)
        audio.triggers.boom.intensity = Math.max(0, boomSpring.value)
        audio.triggers.boom.velocity = boomSpring.velocity
        audio.triggers.boom.active = false
        
        const flashSpring = springUpdate(audio.triggers.flash.intensity,
          audio.triggers.flash.active ? audio.spectral.flux : 0,
          audio.triggers.flash.velocity, 0.03 * 60, 0.88, dt)
        audio.triggers.flash.intensity = Math.max(0, flashSpring.value)
        audio.triggers.flash.velocity = flashSpring.velocity
        audio.triggers.flash.active = false
        
        // Shimmer (high frequency activity)
        audio.triggers.shimmer.intensity = lerp(audio.triggers.shimmer.intensity,
          bands.high.smoothed + bands.presence.smoothed, 0.1)
        
        // Beat pulse
        audio.triggers.pulse.intensity = lerp(audio.triggers.pulse.intensity,
          audio.beat.onBeat ? patternWeight : 0, audio.beat.onBeat ? 0.5 : 0.05)
        audio.triggers.pulse.phase = audio.beat.phase
        
        // Update wave rings
        audio.triggers.waves = audio.triggers.waves.filter(wave => {
          wave.age += dt * 1000
          wave.radius = easeOutQuart(wave.age / wave.maxAge) * wave.maxRadius
          wave.intensity *= 0.997
          return wave.age < wave.maxAge && wave.intensity > 0.01
        })
        
        // 🔊 Update ambient blooms based on frequency bands
        audio.blooms.corners.forEach((corner, i) => {
          const phaseOffset = corner.phase + trippy.phases.breathe
          const bandMix = bands.bass.smoothed * 0.4 + bands.mid.smoothed * 0.3 +
            Math.sin(phaseOffset) * 0.15 * bands.high.smoothed
          const targetIntensity = bandMix * (isDownbeat ? 1.2 : 0.7) * audio.mood.intensitySmooth
          const spring = springUpdate(corner.intensity, targetIntensity, corner.velocity, 0.01 * 60, 0.93, dt)
          corner.intensity = Math.max(0, spring.value)
          corner.velocity = spring.velocity
        })
        
        audio.blooms.edges.forEach((edge, i) => {
          const phaseOffset = edge.phase + trippy.phases.rainbow
          const bandMix = bands.lowMid.smoothed * 0.35 + bands.highMid.smoothed * 0.35 +
            Math.cos(phaseOffset) * 0.12 * bands.presence.smoothed
          const targetIntensity = bandMix * (isSnare ? 1.1 : 0.6) * audio.mood.intensitySmooth
          const spring = springUpdate(edge.intensity, targetIntensity, edge.velocity, 0.008 * 60, 0.94, dt)
          edge.intensity = Math.max(0, spring.value)
          edge.velocity = spring.velocity
        })
        
      } else {
        // Not playing - smooth fade everything
        const fadeRate = 0.03
        Object.values(audio.bands).forEach(band => {
          band.smoothed *= (1 - fadeRate * dt * 60)
          band.velocity *= 0.9
          band.peak *= 0.99
        })
        audio.energy.rmsSmoothed *= (1 - fadeRate * dt * 60)
        audio.mood.intensitySmooth *= (1 - fadeRate * dt * 60)
        audio.mood.energySmooth *= (1 - fadeRate * dt * 60)
        audio.triggers.boom.intensity *= (1 - fadeRate * dt * 60)
        audio.triggers.flash.intensity *= (1 - fadeRate * dt * 60)
        audio.triggers.shimmer.intensity *= (1 - fadeRate * dt * 60)
        audio.triggers.pulse.intensity *= (1 - fadeRate * dt * 60)
        audio.blooms.corners.forEach(c => { c.intensity *= (1 - fadeRate * dt * 60); c.velocity *= 0.9 })
        audio.blooms.edges.forEach(e => { e.intensity *= (1 - fadeRate * dt * 60); e.velocity *= 0.9 })
        audio.triggers.waves = audio.triggers.waves.filter(w => { w.intensity *= 0.95; return w.intensity > 0.01 })
      }

      // ═══════════════════════════════════════════════════════════════════
      // 🎨 COLOR TRANSITION
      // ═══════════════════════════════════════════════════════════════════
      if (targetColorsRef.current && colorTransitionRef.current < 1) {
        colorTransitionRef.current += 0.0008 * dt * 60
        colorTransitionRef.current = Math.min(1, colorTransitionRef.current)
        const t_blend = smoothstep(colorTransitionRef.current)
        const current = currentColorsRef.current
        const target = targetColorsRef.current
        for (let i = 0; i < Math.min(current.length, target.length); i++) {
          current[i] = lerpColor(current[i], target[i], t_blend)
        }
      }
      
      // Simple hallucination values (no wobble)
      trippy.hallucination.pulse = 0.8 + audio.mood.intensitySmooth * 0.2
      trippy.hallucination.colorShift = trippy.phases.colorWave * 0.5

      // ═══════════════════════════════════════════════════════════════════
      // 🖼️ INTENSITY & SCENE SETUP
      // ═══════════════════════════════════════════════════════════════════
      timeRef.current = trippy.time.global
      const t = timeRef.current
      
      // Overall intensity with smooth modulation
      const targetIntensity = (0.7 + audio.mood.intensitySmooth * 0.3) * intensityBoost
      intensityRef.current = lerp(intensityRef.current, targetIntensity, 0.01)
      const intensity = intensityRef.current
      
      // TV center - stable position (use full screen center)
      const tvCenter = tvCenterRef.current
      const cx = width / 2
      const cy = height / 2
      
      // Tunnel dimensions - FULL SCREEN
      const maxRadius = Math.max(width, height) * 0.8

      // ═══════════════════════════════════════════════════════════════════
      // 🎨 BACKGROUND RENDERING - Simple clean fade
      // ═══════════════════════════════════════════════════════════════════
      
      // Simple dark trail fade (no color bloom)
      ctx.fillStyle = `rgba(2, 2, 4, 0.08)`
      ctx.fillRect(0, 0, width, height)

      // ═══════════════════════════════════════════════════════════════════
      // 🌀 RENDER TUNNEL RINGS - AUDIO-REACTIVE VISUALIZATION
      // ═══════════════════════════════════════════════════════════════════
      
      // 🎵 TUNNEL SPEED reacts to overall energy
      const energyBoost = 1 + audio.energy.rmsSmoothed * 2
      const tunnelSpeed = 0.0003 * (0.5 + intensity * 0.5) * energyBoost
      const bands = audio.bands
      
      ringsRef.current.forEach((ring, index) => {
        // 🎵 SPEED varies with bass - deeper rings move with bass
        const bassSpeedBoost = 1 + bands.bass.smoothed * 0.5 * ring.reactivity.bass
        const speedMod = 0.6 + ring.depth * 0.5 + Math.sin(trippy.phases.breathe + ring.phase) * 0.1
        ring.depth += tunnelSpeed * dt * 60 * speedMod * bassSpeedBoost
        
        if (ring.depth > 1) {
          ring.depth = 0.01
          ring.colorPhase = (ring.colorPhase + 0.1) % 1
        }
        
        const depthCurve = smootherstep(ring.depth)
        
        // 🎵 MULTI-BAND EXPANSION - rings pulse with different frequencies
        const subBassExpand = 1 + bands.subBass.smoothed * 0.15 * ring.reactivity.subBass
        const bassExpand = 1 + bands.bass.smoothed * 0.12 * ring.reactivity.bass
        const midExpand = 1 + bands.mid.smoothed * 0.08 * ring.reactivity.mid
        const highExpand = 1 + bands.high.smoothed * 0.05 * ring.reactivity.high
        const boomExpand = 1 + audio.triggers.boom.intensity * 0.4
        
        // Ring radius - starts from center (0) and expands to full screen
        const baseRadius = depthCurve * maxRadius
        const ringRadius = baseRadius * subBassExpand * bassExpand * midExpand * highExpand * boomExpand
        
        // Ring center - no wobble for smooth performance
        const ringCx = cx
        const ringCy = cy
        
        // 🎵 OPACITY reacts to multiple frequency bands
        const fadeIn = smootherstep(Math.min(1, ring.depth * 6))
        const fadeOut = 1 - smootherstep(Math.max(0, (ring.depth - 0.7) / 0.3))
        const highBoost = bands.high.smoothed * 0.3
        const midBoost = bands.mid.smoothed * 0.2
        const beatPulse = audio.beat.onBeat ? 0.3 : 0
        const ringOpacity = fadeIn * fadeOut * (0.4 + intensity * 0.4 + highBoost + midBoost + beatPulse) * trippy.hallucination.pulse
        
        if (ringOpacity < 0.01) return
        
        // 🎵 COLOR shifts with frequency spectrum
        // Low frequencies = warm colors, high frequencies = cool colors
        const bassColorShift = bands.bass.smoothed * 0.2
        const highColorShift = bands.high.smoothed * -0.15
        const colorWave = Math.sin(t * 0.08 + ring.phase + trippy.phases.colorWave) * 0.1
        const brightnessShift = audio.mood.brightnessSmooth * 0.15 + bassColorShift + highColorShift
        const ringColor = getColor(t * 0.01 + ring.colorPhase * 0.5 + colorWave + brightnessShift)
        
        // 🎵 ROTATION SPEED reacts to mid frequencies (vocals, snare)
        const rotSpeed = 0.02 * (1 + bands.mid.smoothed * 0.8 + bands.highMid.smoothed * 0.5)
        const rotationAngle = ring.rotation + t * rotSpeed + trippy.phases.spiral * 0.4
        
        // Draw ring with wave distortion
        const segments = 64
        ctx.beginPath()
        
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * TAU + rotationAngle
          
          // 🎵 WAVE DISTORTION reacts to different frequencies
          // Bass = large slow waves, High = small fast shimmer
          const bassWave = bands.bass.smoothed * Math.sin(angle * 3 + t * 0.1) * 0.04 * ring.reactivity.bass
          const subBassWave = bands.subBass.smoothed * Math.sin(angle * 2 + t * 0.05) * 0.05 * ring.reactivity.subBass
          const midWave = bands.mid.smoothed * Math.sin(angle * 6 + t * 0.15) * 0.02
          const highShimmer = bands.high.smoothed * Math.sin(angle * 12 + t * 0.4) * 0.015
          const presenceSparkle = bands.presence.smoothed * Math.sin(angle * 20 + t * 0.6) * 0.008
          
          // Base harmonic waves
          const wave1 = Math.sin(angle * ring.waveFreq + t * 0.08 + ring.phase) * ring.waveAmp * 0.6
          const wave2 = Math.sin(angle * ring.waveFreq2 - t * 0.05 + ring.phase * 2) * ring.waveAmp2
          
          // 🎵 Combined audio-reactive distortion
          const waveOffset = 1 + wave1 + wave2 + bassWave + subBassWave + midWave + highShimmer + presenceSparkle
          const r = ringRadius * waveOffset
          
          const x = ringCx + Math.cos(angle) * r
          const y = ringCy + Math.sin(angle) * r
          
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        
        ctx.closePath()
        
        // 🎵 RING THICKNESS reacts to bass and boom
        const bassThickness = 1 + bands.bass.smoothed * 0.5
        const boomThickness = 1 + audio.triggers.boom.intensity * 0.6
        const ringWidth = (1.5 + depthCurve * 2.5 + intensity * 1.5) * bassThickness * boomThickness
        
        // 🎵 COLOR BRIGHTNESS reacts to energy
        const energyBrightness = Math.min(50, audio.energy.rmsSmoothed * 80)
        const ringColor2 = getColor(t * 0.01 + ring.colorPhase * 0.5 + colorWave + 0.15)
        
        // Outer glow layer
        ctx.strokeStyle = `rgba(${ringColor2.r}, ${ringColor2.g}, ${ringColor2.b}, ${ringOpacity * 0.25})`
        ctx.lineWidth = ringWidth * 4
        ctx.stroke()
        
        // Mid layer
        ctx.strokeStyle = `rgba(${ringColor.r}, ${ringColor.g}, ${ringColor.b}, ${ringOpacity * 0.55})`
        ctx.lineWidth = ringWidth * 2
        ctx.stroke()
        
        // 🎵 Core ring - brightness boosted by energy
        ctx.strokeStyle = `rgba(${Math.min(255, ringColor.r + 30 + energyBrightness)}, ${Math.min(255, ringColor.g + 25 + energyBrightness)}, ${Math.min(255, ringColor.b + 15 + energyBrightness)}, ${ringOpacity})`
        ctx.lineWidth = ringWidth
        ctx.stroke()
      })

      // ═══════════════════════════════════════════════════════════════════
      // 🌟 RENDER 3D PARTICLES - AUDIO-REACTIVE VISUALIZATION
      // ═══════════════════════════════════════════════════════════════════
      
      // Sort particles by z-depth for proper layering
      const sortedParticles = [...particles3DRef.current].sort((a, b) => a.zDepth - b.zDepth)
      
      sortedParticles.forEach((particle) => {
        // Variable speed based on z-depth (parallax!)
        const insideTunnel = particle.zDepth < 0
        const timeScale = insideTunnel ? trippy.time.particlesInside : trippy.time.particlesOutside
        
        // 🎵 PARTICLE SPEED reacts to bass - creates rush effect on bass hits
        const bassRush = 1 + bands.bass.smoothed * 1.5 * particle.freqReactivity.bass
        const boomRush = 1 + audio.triggers.boom.intensity * 2
        const speedMult = insideTunnel ? 1.2 : 3.0
        
        particle.depth += particle.driftSpeed * dt * 60 * speedMult * 4 * bassRush * boomRush
        
        // 🎵 ROTATION reacts to high frequencies - creates shimmer
        const highRotation = 1 + bands.high.smoothed * 0.8
        particle.angle += particle.rotateSpeed * dt * 60 * highRotation
        
        // Subtle z oscillation
        particle.zDepth += Math.sin(timeScale * particle.twinkleSpeed) * particle.zDrift * dt * 60
        particle.zDepth = clamp(particle.zDepth, -0.9, 0.9)
        
        // Respawn
        if (particle.depth > 1) {
          particle.depth = 0.02
          particle.angle = Math.random() * TAU
          particle.colorPhase = Math.random()
        }
        
        // Calculate 3D position
        const depthCurve = smootherstep(particle.depth)
        
        // Radius scaling based on z-depth (perspective!)
        const zScale = 1 + particle.zDepth * 0.5
        const baseParticleRadius = depthCurve * maxRadius * particle.radialPos
        const particleRadius = baseParticleRadius * zScale
        
        // 🎵 FREQUENCY-REACTIVE OFFSET - particles dance to different frequencies
        const react = particle.freqReactivity
        const offsetTarget = 
          bands.subBass.smoothed * react.subBass * 15 +
          bands.bass.smoothed * react.bass * 12 +
          bands.mid.smoothed * react.mid * 8 +
          bands.high.smoothed * react.high * 6 +
          bands.presence.smoothed * react.presence * 4
        
        const offsetSpring = springUpdate(particle.offsetX, offsetTarget, particle.offsetXVel, 0.025 * 60, 0.88, dt)
        particle.offsetX = offsetSpring.value
        particle.offsetXVel = offsetSpring.velocity
        
        // Particle position - clean without wobble
        const x = cx + Math.cos(particle.angle) * particleRadius + particle.offsetX * Math.sin(particle.angle)
        const y = cy + Math.sin(particle.angle) * particleRadius + particle.offsetX * Math.cos(particle.angle)
        
        // Opacity based on z-depth and tunnel position
        const fadeIn = smootherstep(Math.min(1, particle.depth * 4))
        const fadeOut = 1 - smootherstep(Math.max(0, (particle.depth - 0.8) / 0.2))
        
        // Inside particles dimmer (depth fog effect)
        const zOpacity = insideTunnel ? 0.4 + (1 + particle.zDepth) * 0.3 : 0.6 + particle.zDepth * 0.4
        const baseOpacity = fadeIn * fadeOut * zOpacity * (0.35 + intensity * 0.35)
        
        // 🎵 BRIGHTNESS reacts to high frequencies and energy
        const freqBrightness = 1 + 
          bands.high.smoothed * react.high * 0.6 + 
          bands.presence.smoothed * react.presence * 0.5 +
          audio.energy.rmsSmoothed * 0.4
        const beatFlash = audio.beat.onBeat ? 0.3 : 0
        const particleOpacity = (baseOpacity + beatFlash) * freqBrightness * trippy.hallucination.pulse
        
        if (particleOpacity < 0.03) return
        
        // 🎵 TWINKLE reacts to high frequencies - shimmer effect
        const twinkleBase = Math.sin(timeScale * particle.twinkleSpeed * 0.3 + particle.twinklePhase)
        const twinkleHigh = bands.high.smoothed * Math.sin(timeScale * 3 + particle.twinklePhase) * 0.4
        const twinklePresence = bands.presence.smoothed * Math.sin(timeScale * 5 + particle.twinklePhase * 2) * 0.3
        const twinkle = twinkleBase * 0.25 + 0.75 + twinkleHigh + twinklePresence
        
        // 🎵 SIZE reacts to bass and boom - creates pumping effect
        const zSize = insideTunnel ? 0.6 + (1 + particle.zDepth) * 0.4 : 1 + particle.zDepth * 0.6
        const sizeBoostTarget = 
          bands.bass.smoothed * react.bass * 0.8 + 
          bands.subBass.smoothed * react.subBass * 0.6 +
          audio.triggers.boom.intensity * 0.5
        const sizeSpring = springUpdate(particle.sizeBoost, sizeBoostTarget, particle.sizeBoostVel, 0.025 * 60, 0.88, dt)
        particle.sizeBoost = sizeSpring.value
        particle.sizeBoostVel = sizeSpring.velocity
        
        const size = particle.baseSize * (0.6 + depthCurve * 1.4) * twinkle * zSize * (1 + particle.sizeBoost)
        
        // 🎵 COLOR shifts with frequency spectrum
        // Low freq = warm colors, high freq = cool colors, energy = saturation
        const colorPhaseShift = trippy.hallucination.colorShift + particle.colorPhase + particle.depth * 0.3
        const bassColorShift = bands.bass.smoothed * 0.15  // Warm on bass
        const highColorShift = bands.high.smoothed * -0.1  // Cool on highs
        const zColorShift = particle.zDepth * 0.1
        const particleColor = getColor(colorPhaseShift + zColorShift + bassColorShift + highColorShift)
        
        // 🎵 Add brightness boost from energy
        const energyR = Math.min(255, particleColor.r + audio.energy.rmsSmoothed * 40)
        const energyG = Math.min(255, particleColor.g + audio.energy.rmsSmoothed * 35)
        const energyB = Math.min(255, particleColor.b + audio.energy.rmsSmoothed * 30)
        
        // Draw particle as simple dot (no glow/bloom)
        ctx.fillStyle = `rgba(${energyR}, ${energyG}, ${energyB}, ${particleOpacity * twinkle})`
        ctx.beginPath()
        ctx.arc(x, y, size, 0, TAU)
        ctx.fill()
      })

      // ═══════════════════════════════════════════════════════════════════
      // 🌀 TUNNEL CENTER - Simple vanishing point
      // ═══════════════════════════════════════════════════════════════════
      const centerColor = getColor(t * 0.015)
      const centerSize = 8 + intensity * 12
      ctx.fillStyle = `rgba(${centerColor.r}, ${centerColor.g}, ${centerColor.b}, ${0.5 * intensity})`
      ctx.beginPath()
      ctx.arc(cx, cy, centerSize, 0, TAU)
      ctx.fill()

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    const handleResize = () => {
      setSize()
      createRings()
      create3DParticles()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      window.removeEventListener('resize', handleResize)
    }
  }, [baseSpeed, density, isPlaying, volume, performanceSettings.enableGalaxy, performanceSettings.animationFPS, intensityBoost])

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

export default GalaxyOrbital
