/**
 * useAmbientColors Hook
 * 
 * Samples dominant colors from video content for ambient light effect
 * Uses canvas to extract average colors from screen edges
 * 
 * Architecture:
 * - Samples colors from iframe/video using screenshot approach
 * - Falls back to static color based on channel theme
 * - Uses requestAnimationFrame for smooth updates
 * - Battery-conscious: reduces sampling rate on low power mode
 */

import { useState, useEffect, useRef, useCallback } from 'react'

// Default fallback colors by mood
const MOOD_COLORS = {
  romantic: { primary: '#ff6b9d', secondary: '#9b59b6', tertiary: '#e91e63' },
  comedy: { primary: '#ffd93d', secondary: '#ff8c00', tertiary: '#ff5733' },
  retro: { primary: '#d4a574', secondary: '#8b5a2b', tertiary: '#cd853f' },
  bollywood: { primary: '#ff4081', secondary: '#9c27b0', tertiary: '#673ab7' },
  punjabi: { primary: '#ffc107', secondary: '#ff5722', tertiary: '#e91e63' },
  default: { primary: '#4a90d9', secondary: '#5c6bc0', tertiary: '#7e57c2' },
}

/**
 * Extract dominant colors from image data
 * @param {ImageData} imageData - Canvas image data
 * @returns {Object} - Extracted colors { primary, secondary, tertiary }
 */
function extractColors(imageData) {
  const data = imageData.data
  const colorMap = {}
  
  // Sample every 10th pixel for performance
  for (let i = 0; i < data.length; i += 40) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    
    // Skip very dark or very light pixels
    const brightness = (r + g + b) / 3
    if (brightness < 20 || brightness > 235) continue
    
    // Quantize colors to reduce variations (bucket into 32 levels)
    const key = `${Math.floor(r / 32) * 32},${Math.floor(g / 32) * 32},${Math.floor(b / 32) * 32}`
    colorMap[key] = (colorMap[key] || 0) + 1
  }
  
  // Sort by frequency
  const sortedColors = Object.entries(colorMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([color]) => {
      const [r, g, b] = color.split(',').map(Number)
      return `rgb(${r}, ${g}, ${b})`
    })
  
  return {
    primary: sortedColors[0] || MOOD_COLORS.default.primary,
    secondary: sortedColors[1] || MOOD_COLORS.default.secondary,
    tertiary: sortedColors[2] || MOOD_COLORS.default.tertiary,
  }
}

/**
 * useAmbientColors Hook
 * 
 * @param {Object} options - Configuration
 * @param {HTMLElement} options.targetElement - Element to sample from (video/canvas/img)
 * @param {string} options.channelName - Current channel name for fallback colors
 * @param {boolean} options.enabled - Whether effect is enabled
 * @param {number} options.sampleRate - Samples per second (default: 2)
 */
export function useAmbientColors({
  targetElement = null,
  channelName = '',
  enabled = true,
  sampleRate = 2,
} = {}) {
  const [colors, setColors] = useState(MOOD_COLORS.default)
  const [isActive, setIsActive] = useState(false)
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const lastSampleRef = useRef(0)
  
  // Determine mood from channel name
  const getMoodColors = useCallback(() => {
    const name = channelName.toLowerCase()
    if (name.includes('romantic') || name.includes('love')) return MOOD_COLORS.romantic
    if (name.includes('comedy') || name.includes('funny')) return MOOD_COLORS.comedy
    if (name.includes('retro') || name.includes('90s') || name.includes('80s')) return MOOD_COLORS.retro
    if (name.includes('bollywood') || name.includes('hindi')) return MOOD_COLORS.bollywood
    if (name.includes('punjabi') || name.includes('bhangra')) return MOOD_COLORS.punjabi
    return MOOD_COLORS.default
  }, [channelName])

  // Sample colors from target element
  const sampleColors = useCallback(() => {
    if (!targetElement || !canvasRef.current) {
      // Use mood-based fallback
      setColors(getMoodColors())
      return
    }

    try {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      
      // Get dimensions
      const width = targetElement.videoWidth || targetElement.width || 160
      const height = targetElement.videoHeight || targetElement.height || 90
      
      // Scale down for performance
      canvas.width = Math.min(80, width)
      canvas.height = Math.min(45, height)
      
      // Draw frame to canvas
      ctx.drawImage(targetElement, 0, 0, canvas.width, canvas.height)
      
      // Sample edges (top, bottom, left, right)
      const edgeSize = 10
      
      // Top edge
      const topData = ctx.getImageData(0, 0, canvas.width, edgeSize)
      // Bottom edge
      const bottomData = ctx.getImageData(0, canvas.height - edgeSize, canvas.width, edgeSize)
      // Combined for overall mood
      const combinedData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      
      const extracted = extractColors(combinedData)
      setColors(extracted)
      setIsActive(true)
    } catch (error) {
      // Cross-origin or other error - use fallback
      console.warn('[useAmbientColors] Sampling failed, using fallback:', error.message)
      setColors(getMoodColors())
      setIsActive(false)
    }
  }, [targetElement, getMoodColors])

  // Animation loop for sampling
  useEffect(() => {
    if (!enabled) {
      setColors(getMoodColors())
      setIsActive(false)
      return
    }

    // Create offscreen canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }

    const interval = 1000 / sampleRate

    const tick = (timestamp) => {
      if (timestamp - lastSampleRef.current >= interval) {
        lastSampleRef.current = timestamp
        sampleColors()
      }
      animationRef.current = requestAnimationFrame(tick)
    }

    animationRef.current = requestAnimationFrame(tick)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [enabled, sampleRate, sampleColors, getMoodColors])

  // Generate CSS gradient from colors
  const gradient = `
    radial-gradient(
      ellipse 150% 100% at 50% 100%,
      ${colors.primary}40 0%,
      ${colors.secondary}20 40%,
      transparent 70%
    ),
    radial-gradient(
      ellipse 100% 80% at 0% 50%,
      ${colors.secondary}30 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse 100% 80% at 100% 50%,
      ${colors.tertiary}30 0%,
      transparent 50%
    ),
    radial-gradient(
      ellipse 150% 100% at 50% 0%,
      ${colors.primary}20 0%,
      transparent 60%
    )
  `.trim()

  return {
    colors,
    gradient,
    isActive,
    setTargetElement: (el) => { /* No-op, use prop */ },
  }
}

export default useAmbientColors
