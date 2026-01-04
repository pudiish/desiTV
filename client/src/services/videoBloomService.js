/**
 * 🌟 Video Bloom Effect Service
 * Detects brightness/intensity from video and creates smooth flash/bloom effects
 * 
 * Features:
 * - Samples video brightness in real-time via hidden canvas
 * - Detects sudden brightness spikes (explosions, flashes, transitions)
 * - Smooth bloom/glow effect that syncs with video
 * - Performance optimized - runs at 10-15 FPS for detection
 * - Integrates with Galaxy background for cohesive visuals
 */

class VideoBloomService {
  constructor() {
    this.canvas = null
    this.ctx = null
    this.isRunning = false
    this.animationId = null
    this.lastBrightness = 0
    this.smoothBrightness = 0
    this.peakBrightness = 0
    this.bloomIntensity = 0
    this.listeners = new Set()
    
    // Configurable thresholds
    this.config = {
      // Brightness spike detection
      spikeThreshold: 0.15,      // 15% brightness jump = flash detected
      peakDecay: 0.92,           // How fast peak brightness fades
      smoothingFactor: 0.15,     // Smoothing for brightness (0-1, lower = smoother)
      
      // Bloom effect
      bloomDecay: 0.85,          // How fast bloom fades (lower = longer glow)
      bloomMultiplier: 2.5,      // Intensity multiplier for bloom
      minBloom: 0,               // Minimum bloom level
      maxBloom: 1,               // Maximum bloom level
      
      // Performance
      sampleInterval: 66,        // ~15 FPS for detection (ms between samples)
      sampleSize: 32,            // Canvas sample size (smaller = faster)
      skipDarkFrames: true,      // Skip processing very dark frames
      darkThreshold: 0.05,       // What counts as "dark"
    }
    
    // State
    this.lastSampleTime = 0
    this.frameHistory = []
    this.historyLength = 10      // Keep last 10 brightness values
    
    this._initCanvas()
  }

  /**
   * Initialize hidden canvas for brightness sampling
   */
  _initCanvas() {
    if (typeof document === 'undefined') return
    
    this.canvas = document.createElement('canvas')
    this.canvas.width = this.config.sampleSize
    this.canvas.height = this.config.sampleSize
    this.ctx = this.canvas.getContext('2d', { 
      willReadFrequently: true,
      alpha: false 
    })
  }

  /**
   * Subscribe to bloom effect updates
   * Callback receives: { brightness, bloom, isPeak, intensity }
   */
  subscribe(callback) {
    this.listeners.add(callback)
    // Send current state immediately
    callback(this._getState())
    return () => this.listeners.delete(callback)
  }

  /**
   * Get current state object
   */
  _getState() {
    return {
      brightness: this.smoothBrightness,
      rawBrightness: this.lastBrightness,
      bloom: this.bloomIntensity,
      peak: this.peakBrightness,
      isPeak: this.bloomIntensity > 0.3,
      isFlash: this.bloomIntensity > 0.6,
      intensity: Math.min(1, this.bloomIntensity * this.config.bloomMultiplier),
    }
  }

  /**
   * Notify all listeners
   */
  _notifyListeners() {
    const state = this._getState()
    this.listeners.forEach(cb => {
      try {
        cb(state)
      } catch (e) {
        console.warn('[VideoBloom] Listener error:', e)
      }
    })
  }

  /**
   * Start monitoring a video/iframe element
   */
  start(videoElement) {
    if (this.isRunning) {
      this.stop()
    }
    
    if (!videoElement || !this.ctx) {
      console.warn('[VideoBloom] No video element or canvas context')
      return
    }
    
    this.videoElement = videoElement
    this.isRunning = true
    this.lastSampleTime = 0
    
    console.log('[VideoBloom] 🌟 Started brightness detection')
    this._loop()
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.isRunning = false
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
    this.videoElement = null
    
    // Fade out bloom smoothly
    this._fadeOut()
  }

  /**
   * Smooth fade out when stopping
   */
  _fadeOut() {
    const fadeStep = () => {
      this.bloomIntensity *= 0.9
      this.peakBrightness *= 0.9
      this.smoothBrightness *= 0.95
      
      this._notifyListeners()
      
      if (this.bloomIntensity > 0.01) {
        requestAnimationFrame(fadeStep)
      }
    }
    fadeStep()
  }

  /**
   * Main animation loop
   */
  _loop() {
    if (!this.isRunning) return
    
    const now = performance.now()
    
    // Throttle to configured FPS
    if (now - this.lastSampleTime >= this.config.sampleInterval) {
      this.lastSampleTime = now
      this._sample()
    }
    
    // Decay bloom even between samples for smooth animation
    this._updateBloom()
    
    this.animationId = requestAnimationFrame(() => this._loop())
  }

  /**
   * Sample brightness from video frame
   */
  _sample() {
    if (!this.videoElement || !this.ctx) return
    
    try {
      // Try to draw video to canvas
      // Note: YouTube iframes have CORS restrictions, so we use fallback methods
      const video = this._getVideoElement()
      
      if (video && video.videoWidth > 0) {
        this.ctx.drawImage(
          video, 
          0, 0, 
          this.config.sampleSize, 
          this.config.sampleSize
        )
        
        const imageData = this.ctx.getImageData(
          0, 0, 
          this.config.sampleSize, 
          this.config.sampleSize
        )
        
        const brightness = this._calculateBrightness(imageData.data)
        this._processBrightness(brightness)
      } else {
        // Fallback: simulate based on time (creates subtle pulsing effect)
        this._simulateBrightness()
      }
    } catch (err) {
      // CORS error - use simulation fallback
      this._simulateBrightness()
    }
  }

