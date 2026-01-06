/**
 * Sitaare (Stars) - Milky Way Starfield Effect
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Refactored modular implementation using shared utilities.
 * Features: Galaxy particles, shooting stars, cosmic rays, star clusters.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'
import mobilePerformanceOptimizer from '../../services/mobilePerformanceOptimizer'

// Import shared utilities
import {
  // Math
  TAU, PHI, lerp, clamp, smootherstep,
  springUpdate, noise2D,
  // Colors
  DEFAULT_COLORS, STAR_COLORS, NEBULA_COLORS,
  lerpColor, getColorFromPalette, extractColorsFromThumbnail, createColorTransition,
  // Canvas
  setupCanvas, clearWithFade, createGlowGradient,
  // Animation
  createAnimationLoop, createTimeState, createParticlePool, createSpawnTimer,
  // Audio
  createAudioState, createAudioAnalyser, connectToMedia, updateAudio,
  // Performance
  createAdaptiveQuality, updateAdaptiveQuality, createVisibilityTracker, setupVisibilityTracking,
} from './shared'

import './GalaxyThree.css'

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION - Easy to tweak
// ═══════════════════════════════════════════════════════════════════════════════
const CONFIG = {
  // Particle counts (will be scaled by performance tier)
  baseParticleCount: 600,
  particleCountMultiplier: 3,
  
  // Shooting stars
  shootingStarInterval: { min: 2000, max: 6000 },
  shootingStarChance: { playing: 0.7, idle: 0.4 },
  maxShootingStars: 10,
  
  // Cosmic rays
  cosmicRayInterval: { min: 8000, max: 20000 },
  cosmicRayChance: { playing: 0.6, idle: 0.3 },
  maxCosmicRays: 6,
  
  // Star clusters
  clusterCount: { min: 2, max: 4 },
  starsPerCluster: { min: 5, max: 10 },
  
  // Visual
  trailFadeAlpha: 0.10,
  galaxyRotationSpeed: { playing: 0.03, idle: 0.016 },
  colorTransitionSpeed: 0.5,
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTICLE FACTORY
// ═══════════════════════════════════════════════════════════════════════════════
const createSitaareParticle = (maxRadius) => {
  const typeRoll = Math.random()
  const sizeVariation = Math.random()
  const isGiant = sizeVariation > 0.92
  const isTiny = sizeVariation < 0.3
  const sizeMult = isGiant ? 2.5 + Math.random() * 1.5 : isTiny ? 0.3 + Math.random() * 0.4 : 0.7 + Math.random() * 0.8
  
  let particleType, colorKey, baseSize, glowSize
  
  if (typeRoll < 0.75) {
    // STARS
    particleType = 'star'
    const starRoll = Math.random()
    if (starRoll < 0.08) {
      colorKey = 'blueGiant'
      baseSize = (4 + Math.random() * 8) * sizeMult
      glowSize = (15 + Math.random() * 20) * sizeMult
    } else if (starRoll < 0.18) {
      colorKey = starRoll < 0.12 ? 'blueStar' : 'blueWhite'
      baseSize = (2.5 + Math.random() * 5) * sizeMult
      glowSize = (8 + Math.random() * 12) * sizeMult
    } else if (starRoll < 0.38) {
      colorKey = starRoll < 0.28 ? 'brightWhite' : 'white'
      baseSize = (1.5 + Math.random() * 4) * sizeMult
      glowSize = (5 + Math.random() * 10) * sizeMult
    } else if (starRoll < 0.58) {
      colorKey = starRoll < 0.48 ? 'yellowWhite' : 'sunYellow'
      baseSize = (1 + Math.random() * 3) * sizeMult
      glowSize = (3 + Math.random() * 8) * sizeMult
    } else if (starRoll < 0.78) {
      colorKey = starRoll < 0.68 ? 'orange' : 'deepOrange'
      baseSize = (0.8 + Math.random() * 2.5) * sizeMult
      glowSize = (2 + Math.random() * 6) * sizeMult
    } else {
      colorKey = starRoll < 0.90 ? 'redOrange' : 'red'
      baseSize = (0.5 + Math.random() * 1.5) * sizeMult
      glowSize = (1.5 + Math.random() * 4) * sizeMult
    }
  } else if (typeRoll < 0.90) {
    // NEBULA
    particleType = 'nebula'
    colorKey = Object.keys(NEBULA_COLORS)[Math.floor(Math.random() * Object.keys(NEBULA_COLORS).length)]
    const nebulaSizeMult = 0.4 + Math.random() * 1.8
    baseSize = (8 + Math.random() * 25) * nebulaSizeMult
    glowSize = (25 + Math.random() * 60) * nebulaSizeMult
  } else {
    // DUST
    particleType = 'dust'
    colorKey = Math.random() < 0.4 ? 'dustGold' : Math.random() < 0.7 ? 'dustBrown' : 'purple'
    baseSize = (1 + Math.random() * 6) * sizeMult
    glowSize = (3 + Math.random() * 12) * sizeMult
  }
  
  // Z-depth distribution
  const zBias = Math.random()
  const zDepth = zBias < 0.35 ? -0.2 - Math.random() * 0.8 
              : zBias < 0.65 ? (Math.random() - 0.5) * 0.4 
              : 0.2 + Math.random() * 0.6
  
  return {
    type: particleType,
    colorKey,
    colorPhase: Math.random(),
    depth: Math.random(),
    angle: Math.random() * TAU,
    radialPos: 0.05 + Math.random() * 0.95,
    zDepth,
    driftSpeed: particleType === 'nebula' ? 0.001 + Math.random() * 0.004 : 0.002 + Math.random() * 0.008,
    rotateSpeed: (Math.random() - 0.5) * (particleType === 'nebula' ? 0.0003 : 0.0008),
    baseSize,
    glowSize,
    pulseSpeed: 0.3 + Math.random() * 0.8,
    pulsePhase: Math.random() * TAU,
    pulseAmount: 0.15 + Math.random() * 0.25,
    twinkleSpeed: particleType === 'star' ? 0.8 + Math.random() * 2 : 0.2 + Math.random() * 0.5,
    twinklePhase: Math.random() * TAU,
    twinkleIntensity: particleType === 'star' ? 0.2 + Math.random() * 0.35 : 0.08 + Math.random() * 0.12,
    opacity: particleType === 'nebula' ? 0.15 + Math.random() * 0.2 : particleType === 'dust' ? 0.35 + Math.random() * 0.35 : 0.6 + Math.random() * 0.4,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHOOTING STAR FACTORY
// ═══════════════════════════════════════════════════════════════════════════════
const createShootingStar = (w, h, colors) => {
  const edge = Math.floor(Math.random() * 4)
  let x, y, angle
  
  if (edge === 0) { x = Math.random() * w; y = -20; angle = Math.PI * 0.3 + Math.random() * Math.PI * 0.4 }
  else if (edge === 1) { x = w + 20; y = Math.random() * h * 0.6; angle = Math.PI * 0.6 + Math.random() * Math.PI * 0.3 }
  else if (edge === 2) { x = Math.random() * w; y = h + 20; angle = -Math.PI * 0.3 - Math.random() * Math.PI * 0.4 }
  else { x = -20; y = Math.random() * h * 0.6; angle = Math.random() * Math.PI * 0.4 - Math.PI * 0.2 }
  
  // Color selection
  const colorRoll = Math.random()
  let color
  if (colorRoll < 0.4) {
    color = { r: 255, g: 255, b: 255 }
  } else if (colorRoll < 0.65 && colors[0]) {
    const vc = colors[0]
    color = { r: Math.min(255, vc.r + 80), g: Math.min(255, vc.g + 80), b: Math.min(255, vc.b + 80) }
  } else if (colorRoll < 0.85 && colors[1]) {
    const vc = colors[1]
    color = { r: Math.min(255, vc.r + 60), g: Math.min(255, vc.g + 60), b: Math.min(255, vc.b + 60) }
  } else if (colors[2]) {
    const vc = colors[2]
    color = { r: Math.min(255, vc.r + 50), g: Math.min(255, vc.g + 50), b: Math.min(255, vc.b + 50) }
  } else {
    color = { r: 255, g: 220, b: 180 }
  }
  
  return {
    x, y, angle,
    speed: 400 + Math.random() * 600,
    length: 80 + Math.random() * 150,
    width: 1.5 + Math.random() * 2.5,
    life: 1,
    decay: 0.3 + Math.random() * 0.4,
    color,
    sparkles: [],
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COSMIC RAY FACTORY
// ═══════════════════════════════════════════════════════════════════════════════
const createCosmicRay = (w, h, colors) => {
  const angle = Math.random() * TAU
  const startX = w/2 + Math.cos(angle) * w * 0.7
  const startY = h/2 + Math.sin(angle) * h * 0.7
  
  const roll = Math.random()
  let rayColor
  if (roll < 0.3 && colors[0]) {
    const vc = colors[0]
    rayColor = { r: Math.min(255, vc.r + 100), g: Math.min(255, vc.g + 100), b: Math.min(255, vc.b + 100) }
  } else if (roll < 0.6 && colors[1]) {
    const vc = colors[1]
    rayColor = { r: Math.min(255, vc.r + 80), g: Math.min(255, vc.g + 80), b: Math.min(255, vc.b + 80) }
  } else if (roll < 0.8) {
    rayColor = { r: 200, g: 220, b: 255 }
  } else {
    rayColor = { r: 255, g: 220, b: 255 }
  }
  
  return {
    x: startX, y: startY,
    targetX: w/2 + Math.cos(angle + Math.PI) * w * 0.7,
    targetY: h/2 + Math.sin(angle + Math.PI) * h * 0.7,
    progress: 0,
    speed: 3 + Math.random() * 2,
    width: 1 + Math.random() * 2,
    color: rayColor,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAR CLUSTER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════
const createStarClusters = (w, h, colors) => {
  const cx = w / 2, cy = h / 2
  const clusters = []
  const numClusters = CONFIG.clusterCount.min + Math.floor(Math.random() * (CONFIG.clusterCount.max - CONFIG.clusterCount.min))
  
  for (let i = 0; i < numClusters; i++) {
    const angle = (TAU / numClusters) * i + Math.random() * 0.5
    const dist = 0.35 + Math.random() * 0.3
    const starCount = CONFIG.starsPerCluster.min + Math.floor(Math.random() * (CONFIG.starsPerCluster.max - CONFIG.starsPerCluster.min))
    const radius = 25 + Math.random() * 35
    
    const stars = []
    for (let j = 0; j < starCount; j++) {
      stars.push({
        angle: Math.random() * TAU,
        dist: Math.random() * radius * 0.7,
        size: 0.8 + Math.random() * 1.5,
        phase: Math.random() * TAU,
      })
    }
    
    const hotStars = [STAR_COLORS.blueGiant, STAR_COLORS.blueStar, STAR_COLORS.blueWhite, STAR_COLORS.brightWhite]
    let clusterColor
    if (colors[i % colors.length] && Math.random() < 0.7) {
      const vc = colors[i % colors.length]
      clusterColor = { r: Math.min(255, vc.r + 60), g: Math.min(255, vc.g + 60), b: Math.min(255, vc.b + 60) }
    } else {
      clusterColor = hotStars[Math.floor(Math.random() * hotStars.length)]
    }
    
    clusters.push({
      x: cx + Math.cos(angle) * Math.min(w, h) * 0.4 * dist,
      y: cy + Math.sin(angle) * Math.min(w, h) * 0.4 * dist,
      radius, stars, color: clusterColor,
      phase: Math.random() * TAU,
      pulseSpeed: 0.4 + Math.random() * 0.3,
    })
  }
  
  return clusters
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDERING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════
const renderParticle = (ctx, p, x, y, size, glow, color, finalOpacity, twinkle) => {
  const c = color
  
  if (p.type === 'nebula') {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, glow)
    gradient.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${finalOpacity * 0.4})`)
    gradient.addColorStop(0.3, `rgba(${c.r}, ${c.g}, ${c.b}, ${finalOpacity * 0.25})`)
    gradient.addColorStop(0.6, `rgba(${c.r}, ${c.g}, ${c.b}, ${finalOpacity * 0.1})`)
    gradient.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`)
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, glow, 0, TAU)
    ctx.fill()
  } else if (p.type === 'star') {
    // Glow halo
    if (glow > 2) {
      const starGlow = ctx.createRadialGradient(x, y, 0, x, y, glow)
      starGlow.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${finalOpacity * 0.5})`)
      starGlow.addColorStop(0.2, `rgba(${c.r}, ${c.g}, ${c.b}, ${finalOpacity * 0.3})`)
      starGlow.addColorStop(0.5, `rgba(${c.r}, ${c.g}, ${c.b}, ${finalOpacity * 0.1})`)
      starGlow.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`)
      ctx.fillStyle = starGlow
      ctx.beginPath()
      ctx.arc(x, y, glow, 0, TAU)
      ctx.fill()
    }
    // Core
    ctx.fillStyle = `rgba(${Math.min(255, c.r + 50)}, ${Math.min(255, c.g + 50)}, ${Math.min(255, c.b + 50)}, ${finalOpacity})`
    ctx.beginPath()
    ctx.arc(x, y, size * 0.6, 0, TAU)
    ctx.fill()
    // Center point
    if (size > 1.5 && twinkle > 0.7) {
      ctx.fillStyle = `rgba(255, 255, 255, ${finalOpacity * twinkle * 0.8})`
      ctx.beginPath()
      ctx.arc(x, y, size * 0.25, 0, TAU)
      ctx.fill()
    }
  } else {
    // Dust
    const dustGradient = ctx.createRadialGradient(x, y, 0, x, y, glow * 0.7)
    dustGradient.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${finalOpacity * 0.5})`)
    dustGradient.addColorStop(0.5, `rgba(${c.r}, ${c.g}, ${c.b}, ${finalOpacity * 0.2})`)
    dustGradient.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`)
    ctx.fillStyle = dustGradient
    ctx.beginPath()
    ctx.arc(x, y, glow * 0.7, 0, TAU)
    ctx.fill()
  }
}

const renderShootingStar = (ctx, star, dt) => {
  star.x += Math.cos(star.angle) * star.speed * dt
  star.y += Math.sin(star.angle) * star.speed * dt
  star.life -= star.decay * dt
  
  if (star.life <= 0) return false
  
  const c = star.color
  const alpha = star.life
  const trailX = star.x - Math.cos(star.angle) * star.length * alpha
  const trailY = star.y - Math.sin(star.angle) * star.length * alpha
  
  // Trail gradient
  const gradient = ctx.createLinearGradient(trailX, trailY, star.x, star.y)
  gradient.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`)
  gradient.addColorStop(0.3, `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha * 0.3})`)
  gradient.addColorStop(0.7, `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha * 0.6})`)
  gradient.addColorStop(1, `rgba(255, 255, 255, ${alpha * 0.9})`)
  
  ctx.strokeStyle = gradient
  ctx.lineWidth = star.width * alpha
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(trailX, trailY)
  ctx.lineTo(star.x, star.y)
  ctx.stroke()
  
  // Head glow
  const headGlow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.width * 4 * alpha)
  headGlow.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.9})`)
  headGlow.addColorStop(0.3, `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha * 0.5})`)
  headGlow.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`)
  ctx.fillStyle = headGlow
  ctx.beginPath()
  ctx.arc(star.x, star.y, star.width * 4 * alpha, 0, TAU)
  ctx.fill()
  
  // Sparkles
  if (Math.random() < 0.3 && star.life > 0.3) {
    star.sparkles.push({
      x: star.x - Math.cos(star.angle) * Math.random() * 30,
      y: star.y - Math.sin(star.angle) * Math.random() * 30,
      life: 0.5 + Math.random() * 0.5,
      size: 1 + Math.random() * 2,
    })
  }
  
  star.sparkles = star.sparkles.filter(sparkle => {
    sparkle.life -= dt * 2
    if (sparkle.life <= 0) return false
    ctx.fillStyle = `rgba(255, 255, 255, ${sparkle.life * 0.6})`
    ctx.beginPath()
    ctx.arc(sparkle.x, sparkle.y, sparkle.size * sparkle.life, 0, TAU)
    ctx.fill()
    return true
  })
  
  return star.x > -50 && star.x < window.innerWidth + 50 && star.y > -50 && star.y < window.innerHeight + 50
}

const renderCosmicRay = (ctx, ray, dt) => {
  ray.progress += ray.speed * dt
  if (ray.progress >= 1) return false
  
  const c = ray.color
  const currentX = ray.x + (ray.targetX - ray.x) * ray.progress
  const currentY = ray.y + (ray.targetY - ray.y) * ray.progress
  const trailProgress = Math.max(0, ray.progress - 0.15)
  const trailX = ray.x + (ray.targetX - ray.x) * trailProgress
  const trailY = ray.y + (ray.targetY - ray.y) * trailProgress
  const alpha = ray.progress < 0.2 ? ray.progress / 0.2 : ray.progress > 0.8 ? (1 - ray.progress) / 0.2 : 1
  
  const rayGradient = ctx.createLinearGradient(trailX, trailY, currentX, currentY)
  rayGradient.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`)
  rayGradient.addColorStop(0.5, `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha * 0.4})`)
  rayGradient.addColorStop(1, `rgba(255, 255, 255, ${alpha * 0.8})`)
  
  ctx.strokeStyle = rayGradient
  ctx.lineWidth = ray.width * alpha
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(trailX, trailY)
  ctx.lineTo(currentX, currentY)
  ctx.stroke()
  
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`
  ctx.beginPath()
  ctx.arc(currentX, currentY, ray.width * 1.5 * alpha, 0, TAU)
  ctx.fill()
  
  return true
}

const renderStarCluster = (ctx, cluster, t) => {
  const pulse = 0.7 + Math.sin(t * cluster.pulseSpeed + cluster.phase) * 0.3
  const c = cluster.color
  
  const clusterGlow = ctx.createRadialGradient(cluster.x, cluster.y, 0, cluster.x, cluster.y, cluster.radius)
  clusterGlow.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${0.12 * pulse})`)
  clusterGlow.addColorStop(0.6, `rgba(${c.r}, ${c.g}, ${c.b}, ${0.05 * pulse})`)
  clusterGlow.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`)
  
  ctx.fillStyle = clusterGlow
  ctx.beginPath()
  ctx.arc(cluster.x, cluster.y, cluster.radius, 0, TAU)
  ctx.fill()
  
  cluster.stars.forEach(star => {
    const starX = cluster.x + Math.cos(star.angle) * star.dist
    const starY = cluster.y + Math.sin(star.angle) * star.dist
    const twinkle = 0.6 + Math.sin(t * 1.5 + star.phase) * 0.4
    ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${twinkle * pulse * 0.8})`
    ctx.beginPath()
    ctx.arc(starX, starY, star.size, 0, TAU)
    ctx.fill()
  })
}

const renderGalacticCenter = (ctx, cx, cy, intensity, colors) => {
  const centerSize = 25 + intensity * 20
  const primary = colors[0] || { r: 255, g: 200, b: 150 }
  const secondary = colors[1] || { r: 200, g: 150, b: 255 }
  const tertiary = colors[2] || { r: 150, g: 200, b: 255 }
  
  // Outer halo
  const outerHalo = ctx.createRadialGradient(cx, cy, centerSize * 0.5, cx, cy, centerSize * 4)
  outerHalo.addColorStop(0, `rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.18)`)
  outerHalo.addColorStop(0.4, `rgba(${tertiary.r}, ${tertiary.g}, ${tertiary.b}, 0.10)`)
  outerHalo.addColorStop(1, `rgba(${tertiary.r * 0.5}, ${tertiary.g * 0.5}, ${tertiary.b * 0.5}, 0)`)
  ctx.fillStyle = outerHalo
  ctx.beginPath()
  ctx.arc(cx, cy, centerSize * 4, 0, TAU)
  ctx.fill()
  
  // Inner glow
  const warmR = Math.min(255, (primary.r + 255) / 2)
  const warmG = Math.min(255, (primary.g + 220) / 2)
  const warmB = Math.min(255, (primary.b + 150) / 2)
  const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, centerSize * 2)
  innerGlow.addColorStop(0, `rgba(255, 250, 230, 0.65)`)
  innerGlow.addColorStop(0.2, `rgba(${warmR}, ${warmG}, ${warmB}, 0.45)`)
  innerGlow.addColorStop(0.5, `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.25)`)
  innerGlow.addColorStop(0.8, `rgba(${primary.r * 0.7}, ${primary.g * 0.7}, ${primary.b * 0.7}, 0.12)`)
  innerGlow.addColorStop(1, `rgba(${primary.r * 0.4}, ${primary.g * 0.4}, ${primary.b * 0.4}, 0)`)
  ctx.fillStyle = innerGlow
  ctx.beginPath()
  ctx.arc(cx, cy, centerSize * 2, 0, TAU)
  ctx.fill()
  
  // Core
  const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, centerSize * 0.5)
  coreGlow.addColorStop(0, `rgba(255, 255, 250, 0.85)`)
  coreGlow.addColorStop(0.5, `rgba(255, 248, 220, 0.45)`)
  coreGlow.addColorStop(1, `rgba(${Math.min(255, primary.r + 50)}, ${Math.min(255, primary.g + 30)}, ${Math.min(255, primary.b)}, 0)`)
  ctx.fillStyle = coreGlow
  ctx.beginPath()
  ctx.arc(cx, cy, centerSize * 0.5, 0, TAU)
  ctx.fill()
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const GalaxyOrbitalThree = ({
  isActive = true,
  baseSpeed = 0.3,
  density = 200,
  volume = 0.5,
  isPlaying = false,
  isBuffering = false,
  colors = null,
  intensityBoost = 0.7,
  videoId = null,
  tvFrameRect = null,
}) => {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const isActiveRef = useRef(isActive)
  
  // State refs
  const stateRef = useRef({
    particles: [],
    shootingStars: [],
    cosmicRays: [],
    starClusters: [],
    galaxyRotation: 0,
    time: 0,
    intensity: 0.7,
  })
  
  // Color transition state
  const colorTransition = useRef(createColorTransition(colors || DEFAULT_COLORS))
  
  // Audio state
  const audioState = useRef(createAudioState())
  const audioAnalyser = useRef(null)
  
  // Spawn timers
  const spawnTimers = useRef({
    shootingStar: createSpawnTimer(CONFIG.shootingStarInterval.min, CONFIG.shootingStarInterval.max),
    cosmicRay: createSpawnTimer(CONFIG.cosmicRayInterval.min, CONFIG.cosmicRayInterval.max),
  })
  
  // Performance
  const [performanceSettings] = useState(() => mobilePerformanceOptimizer.getSettings())

  // Update active state
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  // Color extraction from video thumbnail
  useEffect(() => {
    if (!videoId) return
    
    extractColorsFromThumbnail(videoId).then(extractedColors => {
      if (extractedColors && extractedColors.length >= 3) {
        colorTransition.current.setTarget(extractedColors.slice(0, 6))
      }
    })
  }, [videoId])

  // Color props change
  useEffect(() => {
    if (colors && colors.length >= 3) {
      colorTransition.current.setTarget(colors)
    }
  }, [colors])

  // Audio analyser setup
  useEffect(() => {
    if (!isPlaying) return
    
    const setupAudio = () => {
      if (!audioAnalyser.current) {
        audioAnalyser.current = createAudioAnalyser()
      }
      if (audioAnalyser.current) {
        connectToMedia(audioAnalyser.current)
      }
    }
    
    setupAudio()
    const retryInterval = setInterval(setupAudio, 2000)
    return () => clearInterval(retryInterval)
  }, [isPlaying])

  // Main animation effect
  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const state = stateRef.current
    
    // Setup canvas
    const setSize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2)
      canvas.width = window.innerWidth * dpr
      canvas.height = window.innerHeight * dpr
      canvas.style.width = `${window.innerWidth}px`
      canvas.style.height = `${window.innerHeight}px`
      ctx.scale(dpr, dpr)
    }
    setSize()

    const w = window.innerWidth
    const h = window.innerHeight
    const cx = w / 2
    const cy = h / 2
    const maxRadius = Math.max(w, h) * 0.85

    // Initialize particles
    const initParticles = () => {
      state.particles = []
      const count = mobilePerformanceOptimizer.getParticleCount(Math.floor(density * CONFIG.particleCountMultiplier))
      for (let i = 0; i < count; i++) {
        state.particles.push(createSitaareParticle(maxRadius))
      }
    }

    // Initialize clusters
    const initClusters = () => {
      state.starClusters = createStarClusters(w, h, colorTransition.current.current)
    }

    initParticles()
    initClusters()

    // Animation loop
    let lastTime = 0
    
    const animate = (timestamp) => {
      if (!isActiveRef.current) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      const dt = Math.min(timestamp - lastTime, 50) / 1000
      lastTime = timestamp
      state.time += dt * (isPlaying ? (0.8 + volume * 0.4) : 0.5)
      const t = state.time
      const audio = audioState.current

      // Update audio
      updateAudio(audioAnalyser.current, audio, isPlaying, t, dt)

      // Update color transition
      colorTransition.current.update(dt)
      const currentColors = colorTransition.current.current

      // Intensity
      const targetIntensity = (0.6 + audio.energy * 0.4) * intensityBoost
      state.intensity = lerp(state.intensity, targetIntensity, 0.03)
      const intensity = state.intensity

      // Clear with fade
      ctx.fillStyle = `rgba(2, 2, 6, ${CONFIG.trailFadeAlpha})`
      ctx.fillRect(0, 0, w, h)

      // Galaxy rotation
      state.galaxyRotation += dt * CONFIG.galaxyRotationSpeed[isPlaying ? 'playing' : 'idle']
      const audioSpeedBoost = isPlaying ? (1 + audio.energy * 0.8 + audio.bass * 0.5) : 1

      // Get video color function
      const getVideoColor = (phase) => getColorFromPalette(phase, currentColors)

      // Sort and render particles
      const sortedParticles = [...state.particles].sort((a, b) => a.zDepth - b.zDepth)
      
      sortedParticles.forEach(p => {
        const inBackground = p.zDepth < 0
        const speedMult = (isPlaying ? 1.2 : 0.6) * audioSpeedBoost
        p.depth += p.driftSpeed * dt * 60 * speedMult
        p.angle += p.rotateSpeed * dt * 60
        const rotatedAngle = p.angle + state.galaxyRotation
        
        if (p.depth > 1) {
          p.depth = 0.005
          p.angle = Math.random() * TAU
        }
        
        const depthCurve = smootherstep(p.depth)
        const zScale = 0.4 + (1 + p.zDepth) * 0.6
        const particleRadius = depthCurve * maxRadius * p.radialPos * zScale
        const x = cx + Math.cos(rotatedAngle) * particleRadius
        const y = cy + Math.sin(rotatedAngle) * particleRadius
        
        const fadeIn = smootherstep(Math.min(1, p.depth * 2.5))
        const fadeOut = 1 - smootherstep(Math.max(0, (p.depth - 0.75) / 0.25))
        const zOpacity = inBackground ? 0.45 + (1 + p.zDepth) * 0.35 : 0.65 + p.zDepth * 0.35
        const audioBrightness = isPlaying ? (1 + audio.energy * 0.3) : 1
        const twinkle = 1 - p.twinkleIntensity + Math.sin(t * p.twinkleSpeed + p.twinklePhase) * p.twinkleIntensity
        const bassPulse = isPlaying ? audio.bass * 0.2 : 0
        const pulse = 1 + Math.sin(t * p.pulseSpeed + p.pulsePhase) * p.pulseAmount + bassPulse
        const baseOpacity = fadeIn * fadeOut * zOpacity * p.opacity
        const finalOpacity = Math.min(1, baseOpacity * twinkle * audioBrightness)
        
        if (finalOpacity < 0.015) return
        
        const zSize = inBackground ? 0.4 + (1 + p.zDepth) * 0.6 : 0.8 + p.zDepth * 0.7
        const depthSizeMultiplier = 0.2 + depthCurve * 2.2
        const size = p.baseSize * depthSizeMultiplier * zSize * pulse
        const glow = p.glowSize * depthSizeMultiplier * zSize * pulse
        
        const colorPhase = (t * 0.03 + p.colorPhase) % 1
        const c = getVideoColor(colorPhase)
        
        renderParticle(ctx, p, x, y, size, glow, c, finalOpacity, twinkle)
      })

      // Galactic center
      renderGalacticCenter(ctx, cx, cy, intensity, currentColors)

      // Shooting stars
      if (spawnTimers.current.shootingStar.check(timestamp)) {
        if (Math.random() < CONFIG.shootingStarChance[isPlaying ? 'playing' : 'idle']) {
          if (state.shootingStars.length < CONFIG.maxShootingStars) {
            state.shootingStars.push(createShootingStar(w, h, currentColors))
          }
        }
      }
      state.shootingStars = state.shootingStars.filter(star => renderShootingStar(ctx, star, dt))

      // Cosmic rays
      if (spawnTimers.current.cosmicRay.check(timestamp)) {
        if (Math.random() < CONFIG.cosmicRayChance[isPlaying ? 'playing' : 'idle']) {
          if (state.cosmicRays.length < CONFIG.maxCosmicRays) {
            state.cosmicRays.push(createCosmicRay(w, h, currentColors))
          }
        }
      }
      state.cosmicRays = state.cosmicRays.filter(ray => renderCosmicRay(ctx, ray, dt))

      // Star clusters
      state.starClusters.forEach(cluster => renderStarCluster(ctx, cluster, t))

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    const handleResize = () => {
      setSize()
      initParticles()
      initClusters()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [isPlaying, volume, intensityBoost, density, performanceSettings])

  if (!performanceSettings.enableGalaxy) {
    return null
  }

  return (
    <canvas
      ref={canvasRef}
      className={`galaxy-canvas ${isActive ? 'active' : ''}`}
      aria-hidden="true"
    />
  )
}

export default GalaxyOrbitalThree
