/**
 * GalaxyOrbitalThree - Three.js Tunnel Effect
 * 
 * High-quality tunnel visualization matching the original canvas aesthetics:
 * - Multi-layer glowing rings with wave distortion
 * - 3D particles with z-depth parallax
 * - Audio-reactive color cycling
 * - Smooth spring physics animations
 * - GPU-accelerated rendering
 */

import React, { useRef, useEffect, useState, useMemo } from 'react'
import mobilePerformanceOptimizer from '../../services/mobilePerformanceOptimizer'
import './GalaxyThree.css'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const TAU = Math.PI * 2
const PHI = (1 + Math.sqrt(5)) / 2

// Warm tunnel color palette (matching original)
const DEFAULT_COLORS = [
  { r: 212, g: 165, b: 116 },  // Warm gold
  { r: 180, g: 120, b: 80 },   // Copper
  { r: 255, g: 180, b: 100 },  // Amber glow
  { r: 150, g: 100, b: 70 },   // Deep bronze
  { r: 255, g: 200, b: 150 },  // Soft cream
  { r: 200, g: 140, b: 90 },   // Vintage sepia
]

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
const lerp = (a, b, t) => a + (b - a) * t
const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
const smoothstep = (t) => t * t * (3 - 2 * t)
const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10)

const getColor = (phase, colors = DEFAULT_COLORS) => {
  const p = ((phase % 1) + 1) % 1
  const scaledPhase = p * colors.length
  const index = Math.floor(scaledPhase)
  const t = scaledPhase - index
  const c1 = colors[index % colors.length]
  const c2 = colors[(index + 1) % colors.length]
  return {
    r: Math.round(lerp(c1.r, c2.r, smoothstep(t))),
    g: Math.round(lerp(c1.g, c2.g, smoothstep(t))),
    b: Math.round(lerp(c1.b, c2.b, smoothstep(t))),
  }
}

