/**
 * BackgroundContext - Central state management for all background effects
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Provides shared state and utilities to all background effects:
 * - Bass detection system (synthetic BPM-based)
 * - Color extraction from video thumbnails
 * - Performance settings
 * - Common animation utilities
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React, { createContext, useContext, useRef, useState, useEffect, useCallback } from 'react'
import mobilePerformanceOptimizer from '../../../services/mobilePerformanceOptimizer'

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════
const BackgroundContext = createContext(null)

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT BASS STATE
// ═══════════════════════════════════════════════════════════════════════════════
const createInitialBassState = () => ({
  // Beat timing
  bpm: 120,
  beatInterval: 500,
  accumulator: 0,
  lastTrigger: 0,
  beatIndex: 0,
  
  // Multi-band frequency simulation
  bands: {
    low: 0, lowTarget: 0,
    mid: 0, midTarget: 0,
    high: 0, highTarget: 0,
  },
  
  // Energy tracking
  energyHistory: [],
  energyHistoryMax: 8,
  normalizedEnergy: 0,
  smoothIntensity: 0,
  targetIntensity: 0,
  
  // Wave phase for synced animations
  wavePhase: 0,
})

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export function BackgroundProvider({ 
  children, 
  isPlaying = false, 
  volume = 0.5, 
  videoId = null,
  videoTitle = null,
  channelName = null,
}) {
  // Performance settings
  const [performanceSettings, setPerformanceSettings] = useState(() => 
    mobilePerformanceOptimizer.getSettings()
  )
  
  // Bass detection state
  const bassRef = useRef(createInitialBassState())
  const [bassState, setBassState] = useState(() => createInitialBassState())
  
  // Color palette state
  const [colors, setColors] = useState([
    { r: 100, g: 100, b: 180 },
    { r: 150, g: 100, b: 200 },
    { r: 80, g: 120, b: 200 },
    { r: 120, g: 80, b: 160 },
    { r: 100, g: 150, b: 220 },
  ])
  const [targetColors, setTargetColors] = useState(null)
  const colorTransitionRef = useRef(1)
  
  // Subscribe to performance changes
  useEffect(() => {
    const unsubscribe = mobilePerformanceOptimizer.subscribe(setPerformanceSettings)
    return unsubscribe
  }, [])
  
  // ═══════════════════════════════════════════════════════════════════════════
  // COLOR EXTRACTION FROM VIDEO THUMBNAIL
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (!videoId) return

    const extractColors = async () => {
      try {
        const qualities = ['hqdefault', 'mqdefault', 'default']
        let img = null
        let loaded = false
        
        for (const quality of qualities) {
          const url = `https://img.youtube.com/vi/${videoId}/${quality}.jpg`
          try {
            img = await new Promise((resolve, reject) => {
              const testImg = new Image()
              testImg.crossOrigin = 'anonymous'
              testImg.onload = () => {
                if (testImg.width > 100 && testImg.height > 100) {
                  resolve(testImg)
                } else {
                  reject(new Error('Invalid thumbnail'))
                }
              }
              testImg.onerror = () => reject(new Error('Failed to load'))
              testImg.src = url
            })
            loaded = true
            break
          } catch {
            continue
          }
        }

        if (!loaded || !img) return

        // Sample colors from thumbnail
        const sampleCanvas = document.createElement('canvas')
        const sampleCtx = sampleCanvas.getContext('2d')
        const sampleSize = 50
        sampleCanvas.width = sampleSize
        sampleCanvas.height = sampleSize
        sampleCtx.drawImage(img, 0, 0, sampleSize, sampleSize)

        const imageData = sampleCtx.getImageData(0, 0, sampleSize, sampleSize)
        const pixels = imageData.data

        // Extract dominant colors
        const colorBuckets = {}
        const bucketSize = 32

        for (let i = 0; i < pixels.length; i += 16) {
          const r = Math.floor(pixels[i] / bucketSize) * bucketSize
          const g = Math.floor(pixels[i + 1] / bucketSize) * bucketSize
          const b = Math.floor(pixels[i + 2] / bucketSize) * bucketSize
          
          const brightness = (r + g + b) / 3
          if (brightness < 30 || brightness > 240) continue
          
          const max = Math.max(r, g, b)
          const min = Math.min(r, g, b)
          if (max - min < 30) continue

          const key = `${r},${g},${b}`
          colorBuckets[key] = (colorBuckets[key] || 0) + 1
        }

        const sortedColors = Object.entries(colorBuckets)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([key]) => {
            const [r, g, b] = key.split(',').map(Number)
            const avg = (r + g + b) / 3
            return {
              r: Math.min(255, Math.round(r + (r - avg) * 0.3)),
              g: Math.min(255, Math.round(g + (g - avg) * 0.3)),
              b: Math.min(255, Math.round(b + (b - avg) * 0.3)),
            }
          })

        if (sortedColors.length >= 3) {
          while (sortedColors.length < 5) {
            sortedColors.push(sortedColors[sortedColors.length % sortedColors.length])
          }
          setTargetColors(sortedColors.slice(0, 5))
          colorTransitionRef.current = 0
          console.log('[BackgroundContext] 🎨 Colors extracted from video thumbnail')
        }
      } catch (err) {
        console.log('[BackgroundContext] Could not extract colors:', err)
      }
    }

    extractColors()
  }, [videoId])
  
  // ═══════════════════════════════════════════════════════════════════════════
  // BASS UPDATE FUNCTION - Called by animation loops
  // ═══════════════════════════════════════════════════════════════════════════
  const updateBass = useCallback((timestamp, dt) => {
    const bass = bassRef.current
    
    if (isPlaying && volume > 0.1) {
      // Subtle BPM variation
      const bpmVariation = Math.sin(timestamp * 0.00003) * 5 + Math.sin(timestamp * 0.00007) * 3
      bass.bpm = 118 + bpmVariation
      bass.beatInterval = 60000 / bass.bpm
      
      // Update wave phase
      bass.wavePhase += dt * 0.003 * (bass.bpm / 120)
      
      // Accumulate toward next beat
      bass.accumulator += dt
      
      if (bass.accumulator >= bass.beatInterval) {
        bass.accumulator = bass.accumulator % bass.beatInterval
        bass.beatIndex = (bass.beatIndex + 1) % 4
        
        const isDownbeat = bass.beatIndex === 0
        const isAccent = bass.beatIndex === 2
        
        let lowBeat, midBeat, highBeat
        
        if (isDownbeat) {
          lowBeat = 0.85 + Math.random() * 0.15
          midBeat = 0.25 + Math.random() * 0.15
          highBeat = 0.15 + Math.random() * 0.1
        } else if (isAccent) {
          lowBeat = 0.35 + Math.random() * 0.15
          midBeat = 0.7 + Math.random() * 0.2
          highBeat = 0.45 + Math.random() * 0.2
        } else {
          lowBeat = 0.1 + Math.random() * 0.1
          midBeat = 0.2 + Math.random() * 0.15
          highBeat = 0.55 + Math.random() * 0.25
        }
        
        bass.bands.lowTarget = lowBeat * volume
        bass.bands.midTarget = midBeat * volume
        bass.bands.highTarget = highBeat * volume
        
        const beatStrength = lowBeat * 0.65 + midBeat * 0.25 + highBeat * 0.1
        bass.targetIntensity = beatStrength * volume
        
        bass.energyHistory.push(beatStrength * volume)
        if (bass.energyHistory.length > bass.energyHistoryMax) {
          bass.energyHistory.shift()
        }
        const avgEnergy = bass.energyHistory.reduce((a, b) => a + b, 0) / bass.energyHistory.length
        bass.normalizedEnergy = avgEnergy > 0.01 ? (beatStrength * volume) / avgEnergy : beatStrength * volume
      }
      
      // Smooth band decay
      const expSmooth = (current, target, smoothing) => {
        const k = Math.pow(smoothing, dt / 16.67)
        return current * k + target * (1 - k)
      }
      
      bass.bands.low = expSmooth(bass.bands.low, bass.bands.lowTarget, 0.92)
      bass.bands.mid = expSmooth(bass.bands.mid, bass.bands.midTarget, 0.88)
      bass.bands.high = expSmooth(bass.bands.high, bass.bands.highTarget, 0.82)
      bass.smoothIntensity = expSmooth(bass.smoothIntensity, bass.targetIntensity, 0.9)
      
      bass.bands.lowTarget *= 0.97
      bass.bands.midTarget *= 0.95
      bass.bands.highTarget *= 0.92
      bass.targetIntensity *= 0.95
      
    } else {
      bass.bands.low *= 0.95
      bass.bands.mid *= 0.95
      bass.bands.high *= 0.95
      bass.smoothIntensity *= 0.95
    }
    
    // Update React state periodically (not every frame)
    if (Math.random() < 0.1) {
      setBassState({ ...bass })
    }
    
    return bass
  }, [isPlaying, volume])
  
  // ═══════════════════════════════════════════════════════════════════════════
  // SMOOTH COLOR TRANSITION
  // ═══════════════════════════════════════════════════════════════════════════
  const updateColors = useCallback((dt) => {
    if (targetColors && colorTransitionRef.current < 1) {
      colorTransitionRef.current = Math.min(1, colorTransitionRef.current + dt * 0.0005)
      const t = colorTransitionRef.current
      const eased = t * t * (3 - 2 * t)
      
      setColors(prev => prev.map((c, i) => ({
        r: Math.round(c.r + (targetColors[i].r - c.r) * eased * 0.1),
        g: Math.round(c.g + (targetColors[i].g - c.g) * eased * 0.1),
        b: Math.round(c.b + (targetColors[i].b - c.b) * eased * 0.1),
      })))
    }
  }, [targetColors])
  
  // Context value
  const value = {
    // State
    colors,
    bassState,
    bassRef,
    performanceSettings,
    
    // Props passthrough
    isPlaying,
    volume,
    videoId,
    videoTitle,
    channelName,
    
    // Update functions
    updateBass,
    updateColors,
  }
  
  return (
    <BackgroundContext.Provider value={value}>
      {children}
    </BackgroundContext.Provider>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════
export function useBackground() {
  const context = useContext(BackgroundContext)
  if (!context) {
    throw new Error('useBackground must be used within a BackgroundProvider')
  }
  return context
}

export default BackgroundContext
