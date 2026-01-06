/**
 * Shared Color Utilities
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Color manipulation, extraction, and interpolation functions.
 * Used by all background effects for video color synchronization.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { lerp, clamp } from './math'

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT COLOR PALETTES
// ═══════════════════════════════════════════════════════════════════════════════

export const DEFAULT_COLORS = [
  { r: 100, g: 100, b: 180 },
  { r: 150, g: 100, b: 200 },
  { r: 80, g: 120, b: 200 },
  { r: 120, g: 80, b: 160 },
  { r: 100, g: 150, b: 220 },
  { r: 180, g: 100, b: 150 },
]

// Milky Way star color temperatures (Blue giants to Red dwarfs)
export const STAR_COLORS = {
  blueGiant: { r: 155, g: 176, b: 255 },    // O-type stars ~30,000K
  blueStar: { r: 170, g: 191, b: 255 },     // B-type stars ~20,000K
  blueWhite: { r: 202, g: 215, b: 255 },    // A-type stars ~10,000K
  brightWhite: { r: 248, g: 247, b: 255 },  // F-type stars ~7,500K
  white: { r: 255, g: 244, b: 234 },        // G-type (Sun-like) ~6,000K
  yellowWhite: { r: 255, g: 237, b: 210 },  // G-type cooler
  sunYellow: { r: 255, g: 223, b: 181 },    // K-type ~5,000K
  orange: { r: 255, g: 190, b: 127 },       // K-type cooler
  deepOrange: { r: 255, g: 166, b: 99 },    // M-type ~3,500K
  redOrange: { r: 255, g: 138, b: 80 },     // M-type cooler
  red: { r: 255, g: 100, b: 60 },           // Red dwarf ~3,000K
  deepRed: { r: 200, g: 60, b: 40 },        // Coolest red dwarfs
}

// Nebula and dust colors
export const NEBULA_COLORS = {
  pinkNebula: { r: 255, g: 150, b: 200 },
  blueNebula: { r: 100, g: 150, b: 255 },
  purpleNebula: { r: 180, g: 100, b: 255 },
  tealNebula: { r: 100, g: 200, b: 200 },
  goldNebula: { r: 255, g: 200, b: 100 },
  greenNebula: { r: 100, g: 200, b: 150 },
  dustBrown: { r: 120, g: 80, b: 60 },
  dustGold: { r: 180, g: 140, b: 80 },
  cosmicDust: { r: 80, g: 70, b: 100 },
  darkMatter: { r: 40, g: 30, b: 60 },
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR INTERPOLATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Interpolate between two RGB colors
 */
export const lerpColor = (c1, c2, t) => ({
  r: Math.round(lerp(c1.r, c2.r, t)),
  g: Math.round(lerp(c1.g, c2.g, t)),
  b: Math.round(lerp(c1.b, c2.b, t)),
})

/**
 * Interpolate through a color palette based on phase (0-1)
 * @param {number} phase - Position in palette (0-1, wraps)
 * @param {Array} colors - Array of {r, g, b} color objects
 */
export const getColorFromPalette = (phase, colors) => {
  if (!colors || colors.length === 0) {
    return { r: 200, g: 200, b: 255 }
  }
  
  const p = (phase % 1) * colors.length
  const i1 = Math.floor(p) % colors.length
  const i2 = (i1 + 1) % colors.length
  const t = p - Math.floor(p)
  
  // Smoothstep interpolation for smoother color cycling
  const smoothT = t * t * (3 - 2 * t)
  return lerpColor(colors[i1], colors[i2], smoothT)
}

/**
 * Boost color brightness
 */
export const boostColor = (color, amount) => ({
  r: Math.min(255, color.r + amount),
  g: Math.min(255, color.g + amount),
  b: Math.min(255, color.b + amount),
})

/**
 * Boost color saturation
 */
export const saturateColor = (color, factor) => {
  const avg = (color.r + color.g + color.b) / 3
  return {
    r: clamp(Math.round(avg + (color.r - avg) * (1 + factor)), 0, 255),
    g: clamp(Math.round(avg + (color.g - avg) * (1 + factor)), 0, 255),
    b: clamp(Math.round(avg + (color.b - avg) * (1 + factor)), 0, 255),
  }
}

