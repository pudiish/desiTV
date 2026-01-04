/**
 * GalaxyOrbital Background Component - HYPNOTIC TUNNEL 🌀✨
 * 
 * NEVER-ENDING PSYCHEDELIC TUNNEL EMANATING FROM TV FRAME BORDER
 * ═════════════════════════════════════════════════════════════════════════
 * 
 * Visual Concept: Flying through an infinite hypnotic tunnel
 * - Tunnel ORIGIN: TV frame border (not viewport center)
 * - Rings expand OUTWARD from TV edges creating depth illusion
 * - Warm vintage color palette matching DesiTV theme
 * - 🔊 TUNNEL BOOM ON BASS: Rings pulse on downbeats
 * 
 * Color Palette: Warm Gold/Amber (#d4a574) based theme
 * - Deep amber golds
 * - Warm copper tones
 * - Soft sepia accents
 * - Cinematic orange highlights
 * 
 * Mathematical Elements:
 * - TV-centered coordinate system
 * - Sine wave modulation for organic pulsing
 * - Phase-shifted color cycling
 * - Golden ratio spacing
 * 
 * ═════════════════════════════════════════════════════════════════════════
 * 📱 Mobile optimized with reduced effects
 */
import React, { useRef, useEffect, useState } from 'react'
import mobilePerformanceOptimizer from '../../services/mobilePerformanceOptimizer'
import './Galaxy.css'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const PHI = (1 + Math.sqrt(5)) / 2  // Golden Ratio ≈ 1.618
const TAU = 2 * Math.PI              // Full circle

// Default warm tunnel color palette - amber/gold/copper vintage theme
const DEFAULT_TUNNEL_COLORS = [
  { r: 212, g: 165, b: 116 },  // Warm gold #d4a574
  { r: 180, g: 120, b: 80 },   // Copper
  { r: 255, g: 180, b: 100 },  // Amber glow
  { r: 150, g: 100, b: 70 },   // Deep bronze
  { r: 255, g: 200, b: 150 },  // Soft cream
  { r: 200, g: 140, b: 90 },   // Vintage sepia
]

