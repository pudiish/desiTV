// Background effect utilities

export const TAU = 6.283185307179586
export const lerp = (a, b, t) => a + (b - a) * t
export const clamp = (v, min, max) => v < min ? min : v > max ? max : v
export const smoothstep = (t) => t * t * (3 - 2 * t)
export const noise = (x, y) => {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

export const lerpColor = (a, b, t) => ({
  r: Math.round(lerp(a.r, b.r, t)),
  g: Math.round(lerp(a.g, b.g, t)),
  b: Math.round(lerp(a.b, b.b, t))
})

export const toRgba = (c, a = 1) => `rgba(${c.r},${c.g},${c.b},${a})`

export const setupCanvas = (canvas, maxDpr = 2) => {
  const ctx = canvas.getContext('2d')
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
  const w = window.innerWidth
  const h = window.innerHeight
  canvas.width = w * dpr
  canvas.height = h * dpr
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  ctx.scale(dpr, dpr)
  return { ctx, width: w, height: h, dpr }
}

export const clearFade = (ctx, w, h, fade = 0.08) => {
  ctx.fillStyle = `rgba(2,2,6,${fade})`
  ctx.fillRect(0, 0, w, h)
}

export const createLoop = (onFrame, targetFPS = 60) => {
  let id = null
  let last = 0
  let running = false
  let interval = 1000 / targetFPS

  const loop = (t) => {
    if (!running) return
    const elapsed = t - last
    if (elapsed < interval) {
      id = requestAnimationFrame(loop)
      return
    }
    const dt = Math.min(elapsed / 1000, 0.05)
    last = t
    onFrame(dt, t)
    id = requestAnimationFrame(loop)
  }

  return {
    start: () => {
      if (running) return
      running = true
      last = performance.now()
      id = requestAnimationFrame(loop)
    },
    stop: () => {
      running = false
      if (id) cancelAnimationFrame(id)
      id = null
    },
    setFPS: (fps) => { interval = 1000 / fps }
  }
}

let extractCanvas = null
let extractCtx = null

const getExtractCanvas = () => {
  if (!extractCanvas) {
    extractCanvas = document.createElement('canvas')
    extractCanvas.width = 50
    extractCanvas.height = 50
    extractCtx = extractCanvas.getContext('2d')
  }
  return { canvas: extractCanvas, ctx: extractCtx }
}

export const extractColors = async (videoId) => {
  if (!videoId) return null
  try {
    const qualities = ['hqdefault', 'mqdefault', 'default']
    let img = null
    for (const q of qualities) {
      try {
        img = await new Promise((resolve, reject) => {
          const i = new Image()
          i.crossOrigin = 'anonymous'
          i.onload = () => resolve(i)
          i.onerror = reject
          i.src = `https://img.youtube.com/vi/${videoId}/${q}.jpg`
        })
        if (img.width > 100) break
      } catch { continue }
    }
    if (!img) return null

    const { ctx } = getExtractCanvas()
    ctx.drawImage(img, 0, 0, 50, 50)
    const data = ctx.getImageData(0, 0, 50, 50).data

    const buckets = {}
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const brightness = (r + g + b) / 3
      if (brightness < 25 || brightness > 235) continue
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      if (max - min < 25) continue
      const key = `${Math.floor(r / 32) * 32},${Math.floor(g / 32) * 32},${Math.floor(b / 32) * 32}`
      buckets[key] = (buckets[key] || 0) + 1
    }

    const colors = Object.entries(buckets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([k]) => {
        const [r, g, b] = k.split(',').map(Number)
        return { r, g, b }
      })

    return colors.length >= 3 ? colors : null
  } catch {
    return null
  }
}