/**
 * Dim color by factor (0-1)
 */
export const dimColor = (color, factor) => ({
  r: Math.round(color.r * factor),
  g: Math.round(color.g * factor),
  b: Math.round(color.b * factor),
})

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR CONVERSION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert RGB to HSL
 */
export const rgbToHsl = (r, g, b) => {
  r /= 255
  g /= 255
  b /= 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  
  if (max === min) {
    return { h: 0, s: 0, l: l * 100 }
  }
  
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  
  let h
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
    case g: h = ((b - r) / d + 2) / 6; break
    default: h = ((r - g) / d + 4) / 6
  }
  
  return { h: h * 360, s: s * 100, l: l * 100 }
}

/**
 * Convert HSL to RGB
 */
export const hslToRgb = (h, s, l) => {
  h /= 360
  s /= 100
  l /= 100
  
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR STRING FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * RGB object to CSS rgba string
 */
export const toRgba = (color, alpha = 1) => 
  `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`

/**
 * RGB values to CSS rgba string
 */
export const rgba = (r, g, b, a = 1) => 
  `rgba(${r}, ${g}, ${b}, ${a})`

/**
 * HSL values to CSS hsla string
 */
export const hsla = (h, s, l, a = 1) => 
  `hsla(${h}, ${s}%, ${l}%, ${a})`

// ═══════════════════════════════════════════════════════════════════════════════
// VIDEO COLOR EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════

// Shared canvas for color extraction (reused to avoid GC)
let extractionCanvas = null
let extractionCtx = null

const getExtractionCanvas = () => {
  if (!extractionCanvas) {
    extractionCanvas = document.createElement('canvas')
    extractionCanvas.width = 50
    extractionCanvas.height = 50
    extractionCtx = extractionCanvas.getContext('2d', { willReadFrequently: true })
  }
  return { canvas: extractionCanvas, ctx: extractionCtx }
}

/**
 * Extract dominant colors from a video thumbnail
 * @param {string} videoId - YouTube video ID
 * @param {Object} options - Extraction options
 * @returns {Promise<Array>} - Array of {r, g, b} color objects
 */
export const extractColorsFromThumbnail = async (videoId, options = {}) => {
  const {
    colorCount = 6,
    saturationBoost = 0.5,
    minBrightness = 25,
    maxBrightness = 235,
    minSaturation = 25,
  } = options
  
  if (!videoId) return null
  
  try {
    // Try thumbnails in order of quality
    const qualities = ['hqdefault', 'mqdefault', 'default']
    let img = null
    
    for (const quality of qualities) {
      const url = `https://img.youtube.com/vi/${videoId}/${quality}.jpg`
      try {
        img = await loadImage(url)
        if (img.width > 100 && img.height > 100) break
        img = null
      } catch {
        continue
      }
    }
    
    if (!img) return null
    
    const { canvas, ctx } = getExtractionCanvas()
    ctx.drawImage(img, 0, 0, 50, 50)
    
    const imageData = ctx.getImageData(0, 0, 50, 50)
    const pixels = imageData.data
    
    // Color bucketing for finding dominant colors
    const colorBuckets = {}
    const bucketSize = 32
    
    for (let i = 0; i < pixels.length; i += 16) { // Sample every 4th pixel
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      
      // Filter by brightness
      const brightness = (r + g + b) / 3
      if (brightness < minBrightness || brightness > maxBrightness) continue
      
      // Filter by saturation (skip grays)
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      if (max - min < minSaturation) continue
      
      // Bucket the color
      const bucketR = Math.floor(r / bucketSize) * bucketSize
      const bucketG = Math.floor(g / bucketSize) * bucketSize
      const bucketB = Math.floor(b / bucketSize) * bucketSize
      
      const key = `${bucketR},${bucketG},${bucketB}`
      colorBuckets[key] = (colorBuckets[key] || 0) + 1
    }
    
    // Sort by frequency and get top colors
    const sortedColors = Object.entries(colorBuckets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key]) => {
        const [r, g, b] = key.split(',').map(Number)
        return saturateColor({ r, g, b }, saturationBoost)
      })
    
    if (sortedColors.length < 3) return null
    
    // Pad to required count
    while (sortedColors.length < colorCount) {
      const baseColor = sortedColors[sortedColors.length % 3]
      sortedColors.push({
        r: Math.min(255, (baseColor.r + 60) % 256),
        g: Math.min(255, (baseColor.g + 120) % 256),
        b: Math.min(255, (baseColor.b + 180) % 256),
      })
    }
    
    return sortedColors.slice(0, colorCount)
    
  } catch (err) {
    console.warn('[ColorExtraction] Failed:', err.message)
    return null
  }
}