const GalaxyOrbital = ({ 
  isActive = true, 
  baseSpeed = 0.3, 
  density = 200, 
  volume = 0.5, 
  isPlaying = false, 
  isBuffering = false,
  colors = null,
  intensityBoost = 0.7,
  // TV Frame position for centered tunnel origin
  tvFrameRect = null,  // { x, y, width, height } - TV frame bounds
}) => {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const ringsRef = useRef([])
  const starsRef = useRef([])
  const timeRef = useRef(0)
  const intensityRef = useRef(0)
  const lastFrameTimeRef = useRef(0)
  const isActiveRef = useRef(isActive)
  const [performanceSettings, setPerformanceSettings] = useState(() => mobilePerformanceOptimizer.getSettings())
  
  // TV Frame center - updates when tvFrameRect changes
  const tvCenterRef = useRef({ x: 0, y: 0, width: 0, height: 0 })
  
  // Bass detection state - synthetic beat detection with SMOOTH transitions
  // 🔬 RESEARCH-BASED: Clubber.js-style adaptive smoothing + MDN smoothingTimeConstant
  const bassRef = useRef({
    lastBeat: 0,           // Timestamp of last beat
    bpm: 120,              // Base BPM (typical music tempo)
    beatInterval: 500,     // ms between beats
    rawIntensity: 0,       // Raw bass level before smoothing
    smoothIntensity: 0,    // Smoothed intensity for visuals (eased)
    targetIntensity: 0,    // Target to ease toward
    accumulator: 0,        // Beat phase accumulator
    lastTrigger: 0,        // Last beat trigger time
    
    // 🔬 ADVANCED: Rolling average for normalized energy (like Clubber.js)
    energyHistory: [],     // Last N beats for averaging
    energyHistoryMax: 8,   // Keep 8 beats of history (2 bars)
    normalizedEnergy: 0,   // Energy relative to recent history
    
    // 🔬 ADVANCED: Multi-band simulation (low, mid, high frequencies)
    bands: {
      low: 0,              // Sub-bass / kick drum
      lowTarget: 0,
      mid: 0,              // Mid frequencies / snare
      midTarget: 0,
      high: 0,             // High frequencies / hi-hats
      highTarget: 0,
    },
    
    // TUNNEL BOOM state - the tunnel itself expands on bass
    tunnelBoom: 0,         // Current tunnel expansion (0-1)
    tunnelBoomTarget: 0,   // Target expansion to ease toward
    tunnelBoomPeak: 0,     // Peak intensity for this boom
    tunnelBoomVelocity: 0, // For momentum-based animation
    
    // 🔬 ADVANCED: Wave propagation system
    waveRings: [],         // Array of expanding wave pulses
    wavePhase: 0,          // Global wave phase for sync
    
    // Ambient bloom state - smooth corner/edge glows
    bloomCorners: [
      { x: 0, y: 0, intensity: 0, targetIntensity: 0, phase: 0, velocity: 0 },
      { x: 1, y: 0, intensity: 0, targetIntensity: 0, phase: Math.PI * 0.5, velocity: 0 },
      { x: 1, y: 1, intensity: 0, targetIntensity: 0, phase: Math.PI, velocity: 0 },
      { x: 0, y: 1, intensity: 0, targetIntensity: 0, phase: Math.PI * 1.5, velocity: 0 },
    ],
    // Edge blooms - top, right, bottom, left
    bloomEdges: [
      { intensity: 0, targetIntensity: 0, phase: 0, velocity: 0 },
      { intensity: 0, targetIntensity: 0, phase: Math.PI * 0.25, velocity: 0 },
      { intensity: 0, targetIntensity: 0, phase: Math.PI * 0.5, velocity: 0 },
      { intensity: 0, targetIntensity: 0, phase: Math.PI * 0.75, velocity: 0 },
    ],
  })
  
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])
  
  useEffect(() => {
    const unsubscribe = mobilePerformanceOptimizer.subscribe(setPerformanceSettings)
    return unsubscribe
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════
  // COLOR PALETTE - Warm tunnel colors (default or from parent)
  // Colors are extracted from video thumbnails and mood detection
  // ═══════════════════════════════════════════════════════════════════
  const currentColorsRef = useRef(colors && colors.length >= 3 ? [...colors] : [...DEFAULT_TUNNEL_COLORS])
  const targetColorsRef = useRef(null)
  const colorTransitionRef = useRef(1) // 0-1, 1 = complete
  
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
      colorTransitionRef.current = 0 // Start transition
      console.log('[GalaxyOrbital] 🎨 New colors received:', colors.slice(0, 2).map(c => `rgb(${c.r},${c.g},${c.b})`))
    }
  }, [colors])

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
    // HELPER FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    const lerp = (a, b, t) => a + (b - a) * t
    
    // Very slow color lerp for smooth mood transitions
    const lerpColorSlow = (c1, c2, t) => {
      // Extra smooth easing for color transitions
      const eased = t * t * (3 - 2 * t) // smoothstep
      return {
        r: Math.round(lerp(c1.r, c2.r, eased)),
        g: Math.round(lerp(c1.g, c2.g, eased)),
        b: Math.round(lerp(c1.b, c2.b, eased)),
      }
    }
    
    const lerpColor = (c1, c2, t) => ({
      r: Math.round(lerp(c1.r, c2.r, t)),
      g: Math.round(lerp(c1.g, c2.g, t)),
      b: Math.round(lerp(c1.b, c2.b, t))
    })

    // Smooth color interpolation through palette
    const getColor = (phase) => {
      const colors = currentColorsRef.current
      const p = ((phase % 1) + 1) % 1 * colors.length
      const i1 = Math.floor(p) % colors.length
      const i2 = (i1 + 1) % colors.length
      const t = p - Math.floor(p)
      // Smooth step for buttery transitions
      const smooth = t * t * (3 - 2 * t)
      return lerpColor(colors[i1], colors[i2], smooth)
    }
    
    // Ken Perlin's smootherstep
    const smootherstep = (x) => x * x * x * (x * (6 * x - 15) + 10)
    
    // 🔬 RESEARCH-BASED: Simple Perlin-style noise for organic wave distortion
    // Inspired by Three.js particle tutorials
    const noise = (x, y, seed = 0) => {
      const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453
      return (n - Math.floor(n)) * 2 - 1  // Returns -1 to 1
    }
    
    // 🔬 RESEARCH-BASED: Clubber.js-style snap smoothing
    // Fast rise (snap), slow fall - perfect for bass response
    const snapSmooth = (current, target, snapSpeed, fallSpeed, dt) => {
      if (target > current) {
        // Rising - use snap speed (fast)
        return current + (target - current) * Math.min(1, snapSpeed * dt)
      } else {
        // Falling - use fall speed (slow)
        return current + (target - current) * Math.min(1, fallSpeed * dt)
      }
    }
    
    // 🔬 RESEARCH-BASED: MDN smoothingTimeConstant-inspired exponential smoothing
    // Like Web Audio API's analyser.smoothingTimeConstant
    const expSmooth = (current, target, smoothingConstant, dt) => {
      // Higher constant = more smoothing (0-1)
      // Formula: output = current * k + target * (1 - k)
      const k = Math.pow(smoothingConstant, dt * 0.06)  // Time-corrected
      return current * k + target * (1 - k)
    }
    
    // 🔬 RESEARCH-BASED: Momentum-based easing with velocity
    // Creates more natural, physics-based motion
    const springSmooth = (value, target, velocity, stiffness, damping, dt) => {
      const force = (target - value) * stiffness
      const newVelocity = (velocity + force * dt) * damping
      const newValue = value + newVelocity * dt
      return { value: newValue, velocity: newVelocity }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CREATE TUNNEL RINGS - Concentric circles that expand outward
    // 🔬 IMPROVED: Better wave parameters for organic distortion
    // ═══════════════════════════════════════════════════════════════════════
    const createRings = () => {
      ringsRef.current = []
      const ringCount = 25  // Number of rings in the tunnel
      
      for (let i = 0; i < ringCount; i++) {
        const depthRatio = i / ringCount
        ringsRef.current.push({
          // Position in tunnel (0 = center/far, 1 = edge/close)
          depth: depthRatio,
          
          // Phase offset for synchronized wave patterns
          phase: depthRatio * TAU,
          
          // Color phase offset - creates rainbow flow through tunnel
          colorPhase: depthRatio,
          
          // Rotation offset for spiral effect
          rotation: depthRatio * Math.PI * 0.5,
          
          // 🔬 IMPROVED: Wave parameters - multiple harmonics for organic distortion
          waveAmp: 0.015 + depthRatio * 0.06,     // Subtler base, grows outward
          waveFreq: 3 + Math.floor(i / 5),         // Harmonic frequencies
          waveAmp2: 0.008 + depthRatio * 0.025,    // Secondary harmonic
          waveFreq2: 5 + (i % 3),                  // Different frequency
          waveAmp3: 0.004 + depthRatio * 0.012,    // Tertiary harmonic
          noiseOffset: Math.random() * 1000,       // Perlin noise seed per ring
          
          // 🔬 NEW: Per-ring bass response (inner rings react more)
          bassReactivity: 1 - depthRatio * 0.6,   // Inner rings more reactive
        })
      }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CREATE FLOATING STARS - Drifting through the tunnel
    // ═══════════════════════════════════════════════════════════════════════
    const createStars = () => {
      starsRef.current = []
      const starCount = mobilePerformanceOptimizer.getParticleCount(Math.floor(density * 0.4))
      
      for (let i = 0; i < starCount; i++) {
        starsRef.current.push({
          // Start at random depth in tunnel
          depth: Math.random(),
          
          // Angular position
          angle: Math.random() * TAU,
          
          // Distance from center (as fraction of ring radius)
          radialPos: 0.3 + Math.random() * 0.7,
          
          // Drift speed - VERY SLOW
          driftSpeed: 0.00005 + Math.random() * 0.0001,
          rotateSpeed: (Math.random() - 0.5) * 0.0002,
          
          // Visual properties
          size: 0.5 + Math.random() * 2,
          twinkleSpeed: 0.3 + Math.random() * 0.7,
          twinklePhase: Math.random() * TAU,
          colorPhase: Math.random(),
          
          // Glow intensity
          glowSize: 2 + Math.random() * 4,
        })
      }
    }

    createRings()
    createStars()

    // ═══════════════════════════════════════════════════════════════════════
    // ANIMATION LOOP - SLOW HYPNOTIC TUNNEL
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
      
      const dt = Math.min(timestamp - lastTime, 50)
      lastTime = timestamp

      // ═══════════════════════════════════════════════════════════════════
      // TIME - VERY SLOW for hypnotic effect
      // ═══════════════════════════════════════════════════════════════════
      const speedMult = isPlaying ? (0.12 + volume * 0.18) : 0.06  // SLOWER!
      timeRef.current += dt * 0.0002 * speedMult  // Even slower time progression

      // Intensity cycles very slowly
      const cyclePhase = (timeRef.current % 90) / 90  // 90 second cycle (slower)
      const targetIntensity = (Math.sin(cyclePhase * TAU) * 0.25 + 0.75) * intensityBoost
      intensityRef.current += (targetIntensity - intensityRef.current) * 0.003  // Very slow interpolation

      // ═══════════════════════════════════════════════════════════════════
      // 🔊 BASS BEAT DETECTION - ADVANCED SYNC (Research-Based)
      // Clubber.js-style adaptive smoothing, MDN smoothingTimeConstant,
      // normalized energy, multi-band simulation
      // ═══════════════════════════════════════════════════════════════════
      const bass = bassRef.current
      
      // 🔬 RESEARCH-BASED: Improved easing functions
      const easeInOutCubic = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
      const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3)
      const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4)
      
      if (isPlaying && volume > 0.1) {
        // 🔬 ADVANCED: Subtle BPM variation for human feel
        const bpmVariation = Math.sin(timestamp * 0.00003) * 3 + Math.sin(timestamp * 0.00007) * 2
        bass.bpm = 120 + bpmVariation
        bass.beatInterval = 60000 / bass.bpm
        
        // Update global wave phase for synced animations
        bass.wavePhase += dt * 0.002 * (bass.bpm / 120)
        
        // Accumulate time toward next beat
        bass.accumulator += dt
        
        // Check if it's time for a beat
        if (bass.accumulator >= bass.beatInterval) {
          bass.accumulator = bass.accumulator % bass.beatInterval
          
          // 4-beat pattern for trippy sync
          const beatIndex = Math.floor((timestamp * 0.001 / (bass.beatInterval / 1000)) % 4)
          const isDownbeat = beatIndex === 0  // Beat 1 = strongest
          const isAccent = beatIndex === 2    // Beat 3 = secondary accent
          
          // 🔬 ADVANCED: Multi-band simulation (simulates frequency separation)
          // In real audio, different frequencies hit at different times
          let lowBeat, midBeat, highBeat
          
          if (isDownbeat) {
            lowBeat = 0.9 + Math.random() * 0.1   // Kick drum (low)
            midBeat = 0.3 + Math.random() * 0.2   // Some mid content
            highBeat = 0.2 + Math.random() * 0.15 // Less highs on downbeat
          } else if (isAccent) {
            lowBeat = 0.4 + Math.random() * 0.2   // Some low
            midBeat = 0.7 + Math.random() * 0.2   // Snare (mid)
            highBeat = 0.5 + Math.random() * 0.2  // Some highs
          } else {
            lowBeat = 0.15 + Math.random() * 0.15 // Minimal low
            midBeat = 0.25 + Math.random() * 0.15 // Some mid
            highBeat = 0.6 + Math.random() * 0.25 // Hi-hats (high)
          }
          
          bass.bands.lowTarget = lowBeat * volume
          bass.bands.midTarget = midBeat * volume
          bass.bands.highTarget = highBeat * volume
          
          // Combined beat strength (weighted toward low for bass boom)
          const beatStrength = lowBeat * 0.6 + midBeat * 0.25 + highBeat * 0.15
          
          // 🔬 ADVANCED: Track energy history for normalized response
          bass.energyHistory.push(beatStrength * volume)
          if (bass.energyHistory.length > bass.energyHistoryMax) {
            bass.energyHistory.shift()
          }
          // Calculate average energy of recent beats
          const avgEnergy = bass.energyHistory.reduce((a, b) => a + b, 0) / bass.energyHistory.length
          // Normalize current beat against average (like Clubber.js adaptive threshold)
          bass.normalizedEnergy = avgEnergy > 0.01 ? (beatStrength * volume) / avgEnergy : beatStrength * volume
          
          // Set target intensity
          bass.targetIntensity = beatStrength * volume
          
          // 🔊 TUNNEL BOOM - ONLY on HIGH bass (downbeats with high volume)
          // 🔬 IMPROVED: Use normalized energy for more consistent booms
          const highBassThreshold = 0.55  // Slightly lower for normalized energy
          const boomStrength = lowBeat * volume  // Use only LOW frequency for boom
          const normalizedBoom = avgEnergy > 0.01 ? boomStrength / avgEnergy : boomStrength
          
          if (isDownbeat && normalizedBoom > highBassThreshold && timestamp - bass.lastTrigger > 420) {
            bass.lastTrigger = timestamp
            // Boom intensity scales with how much above threshold
            const boomIntensity = Math.min(1, (normalizedBoom - highBassThreshold) / (1.5 - highBassThreshold))
            bass.tunnelBoomTarget = boomIntensity
            bass.tunnelBoomPeak = boomStrength
            
            // 🔬 NEW: Spawn a wave ring for propagating pulse effect
            bass.waveRings.push({
              radius: 0,
              maxRadius: 1.5,
              intensity: boomIntensity,
              age: 0,
              maxAge: 1200,  // 1.2 seconds to expand
            })
          }
          
          // Trigger ambient bloom - synced pattern with wave phase
          const bloomPhase = bass.wavePhase % (Math.PI * 2)
          bass.bloomCorners.forEach((corner, i) => {
            // Phase-shifted bloom - creates rotating wave pattern
            const phaseOffset = (i / 4) * Math.PI * 2
            const waveSync = Math.sin(bloomPhase + phaseOffset) * 0.3 + 0.7
            // 🔬 IMPROVED: Use normalized energy for consistent bloom
            corner.targetIntensity = bass.normalizedEnergy * waveSync * (isDownbeat ? 0.9 : 0.4) * Math.min(1, avgEnergy * 2)
          })
          
          bass.bloomEdges.forEach((edge, i) => {
            const phaseOffset = (i / 4) * Math.PI * 2 + Math.PI * 0.25
            const waveSync = Math.sin(bloomPhase + phaseOffset) * 0.25 + 0.75
            edge.targetIntensity = bass.normalizedEnergy * waveSync * (isDownbeat ? 0.7 : 0.35) * Math.min(1, avgEnergy * 2)
          })
        }
        
        // 🔬 RESEARCH-BASED: Multi-band smoothing with different characteristics
        // Low = slow attack, slow decay (rumble)
        // Mid = medium attack, medium decay
        // High = fast attack, fast decay (transients)
        bass.bands.low = snapSmooth(bass.bands.low, bass.bands.lowTarget, 0.015, 0.004, dt)
        bass.bands.mid = snapSmooth(bass.bands.mid, bass.bands.midTarget, 0.025, 0.008, dt)
        bass.bands.high = snapSmooth(bass.bands.high, bass.bands.highTarget, 0.05, 0.015, dt)
        
        // Decay targets
        bass.bands.lowTarget *= 0.98
        bass.bands.midTarget *= 0.97
        bass.bands.highTarget *= 0.95
        
        // 🔬 RESEARCH-BASED: MDN smoothingTimeConstant-style overall intensity
        // Combines all bands with exponential smoothing
        const combinedTarget = bass.bands.low * 0.5 + bass.bands.mid * 0.3 + bass.bands.high * 0.2
        bass.smoothIntensity = expSmooth(bass.smoothIntensity, combinedTarget, 0.85, dt)
        
        // Smooth decay of target
        bass.targetIntensity *= 0.985
        
        // 🔬 RESEARCH-BASED: Spring-based bloom smoothing for natural motion
        bass.bloomCorners.forEach((corner) => {
          const spring = springSmooth(corner.intensity, corner.targetIntensity, corner.velocity, 0.008, 0.92, dt)
          corner.intensity = Math.max(0, spring.value)
          corner.velocity = spring.velocity
          corner.targetIntensity *= 0.975
          // Gentle sync breathing
          const breathe = Math.sin(timestamp * 0.0006 + corner.phase) * 0.03
          corner.intensity = Math.max(0, corner.intensity * (1 + breathe))
        })
        
        // Edge blooms with spring physics
        bass.bloomEdges.forEach((edge) => {
          const spring = springSmooth(edge.intensity, edge.targetIntensity, edge.velocity, 0.006, 0.94, dt)
          edge.intensity = Math.max(0, spring.value)
          edge.velocity = spring.velocity
          edge.targetIntensity *= 0.97
          const breathe = Math.sin(timestamp * 0.0007 + edge.phase) * 0.025
          edge.intensity = Math.max(0, edge.intensity * (1 + breathe))
        })
        
        // 🔊 TUNNEL BOOM EASING - Spring physics for organic bounce
        const boomSpring = springSmooth(bass.tunnelBoom, bass.tunnelBoomTarget, bass.tunnelBoomVelocity, 0.012, 0.88, dt)
        bass.tunnelBoom = Math.max(0, boomSpring.value)
        bass.tunnelBoomVelocity = boomSpring.velocity
        bass.tunnelBoomTarget *= 0.965
        
        // 🔬 NEW: Update wave rings (propagating pulses)
        bass.waveRings = bass.waveRings.filter(wave => {
          wave.age += dt
          wave.radius = easeOutQuart(wave.age / wave.maxAge) * wave.maxRadius
          wave.intensity *= 0.995  // Fade out
          return wave.age < wave.maxAge && wave.intensity > 0.01
        })
        
      } else {
        // Not playing - smooth fade everything to zero
        const fadeSpeed = 0.004 * dt
        bass.smoothIntensity *= (1 - fadeSpeed)
        bass.targetIntensity *= 0.96
        bass.tunnelBoom *= (1 - fadeSpeed * 0.4)
        bass.tunnelBoomTarget *= 0.9
        bass.tunnelBoomVelocity *= 0.9
        
        // Fade multi-band values
        bass.bands.low *= (1 - fadeSpeed)
        bass.bands.mid *= (1 - fadeSpeed)
        bass.bands.high *= (1 - fadeSpeed)
        bass.bands.lowTarget *= 0.92
        bass.bands.midTarget *= 0.92
        bass.bands.highTarget *= 0.92
        
        bass.bloomCorners.forEach((corner) => {
          corner.intensity *= (1 - fadeSpeed * 0.6)
          corner.targetIntensity *= 0.92
          corner.velocity *= 0.9
        })
        bass.bloomEdges.forEach((edge) => {
          edge.intensity *= (1 - fadeSpeed * 0.5)
          edge.targetIntensity *= 0.92
          edge.velocity *= 0.9
        })
        
        // Fade wave rings
        bass.waveRings = bass.waveRings.filter(wave => {
          wave.intensity *= 0.95
          return wave.intensity > 0.01
        })
        
        bass.accumulator = 0
      }

      // ═══════════════════════════════════════════════════════════════════
      // SMOOTH COLOR TRANSITION from video thumbnail palette
      // Smooth 3-second fade to new colors for cinematic feel
      // ═══════════════════════════════════════════════════════════════════
      if (targetColorsRef.current && colorTransitionRef.current < 1) {
        colorTransitionRef.current += 0.0005 * dt // ~3 seconds transition
        colorTransitionRef.current = Math.min(1, colorTransitionRef.current)
        
        // Smoothly blend current colors toward target
        const t_blend = colorTransitionRef.current
        const current = currentColorsRef.current
        const target = targetColorsRef.current
        
        for (let i = 0; i < Math.min(current.length, target.length); i++) {
          current[i] = lerpColorSlow(current[i], target[i], t_blend)
        }
      }

      const t = timeRef.current
      const intensity = intensityRef.current
      
      // ═══════════════════════════════════════════════════════════════════
      // TV-CENTERED TUNNEL - Origin at TV frame center
      // Rings emanate FROM the TV border, expanding outward
      // ═══════════════════════════════════════════════════════════════════
      const tvCenter = tvCenterRef.current
      
      // Use TV frame center if available, otherwise viewport center
      const cx = tvCenter.width > 0 ? tvCenter.x : width / 2
      const cy = tvCenter.height > 0 ? tvCenter.y : height / 2
      
      // TV frame dimensions for ring scaling
      const tvWidth = tvCenter.width > 0 ? tvCenter.width : width * 0.6
      const tvHeight = tvCenter.height > 0 ? tvCenter.height : height * 0.6
      
      // Max radius - rings expand beyond TV frame to fill screen
      const maxRadius = Math.max(width, height) * 1.2
      
      // TV frame "border" radius - where rings start from
      const tvBorderRadius = Math.sqrt(tvWidth * tvWidth + tvHeight * tvHeight) / 2

      // ═══════════════════════════════════════════════════════════════════
      // BACKGROUND - Deep warm black with TV-centered glow
      // ═══════════════════════════════════════════════════════════════════
      
      // Warm fade for trail effect - tinted with warm gold
      const bgTint = getColor(0.5) // Middle of palette
      ctx.fillStyle = `rgba(${Math.floor(bgTint.r * 0.015)}, ${Math.floor(bgTint.g * 0.01)}, ${Math.floor(bgTint.b * 0.005 + 5)}, 0.08)`
      ctx.fillRect(0, 0, width, height)
      
      // ═══════════════════════════════════════════════════════════════════
      // TV FRAME GLOW - Warm light emanating FROM the TV border
      // Creates the illusion that light comes from within the TV
      // ═══════════════════════════════════════════════════════════════════
      
      // Main TV glow - warm gold emanating from TV frame
      const tvGlowColor = getColor(t * 0.01)
      const tvGlowPulse = Math.sin(t * 0.2) * 0.15 + 0.85
      const tvGlow = ctx.createRadialGradient(cx, cy, tvBorderRadius * 0.3, cx, cy, tvBorderRadius * 2)
      tvGlow.addColorStop(0, `rgba(${tvGlowColor.r}, ${tvGlowColor.g}, ${tvGlowColor.b}, ${0.15 * intensity * tvGlowPulse})`)
      tvGlow.addColorStop(0.3, `rgba(${tvGlowColor.r}, ${tvGlowColor.g}, ${tvGlowColor.b}, ${0.08 * intensity})`)
      tvGlow.addColorStop(0.6, `rgba(${tvGlowColor.r * 0.8}, ${tvGlowColor.g * 0.7}, ${tvGlowColor.b * 0.5}, ${0.03 * intensity})`)
      tvGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = tvGlow
      ctx.fillRect(0, 0, width, height)
      
      // ═══════════════════════════════════════════════════════════════════
      // WARM AMBIENT WASHES - Soft gold color pools
      // ═══════════════════════════════════════════════════════════════════
      const leakCount = 3
      for (let i = 0; i < leakCount; i++) {
        // Position around TV frame border
        const leakAngle = t * 0.015 + (i / leakCount) * TAU
        const leakDist = tvBorderRadius * (1.2 + Math.sin(t * 0.08 + i) * 0.3)
        const leakX = cx + Math.cos(leakAngle) * leakDist
        const leakY = cy + Math.sin(leakAngle * 0.8 + i * 0.5) * leakDist * 0.6
        
        // Get warm color from palette
        const leakColor = getColor((t * 0.006) + (i / leakCount))
        
        // Breathing pulse
        const breathe = Math.sin(t * 0.12 + i * PHI) * 0.25 + 0.75
        const leakSize = maxRadius * (0.25 + i * 0.1) * breathe
        
        // Soft warm gradient
        const leakGlow = ctx.createRadialGradient(leakX, leakY, 0, leakX, leakY, leakSize)
        leakGlow.addColorStop(0, `rgba(${leakColor.r}, ${leakColor.g}, ${leakColor.b}, ${0.05 * intensity * breathe})`)
        leakGlow.addColorStop(0.4, `rgba(${leakColor.r}, ${leakColor.g}, ${leakColor.b}, ${0.02 * intensity})`)
        leakGlow.addColorStop(0.7, `rgba(${leakColor.r * 0.8}, ${leakColor.g * 0.7}, ${leakColor.b * 0.5}, ${0.008 * intensity})`)
        leakGlow.addColorStop(1, 'transparent')
        ctx.fillStyle = leakGlow
        ctx.fillRect(0, 0, width, height)
      }
      
      // TV screen center hot spot - white-gold core
      const centerColor = getColor(t * 0.012)
      const centerPulse = Math.sin(t * 0.18) * 0.15 + 0.85
      const centerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, tvBorderRadius * 0.8)
      centerGlow.addColorStop(0, `rgba(255, 245, 230, ${0.1 * intensity * centerPulse})`)
      centerGlow.addColorStop(0.2, `rgba(${centerColor.r}, ${centerColor.g}, ${centerColor.b}, ${0.08 * intensity})`)
      centerGlow.addColorStop(0.5, `rgba(${centerColor.r}, ${centerColor.g}, ${centerColor.b}, ${0.03 * intensity})`)
      centerGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = centerGlow
      ctx.fillRect(0, 0, width, height)

      // ═══════════════════════════════════════════════════════════════════
      // HYPNOTIC TUNNEL RINGS - Emanating FROM TV Frame Border
      // Rings start at TV edge and expand OUTWARD (away from TV)
      // Creates illusion of energy/light radiating from the TV screen
      // ═══════════════════════════════════════════════════════════════════
      
      // Ring expansion speed - smooth, hypnotic
      const tunnelSpeed = 0.00008 * (0.5 + intensity * 0.5)
      
      // Pre-calculate multi-band values
      const bassLow = bassRef.current.bands.low
      const bassMid = bassRef.current.bands.mid
      const bassHigh = bassRef.current.bands.high
      const wavePhase = bassRef.current.wavePhase
      
      ringsRef.current.forEach((ring, index) => {
        // Move ring OUTWARD from TV (depth 0 = at TV border, 1 = far out)
        ring.depth += tunnelSpeed * dt
        
        // Reset when ring reaches edge (respawn at TV border)
        if (ring.depth > 1) {
          ring.depth = 0.01
          ring.colorPhase = (ring.colorPhase + 0.08) % 1
        }
        
        // ═══════════════════════════════════════════════════════════════
        // RING SIZE - Start at TV border, expand outward
        // Inner radius = TV frame border
        // Outer radius = screen edge
        // ═══════════════════════════════════════════════════════════════
        const depthCurve = smootherstep(ring.depth)
        const bassSmooth = bassRef.current.smoothIntensity
        const tunnelBoom = bassRef.current.tunnelBoom
        const boomPeak = bassRef.current.tunnelBoomPeak
        
        // Ring radius: starts at TV border, expands to screen edge
        const baseRadius = tvBorderRadius * 0.5 + depthCurve * (maxRadius - tvBorderRadius * 0.5)
        
        // BOOM EXPANSION - all rings pulse outward on bass
        const boomExpand = 1 + tunnelBoom * boomPeak * 0.25
        
        // Multi-band response - bass makes rings thicker, highs add shimmer
        const lowExpand = 1 + bassLow * 0.05 * ring.bassReactivity
        const midExpand = 1 + bassMid * 0.03
        
        const ringRadius = baseRadius * boomExpand * lowExpand * midExpand
        
        // ═══════════════════════════════════════════════════════════════
        // RING OPACITY - Fade in at TV border, fade out at screen edge
        // ═══════════════════════════════════════════════════════════════
        const fadeIn = smootherstep(Math.min(1, ring.depth * 6))  // Quick fade in at TV border
        const fadeOut = 1 - smootherstep(Math.max(0, (ring.depth - 0.7) / 0.3))  // Fade at edge
        const boomGlowBoost = tunnelBoom * boomPeak * 0.25
        const ringOpacity = fadeIn * fadeOut * (0.3 + intensity * 0.4 + boomGlowBoost)
        
        if (ringOpacity < 0.01) return
        
        // ═══════════════════════════════════════════════════════════════
        // WARM COLOR from vintage palette
        // ═══════════════════════════════════════════════════════════════
        const colorWave = Math.sin(t * 0.06 + ring.phase) * 0.08
        const ringColor = getColor(t * 0.01 + ring.colorPhase * 0.5 + colorWave)
        
        // ═══════════════════════════════════════════════════════════════
        // RING ROTATION - Slow spiral
        // ═══════════════════════════════════════════════════════════════
        const rotationAngle = ring.rotation + t * 0.03 * (1 + ring.depth * 0.2)
        
        // ═══════════════════════════════════════════════════════════════
        // ORGANIC WAVE DISTORTION - Subtle, elegant wobble
        // ═══════════════════════════════════════════════════════════════
        const segments = 64
        
        ctx.beginPath()
        
        let wave1 = 0
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * TAU + rotationAngle
          
          // Multi-harmonic wave - subtle, elegant
          wave1 = Math.sin(angle * ring.waveFreq + t * 0.1 + ring.phase) * ring.waveAmp * 0.6
          const wave2 = Math.sin(angle * ring.waveFreq2 - t * 0.07 + ring.phase * 2) * ring.waveAmp2
          const wave3 = Math.sin(angle * 6 + t * 0.04) * ring.waveAmp3 * intensity
          
          // Perlin-style noise for organic irregularity
          const noiseVal = noise(angle * 2, t * 0.015, ring.noiseOffset) * 0.006 * (1 + bassSmooth * 0.5)
          
          // Bass-reactive wave boost
          const bassWaveBoost = bassLow * 0.02 * (1 - ring.depth)
          const highShimmerWave = bassHigh * Math.sin(angle * 10 + t * 0.25) * 0.008
          
          // Combined wave
          const waveOffset = 1 + wave1 + wave2 + wave3 + noiseVal + bassWaveBoost + highShimmerWave
          const r = ringRadius * waveOffset
          
          const x = cx + Math.cos(angle) * r
          const y = cy + Math.sin(angle) * r
          
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        
        ctx.closePath()
        
        // Ring stroke - warm gold glow
        const boomThicknessBoost = 1 + tunnelBoom * boomPeak * 0.4
        const bassGlow = 1 + bassSmooth * 0.2
        const ringWidth = (1.5 + depthCurve * 2.5 + intensity * 1.5) * bassGlow * boomThicknessBoost
        const boomOpacityBoost = tunnelBoom * boomPeak * 0.15
        const bassOpacityBoost = bassSmooth * 0.1
        
        // Outer glow - warm and soft
        ctx.strokeStyle = `rgba(${ringColor.r}, ${ringColor.g}, ${ringColor.b}, ${(ringOpacity + bassOpacityBoost + boomOpacityBoost) * 0.25})`
        ctx.lineWidth = ringWidth * 3.5
        ctx.stroke()
        
        // Mid glow
        ctx.strokeStyle = `rgba(${ringColor.r}, ${ringColor.g}, ${ringColor.b}, ${(ringOpacity + bassOpacityBoost + boomOpacityBoost) * 0.5})`
        ctx.lineWidth = ringWidth * 1.8
        ctx.stroke()
        
        // Core line - bright gold
        ctx.strokeStyle = `rgba(${Math.min(255, ringColor.r + 40)}, ${Math.min(255, ringColor.g + 30)}, ${Math.min(255, ringColor.b + 20)}, ${ringOpacity + bassOpacityBoost + boomOpacityBoost})`
        ctx.lineWidth = ringWidth
        ctx.stroke()
        
        // ═══════════════════════════════════════════════════════════════
        // ACCENT DOTS - Warm gold sparkles along rings
        // ═══════════════════════════════════════════════════════════════
        if (index % 4 === 0 && ringOpacity > 0.12) {
          const dotCount = 5
          for (let d = 0; d < dotCount; d++) {
            const dotAngle = (d / dotCount) * TAU + rotationAngle + t * 0.04
            const dotPulse = Math.sin(t * 0.6 + d * PHI + ring.phase) * 0.4 + 0.6
            const highPulse = bassHigh * 0.3
            const dotR = ringRadius * (1 + wave1)
            
            const dx = cx + Math.cos(dotAngle) * dotR
            const dy = cy + Math.sin(dotAngle) * dotR
            
            const dotSize = (2 + depthCurve * 3) * (0.6 + dotPulse * 0.4) * (1 + tunnelBoom * 0.25 + highPulse)
            const dotOpacity = ringOpacity * dotPulse * (0.7 + highPulse * 0.2)
            
            // Warm gold dot glow
            const dotGlow = ctx.createRadialGradient(dx, dy, 0, dx, dy, dotSize * 2.5)
            dotGlow.addColorStop(0, `rgba(255, 245, 220, ${dotOpacity})`)
            dotGlow.addColorStop(0.3, `rgba(${ringColor.r}, ${ringColor.g}, ${ringColor.b}, ${dotOpacity * 0.5})`)
            dotGlow.addColorStop(1, 'transparent')
            ctx.fillStyle = dotGlow
            ctx.beginPath()
            ctx.arc(dx, dy, dotSize * 2.5, 0, TAU)
            ctx.fill()
          }
        }
      })

      // ═══════════════════════════════════════════════════════════════════
      // FLOATING PARTICLES - Warm gold dust drifting from TV
      // ═══════════════════════════════════════════════════════════════════
      starsRef.current.forEach((star) => {
        // Particles drift OUTWARD from TV frame
        star.depth += star.driftSpeed * dt * 0.4
        star.angle += star.rotateSpeed * dt * 0.2
        
        // Respawn at TV border when they drift too far
        if (star.depth > 1) {
          star.depth = 0.05
          star.angle = Math.random() * TAU
          star.radialPos = 0.4 + Math.random() * 0.6
          star.colorPhase = Math.random()
        }
        
        // Position - starts at TV border, drifts outward
        const depthCurve = smootherstep(star.depth)
        const starRadius = (tvBorderRadius * 0.4 + depthCurve * (maxRadius * 0.8 - tvBorderRadius * 0.4)) * star.radialPos
        
        const x = cx + Math.cos(star.angle) * starRadius
        const y = cy + Math.sin(star.angle) * starRadius
        
        // Opacity - fade in near TV, fade out at edges
        const fadeIn = smootherstep(Math.min(1, star.depth * 4))
        const fadeOut = 1 - smootherstep(Math.max(0, (star.depth - 0.75) / 0.25))
        const starOpacity = fadeIn * fadeOut * (0.3 + intensity * 0.35)
        
        if (starOpacity < 0.04) return
        
        // Slow twinkle
        const twinkle = Math.sin(t * star.twinkleSpeed * 0.35 + star.twinklePhase) * 0.25 + 0.75
        
        // Size
        const size = star.size * (0.6 + depthCurve * 1.5) * twinkle
        
        // Warm gold color
        const starColor = getColor(t * 0.006 + star.colorPhase)
        
        // Draw warm golden glow
        const glow = ctx.createRadialGradient(x, y, 0, x, y, size * star.glowSize)
        glow.addColorStop(0, `rgba(255, 245, 230, ${starOpacity * twinkle * 0.85})`)
        glow.addColorStop(0.25, `rgba(${starColor.r}, ${starColor.g}, ${starColor.b}, ${starOpacity * 0.5})`)
        glow.addColorStop(0.6, `rgba(${starColor.r * 0.8}, ${starColor.g * 0.7}, ${starColor.b * 0.5}, ${starOpacity * 0.12})`)
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(x, y, size * star.glowSize, 0, TAU)
        ctx.fill()
      })

      // ═══════════════════════════════════════════════════════════════════
      // 🔊 AMBIENT BASS BLOOM - Smooth glows from corners & edges
      // Ultra smooth ease in/out, synchronized, no chaos
      // ═══════════════════════════════════════════════════════════════════
      const bassSmooth = bassRef.current.smoothIntensity
      
      // CORNER BLOOMS - Soft radial glows from each corner
      bassRef.current.bloomCorners.forEach((corner, i) => {
        if (corner.intensity < 0.01) return
        
        const cornerX = corner.x * width
        const cornerY = corner.y * height
        const bloomSize = Math.max(width, height) * (0.6 + corner.intensity * 0.4)
        
        // Get color from palette - each corner has slight phase offset for variety
        const bloomColor = getColor(t * 0.015 + i * 0.25)
        
        // Smooth eased opacity
        const easeOpacity = corner.intensity * corner.intensity * (3 - 2 * corner.intensity)  // smoothstep
        const opacity = easeOpacity * 0.12 * intensity
        
        // Soft radial gradient bloom
        const bloom = ctx.createRadialGradient(cornerX, cornerY, 0, cornerX, cornerY, bloomSize)
        bloom.addColorStop(0, `rgba(${bloomColor.r}, ${bloomColor.g}, ${bloomColor.b}, ${opacity * 1.2})`)
        bloom.addColorStop(0.2, `rgba(${bloomColor.r}, ${bloomColor.g}, ${bloomColor.b}, ${opacity * 0.8})`)
        bloom.addColorStop(0.5, `rgba(${bloomColor.r}, ${bloomColor.g}, ${bloomColor.b}, ${opacity * 0.3})`)
        bloom.addColorStop(0.8, `rgba(${bloomColor.r}, ${bloomColor.g}, ${bloomColor.b}, ${opacity * 0.08})`)
        bloom.addColorStop(1, 'transparent')
        ctx.fillStyle = bloom
        ctx.fillRect(0, 0, width, height)
      })
      
      // EDGE BLOOMS - Soft linear glows from each edge (top, right, bottom, left)
      const edgePositions = [
        { x: cx, y: 0, dirX: 0, dirY: 1 },      // Top
        { x: width, y: cy, dirX: -1, dirY: 0 }, // Right
        { x: cx, y: height, dirX: 0, dirY: -1 }, // Bottom
        { x: 0, y: cy, dirX: 1, dirY: 0 },      // Left
      ]
      
      bassRef.current.bloomEdges.forEach((edge, i) => {
        if (edge.intensity < 0.01) return
        
        const pos = edgePositions[i]
        const bloomDepth = Math.max(width, height) * 0.4 * (0.5 + edge.intensity * 0.5)
        
        // Get color from palette
        const edgeColor = getColor(t * 0.012 + i * 0.2 + 0.5)
        
        // Smooth eased opacity
        const easeOpacity = edge.intensity * edge.intensity * (3 - 2 * edge.intensity)
        const opacity = easeOpacity * 0.08 * intensity
        
        // Radial gradient from edge center
        const edgeBloom = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, bloomDepth)
        edgeBloom.addColorStop(0, `rgba(${edgeColor.r}, ${edgeColor.g}, ${edgeColor.b}, ${opacity})`)
        edgeBloom.addColorStop(0.3, `rgba(${edgeColor.r}, ${edgeColor.g}, ${edgeColor.b}, ${opacity * 0.5})`)
        edgeBloom.addColorStop(0.6, `rgba(${edgeColor.r}, ${edgeColor.g}, ${edgeColor.b}, ${opacity * 0.15})`)
        edgeBloom.addColorStop(1, 'transparent')
        ctx.fillStyle = edgeBloom
        ctx.fillRect(0, 0, width, height)
      })
      
      // OVERALL AMBIENT PULSE - Very subtle full-screen glow synced to bass
      if (bassSmooth > 0.05) {
        const ambientColor = getColor(t * 0.01)
        // Ultra smooth easing
        const ambientEase = bassSmooth * bassSmooth * (3 - 2 * bassSmooth)
        const ambientOpacity = ambientEase * 0.04 * volume
        
        // Full screen ambient wash
        ctx.fillStyle = `rgba(${ambientColor.r}, ${ambientColor.g}, ${ambientColor.b}, ${ambientOpacity})`
        ctx.fillRect(0, 0, width, height)
      }
      
      // 🔊 TUNNEL BOOM FLASH - Subtle screen pulse on boom peaks
      const tunnelBoom = bassRef.current.tunnelBoom
      const boomPeak = bassRef.current.tunnelBoomPeak
      if (tunnelBoom > 0.1) {
        const boomColor = getColor(t * 0.015)
        // Smooth eased flash
        const boomFlash = tunnelBoom * tunnelBoom * (3 - 2 * tunnelBoom)  // smoothstep
        const flashOpacity = boomFlash * boomPeak * 0.06 * volume
        ctx.fillStyle = `rgba(${boomColor.r}, ${boomColor.g}, ${boomColor.b}, ${flashOpacity})`
        ctx.fillRect(0, 0, width, height)
      }
      
      // 🔬 NEW: PROPAGATING WAVE RINGS - Expanding pulses from boom impacts
      // Inspired by audio visualizer demos - creates depth and movement
      bassRef.current.waveRings.forEach(wave => {
        if (wave.intensity < 0.02) return
        
        const waveRadius = wave.radius * maxRadius
        const waveColor = getColor(t * 0.015 + wave.radius * 0.3)
        const easeOpacity = wave.intensity * (1 - wave.radius / wave.maxRadius)  // Fade as it expands
        const waveOpacity = easeOpacity * 0.15 * intensity
        
        // Draw expanding ring
        ctx.beginPath()
        ctx.arc(cx, cy, waveRadius, 0, TAU)
        ctx.strokeStyle = `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, ${waveOpacity})`
        ctx.lineWidth = 3 + wave.intensity * 8
        ctx.stroke()
        
        // Outer glow
        ctx.strokeStyle = `rgba(${waveColor.r}, ${waveColor.g}, ${waveColor.b}, ${waveOpacity * 0.4})`
        ctx.lineWidth = 10 + wave.intensity * 15
        ctx.stroke()
      })

      // ═══════════════════════════════════════════════════════════════════
      // TUNNEL CENTER - The infinite vanishing point
      // Hypnotic focal point that draws the eye - uses video colors
      // ═══════════════════════════════════════════════════════════════════
      // Center reacts to tunnel boom - expands with the tunnel
      const centerBoomPulse = 1 + tunnelBoom * boomPeak * 0.5
      const bassPulse = 1 + bassSmooth * 0.2
      const centerSize = (15 + intensity * 25) * bassPulse * centerBoomPulse
      const vanishColor = getColor(t * 0.02)  // Slower color cycle
      
      // Slower pulsing center light
      const centerPulse2 = Math.sin(t * 0.2) * 0.2 + Math.sin(t * 0.15 * PHI) * 0.15 + 0.65
      
      // Outer halo
      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, centerSize * 4)
      halo.addColorStop(0, `rgba(255, 255, 255, ${0.4 * intensity * centerPulse2})`)
      halo.addColorStop(0.2, `rgba(${vanishColor.r}, ${vanishColor.g}, ${vanishColor.b}, ${0.25 * intensity})`)
      halo.addColorStop(0.5, `rgba(${vanishColor.r}, ${vanishColor.g}, ${vanishColor.b}, ${0.08 * intensity})`)
      halo.addColorStop(1, 'transparent')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(cx, cy, centerSize * 4, 0, TAU)
      ctx.fill()
      
      // Inner bright core
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, centerSize)
      core.addColorStop(0, `rgba(255, 255, 255, ${0.9 * centerPulse2})`)
      core.addColorStop(0.3, `rgba(255, 255, 255, ${0.5 * centerPulse2})`)
      core.addColorStop(0.6, `rgba(${vanishColor.r}, ${vanishColor.g}, ${vanishColor.b}, ${0.3 * intensity})`)
      core.addColorStop(1, 'transparent')
      ctx.fillStyle = core
      ctx.beginPath()
      ctx.arc(cx, cy, centerSize, 0, TAU)
      ctx.fill()

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    const handleResize = () => {
      setSize()
      createRings()
      createStars()
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
