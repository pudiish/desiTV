import React, { useRef, useEffect } from 'react'
import { setupCanvas, lerp, extractColors, createLoop, TAU } from './utils'
import './Galaxy.css'

const DEFAULT_COLORS = [
  { h: 140, s: 80, l: 55 },
  { h: 160, s: 70, l: 50 },
  { h: 280, s: 65, l: 55 },
  { h: 320, s: 70, l: 60 },
  { h: 200, s: 75, l: 50 },
]

const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`
const lerpHsl = (a, b, t) => ({ h: lerp(a.h, b.h, t), s: lerp(a.s, b.s, t), l: lerp(a.l, b.l, t) })
const spring = (cur, tgt, vel, stiff, damp, dt) => {
  const nv = (vel + (tgt - cur) * stiff * dt) * damp
  return { v: cur + nv * dt, vel: nv }
}
const expSmooth = (cur, tgt, sm, dt) => cur * Math.pow(sm, dt / 16.67) + tgt * (1 - Math.pow(sm, dt / 16.67))

const noise2D = (() => {
  const perm = new Uint8Array(512)
  const p = new Uint8Array(256)
  for (let i = 0; i < 256; i++) p[i] = i
  let n = 256, rng = Math.random() * 10000
  while (n > 1) { rng = (rng * 16807) % 2147483647; const k = Math.floor((rng / 2147483647) * n); n--; [p[n], p[k]] = [p[k], p[n]] }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]
  
  return (x, y) => {
    const F2 = 0.366025, G2 = 0.211325
    const s = (x + y) * F2, i = Math.floor(x + s), j = Math.floor(y + s), t = (i + j) * G2
    const x0 = x - i + t, y0 = y - j + t
    const [i1, j1] = x0 > y0 ? [1, 0] : [0, 1]
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2
    const ii = i & 255, jj = j & 255
    const grad = (h, u, v) => ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v)
    let n0 = 0, n1 = 0, n2 = 0, t0 = 0.5 - x0 * x0 - y0 * y0, t1 = 0.5 - x1 * x1 - y1 * y1, t2 = 0.5 - x2 * x2 - y2 * y2
    if (t0 >= 0) { t0 *= t0; n0 = t0 * t0 * grad(perm[ii + perm[jj]] & 7, x0, y0) }
    if (t1 >= 0) { t1 *= t1; n1 = t1 * t1 * grad(perm[ii + i1 + perm[jj + j1]] & 7, x1, y1) }
    if (t2 >= 0) { t2 *= t2; n2 = t2 * t2 * grad(perm[ii + 1 + perm[jj + 1]] & 7, x2, y2) }
    return 70 * (n0 + n1 + n2)
  }
})()

const fbm = (x, y, oct = 3) => {
  let v = 0, a = 1, f = 1, m = 0
  for (let i = 0; i < oct; i++) { v += a * noise2D(x * f, y * f); m += a; a *= 0.5; f *= 2 }
  return v / m
}

const Aurora = ({ isActive = true, density = 200, volume = 0.5, isPlaying = false, videoId = null }) => {
  const canvasRef = useRef(null)
  const starsRef = useRef([])
  const shimmerRef = useRef([])
  const timeRef = useRef(0)
  const intensityRef = useRef(0.5)
  const colorsRef = useRef([...DEFAULT_COLORS])
  const targetColorsRef = useRef([...DEFAULT_COLORS])
  const colorTransitionRef = useRef(1)
  const loopRef = useRef(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const bassRef = useRef({
    bpm: 120, beatInterval: 500, acc: 0, lastTrigger: 0, beatIdx: 0,
    low: 0, lowTgt: 0, mid: 0, midTgt: 0, high: 0, highTgt: 0,
    shake: { x: 0, y: 0, tgtX: 0, tgtY: 0, velX: 0, velY: 0, rot: 0, rotTgt: 0, rotVel: 0 },
    pulse: { i: 0, tgt: 0, vel: 0, exp: 0, bright: 0 },
    horizon: { i: 0, tgt: 0, vel: 0 },
    waves: [],
    boom: { rings: [], centerFlash: 0, screenFlash: 0 },
  })

  useEffect(() => {
    if (!videoId) return
    extractColors(videoId).then(colors => {
      if (colors && colors.length >= 3) {
        const hslColors = colors.slice(0, 5).map(c => {
          const r = c.r / 255, g = c.g / 255, b = c.b / 255
          const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
          let h = 0, s = 0
          if (max !== min) {
            const d = max - min
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
            else if (max === g) h = ((b - r) / d + 2) / 6
            else h = ((r - g) / d + 4) / 6
          }
          return { h: Math.round(h * 360), s: Math.min(100, Math.round(s * 100) + 20), l: Math.max(40, Math.min(70, Math.round(l * 100))) }
        })
        while (hslColors.length < 5) hslColors.push(hslColors[hslColors.length - 1])
        targetColorsRef.current = hslColors
        colorTransitionRef.current = 0
      }
    })
  }, [videoId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const { ctx, width, height } = setupCanvas(canvas)
    sizeRef.current = { width, height }

    const createStars = () => {
      starsRef.current = []
      const count = Math.floor(density * 0.8 * (width * height / 1920000))
      for (let i = 0; i < count; i++) {
        starsRef.current.push({ x: Math.random() * width, y: Math.random() * height, size: 0.5 + Math.random() * 1.5, brightness: Math.random(), twinkleSpeed: 0.5 + Math.random() * 2, phase: Math.random() * TAU })
      }
    }

    const createShimmer = () => {
      shimmerRef.current = []
      const count = Math.floor(density * 0.4 * (width * height / 1920000))
      for (let i = 0; i < count; i++) {
        shimmerRef.current.push({ x: Math.random() * width, y: height * 0.15 + Math.random() * height * 0.55, size: 1 + Math.random() * 3, drift: Math.random() * 2 - 1, floatSpeed: 0.2 + Math.random() * 0.5, phase: Math.random() * TAU, colorIdx: Math.floor(Math.random() * 5), alpha: 0.3 + Math.random() * 0.5, burstVelX: 0, burstVelY: 0 })
      }
    }

    createStars()
    createShimmer()

    const handleResize = () => {
      const { width: w, height: h } = setupCanvas(canvas)
      sizeRef.current = { width: w, height: h }
      createStars()
      createShimmer()
    }
    window.addEventListener('resize', handleResize)

    const getColor = (phase, alpha = 1) => {
      const colors = colorsRef.current
      const p = (phase % 1) * colors.length
      const i1 = Math.floor(p) % colors.length, i2 = (i1 + 1) % colors.length
      const c = lerpHsl(colors[i1], colors[i2], p - Math.floor(p))
      return hsl(c.h, c.s, c.l, alpha)
    }

    loopRef.current = createLoop((dt, timestamp) => {
      if (!isActive) return
      const { width, height } = sizeRef.current
      const bass = bassRef.current

      if (colorTransitionRef.current < 1) {
        colorTransitionRef.current = Math.min(1, colorTransitionRef.current + dt * 0.3)
        colorsRef.current = colorsRef.current.map((c, i) => lerpHsl(c, targetColorsRef.current[i], 0.1))
      }

      if (isPlaying && volume > 0.1) {
        bass.bpm = 118 + Math.sin(timestamp * 0.00003) * 5
        bass.beatInterval = 60000 / bass.bpm
        bass.acc += dt * 1000
        
        if (bass.acc >= bass.beatInterval) {
          bass.acc %= bass.beatInterval
          bass.beatIdx = (bass.beatIdx + 1) % 4
          const isDown = bass.beatIdx === 0, isAccent = bass.beatIdx === 2
          
          if (isDown) { bass.lowTgt = (0.85 + Math.random() * 0.15) * volume; bass.midTgt = 0.3 * volume; bass.highTgt = 0.2 * volume }
          else if (isAccent) { bass.lowTgt = 0.4 * volume; bass.midTgt = 0.8 * volume; bass.highTgt = 0.5 * volume }
          else { bass.lowTgt = 0.15 * volume; bass.midTgt = 0.25 * volume; bass.highTgt = 0.6 * volume }
          
          const bassStrength = bass.lowTgt
          if (isDown && bassStrength > 0.5 && timestamp - bass.lastTrigger > 380) {
            bass.lastTrigger = timestamp
            const imp = Math.min(1, (bassStrength - 0.5) / 0.5)
            const angle = Math.random() * TAU, mag = 8 + imp * 20
            bass.shake.tgtX = Math.cos(angle) * mag
            bass.shake.tgtY = Math.sin(angle) * mag
            bass.shake.rotTgt = (Math.random() - 0.5) * 0.02 * imp
            bass.pulse.tgt = imp
            bass.pulse.exp = imp * 0.3
            bass.pulse.bright = imp * 0.4
            bass.horizon.tgt = imp * 0.8
            bass.waves.push({ y: height * 0.3, speed: 2 + imp * 3, i: imp, age: 0 })
            shimmerRef.current.forEach(p => { const a = Math.random() * TAU, s = (2 + Math.random() * 4) * imp; p.burstVelX = Math.cos(a) * s; p.burstVelY = Math.sin(a) * s })
            bass.boom.rings.push({ x: width / 2, y: height * 0.4, r: 0, maxR: Math.max(width, height) * 0.8, speed: 8 + imp * 12, i: imp, thick: 3 + imp * 8, colorPhase: Math.random() })
            bass.boom.centerFlash = imp
            bass.boom.screenFlash = imp * 0.4
          }
        }
        
        bass.low = expSmooth(bass.low, bass.lowTgt, 0.92, dt * 1000); bass.lowTgt *= 0.97
        bass.mid = expSmooth(bass.mid, bass.midTgt, 0.88, dt * 1000); bass.midTgt *= 0.95
        bass.high = expSmooth(bass.high, bass.highTgt, 0.82, dt * 1000); bass.highTgt *= 0.92
      } else {
        bass.low *= 0.95; bass.mid *= 0.95; bass.high *= 0.95
      }

      let sp = spring(bass.shake.x, 0, bass.shake.velX, 0.15, 0.85, dt * 1000); bass.shake.x = sp.v + bass.shake.tgtX * 0.3; bass.shake.velX = sp.vel; bass.shake.tgtX *= 0.7
      sp = spring(bass.shake.y, 0, bass.shake.velY, 0.15, 0.85, dt * 1000); bass.shake.y = sp.v + bass.shake.tgtY * 0.3; bass.shake.velY = sp.vel; bass.shake.tgtY *= 0.7
      sp = spring(bass.shake.rot, 0, bass.shake.rotVel, 0.1, 0.9, dt * 1000); bass.shake.rot = sp.v + bass.shake.rotTgt * 0.2; bass.shake.rotVel = sp.vel; bass.shake.rotTgt *= 0.8
      sp = spring(bass.pulse.i, bass.pulse.tgt, bass.pulse.vel, 0.2, 0.88, dt * 1000); bass.pulse.i = Math.max(0, sp.v); bass.pulse.vel = sp.vel; bass.pulse.tgt *= 0.9; bass.pulse.exp *= 0.92; bass.pulse.bright *= 0.9
      sp = spring(bass.horizon.i, bass.horizon.tgt, bass.horizon.vel, 0.25, 0.85, dt * 1000); bass.horizon.i = Math.max(0, sp.v); bass.horizon.vel = sp.vel; bass.horizon.tgt *= 0.88
      bass.waves = bass.waves.filter(w => { w.age += dt * 1000; w.y += w.speed; w.i *= 0.985; return w.age < 800 && w.i > 0.01 })
      bass.boom.rings = bass.boom.rings.filter(r => { r.r += r.speed * dt * 60; r.i *= 0.97; r.thick *= 0.995; return r.r < r.maxR && r.i > 0.02 })
      bass.boom.centerFlash *= 0.88; bass.boom.screenFlash *= 0.85
      shimmerRef.current.forEach(p => { p.burstVelX *= 0.94; p.burstVelY *= 0.94 })

      const speedMult = isPlaying ? 0.5 + volume * 0.5 : 0.3
      timeRef.current += dt * speedMult
      intensityRef.current = lerp(intensityRef.current, isPlaying ? 0.5 + volume * 0.5 : 0.4, 0.02)
      const t = timeRef.current, intensity = intensityRef.current
      const shakeX = bass.shake.x, shakeY = bass.shake.y

      ctx.save()
      if (Math.abs(bass.shake.rot) > 0.001) { ctx.translate(width / 2, height / 2); ctx.rotate(bass.shake.rot); ctx.translate(-width / 2, -height / 2) }

      const sky = ctx.createLinearGradient(0, 0, 0, height)
      sky.addColorStop(0, '#0a0a15'); sky.addColorStop(0.5, '#0d0d1a'); sky.addColorStop(1, '#111122')
      ctx.fillStyle = sky; ctx.fillRect(-50, -50, width + 100, height + 100)

      starsRef.current.forEach(s => {
        const twinkle = Math.sin(t * s.twinkleSpeed + s.phase) * 0.5 + 0.5
        const bright = s.brightness * twinkle * (0.5 + intensity * 0.5)
        ctx.fillStyle = `rgba(255,255,255,${bright * 0.8})`
        ctx.beginPath(); ctx.arc(s.x + shakeX * 0.3, s.y + shakeY * 0.3, s.size * (0.5 + twinkle * 0.5), 0, TAU); ctx.fill()
        if (bright > 0.7) {
          const g = ctx.createRadialGradient(s.x + shakeX * 0.3, s.y + shakeY * 0.3, 0, s.x + shakeX * 0.3, s.y + shakeY * 0.3, s.size * 4)
          g.addColorStop(0, `rgba(255,255,255,${bright * 0.3})`); g.addColorStop(1, 'transparent')
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x + shakeX * 0.3, s.y + shakeY * 0.3, s.size * 4, 0, TAU); ctx.fill()
        }
      })

      const flashBoost = 1 + bass.horizon.i * 2
      for (let i = 0; i < 3; i++) {
        const c = colorsRef.current[i % 5]
        const g = ctx.createRadialGradient(width / 2 + Math.sin(t + i) * 100, height * 0.85 + shakeY * 0.5, 0, width / 2, height * 0.85 + shakeY * 0.5, width * 0.7)
        const alpha = (0.1 + bass.horizon.i * 0.4) * intensity * flashBoost
        g.addColorStop(0, hsl(c.h, c.s * 0.8, c.l, alpha)); g.addColorStop(0.5, hsl(c.h, c.s * 0.6, c.l * 0.8, alpha * 0.4)); g.addColorStop(1, 'transparent')
        ctx.fillStyle = g; ctx.fillRect(0, height * 0.6, width, height * 0.5)
      }

      const pulseScale = 1 + bass.pulse.exp, pulseBright = 1 + bass.pulse.bright
      for (let band = 0; band < 5; band++) {
        const bandY = height * (0.15 + band * 0.12) + shakeY * (0.8 + band * 0.1)
        const colorPhase = (t * 0.05 + band / 5) % 1
        const waveAmp = (30 + band * 20 + intensity * 40) * pulseScale
        const curtainH = (150 + band * 50 + intensity * 100) * pulseScale
        const segments = 60
        
        ctx.beginPath()
        const pts = []
        for (let i = 0; i <= segments; i++) {
          const x = (i / segments) * (width + 200) - 100 + shakeX
          const n1 = fbm(x * 0.003 + t * 0.2, band * 10)
          const n2 = fbm(x * 0.0015 + t * 0.1, band * 10 + 100, 2)
          let waveInf = 0
          bass.waves.forEach(w => { const d = Math.abs(bandY - w.y); if (d < 100) waveInf += (1 - d / 100) * w.i * Math.sin(x * 0.02 + w.age * 0.01) * 15 })
          const y = bandY + n1 * waveAmp + n2 * waveAmp * 0.5 + Math.sin(x * 0.01 + t * 0.5 + band) * 20 * intensity + waveInf
          const drapeH = curtainH * (0.5 + noise2D(x * 0.005, t * 0.2 + band) * 0.3)
          pts.push({ x, y, h: drapeH })
        }
        
        const grad = ctx.createLinearGradient(0, bandY - 50, 0, bandY + curtainH)
        const baseAlpha = (0.15 + intensity * 0.25) * (1 - band * 0.12) * pulseBright
        grad.addColorStop(0, getColor(colorPhase, 0)); grad.addColorStop(0.2, getColor(colorPhase, baseAlpha * 0.5)); grad.addColorStop(0.5, getColor(colorPhase + 0.15, baseAlpha)); grad.addColorStop(0.8, getColor(colorPhase + 0.3, baseAlpha * 0.4)); grad.addColorStop(1, 'transparent')
        
        ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i].x, pts[i].y + pts[i].h)
        ctx.closePath(); ctx.fillStyle = grad; ctx.fill()
        
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.strokeStyle = getColor(colorPhase, baseAlpha * 1.5 * pulseBright); ctx.lineWidth = (2 + intensity * 3) * pulseScale; ctx.lineCap = 'round'
        ctx.shadowColor = getColor(colorPhase, 1); ctx.shadowBlur = (15 + intensity * 20) * pulseBright; ctx.stroke(); ctx.shadowBlur = 0
      }

      shimmerRef.current.forEach(p => {
        p.x += p.drift * 0.3 + p.burstVelX; p.y += Math.sin(t * p.floatSpeed + p.phase) * 0.5 + p.burstVelY
        if (p.x < -10) p.x = width + 10; if (p.x > width + 10) p.x = -10
        if (p.y < height * 0.1) p.y = height * 0.6; if (p.y > height * 0.7) p.y = height * 0.15
        const alpha = p.alpha * (0.5 + Math.sin(t * 2 + p.phase) * 0.5) * intensity
        const c = colorsRef.current[p.colorIdx]
        const g = ctx.createRadialGradient(p.x + shakeX, p.y + shakeY, 0, p.x + shakeX, p.y + shakeY, p.size * 3)
        g.addColorStop(0, hsl(c.h, c.s, Math.min(90, c.l + 30), alpha)); g.addColorStop(0.3, hsl(c.h, c.s, c.l, alpha * 0.5)); g.addColorStop(1, 'transparent')
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x + shakeX, p.y + shakeY, p.size * 3, 0, TAU); ctx.fill()
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.8})`; ctx.beginPath(); ctx.arc(p.x + shakeX, p.y + shakeY, p.size * 0.5, 0, TAU); ctx.fill()
      })

      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      bass.boom.rings.forEach(ring => {
        const c = colorsRef.current[Math.floor(ring.colorPhase * 5) % 5]
        const g = ctx.createRadialGradient(ring.x + shakeX, ring.y + shakeY, Math.max(0, ring.r - ring.thick), ring.x + shakeX, ring.y + shakeY, ring.r + ring.thick)
        g.addColorStop(0, 'transparent'); g.addColorStop(0.3, hsl(c.h, c.s, c.l + 20, ring.i * 0.3)); g.addColorStop(0.5, hsl(c.h, c.s, Math.min(95, c.l + 40), ring.i)); g.addColorStop(0.7, hsl(c.h, c.s, c.l + 20, ring.i * 0.3)); g.addColorStop(1, 'transparent')
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ring.x + shakeX, ring.y + shakeY, ring.r + ring.thick, 0, TAU); ctx.fill()
        ctx.strokeStyle = hsl(c.h, c.s * 0.5, 90, ring.i * 1.2); ctx.lineWidth = Math.max(1, ring.thick * 0.3); ctx.shadowColor = hsl(c.h, c.s, c.l, 1); ctx.shadowBlur = ring.thick * 3
        ctx.beginPath(); ctx.arc(ring.x + shakeX, ring.y + shakeY, ring.r, 0, TAU); ctx.stroke(); ctx.shadowBlur = 0
      })
      if (bass.boom.centerFlash > 0.05) {
        const c = colorsRef.current[0]
        const g = ctx.createRadialGradient(width / 2 + shakeX, height * 0.4 + shakeY, 0, width / 2 + shakeX, height * 0.4 + shakeY, 50 + bass.boom.centerFlash * 150)
        g.addColorStop(0, `rgba(255,255,255,${bass.boom.centerFlash * 0.9})`); g.addColorStop(0.2, hsl(c.h, c.s * 0.3, 95, bass.boom.centerFlash * 0.7)); g.addColorStop(0.5, hsl(c.h, c.s, c.l + 20, bass.boom.centerFlash * 0.4)); g.addColorStop(1, 'transparent')
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(width / 2 + shakeX, height * 0.4 + shakeY, 50 + bass.boom.centerFlash * 150, 0, TAU); ctx.fill()
      }
      if (bass.boom.screenFlash > 0.05) { ctx.fillStyle = `rgba(255,255,255,${bass.boom.screenFlash * 0.15})`; ctx.fillRect(-50, -50, width + 100, height + 100) }
      ctx.restore()

      ctx.restore()
    }, 60)

    loopRef.current.start()

    return () => {
      loopRef.current?.stop()
      window.removeEventListener('resize', handleResize)
    }
  }, [isActive, density, isPlaying, volume])

  return <canvas ref={canvasRef} className={`galaxy-canvas ${isActive ? 'active' : ''}`} aria-hidden="true" />
}

export default Aurora
