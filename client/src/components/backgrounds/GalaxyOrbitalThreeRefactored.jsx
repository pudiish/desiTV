import React, { useRef, useEffect } from 'react'
import { setupCanvas, clearFade, lerp, lerpColor, toRgba, extractColors, createLoop, TAU, smoothstep } from './utils'
import './GalaxyThree.css'

const STAR_COLORS = {
  blueGiant: { r: 155, g: 176, b: 255 },
  blueStar: { r: 170, g: 191, b: 255 },
  white: { r: 255, g: 255, b: 255 },
  yellow: { r: 255, g: 244, b: 214 },
  orange: { r: 255, g: 210, b: 161 },
  red: { r: 255, g: 180, b: 150 },
}

const createParticle = () => {
  const typeRoll = Math.random()
  const sizeMult = Math.random() > 0.92 ? 2.5 + Math.random() * 1.5 : 0.5 + Math.random() * 1
  const type = typeRoll < 0.75 ? 'star' : typeRoll < 0.9 ? 'nebula' : 'dust'
  const starKeys = Object.keys(STAR_COLORS)
  const colorKey = starKeys[Math.floor(Math.random() * starKeys.length)]
  
  return {
    type,
    color: STAR_COLORS[colorKey],
    depth: Math.random(),
    angle: Math.random() * TAU,
    radialPos: 0.05 + Math.random() * 0.95,
    zDepth: (Math.random() - 0.5) * 1.6,
    driftSpeed: type === 'nebula' ? 0.002 : 0.004 + Math.random() * 0.006,
    rotateSpeed: (Math.random() - 0.5) * 0.0006,
    baseSize: type === 'nebula' ? 10 + Math.random() * 20 : (1 + Math.random() * 4) * sizeMult,
    glowSize: type === 'nebula' ? 30 + Math.random() * 50 : (3 + Math.random() * 10) * sizeMult,
    pulsePhase: Math.random() * TAU,
    twinklePhase: Math.random() * TAU,
    opacity: type === 'nebula' ? 0.2 : type === 'dust' ? 0.4 : 0.7 + Math.random() * 0.3,
  }
}

const createShootingStar = (w, h, colors) => {
  const edge = Math.floor(Math.random() * 4)
  let x, y, angle
  if (edge === 0) { x = Math.random() * w; y = -20; angle = Math.PI * 0.4 + Math.random() * 0.3 }
  else if (edge === 1) { x = w + 20; y = Math.random() * h * 0.5; angle = Math.PI * 0.7 + Math.random() * 0.2 }
  else if (edge === 2) { x = Math.random() * w; y = h + 20; angle = -Math.PI * 0.4 - Math.random() * 0.3 }
  else { x = -20; y = Math.random() * h * 0.5; angle = -Math.PI * 0.1 + Math.random() * 0.2 }
  
  const c = colors[0] || { r: 255, g: 255, b: 255 }
  return { x, y, angle, speed: 500 + Math.random() * 400, length: 100 + Math.random() * 100, width: 2 + Math.random() * 2, life: 1, decay: 0.35, color: { r: Math.min(255, c.r + 80), g: Math.min(255, c.g + 80), b: Math.min(255, c.b + 80) } }
}