/**
 * Load image with timeout and CORS
 */
const loadImage = (url, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    const timer = setTimeout(() => {
      reject(new Error('Image load timeout'))
    }, timeout)
    
    img.onload = () => {
      clearTimeout(timer)
      resolve(img)
    }
    
    img.onerror = () => {
      clearTimeout(timer)
      reject(new Error('Image load failed'))
    }
    
    img.src = url
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR TRANSITION STATE MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a color transition state object with methods
 * @param {Array} initialColors - Initial color palette
 * @returns {Object} - State object with update and setTarget methods
 */
export const createColorTransition = (initialColors = DEFAULT_COLORS) => {
  const state = {
    current: initialColors.map(c => ({ ...c })),
    target: initialColors.map(c => ({ ...c })),
    progress: 1,  // 0 = transitioning, 1 = complete
    lerpFactor: 0.05,
    
    /**
     * Set new target colors and start transition
     */
    setTarget(newColors) {
      if (!newColors || newColors.length === 0) return
      
      // Ensure we have enough colors
      const colors = newColors.map(c => ({ ...c }))
      while (colors.length < this.current.length) {
        colors.push({ ...colors[colors.length % newColors.length] })
      }
      
      this.target = colors.slice(0, this.current.length)
      this.progress = 0
    },
    
    /**
     * Update transition - call every frame
     * @param {number} dt - Delta time in seconds
     * @param {number} speed - Transition speed (default 0.5 = ~2 seconds)
     */
    update(dt, speed = 0.5) {
      if (this.progress >= 1) return false
      
      this.progress = Math.min(1, this.progress + dt * speed)
      
      this.current = this.current.map((color, i) => {
        const target = this.target[i] || color
        return {
          r: Math.round(color.r + (target.r - color.r) * this.lerpFactor),
          g: Math.round(color.g + (target.g - color.g) * this.lerpFactor),
          b: Math.round(color.b + (target.b - color.b) * this.lerpFactor),
        }
      })
      
      return true // Still transitioning
    },
    
    /**
     * Get a color from the current palette interpolated by phase
     */
    getColor(phase) {
      return getColorFromPalette(phase, this.current)
    },
  }
  
  return state
}

/**
 * Functional version - Start transitioning to new colors
 */
export const setTargetColors = (state, newColors) => {
  if (!newColors || newColors.length === 0) return
  
  // Ensure we have enough colors
  const colors = [...newColors]
  while (colors.length < state.current.length) {
    colors.push(colors[colors.length % newColors.length])
  }
  
  state.target = colors.slice(0, state.current.length)
  state.progress = 0
}

/**
 * Functional version - Update color transition (call every frame)
 * @param {Object} state - Color transition state
 * @param {number} dt - Delta time in seconds
 * @param {number} speed - Transition speed (0.5 = ~2 seconds)
 */
export const updateColorTransition = (state, dt, speed = 0.5) => {
  if (state.progress >= 1) return false
  
  state.progress = Math.min(1, state.progress + dt * speed)
  const lerpFactor = 0.05 // 5% per frame toward target
  
  state.current = state.current.map((color, i) => {
    const target = state.target[i] || color
    return {
      r: Math.round(color.r + (target.r - color.r) * lerpFactor),
      g: Math.round(color.g + (target.g - color.g) * lerpFactor),
      b: Math.round(color.b + (target.b - color.b) * lerpFactor),
    }
  })
  
  return true // Still transitioning
}