  /**
   * Get actual video element (for native video)
   * YouTube iframes can't be sampled due to CORS
   */
  _getVideoElement() {
    if (this.videoElement instanceof HTMLVideoElement) {
      return this.videoElement
    }
    
    // Try to find video inside iframe (won't work due to CORS, but try)
    if (this.videoElement instanceof HTMLIFrameElement) {
      try {
        const iframeDoc = this.videoElement.contentDocument || 
                          this.videoElement.contentWindow?.document
        if (iframeDoc) {
          return iframeDoc.querySelector('video')
        }
      } catch {
        // CORS - expected for YouTube
      }
    }
    
    return null
  }

  /**
   * Calculate average brightness from pixel data
   */
  _calculateBrightness(pixels) {
    let totalBrightness = 0
    const pixelCount = pixels.length / 4
    
    // Sample every 4th pixel for speed
    for (let i = 0; i < pixels.length; i += 16) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      
      // Perceived brightness formula (human eye is more sensitive to green)
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      totalBrightness += brightness
    }
    
    return totalBrightness / (pixelCount / 4)
  }

  /**
   * Process brightness value and detect spikes
   */
  _processBrightness(brightness) {
    // Skip very dark frames if configured
    if (this.config.skipDarkFrames && brightness < this.config.darkThreshold) {
      this.lastBrightness = brightness
      return
    }
    
    // Smooth the brightness
    this.smoothBrightness += (brightness - this.smoothBrightness) * this.config.smoothingFactor
    
    // Detect brightness spike (flash)
    const brightnessDelta = brightness - this.lastBrightness
    
    if (brightnessDelta > this.config.spikeThreshold) {
      // Flash detected! Trigger bloom
      const spikeIntensity = Math.min(1, brightnessDelta * 3)
      this.bloomIntensity = Math.max(this.bloomIntensity, spikeIntensity)
      this.peakBrightness = Math.max(this.peakBrightness, brightness)
      
      console.log(`[VideoBloom] ⚡ Flash! Δ=${brightnessDelta.toFixed(2)} bloom=${this.bloomIntensity.toFixed(2)}`)
    }
    
    // Also trigger bloom on sustained bright frames
    if (brightness > 0.7) {
      this.bloomIntensity = Math.max(this.bloomIntensity, (brightness - 0.5) * 0.5)
    }
    
    // Store history
    this.frameHistory.push(brightness)
    if (this.frameHistory.length > this.historyLength) {
      this.frameHistory.shift()
    }
    
    this.lastBrightness = brightness
    this._notifyListeners()
  }

  /**
   * Simulate brightness for YouTube (CORS blocked)
   * Creates subtle pulsing effect synced to typical music beats
   */
  _simulateBrightness() {
    const time = performance.now() / 1000
    
    // Multiple overlapping sine waves for organic feel
    const wave1 = Math.sin(time * 2) * 0.15          // Slow pulse (2Hz = ~120 BPM feel)
    const wave2 = Math.sin(time * 4) * 0.1           // Medium pulse
    const wave3 = Math.sin(time * 0.5) * 0.05        // Very slow drift
    const noise = (Math.random() - 0.5) * 0.02       // Subtle noise
    
    // Occasional random "flash" (simulates beat drops, scene changes)
    let flash = 0
    if (Math.random() < 0.005) { // ~0.5% chance per frame = occasional flash
      flash = 0.3 + Math.random() * 0.4
      console.log('[VideoBloom] ⚡ Simulated flash!')
    }
    
    const baseBrightness = 0.4 // Base level
    const brightness = Math.max(0, Math.min(1, 
      baseBrightness + wave1 + wave2 + wave3 + noise + flash
    ))
    
    this._processBrightness(brightness)
  }

  /**
   * Update bloom decay (called every frame)
   */
  _updateBloom() {
    // Decay bloom
    this.bloomIntensity *= this.config.bloomDecay
    this.peakBrightness *= this.config.peakDecay
    
    // Clamp to valid range
    this.bloomIntensity = Math.max(
      this.config.minBloom, 
      Math.min(this.config.maxBloom, this.bloomIntensity)
    )
    
    // Also gently push bloom toward current brightness for sustained bright scenes
    if (this.smoothBrightness > 0.6) {
      const targetBloom = (this.smoothBrightness - 0.5) * 0.3
      this.bloomIntensity = Math.max(this.bloomIntensity, targetBloom)
    }
  }

  /**
   * Manually trigger a flash effect (for external events)
   */
  triggerFlash(intensity = 0.8) {
    this.bloomIntensity = Math.max(this.bloomIntensity, intensity)
    this.peakBrightness = 1
    this._notifyListeners()
    console.log(`[VideoBloom] 💥 Manual flash triggered: ${intensity}`)
  }

  /**
   * Update configuration
   */
  configure(options) {
    this.config = { ...this.config, ...options }
  }

  /**
   * Get current bloom intensity (0-1)
   */
  getBloom() {
    return this.bloomIntensity
  }

  /**
   * Get current brightness (0-1)
   */
  getBrightness() {
    return this.smoothBrightness
  }

  /**
   * Check if currently in a "flash" state
   */
  isFlashing() {
    return this.bloomIntensity > 0.5
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stop()
    this.listeners.clear()
    this.canvas = null
    this.ctx = null
  }
}

// Singleton export
export const videoBloomService = new VideoBloomService()
export default videoBloomService