const GalaxyOrbitalThree = ({ isActive = true, density = 200, volume = 0.5, isPlaying = false, videoId = null }) => {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const shootingStarsRef = useRef([])
  const timeRef = useRef(0)
  const rotationRef = useRef(0)
  const intensityRef = useRef(0.7)
  const currentColorsRef = useRef([{ r: 255, g: 200, b: 150 }, { r: 200, g: 150, b: 255 }, { r: 150, g: 200, b: 255 }])
  const targetColorsRef = useRef([...currentColorsRef.current])
  const colorTransitionRef = useRef(1)
  const loopRef = useRef(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const lastShootingRef = useRef(0)

  useEffect(() => {
    if (!videoId) return
    extractColors(videoId).then(colors => {
      if (colors && colors.length >= 3) {
        targetColorsRef.current = colors.slice(0, 3)
        colorTransitionRef.current = 0
      }
    })
  }, [videoId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { ctx, width, height } = setupCanvas(canvas)
    sizeRef.current = { width, height }
    const cx = width / 2, cy = height / 2
    const maxRadius = Math.max(width, height) * 0.85

    const createParticles = () => {
      particlesRef.current = []
      const count = Math.floor(density * 3 * (width * height / 1920000))
      for (let i = 0; i < count; i++) particlesRef.current.push(createParticle())
    }
    createParticles()

    const getColor = (phase) => {
      const colors = currentColorsRef.current
      const p = (phase % 1) * colors.length
      const i1 = Math.floor(p) % colors.length
      const i2 = (i1 + 1) % colors.length
      return lerpColor(colors[i1], colors[i2], smoothstep(p - Math.floor(p)))
    }

    const handleResize = () => {
      const { width: w, height: h } = setupCanvas(canvas)
      sizeRef.current = { width: w, height: h }
      createParticles()
    }
    window.addEventListener('resize', handleResize)

    loopRef.current = createLoop((dt, timestamp) => {
      if (!isActive) return
      const { width, height } = sizeRef.current
      const cx = width / 2, cy = height / 2
      const maxRadius = Math.max(width, height) * 0.85

      if (colorTransitionRef.current < 1) {
        colorTransitionRef.current = Math.min(1, colorTransitionRef.current + dt * 0.5)
        currentColorsRef.current = currentColorsRef.current.map((c, i) => lerpColor(c, targetColorsRef.current[i], 0.05))
      }

      const speedMult = isPlaying ? 1.2 : 0.6
      timeRef.current += dt * speedMult
      rotationRef.current += dt * (isPlaying ? 0.03 : 0.016)
      const t = timeRef.current

      const targetIntensity = isPlaying ? 0.7 + volume * 0.3 : 0.6
      intensityRef.current = lerp(intensityRef.current, targetIntensity, 0.03)
      const intensity = intensityRef.current

      clearFade(ctx, width, height, 0.1)

      particlesRef.current.sort((a, b) => a.zDepth - b.zDepth).forEach(p => {
        p.depth += p.driftSpeed * dt * 60 * speedMult
        p.angle += p.rotateSpeed * dt * 60
        if (p.depth > 1) { p.depth = 0.005; p.angle = Math.random() * TAU }

        const depthCurve = smoothstep(p.depth)
        const zScale = 0.4 + (1 + p.zDepth) * 0.6
        const rotatedAngle = p.angle + rotationRef.current
        const particleRadius = depthCurve * maxRadius * p.radialPos * zScale
        const x = cx + Math.cos(rotatedAngle) * particleRadius
        const y = cy + Math.sin(rotatedAngle) * particleRadius

        const fadeIn = smoothstep(Math.min(1, p.depth * 2.5))
        const fadeOut = 1 - smoothstep(Math.max(0, (p.depth - 0.75) / 0.25))
        const twinkle = 0.7 + Math.sin(t * 1.5 + p.twinklePhase) * 0.3
        const pulse = 1 + Math.sin(t * 0.5 + p.pulsePhase) * 0.2
        const finalOpacity = fadeIn * fadeOut * p.opacity * twinkle

        if (finalOpacity < 0.02) return

        const size = p.baseSize * (0.2 + depthCurve * 2) * zScale * pulse
        const glow = p.glowSize * (0.2 + depthCurve * 2) * zScale * pulse
        const c = p.type === 'star' ? p.color : getColor((t * 0.03 + p.depth) % 1)

        if (p.type === 'nebula') {
          const grad = ctx.createRadialGradient(x, y, 0, x, y, glow)
          grad.addColorStop(0, toRgba(c, finalOpacity * 0.4))
          grad.addColorStop(0.5, toRgba(c, finalOpacity * 0.15))
          grad.addColorStop(1, 'transparent')
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(x, y, glow, 0, TAU)
          ctx.fill()
        } else {
          if (glow > 2) {
            const grad = ctx.createRadialGradient(x, y, 0, x, y, glow)
            grad.addColorStop(0, toRgba(c, finalOpacity * 0.5))
            grad.addColorStop(0.3, toRgba(c, finalOpacity * 0.2))
            grad.addColorStop(1, 'transparent')
            ctx.fillStyle = grad
            ctx.beginPath()
            ctx.arc(x, y, glow, 0, TAU)
            ctx.fill()
          }
          ctx.fillStyle = toRgba({ r: Math.min(255, c.r + 50), g: Math.min(255, c.g + 50), b: Math.min(255, c.b + 50) }, finalOpacity)
          ctx.beginPath()
          ctx.arc(x, y, size * 0.6, 0, TAU)
          ctx.fill()
          if (size > 1.5 && twinkle > 0.85) {
            ctx.fillStyle = toRgba({ r: 255, g: 255, b: 255 }, finalOpacity * 0.8)
            ctx.beginPath()
            ctx.arc(x, y, size * 0.25, 0, TAU)
            ctx.fill()
          }
        }
      })

      const centerSize = 25 + intensity * 20
      const primary = currentColorsRef.current[0]
      const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, centerSize * 2)
      innerGlow.addColorStop(0, 'rgba(255,250,230,0.6)')
      innerGlow.addColorStop(0.3, toRgba(primary, 0.35))
      innerGlow.addColorStop(0.7, toRgba(primary, 0.1))
      innerGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = innerGlow
      ctx.beginPath()
      ctx.arc(cx, cy, centerSize * 2, 0, TAU)
      ctx.fill()

      if (timestamp - lastShootingRef.current > 3000 + Math.random() * 4000) {
        if (Math.random() < (isPlaying ? 0.7 : 0.4) && shootingStarsRef.current.length < 8) {
          shootingStarsRef.current.push(createShootingStar(width, height, currentColorsRef.current))
          lastShootingRef.current = timestamp
        }
      }

      shootingStarsRef.current = shootingStarsRef.current.filter(star => {
        star.x += Math.cos(star.angle) * star.speed * dt
        star.y += Math.sin(star.angle) * star.speed * dt
        star.life -= star.decay * dt
        if (star.life <= 0) return false

        const c = star.color
        const alpha = star.life
        const trailX = star.x - Math.cos(star.angle) * star.length * alpha
        const trailY = star.y - Math.sin(star.angle) * star.length * alpha

        const grad = ctx.createLinearGradient(trailX, trailY, star.x, star.y)
        grad.addColorStop(0, 'transparent')
        grad.addColorStop(0.5, toRgba(c, alpha * 0.4))
        grad.addColorStop(1, toRgba({ r: 255, g: 255, b: 255 }, alpha * 0.9))
        ctx.strokeStyle = grad
        ctx.lineWidth = star.width * alpha
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(trailX, trailY)
        ctx.lineTo(star.x, star.y)
        ctx.stroke()

        const headGlow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.width * 4 * alpha)
        headGlow.addColorStop(0, toRgba({ r: 255, g: 255, b: 255 }, alpha * 0.9))
        headGlow.addColorStop(0.5, toRgba(c, alpha * 0.4))
        headGlow.addColorStop(1, 'transparent')
        ctx.fillStyle = headGlow
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.width * 4 * alpha, 0, TAU)
        ctx.fill()

        return star.x > -50 && star.x < width + 50 && star.y > -50 && star.y < height + 50
      })
    }, 60)

    loopRef.current.start()

    return () => {
      loopRef.current?.stop()
      window.removeEventListener('resize', handleResize)
    }
  }, [isActive, density, isPlaying, volume])

  return <canvas ref={canvasRef} className={`galaxy-canvas ${isActive ? 'active' : ''}`} aria-hidden="true" />
}

export default GalaxyOrbitalThree
