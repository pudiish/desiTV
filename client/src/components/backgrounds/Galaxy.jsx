import React, { useRef, useEffect } from 'react'
import { setupCanvas, clearFade, lerp, lerpColor, toRgba, extractColors, noise, createLoop } from './utils'
import './Galaxy.css'

const Galaxy = ({ isActive = true, baseSpeed = 0.3, density = 400, volume = 0.5, isPlaying = false, videoId = null }) => {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const timeRef = useRef(0)
  const intensityRef = useRef(0)
  const currentColorsRef = useRef([
    { r: 212, g: 165, b: 116 },
    { r: 180, g: 120, b: 80 },
    { r: 230, g: 184, b: 136 },
    { r: 160, g: 100, b: 60 },
    { r: 200, g: 150, b: 100 },
  ])
  const targetColorsRef = useRef([...currentColorsRef.current])
  const colorTransitionRef = useRef(1)
  const loopRef = useRef(null)
  const sizeRef = useRef({ width: 0, height: 0 })

  useEffect(() => {
    if (!videoId) return
    extractColors(videoId).then(colors => {
      if (colors && colors.length >= 3) {
        while (colors.length < 5) colors.push(colors[colors.length % colors.length])
        targetColorsRef.current = colors.slice(0, 5)
        colorTransitionRef.current = 0
      }
    })
  }, [videoId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { ctx, width, height } = setupCanvas(canvas)
    sizeRef.current = { width, height }
    const cx = width / 2
    const cy = height / 2

    const getColor = (phase) => {
      const colors = currentColorsRef.current
      const p = (phase % 1) * colors.length
      const i1 = Math.floor(p) % colors.length
      const i2 = (i1 + 1) % colors.length
      const t = p - Math.floor(p)
      return lerpColor(colors[i1], colors[i2], t * t * (3 - 2 * t))
    }

    const createParticles = () => {
      particlesRef.current = []
      const { width: w, height: h } = sizeRef.current
      const count = Math.floor(density * (w * h / 1920000))
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const dist = Math.pow(Math.random(), 0.5) * Math.max(w, h) * 0.6
        particlesRef.current.push({
          x: w / 2 + Math.cos(angle) * dist,
          y: h / 2 + Math.sin(angle) * dist,
          baseX: w / 2 + Math.cos(angle) * dist,
          baseY: h / 2 + Math.sin(angle) * dist,
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

    const handleResize = () => {
      const { width: w, height: h } = setupCanvas(canvas)
      sizeRef.current = { width: w, height: h }
      createParticles()
    }
    window.addEventListener('resize', handleResize)

    loopRef.current = createLoop((dt, t) => {
      if (!isActive) return
      const { width, height } = sizeRef.current
      const cx = width / 2
      const cy = height / 2

      if (colorTransitionRef.current < 1) {
        colorTransitionRef.current = Math.min(1, colorTransitionRef.current + dt * 0.5)
        const tr = colorTransitionRef.current * colorTransitionRef.current * (3 - 2 * colorTransitionRef.current)
        currentColorsRef.current = currentColorsRef.current.map((c, i) => lerpColor(c, targetColorsRef.current[i], tr * 0.05))
      }

      const speedMult = isPlaying ? (0.3 + volume * 0.7) : 0.15
      timeRef.current += dt * 0.8 * speedMult

      const cyclePhase = (timeRef.current % 30) / 30
      const moodBoost = 0.8 + (isPlaying ? volume * 0.4 : 0.2)
      const targetIntensity = Math.pow(Math.sin(cyclePhase * Math.PI), 0.7) * moodBoost
      intensityRef.current += (targetIntensity + (isPlaying ? volume * 0.3 * moodBoost : 0) - intensityRef.current) * 0.01

      const time = timeRef.current
      const intensity = intensityRef.current
      clearFade(ctx, width, height, 0.02 + (1 - intensity) * 0.04)

      const bgColor = getColor(time * 0.02)
      const bgBreath = Math.sin(time * 0.3) * 0.5 + 0.5
      const bgGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.8)
      bgGrad.addColorStop(0, toRgba(bgColor, 0.12 * intensity * bgBreath))
      bgGrad.addColorStop(0.4, toRgba(bgColor, 0.06 * intensity))
      bgGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, width, height)

      particlesRef.current.forEach(p => {
        const nX = noise(p.baseX * 0.01 + p.phaseX, p.baseY * 0.01, time * p.speedMult) * 100 * (0.5 + intensity * 0.5)
        const nY = noise(p.baseX * 0.01, p.baseY * 0.01 + p.phaseY, time * p.speedMult * 1.1) * 100 * (0.5 + intensity * 0.5)

        const orbitAngle = time * p.orbitSpeed * 100 + p.orbitPhase
        const orbitX = Math.cos(orbitAngle) * p.orbitRadius * (0.3 + intensity * 0.7)
        const orbitY = Math.sin(orbitAngle) * p.orbitRadius * (0.3 + intensity * 0.7)

        const driftX = Math.cos(p.driftAngle) * time * p.driftSpeed * 10
        const driftY = Math.sin(p.driftAngle) * time * p.driftSpeed * 10

        p.x = p.baseX + nX + orbitX + driftX
        p.y = p.baseY + nY + orbitY + driftY

        if (p.x < -100) p.baseX += width + 200
        if (p.x > width + 100) p.baseX -= width + 200
        if (p.y < -100) p.baseY += height + 200
        if (p.y > height + 100) p.baseY -= height + 200

        const sizeBreath = Math.sin(time * 0.5 + p.phaseSize) * 0.3 + 1
        const size = p.size * sizeBreath * (0.8 + intensity * 1.2)
        const color = getColor((time * 0.05 + p.phaseColor) % 1)
        const distFromCenter = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)
        const distFade = 1 - Math.min(1, distFromCenter / (Math.max(width, height) * 0.7))
        const opacity = (0.3 + intensity * 0.7) * distFade * (0.5 + sizeBreath * 0.5)

        const glowSize = size * (3 + intensity * 4)
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize)
        glow.addColorStop(0, toRgba(color, opacity))
        glow.addColorStop(0.3, toRgba(color, opacity * 0.4))
        glow.addColorStop(0.6, toRgba(color, opacity * 0.1))
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2)
        ctx.fill()

        if (intensity > 0.5) {
          ctx.fillStyle = toRgba({ r: 255, g: 255, b: 255 }, (intensity - 0.5) * 2 * opacity * 0.5)
          ctx.beginPath()
          ctx.arc(p.x, p.y, size * 0.3, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      if (intensity > 0.3) {
        for (let s = 0; s < 3; s++) {
          const streamPhase = time * 0.1 + s * (Math.PI * 2 / 3)
          const streamColor = getColor(time * 0.03 + s * 0.33)
          ctx.beginPath()
          ctx.strokeStyle = toRgba(streamColor, (intensity - 0.3) * 0.15)
          ctx.lineWidth = 2 + intensity * 3
          ctx.lineCap = 'round'
          for (let p = 0; p < 50; p++) {
            const progress = p / 50
            const angle = streamPhase + progress * Math.PI * 4
            const radius = 50 + progress * Math.max(width, height) * 0.4
            const wobble = Math.sin(progress * 10 + time * 2 + s) * 30 * intensity
            const x = cx + Math.cos(angle) * (radius + wobble)
            const y = cy + Math.sin(angle) * (radius + wobble) * 0.6
            p === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
      }

      const coreSize = 30 + intensity * 60
      const coreColor = getColor(time * 0.02)
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize * 3)
      coreGrad.addColorStop(0, toRgba({ r: 255, g: 255, b: 255 }, 0.1 + intensity * 0.4))
      coreGrad.addColorStop(0.1, toRgba(coreColor, 0.2 + intensity * 0.3))
      coreGrad.addColorStop(0.4, toRgba(coreColor, intensity * 0.1))
      coreGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = coreGrad
      ctx.beginPath()
      ctx.arc(cx, cy, coreSize * 3, 0, Math.PI * 2)
      ctx.fill()
    }, 60)

    loopRef.current.start()

    return () => {
      loopRef.current?.stop()
      window.removeEventListener('resize', handleResize)
    }
  }, [isActive, density, isPlaying, volume])

  return <canvas ref={canvasRef} className={`galaxy-canvas ${isActive ? 'active' : ''}`} aria-hidden="true" />
}

export default Galaxy
