/**
 * 🎨 Video Color Extractor Service
 * Extracts dominant colors from YouTube iframe/video in real-time
 * Syncs with the Galaxy background for immersive trippy effects
 * 
 * Uses canvas to sample colors from video thumbnails and creates
 * a reactive color palette that the galaxy can use
 */

class VideoColorExtractor {
  constructor() {
    this.canvas = null
    this.ctx = null
    this.currentColors = {
      dominant: { h: 260, s: 70, l: 50 }, // Default purple
      vibrant: { h: 320, s: 80, l: 60 },  // Default magenta
      accent: { h: 200, s: 75, l: 55 },   // Default cyan
      dark: { h: 240, s: 50, l: 20 },     // Default dark blue
      light: { h: 0, s: 0, l: 90 },       // Default white
    }
    this.listeners = new Set()
    this.isExtracting = false
    this.extractionInterval = null
    this.lastVideoId = null
    this.thumbnailCache = new Map()
    
    // Holographic color presets for different moods
    this.holoPresets = {
      energetic: [
        { h: 330, s: 90, l: 60 }, // Hot pink
        { h: 45, s: 95, l: 55 },  // Orange
        { h: 60, s: 90, l: 50 },  // Yellow
      ],
      chill: [
        { h: 200, s: 70, l: 55 }, // Cyan
        { h: 260, s: 60, l: 50 }, // Purple
        { h: 180, s: 65, l: 45 }, // Teal
      ],
      trippy: [
        { h: 280, s: 85, l: 55 }, // Violet
        { h: 320, s: 90, l: 60 }, // Magenta
        { h: 180, s: 80, l: 50 }, // Cyan
        { h: 60, s: 85, l: 55 },  // Yellow
      ],
      cosmic: [
        { h: 260, s: 75, l: 45 }, // Deep purple
        { h: 200, s: 80, l: 50 }, // Blue
        { h: 300, s: 70, l: 55 }, // Pink
      ],
    }
    
    this.currentMood = 'trippy'
    this._initCanvas()
  }