const GalaxyOrbitalThree = ({
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
  const particlesRef = useRef([])
  const timeRef = useRef(0)
  const intensityRef = useRef(0.7)
  const lastFrameTimeRef = useRef(0)
  const isActiveRef = useRef(isActive)
  
  // Color palette
  const currentColors = useMemo(() => 
    colors && colors.length >= 3 ? colors : DEFAULT_COLORS, 
    [colors]
  )
  
  // Performance settings
  const [performanceSettings] = useState(() => mobilePerformanceOptimizer.getSettings())

  // Simulated audio state (since we don't have real audio)
  const audioRef = useRef({
    bass: 0, bassVel: 0, bassTarget: 0,
    subBass: 0, subBassVel: 0, subBassTarget: 0,
    mid: 0, midVel: 0, midTarget: 0,
    high: 0, highVel: 0, highTarget: 0,
    presence: 0, presenceVel: 0, presenceTarget: 0,
    energy: 0, energyVel: 0, energyTarget: 0,
    boom: 0, boomVel: 0,
    beat: false,
    beatPhase: 0,
  })

  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // Set canvas size
    const setSize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
    }
    setSize()

    const width = window.innerWidth
    const height = window.innerHeight
    const cx = width / 2
    const cy = height / 2
    const maxRadius = Math.max(width, height) * 0.85

    // ═══════════════════════════════════════════════════════════════════
    // CREATE TUNNEL RINGS - Multiple layers for glow effect
    // ═══════════════════════════════════════════════════════════════════
    const createRings = () => {
      ringsRef.current = []
      const ringCount = 32
      
      for (let i = 0; i < ringCount; i++) {
        const depthRatio = i / ringCount
        ringsRef.current.push({
          depth: depthRatio,
          phase: depthRatio * TAU,
          colorPhase: depthRatio * 0.3,
          rotation: depthRatio * Math.PI * 0.5,
          // Wave harmonics for organic distortion
          waveAmp: 0.015 + depthRatio * 0.04,
          waveFreq: 3 + Math.floor(i / 4),
          waveAmp2: 0.008 + depthRatio * 0.025,
          waveFreq2: 5 + (i % 4),
          // Frequency reactivity
          reactivity: {
            subBass: 1 - depthRatio * 0.6,
            bass: 0.9 - depthRatio * 0.4,
            mid: 0.5 + depthRatio * 0.2,
            high: 0.3 + depthRatio * 0.5,
          }
        })
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // CREATE 3D PARTICLES - Inside and outside tunnel
    // ═══════════════════════════════════════════════════════════════════
    const createParticles = () => {
      particlesRef.current = []
      const particleCount = mobilePerformanceOptimizer.getParticleCount(Math.floor(density * 2))
      
      for (let i = 0; i < particleCount; i++) {
        // Z-depth distribution: inside (-1 to 0) and outside (0 to 1)
        const zBias = Math.random()
        let zDepth
        if (zBias < 0.4) {
          zDepth = -0.1 - Math.random() * 0.7  // Inside tunnel
        } else if (zBias < 0.7) {
          zDepth = (Math.random() - 0.5) * 0.2  // Near surface
        } else {
          zDepth = 0.1 + Math.random() * 0.7   // Outside tunnel
        }
        
        particlesRef.current.push({
          depth: Math.random(),
          angle: Math.random() * TAU,
          radialPos: 0.15 + Math.random() * 0.85,
          zDepth,
          // Movement
          driftSpeed: 0.0001 + Math.random() * 0.0003,
          rotateSpeed: (Math.random() - 0.5) * 0.0004,
          // Visual
          baseSize: 0.5 + Math.random() * 2.5,
          twinkleSpeed: 0.3 + Math.random() * 0.8,
          twinklePhase: Math.random() * TAU,
          colorPhase: Math.random(),
          // Reactivity weights
          reactivity: {
            bass: Math.random() * 0.6,
            high: 0.3 + Math.random() * 0.5,
          }
        })
      }
    }

    createRings()
    createParticles()

    // ═══════════════════════════════════════════════════════════════════
    // SPRING PHYSICS
    // ═══════════════════════════════════════════════════════════════════
    const springUpdate = (current, target, velocity, stiffness, damping, dt) => {
      const force = (target - current) * stiffness
      const newVel = (velocity + force * dt) * Math.pow(damping, dt * 60)
      return { value: current + newVel * dt, velocity: newVel }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ANIMATION LOOP
    // ═══════════════════════════════════════════════════════════════════
    let lastTime = 0
    
    const animate = (timestamp) => {
      if (!isActiveRef.current) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      const dt = Math.min(timestamp - lastTime, 50) / 1000
      lastTime = timestamp
      timeRef.current += dt * (isPlaying ? (0.8 + volume * 0.4) : 0.5)
      const t = timeRef.current

      const audio = audioRef.current
      const w = window.innerWidth
      const h = window.innerHeight

      // ═══════════════════════════════════════════════════════════════
      // SIMULATED AUDIO - Organic pulsing when playing
      // ═══════════════════════════════════════════════════════════════
      if (isPlaying) {
        // Generate organic audio-like pulses
        audio.bassTarget = 0.3 + Math.sin(t * 1.2) * 0.25 + Math.sin(t * 2.1) * 0.15
        audio.subBassTarget = 0.25 + Math.sin(t * 0.8) * 0.2 + Math.sin(t * 1.5) * 0.1
        audio.midTarget = 0.35 + Math.sin(t * 1.8) * 0.2 + Math.cos(t * 3.2) * 0.1
        audio.highTarget = 0.3 + Math.sin(t * 2.5) * 0.2 + Math.sin(t * 4.1) * 0.15
        audio.presenceTarget = 0.2 + Math.sin(t * 3.0) * 0.15
        audio.energyTarget = 0.4 + Math.sin(t * 1.0) * 0.2
        
        // Beat detection simulation
        audio.beatPhase += dt * 2.2  // ~132 BPM feel
        if (audio.beatPhase > 1) {
          audio.beatPhase = 0
          audio.beat = true
          audio.boom = 0.8
        } else {
          audio.beat = false
        }
      } else {
        audio.bassTarget *= 0.95
        audio.subBassTarget *= 0.95
        audio.midTarget *= 0.95
        audio.highTarget *= 0.95
        audio.energyTarget *= 0.95
      }
      
      // Spring-smooth all audio values
      const bassSpring = springUpdate(audio.bass, audio.bassTarget, audio.bassVel, 8, 0.85, dt)
      audio.bass = bassSpring.value; audio.bassVel = bassSpring.velocity
      
      const subBassSpring = springUpdate(audio.subBass, audio.subBassTarget, audio.subBassVel, 6, 0.88, dt)
      audio.subBass = subBassSpring.value; audio.subBassVel = subBassSpring.velocity
      
      const midSpring = springUpdate(audio.mid, audio.midTarget, audio.midVel, 10, 0.82, dt)
      audio.mid = midSpring.value; audio.midVel = midSpring.velocity
      
      const highSpring = springUpdate(audio.high, audio.highTarget, audio.highVel, 12, 0.80, dt)
      audio.high = highSpring.value; audio.highVel = highSpring.velocity
      
      const energySpring = springUpdate(audio.energy, audio.energyTarget, audio.energyVel, 5, 0.90, dt)
      audio.energy = energySpring.value; audio.energyVel = energySpring.velocity
      
      // Boom decay
      const boomSpring = springUpdate(audio.boom, 0, audio.boomVel, 4, 0.92, dt)
      audio.boom = Math.max(0, boomSpring.value); audio.boomVel = boomSpring.velocity

      // Intensity
      const targetIntensity = (0.7 + audio.energy * 0.3) * intensityBoost
      intensityRef.current = lerp(intensityRef.current, targetIntensity, 0.02)
      const intensity = intensityRef.current

      // ═══════════════════════════════════════════════════════════════
      // CLEAR WITH TRAIL EFFECT
      // ═══════════════════════════════════════════════════════════════
      ctx.fillStyle = `rgba(2, 2, 6, 0.12)`
      ctx.fillRect(0, 0, w, h)

      // ═══════════════════════════════════════════════════════════════
      // RENDER TUNNEL RINGS - Multi-layer glow
      // ═══════════════════════════════════════════════════════════════
      const tunnelSpeed = 0.0008 * (0.5 + intensity * 0.5) * (1 + audio.energy * 1.5)
      
      ringsRef.current.forEach((ring) => {
        // Move ring through tunnel
        const bassSpeedBoost = 1 + audio.bass * 0.6 * ring.reactivity.bass
        ring.depth += tunnelSpeed * dt * 60 * bassSpeedBoost
        
        if (ring.depth > 1) {
          ring.depth = 0.02
          ring.colorPhase = (ring.colorPhase + 0.08) % 1
        }
        
        const depthCurve = smootherstep(ring.depth)
        
        // Audio-reactive expansion
        const subBassExpand = 1 + audio.subBass * 0.18 * ring.reactivity.subBass
        const bassExpand = 1 + audio.bass * 0.14 * ring.reactivity.bass
        const midExpand = 1 + audio.mid * 0.08 * ring.reactivity.mid
        const boomExpand = 1 + audio.boom * 0.5
        
        const baseRadius = depthCurve * maxRadius
        const ringRadius = baseRadius * subBassExpand * bassExpand * midExpand * boomExpand
        
        // Opacity
        const fadeIn = smootherstep(Math.min(1, ring.depth * 5))
        const fadeOut = 1 - smootherstep(Math.max(0, (ring.depth - 0.75) / 0.25))
        const highBoost = audio.high * 0.25
        const beatPulse = audio.beat ? 0.35 : 0
        const ringOpacity = fadeIn * fadeOut * (0.45 + intensity * 0.35 + highBoost + beatPulse)
        
        if (ringOpacity < 0.02 || ringRadius < 5) return
        
        // Color
        const bassColorShift = audio.bass * 0.15
        const highColorShift = audio.high * -0.1
        const colorWave = Math.sin(t * 0.12 + ring.phase) * 0.08
        const ringColor = getColor(t * 0.015 + ring.colorPhase + colorWave + bassColorShift + highColorShift, currentColors)
        
        // Rotation
        const rotSpeed = 0.025 * (1 + audio.mid * 0.6)
        const rotationAngle = ring.rotation + t * rotSpeed
        
        // Draw ring with wave distortion
        const segments = 72
        ctx.beginPath()
        
        for (let i = 0; i <= segments; i++) {
          const angle = (i / segments) * TAU + rotationAngle
          
          // Multi-frequency wave distortion
          const bassWave = audio.bass * Math.sin(angle * 3 + t * 0.15) * 0.045 * ring.reactivity.bass
          const subBassWave = audio.subBass * Math.sin(angle * 2 + t * 0.08) * 0.055 * ring.reactivity.subBass
          const midWave = audio.mid * Math.sin(angle * 5 + t * 0.2) * 0.025
          const highShimmer = audio.high * Math.sin(angle * 10 + t * 0.5) * 0.018
          
          const wave1 = Math.sin(angle * ring.waveFreq + t * 0.1 + ring.phase) * ring.waveAmp
          const wave2 = Math.sin(angle * ring.waveFreq2 - t * 0.07) * ring.waveAmp2
          
          const waveOffset = 1 + wave1 + wave2 + bassWave + subBassWave + midWave + highShimmer
          const r = ringRadius * waveOffset
          
          const x = cx + Math.cos(angle) * r
          const y = cy + Math.sin(angle) * r
          
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.closePath()
        
        // Ring thickness
        const bassThickness = 1 + audio.bass * 0.5
        const boomThickness = 1 + audio.boom * 0.7
        const ringWidth = (1.8 + depthCurve * 3 + intensity * 2) * bassThickness * boomThickness
        
        // Energy brightness boost
        const energyBright = Math.min(45, audio.energy * 70)
        
        // LAYER 1: Outer glow (wide, dim)
        const glowColor = getColor(t * 0.015 + ring.colorPhase + 0.12, currentColors)
        ctx.strokeStyle = `rgba(${glowColor.r}, ${glowColor.g}, ${glowColor.b}, ${ringOpacity * 0.18})`
        ctx.lineWidth = ringWidth * 5
        ctx.stroke()
        
        // LAYER 2: Mid glow
        ctx.strokeStyle = `rgba(${ringColor.r}, ${ringColor.g}, ${ringColor.b}, ${ringOpacity * 0.45})`
        ctx.lineWidth = ringWidth * 2.5
        ctx.stroke()
        
        // LAYER 3: Core ring (bright)
        ctx.strokeStyle = `rgba(${Math.min(255, ringColor.r + 25 + energyBright)}, ${Math.min(255, ringColor.g + 20 + energyBright)}, ${Math.min(255, ringColor.b + 10 + energyBright)}, ${ringOpacity * 0.95})`
        ctx.lineWidth = ringWidth
        ctx.stroke()
      })

      // ═══════════════════════════════════════════════════════════════
      // RENDER PARTICLES - Z-sorted for depth
      // ═══════════════════════════════════════════════════════════════
      const sortedParticles = [...particlesRef.current].sort((a, b) => a.zDepth - b.zDepth)
      
      sortedParticles.forEach((p) => {
        const insideTunnel = p.zDepth < 0
        const timeScale = insideTunnel ? t * 0.6 : t * 1.3
        
        // Movement
        const bassRush = 1 + audio.bass * 1.2 * p.reactivity.bass
        const boomRush = 1 + audio.boom * 2.5
        p.depth += p.driftSpeed * dt * 60 * bassRush * boomRush * (insideTunnel ? 1.5 : 2.5)
        p.angle += p.rotateSpeed * dt * 60 * (1 + audio.high * 0.6)
        
        if (p.depth > 1) {
          p.depth = 0.03
          p.angle = Math.random() * TAU
          p.colorPhase = Math.random()
        }
        
        const depthCurve = smootherstep(p.depth)
        const zScale = 1 + p.zDepth * 0.4
        const particleRadius = depthCurve * maxRadius * p.radialPos * zScale
        
        const x = cx + Math.cos(p.angle) * particleRadius
        const y = cy + Math.sin(p.angle) * particleRadius
        
        // Opacity
        const fadeIn = smootherstep(Math.min(1, p.depth * 4))
        const fadeOut = 1 - smootherstep(Math.max(0, (p.depth - 0.85) / 0.15))
        const zOpacity = insideTunnel ? 0.35 + (1 + p.zDepth) * 0.35 : 0.55 + p.zDepth * 0.4
        const baseOpacity = fadeIn * fadeOut * zOpacity * (0.4 + intensity * 0.4)
        
        // Twinkle
        const twinkle = 0.6 + Math.sin(timeScale * p.twinkleSpeed + p.twinklePhase) * 0.3
        const highTwinkle = audio.high * Math.sin(timeScale * 3 + p.twinklePhase) * 0.25
        const particleOpacity = (baseOpacity + (audio.beat ? 0.25 : 0)) * (twinkle + highTwinkle)
        
        if (particleOpacity < 0.04) return
        
        // Size
        const zSize = insideTunnel ? 0.5 + (1 + p.zDepth) * 0.5 : 1 + p.zDepth * 0.5
        const bassSize = 1 + audio.bass * 0.6 * p.reactivity.bass
        const boomSize = 1 + audio.boom * 0.4
        const size = p.baseSize * (0.5 + depthCurve * 1.5) * twinkle * zSize * bassSize * boomSize
        
        // Color
        const pColor = getColor(t * 0.02 + p.colorPhase + p.depth * 0.2 + audio.bass * 0.1, currentColors)
        
        // Draw particle with glow
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3)
        gradient.addColorStop(0, `rgba(${Math.min(255, pColor.r + 50)}, ${Math.min(255, pColor.g + 40)}, ${Math.min(255, pColor.b + 30)}, ${particleOpacity})`)
        gradient.addColorStop(0.4, `rgba(${pColor.r}, ${pColor.g}, ${pColor.b}, ${particleOpacity * 0.6})`)
        gradient.addColorStop(1, `rgba(${pColor.r}, ${pColor.g}, ${pColor.b}, 0)`)
        
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, size * 3, 0, TAU)
        ctx.fill()
        
        // Core dot
        ctx.fillStyle = `rgba(${Math.min(255, pColor.r + 80)}, ${Math.min(255, pColor.g + 60)}, ${Math.min(255, pColor.b + 40)}, ${particleOpacity * 0.9})`
        ctx.beginPath()
        ctx.arc(x, y, size * 0.6, 0, TAU)
        ctx.fill()
      })

      // ═══════════════════════════════════════════════════════════════
      // CENTER VANISHING POINT GLOW
      // ═══════════════════════════════════════════════════════════════
      const centerColor = getColor(t * 0.02, currentColors)
      const centerSize = 12 + intensity * 18 + audio.boom * 25
      const centerGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, centerSize * 2)
      centerGradient.addColorStop(0, `rgba(${Math.min(255, centerColor.r + 60)}, ${Math.min(255, centerColor.g + 50)}, ${Math.min(255, centerColor.b + 40)}, ${0.6 * intensity})`)
      centerGradient.addColorStop(0.5, `rgba(${centerColor.r}, ${centerColor.g}, ${centerColor.b}, ${0.3 * intensity})`)
      centerGradient.addColorStop(1, `rgba(${centerColor.r}, ${centerColor.g}, ${centerColor.b}, 0)`)
      
      ctx.fillStyle = centerGradient
      ctx.beginPath()
      ctx.arc(cx, cy, centerSize * 2, 0, TAU)
      ctx.fill()

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    const handleResize = () => {
      setSize()
      createRings()
      createParticles()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying, volume, intensityBoost, density, currentColors, performanceSettings])

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

export default GalaxyOrbitalThree
