/**
 * Shared Canvas Utilities
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Optimized canvas rendering utilities used across all background effects.
 * Features:
 * - DPR-aware canvas sizing
 * - Cached gradient factories
 * - Efficient shape drawing
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { TAU } from './math'

// ═══════════════════════════════════════════════════════════════════════════════
// CANVAS SETUP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Setup canvas with proper DPR handling
 * @param {HTMLCanvasElement} canvas
 * @param {number} maxDpr - Maximum device pixel ratio (default 2 for performance)
 */
export const setupCanvas = (canvas, maxDpr = 2) => {
  const ctx = canvas.getContext('2d')
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
  const width = window.innerWidth
  const height = window.innerHeight
  
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  ctx.scale(dpr, dpr)
  
  return { ctx, width, height, dpr }
}

/**
 * Get canvas center point
 */
export const getCanvasCenter = (canvas) => ({
  cx: canvas.width / (window.devicePixelRatio || 1) / 2,
  cy: canvas.height / (window.devicePixelRatio || 1) / 2,
})

// ═══════════════════════════════════════════════════════════════════════════════
// CLEAR OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Clear canvas completely
 */
export const clearCanvas = (ctx, width, height) => {
  ctx.clearRect(0, 0, width, height)
}

/**
 * Clear with fade trail effect (for motion trails)
 * @param {number} fadeAmount - 0.02 = strong trails, 0.15 = quick fade
 */
export const clearWithFade = (ctx, width, height, fadeAmount = 0.08, r = 2, g = 2, b = 6) => {
  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${fadeAmount})`
  ctx.fillRect(0, 0, width, height)
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRADIENT FACTORIES (Optimized for repeated use)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create radial gradient for glowing particles
 */
export const createGlowGradient = (ctx, x, y, innerRadius, outerRadius, color, opacity) => {
  const gradient = ctx.createRadialGradient(x, y, innerRadius, x, y, outerRadius)
  gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`)
  gradient.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.5})`)
  gradient.addColorStop(0.6, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.15})`)
  gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
  return gradient
}

/**
 * Create soft glow gradient (nebula-like)
 */
export const createSoftGlowGradient = (ctx, x, y, radius, color, opacity) => {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
  gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.4})`)
  gradient.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.25})`)
  gradient.addColorStop(0.6, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.1})`)
  gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
  return gradient
}

/**
 * Create trail gradient for shooting stars
 */
export const createTrailGradient = (ctx, x1, y1, x2, y2, color, opacity) => {
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
  gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
  gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity * 0.4})`)
  gradient.addColorStop(1, `rgba(255, 255, 255, ${opacity * 0.9})`)
  return gradient
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHAPE DRAWING (Optimized for batch rendering)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Draw circle (filled)
 */
export const drawCircle = (ctx, x, y, radius) => {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, TAU)
  ctx.fill()
}

/**
 * Draw circle with glow effect
 */
export const drawGlowingCircle = (ctx, x, y, radius, glowRadius, color, opacity) => {
  // Outer glow
  if (glowRadius > radius * 1.5) {
    ctx.fillStyle = createGlowGradient(ctx, x, y, 0, glowRadius, color, opacity * 0.5)
    ctx.beginPath()
    ctx.arc(x, y, glowRadius, 0, TAU)
    ctx.fill()
  }
  
  // Core
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, TAU)
  ctx.fill()
}

/**
 * Draw soft nebula cloud
 */
export const drawNebula = (ctx, x, y, radius, color, opacity) => {
  ctx.fillStyle = createSoftGlowGradient(ctx, x, y, radius, color, opacity)
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, TAU)
  ctx.fill()
}

/**
 * Draw line/trail
 */
export const drawLine = (ctx, x1, y1, x2, y2, width = 1) => {
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

/**
 * Draw shooting star with trail
 */
export const drawShootingStar = (ctx, star, dt) => {
  const { x, y, angle, length, width, life, color } = star
  
  // Calculate trail end point
  const trailX = x - Math.cos(angle) * length * life
  const trailY = y - Math.sin(angle) * length * life
  
  // Draw glowing trail
  ctx.strokeStyle = createTrailGradient(ctx, trailX, trailY, x, y, color, life)
  ctx.lineWidth = width * life
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(trailX, trailY)
  ctx.lineTo(x, y)
  ctx.stroke()
  
  // Bright head glow
  const headRadius = width * 4 * life
  const headGlow = ctx.createRadialGradient(x, y, 0, x, y, headRadius)
  headGlow.addColorStop(0, `rgba(255, 255, 255, ${life * 0.9})`)
  headGlow.addColorStop(0.3, `rgba(${color.r}, ${color.g}, ${color.b}, ${life * 0.5})`)
  headGlow.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`)
  
  ctx.fillStyle = headGlow
  ctx.beginPath()
  ctx.arc(x, y, headRadius, 0, TAU)
  ctx.fill()
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH RENDERING (For many similar particles)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Begin batch rendering of same-style particles
 * Call before drawing many particles of same type
 */
export const beginBatch = (ctx) => {
  ctx.save()
}

/**
 * End batch rendering
 */
export const endBatch = (ctx) => {
  ctx.restore()
}

/**
 * Set composite operation for blending
 */
export const setBlendMode = (ctx, mode = 'source-over') => {
  ctx.globalCompositeOperation = mode
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if point is visible on screen (with margin)
 */
export const isVisible = (x, y, width, height, margin = 50) => {
  return x > -margin && x < width + margin && y > -margin && y < height + margin
}

/**
 * Calculate screen distance for culling
 */
export const distanceFromCenter = (x, y, cx, cy) => {
  const dx = x - cx
  const dy = y - cy
  return Math.sqrt(dx * dx + dy * dy)
}
