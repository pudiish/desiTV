/**
 * useBackgroundAnimation - Shared animation utilities hook
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Provides common animation utilities for all background effects:
 * - Animation frame management
 * - Time tracking
 * - Intensity calculations
 * - Common math functions
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import { useRef, useCallback } from 'react'

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
export const PHI = (1 + Math.sqrt(5)) / 2  // Golden Ratio ≈ 1.618
export const TAU = 2 * Math.PI              // Full circle

// ═══════════════════════════════════════════════════════════════════════════════
// MATH UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

// Linear interpolation
export const lerp = (a, b, t) => a + (b - a) * t

// Clamp value between min and max
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// Smoothstep interpolation
export const smoothstep = (x) => x * x * (3 - 2 * x)

// Ken Perlin's smootherstep
export const smootherstep = (x) => x * x * x * (x * (6 * x - 15) + 10)

// Ease in out cubic
export const easeInOutCubic = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2

// Ease out cubic
export const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3)

// Ease out quart
export const easeOutQuart = (x) => 1 - Math.pow(1 - x, 4)

// Simple Perlin-style noise
export const noise = (x, y, seed = 0) => {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453
  return (n - Math.floor(n)) * 2 - 1
}

// ═══════════════════════════════════════════════════════════════════════════════
// COLOR UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

// Lerp RGB colors
export const lerpColor = (c1, c2, t) => ({
  r: Math.round(lerp(c1.r, c2.r, t)),
  g: Math.round(lerp(c1.g, c2.g, t)),
  b: Math.round(lerp(c1.b, c2.b, t)),
})

// Lerp HSL colors
export const lerpHsl = (c1, c2, t) => ({
  h: lerp(c1.h, c2.h, t),
  s: lerp(c1.s, c2.s, t),
  l: lerp(c1.l, c2.l, t),
})

// RGB to string
export const rgbToString = (r, g, b, a = 1) => 
  `rgba(${r}, ${g}, ${b}, ${a})`

// HSL to string
export const hslToString = (h, s, l, a = 1) => 
  `hsla(${h}, ${s}%, ${l}%, ${a})`

// RGB to HSL conversion
export const rgbToHsl = (r, g, b) => {
  r /= 255
  g /= 255
  b /= 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h, s
  const l = (max + min) / 2
  
  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
      default:
        h = 0
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMOOTHING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

// Snap smoothing - fast rise, slow fall (for bass response)
export const snapSmooth = (current, target, snapSpeed, fallSpeed, dt) => {
  if (target > current) {
    return current + (target - current) * Math.min(1, snapSpeed * dt)
  } else {
    return current + (target - current) * Math.min(1, fallSpeed * dt)
  }
}

// Exponential smoothing (like Web Audio smoothingTimeConstant)
export const expSmooth = (current, target, smoothingConstant, dt) => {
  const k = Math.pow(smoothingConstant, dt * 0.06)
  return current * k + target * (1 - k)
}

// Spring physics smoothing
export const springSmooth = (value, target, velocity, stiffness, damping, dt) => {
  const force = (target - value) * stiffness
  const newVelocity = (velocity + force * dt) * damping
  const newValue = value + newVelocity * dt
  return { value: newValue, velocity: newVelocity }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════
export function useBackgroundAnimation() {
  const timeRef = useRef(0)
  const lastFrameTimeRef = useRef(0)
  const intensityRef = useRef(0.5)
  const animationRef = useRef(null)
  
  // Update time
  const updateTime = useCallback((timestamp, speedMultiplier = 1) => {
    const dt = Math.min(timestamp - lastFrameTimeRef.current, 50)
    lastFrameTimeRef.current = timestamp
    timeRef.current += dt * 0.001 * speedMultiplier
    return { time: timeRef.current, dt }
  }, [])
  
  // Update intensity with smooth transition
  const updateIntensity = useCallback((target, speed = 0.02) => {
    intensityRef.current += (target - intensityRef.current) * speed
    return intensityRef.current
  }, [])
  
  // Get color from palette with phase interpolation
  const getInterpolatedColor = useCallback((colors, phase, alpha = 1) => {
    const p = ((phase % 1) + 1) % 1 * colors.length
    const i1 = Math.floor(p) % colors.length
    const i2 = (i1 + 1) % colors.length
    const t = p - Math.floor(p)
    const smooth = smoothstep(t)
    const c = lerpColor(colors[i1], colors[i2], smooth)
    return rgbToString(c.r, c.g, c.b, alpha)
  }, [])
  
  return {
    // Refs
    timeRef,
    lastFrameTimeRef,
    intensityRef,
    animationRef,
    
    // Functions
    updateTime,
    updateIntensity,
    getInterpolatedColor,
    
    // Math utilities
    lerp,
    clamp,
    smoothstep,
    smootherstep,
    easeInOutCubic,
    easeOutCubic,
    easeOutQuart,
    noise,
    
    // Color utilities
    lerpColor,
    lerpHsl,
    rgbToString,
    hslToString,
    rgbToHsl,
    
    // Smoothing utilities
    snapSmooth,
    expSmooth,
    springSmooth,
    
    // Constants
    PHI,
    TAU,
  }
}

export default useBackgroundAnimation