  _initCanvas() {
    if (typeof document === 'undefined') return
    
    this.canvas = document.createElement('canvas')
    this.canvas.width = 64  // Small for performance
    this.canvas.height = 36
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })
  }

  /**
   * Subscribe to color updates
   */
  subscribe(callback) {
    this.listeners.add(callback)
    // Immediately send current colors
    callback(this.currentColors)
    return () => this.listeners.delete(callback)
  }

  /**
   * Notify all listeners of color change
   */
  _notifyListeners() {
    this.listeners.forEach(cb => {
      try {
        cb(this.currentColors)
      } catch (e) {
        console.warn('[ColorExtractor] Listener error:', e)
      }
    })
  }

  /**
   * Extract colors from YouTube thumbnail
   */
  async extractFromThumbnail(videoId) {
    if (!videoId || !this.ctx) return
    
    // Check cache
    if (this.thumbnailCache.has(videoId)) {
      this.currentColors = this.thumbnailCache.get(videoId)
      this._notifyListeners()
      return this.currentColors
    }

    try {
      // Try different thumbnail qualities
      const thumbnailUrls = [
        `https:// img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        `https:// img.youtube.com/vi/${videoId}/sddefault.jpg`,
        `https:// img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        `https:// img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      ]

      let img = null
      for (const url of thumbnailUrls) {
        try {
          img = await this._loadImage(url)
          if (img) break
        } catch (e) {
          continue
        }
      }

      if (!img) {
        console.warn('[ColorExtractor] Could not load thumbnail for', videoId)
        return this.currentColors
      }

      // Draw and extract colors
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height)
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height)
      const colors = this._extractColorsFromImageData(imageData)
      
      // Cache the result
      this.thumbnailCache.set(videoId, colors)
      
      // Limit cache size
      if (this.thumbnailCache.size > 50) {
        const firstKey = this.thumbnailCache.keys().next().value
        this.thumbnailCache.delete(firstKey)
      }

      this.currentColors = colors
      this._notifyListeners()
      return colors
    } catch (err) {
      console.warn('[ColorExtractor] Extraction error:', err)
      return this.currentColors
    }
  }

  /**
   * Load image with CORS support
   */
  _loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
      
      // Timeout after 3 seconds
      setTimeout(() => reject(new Error('Image load timeout')), 3000)
    })
  }

  /**
   * Extract dominant colors from image data using color quantization
   */
  _extractColorsFromImageData(imageData) {
    const pixels = imageData.data
    const colorCounts = new Map()
    
    // Sample pixels and count colors (quantized to reduce unique values)
    for (let i = 0; i < pixels.length; i += 16) { // Sample every 4th pixel
      const r = Math.floor(pixels[i] / 32) * 32
      const g = Math.floor(pixels[i + 1] / 32) * 32
      const b = Math.floor(pixels[i + 2] / 32) * 32
      
      // Skip very dark or very light pixels
      const brightness = (r + g + b) / 3
      if (brightness < 20 || brightness > 235) continue
      
      const key = `${r},${g},${b}`
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1)
    }
    
    // Sort by frequency
    const sortedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key]) => {
        const [r, g, b] = key.split(',').map(Number)
        return this._rgbToHsl(r, g, b)
      })
    
    // Select diverse colors
    const dominant = sortedColors[0] || { h: 260, s: 70, l: 50 }
    
    // Find most vibrant (highest saturation)
    const vibrant = sortedColors.reduce((best, color) => 
      color.s > best.s ? color : best, sortedColors[0] || dominant)
    
    // Find accent (most different hue from dominant)
    const accent = sortedColors.reduce((best, color) => {
      const hueDiff = Math.abs(color.h - dominant.h)
      const bestDiff = Math.abs(best.h - dominant.h)
      return hueDiff > bestDiff ? color : best
    }, sortedColors[1] || vibrant)
    
    // Dark and light variants
    const dark = { h: dominant.h, s: Math.max(30, dominant.s - 20), l: 20 }
    const light = { h: dominant.h, s: Math.min(100, dominant.s - 30), l: 85 }
    
    return { dominant, vibrant, accent, dark, light }
  }

  /**
   * Convert RGB to HSL
   */
  _rgbToHsl(r, g, b) {
    r /= 255
    g /= 255
    b /= 255
    
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h, s, l = (max + min) / 2
    
    if (max === min) {
      h = s = 0
    } else {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
        default: h = 0
      }
    }
    
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    }
  }

  /**
   * Start continuous color extraction for a video
   */
  startExtraction(videoId) {
    if (this.lastVideoId === videoId && this.isExtracting) return
    
    this.stopExtraction()
    this.lastVideoId = videoId
    this.isExtracting = true
    
    // Extract immediately
    this.extractFromThumbnail(videoId)
    
    // Set up periodic mood shifts for trippy effect
    this.extractionInterval = setInterval(() => {
      this._shiftMood()
    }, 10000) // Shift mood every 10 seconds
  }

  /**
   * Stop extraction
   */
  stopExtraction() {
    this.isExtracting = false
    if (this.extractionInterval) {
      clearInterval(this.extractionInterval)
      this.extractionInterval = null
    }
  }

  /**
   * Shift the color mood for continuous trippy effect
   */
  _shiftMood() {
    const moods = Object.keys(this.holoPresets)
    const currentIdx = moods.indexOf(this.currentMood)
    this.currentMood = moods[(currentIdx + 1) % moods.length]
    
    // Blend current video colors with mood preset
    const preset = this.holoPresets[this.currentMood]
    if (preset && preset.length > 0) {
      this.currentColors = {
        ...this.currentColors,
        vibrant: preset[0],
        accent: preset[1] || preset[0],
      }
      this._notifyListeners()
    }
  }

  /**
   * Get holographic gradient colors for current palette
   */
  getHolographicGradient(phase = 0) {
    const { dominant, vibrant, accent } = this.currentColors
    const shift = phase * 30 // Shift hue based on phase
    
    return [
      { h: (dominant.h + shift) % 360, s: dominant.s, l: dominant.l },
      { h: (vibrant.h + shift + 60) % 360, s: vibrant.s, l: vibrant.l },
      { h: (accent.h + shift + 120) % 360, s: accent.s, l: accent.l },
      { h: (dominant.h + shift + 180) % 360, s: dominant.s * 0.8, l: dominant.l * 1.1 },
    ]
  }

  /**
   * Get chromatic aberration offsets
   */
  getChromaticOffset(intensity = 1) {
    return {
      red: { x: 2 * intensity, y: 0 },
      green: { x: 0, y: 0 },
      blue: { x: -2 * intensity, y: 0 },
    }
  }

  /**
   * Get current colors
   */
  getColors() {
    return this.currentColors
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stopExtraction()
    this.listeners.clear()
    this.thumbnailCache.clear()
    this.canvas = null
    this.ctx = null
  }
}

// Singleton instance
export const videoColorExtractor = new VideoColorExtractor()
export default videoColorExtractor
