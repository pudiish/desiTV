import React, { useRef, useEffect } from 'react'
import { setupCanvas, clearFade, lerp, lerpColor, toRgba, extractColors, noise, createLoop } from './utils'
import './Galaxy.css'

const Liquid = ({ isActive = true, baseSpeed = 0.3, density = 400, volume = 0.5, isPlaying = false, videoId = null, variant = 'classic' }) => {
  const canvasRef = useRef(null)
  const particlesRef = useRef([])
  const timeRef = useRef(0)
  const intensityRef = useRef(0)
  const currentColorsRef = useRef([
    { r: 100, g: 100, b: 180 },
    { r: 150, g: 100, b: 200 },
    { r: 80, g: 120, b: 200 },
    { r: 120, g: 80, b: 160 },
    { r: 100, g: 150, b: 220 },
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
          size: 1 + Math.random() * 4,
          phaseX: Math.random() * 1000,
          phaseY: Math.random() * 1000,
          phaseSize: Math.random() * Math.PI * 2,
          phaseColor: Math.random(),
          speedMult: 0.2 + Math.random() * 0.8,
          flowAngle: Math.random() * Math.PI * 2,
          flowSpeed: 0.05 + Math.random() * 0.2,
          waveAmplitude: 20 + Math.random() * 60,
          waveFrequency: 0.5 + Math.random() * 1.5,
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
        const nX = noise(p.baseX * 0.01 + p.phaseX, p.baseY * 0.01, time * p.speedMult) * p.waveAmplitude * (0.5 + intensity * 0.5)
        const nY = noise(p.baseX * 0.01, p.baseY * 0.01 + p.phaseY, time * p.speedMult * 1.1) * p.waveAmplitude * (0.5 + intensity * 0.5)
        const waveX = Math.sin(time * p.waveFrequency + p.phaseX) * p.waveAmplitude * 0.5 * intensity
        const waveY = Math.cos(time * p.waveFrequency * 0.8 + p.phaseY) * p.waveAmplitude * 0.5 * intensity
        const flowX = Math.cos(p.flowAngle) * time * p.flowSpeed * 20
        const flowY = Math.sin(p.flowAngle) * time * p.flowSpeed * 20

        p.x = p.baseX + nX + waveX + flowX
        p.y = p.baseY + nY + waveY + flowY

        if (p.x < -100) p.baseX += width + 200
        if (p.x > width + 100) p.baseX -= width + 200
        if (p.y < -100) p.baseY += height + 200
        if (p.y > height + 100) p.baseY -= height + 200

        const sizeBreath = Math.sin(time * 0.4 + p.phaseSize) * 0.4 + 1
        const size = p.size * sizeBreath * (0.7 + intensity * 1.3)
        const color = getColor((time * 0.04 + p.phaseColor) % 1)
        const distFromCenter = Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2)
        const distFade = 1 - Math.min(1, distFromCenter / (Math.max(width, height) * 0.8))
        const opacity = (0.4 + intensity * 0.6) * distFade * (0.6 + sizeBreath * 0.4)

        const glowSize = size * (2.5 + intensity * 5)
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize)
        glow.addColorStop(0, toRgba(color, opacity))
        glow.addColorStop(0.25, toRgba(color, opacity * 0.5))
        glow.addColorStop(0.5, toRgba(color, opacity * 0.2))
        glow.addColorStop(1, 'transparent')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, glowSize, 0, Math.PI * 2)
        ctx.fill()

        if (intensity > 0.4) {
          const coreSize = size * (0.4 + intensity * 0.3)
          ctx.fillStyle = toRgba({ r: 255, g: 255, b: 255 }, (intensity - 0.4) * opacity * 0.6)
          ctx.beginPath()
          ctx.arc(p.x, p.y, coreSize, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      if (intensity > 0.35) {
        for (let s = 0; s < 4; s++) {
          const streamPhase = time * 0.08 + s * (Math.PI * 2 / 4)
          const streamColor = getColor(time * 0.025 + s * 0.25)
          ctx.beginPath()
          ctx.strokeStyle = toRgba(streamColor, (intensity - 0.35) * 0.2)
          ctx.lineWidth = 2.5 + intensity * 4
          ctx.lineCap = 'round'
          for (let p = 0; p < 60; p++) {
            const progress = p / 60
            const angle = streamPhase + progress * Math.PI * 3
            const radius = 40 + progress * Math.max(width, height) * 0.45
            const wobble = Math.sin(progress * 12 + time * 1.5 + s) * 35 * intensity
            const x = cx + Math.cos(angle) * (radius + wobble)
            const y = cy + Math.sin(angle) * (radius + wobble) * 0.7
            p === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
      }

      const coreSize = 40 + intensity * 80
      const coreColor = getColor(time * 0.018)
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize * 3.5)
      coreGrad.addColorStop(0, toRgba({ r: 255, g: 255, b: 255 }, 0.15 + intensity * 0.5))
      coreGrad.addColorStop(0.1, toRgba(coreColor, 0.25 + intensity * 0.35))
      coreGrad.addColorStop(0.4, toRgba(coreColor, intensity * 0.12))
      coreGrad.addColorStop(1, 'transparent')
      ctx.fillStyle = coreGrad
      ctx.beginPath()
      ctx.arc(cx, cy, coreSize * 3.5, 0, Math.PI * 2)
      ctx.fill()
    }, 60)

    loopRef.current.start()

    return () => {
      loopRef.current?.stop()
      window.removeEventListener('resize', handleResize)
    }
  }, [isActive, density, isPlaying, volume, variant])

  return <canvas ref={canvasRef} className={`galaxy-canvas ${isActive ? 'active' : ''}`} aria-hidden="true" />
}

export default Liquid
