/**
 * Shared Performance & Device Detection Utilities
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Handles device capability detection, FPS monitoring, and adaptive quality.
 * Works with mobilePerformanceOptimizer for global performance modes.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DEVICE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detect device capabilities
 */
export const detectDeviceCapabilities = () => {
  const ua = navigator.userAgent.toLowerCase()
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|windows phone/i.test(ua)
  const isTablet = /tablet|ipad/i.test(ua) || (isMobile && Math.min(window.innerWidth, window.innerHeight) > 600)
  const isLowPower = navigator.connection?.saveData || navigator.getBattery?.()
  
  // Estimate GPU power based on device pixel ratio and screen size
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const screenPixels = window.innerWidth * window.innerHeight * dpr * dpr
  
  // Check hardware concurrency (CPU cores)
  const cpuCores = navigator.hardwareConcurrency || 4
  
  // Estimate tier: 'high', 'medium', 'low'
  let tier = 'high'
  if (isMobile || screenPixels < 1500000 || cpuCores <= 2) {
    tier = 'low'
  } else if (isTablet || screenPixels < 3000000 || cpuCores <= 4) {
    tier = 'medium'
  }
  
  return {
    isMobile,
    isTablet,
    isLowPower,
    dpr,
    screenPixels,
    cpuCores,
    tier,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE SETTINGS BY TIER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get recommended settings based on device tier
 */
export const getSettingsForTier = (tier) => {
  const settings = {
    high: {
      maxParticles: 2000,
      maxShootingStars: 10,
      maxCosmicRays: 6,
      maxStarClusters: 12,
      targetFPS: 60,
      glowEnabled: true,
      trailsEnabled: true,
      bloomEnabled: true,
      particleDetail: 1.0,
      dprMultiplier: 1.0,
    },
    medium: {
      maxParticles: 1200,
      maxShootingStars: 6,
      maxCosmicRays: 4,
      maxStarClusters: 8,
      targetFPS: 45,
      glowEnabled: true,
      trailsEnabled: true,
      bloomEnabled: false,
      particleDetail: 0.75,
      dprMultiplier: 0.85,
    },
    low: {
      maxParticles: 600,
      maxShootingStars: 3,
      maxCosmicRays: 2,
      maxStarClusters: 4,
      targetFPS: 30,
      glowEnabled: false,
      trailsEnabled: false,
      bloomEnabled: false,
      particleDetail: 0.5,
      dprMultiplier: 0.6,
    },
  }
  
  return settings[tier] || settings.medium
}

// ═══════════════════════════════════════════════════════════════════════════════
// FPS MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create FPS monitor for adaptive quality
 */
export const createFPSMonitor = (options = {}) => {
  const {
    targetFPS = 60,
    sampleSize = 60,  // Frames to average
    downgradeTrigger = 0.7,  // FPS ratio to trigger downgrade
    upgradeTrigger = 0.95,  // FPS ratio to allow upgrade
    stabilityFrames = 120,  // Frames at stable FPS before upgrade
  } = options
  
  return {
    samples: new Float32Array(sampleSize),
    sampleIndex: 0,
    sampleCount: 0,
    lastTime: performance.now(),
    averageFPS: targetFPS,
    targetFPS,
    downgradeTrigger,
    upgradeTrigger,
    stabilityFrames,
    stableFrameCount: 0,
    currentTier: null,
  }
}

/**
 * Update FPS monitor with new frame
 */
export const updateFPSMonitor = (monitor) => {
  const now = performance.now()
  const dt = now - monitor.lastTime
  monitor.lastTime = now
  
  // Calculate instantaneous FPS
  const fps = dt > 0 ? 1000 / dt : 60
  
  // Add to rolling buffer
  monitor.samples[monitor.sampleIndex] = fps
  monitor.sampleIndex = (monitor.sampleIndex + 1) % monitor.samples.length
  monitor.sampleCount = Math.min(monitor.sampleCount + 1, monitor.samples.length)
  
  // Calculate average FPS
  let sum = 0
  for (let i = 0; i < monitor.sampleCount; i++) {
    sum += monitor.samples[i]
  }
  monitor.averageFPS = sum / monitor.sampleCount
  
  // Check stability
  const fpsRatio = monitor.averageFPS / monitor.targetFPS
  if (fpsRatio >= monitor.upgradeTrigger) {
    monitor.stableFrameCount++
  } else {
    monitor.stableFrameCount = 0
  }
  
  return {
    fps: monitor.averageFPS,
    fpsRatio,
    isStable: monitor.stableFrameCount >= monitor.stabilityFrames,
    shouldDowngrade: fpsRatio < monitor.downgradeTrigger,
    shouldUpgrade: monitor.stableFrameCount >= monitor.stabilityFrames,
  }
}

/**
 * Get recommended tier adjustment based on FPS
 */
export const getRecommendedTierChange = (monitor, currentTier) => {
  const fpsRatio = monitor.averageFPS / monitor.targetFPS
  
  if (fpsRatio < monitor.downgradeTrigger) {
    // Downgrade
    if (currentTier === 'high') return 'medium'
    if (currentTier === 'medium') return 'low'
    return currentTier  // Already at lowest
  }
  
  if (monitor.stableFrameCount >= monitor.stabilityFrames) {
    // Consider upgrade
    if (currentTier === 'low') return 'medium'
    if (currentTier === 'medium') return 'high'
    return currentTier  // Already at highest
  }
  
  return currentTier  // No change
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADAPTIVE QUALITY CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create adaptive quality controller that combines device detection with runtime FPS
 */
export const createAdaptiveQuality = () => {
  const device = detectDeviceCapabilities()
  const initialTier = device.tier
  const settings = getSettingsForTier(initialTier)
  const fpsMonitor = createFPSMonitor({ targetFPS: settings.targetFPS })
  
  return {
    device,
    currentTier: initialTier,
    settings,
    fpsMonitor,
    lastTierChange: 0,
    minTierChangeInterval: 3000,  // Minimum 3s between tier changes
  }
}

/**
 * Update adaptive quality - call once per frame
 * Returns current settings and whether they changed
 */
export const updateAdaptiveQuality = (controller) => {
  const fpsResult = updateFPSMonitor(controller.fpsMonitor)
  const now = performance.now()
  
  // Check if enough time has passed since last tier change
  if (now - controller.lastTierChange < controller.minTierChangeInterval) {
    return { settings: controller.settings, changed: false, fps: fpsResult.fps }
  }
  
  // Get recommended tier
  const recommendedTier = getRecommendedTierChange(controller.fpsMonitor, controller.currentTier)
  
  if (recommendedTier !== controller.currentTier) {
    controller.currentTier = recommendedTier
    controller.settings = getSettingsForTier(recommendedTier)
    controller.fpsMonitor.targetFPS = controller.settings.targetFPS
    controller.fpsMonitor.stableFrameCount = 0
    controller.lastTierChange = now
    
    console.log(`[AdaptiveQuality] Tier changed to: ${recommendedTier} (FPS: ${fpsResult.fps.toFixed(1)})`)
    
    return { settings: controller.settings, changed: true, newTier: recommendedTier, fps: fpsResult.fps }
  }
  
  return { settings: controller.settings, changed: false, fps: fpsResult.fps }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FRAME THROTTLING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create frame throttle for target FPS
 */
export const createFrameThrottle = (targetFPS = 60) => ({
  targetFPS,
  frameInterval: 1000 / targetFPS,
  lastFrameTime: 0,
})

/**
 * Check if should render this frame
 */
export const shouldRenderFrame = (throttle, timestamp) => {
  const elapsed = timestamp - throttle.lastFrameTime
  
  if (elapsed >= throttle.frameInterval * 0.9) {  // Small tolerance
    throttle.lastFrameTime = timestamp
    return true
  }
  
  return false
}

/**
 * Update target FPS
 */
export const setTargetFPS = (throttle, fps) => {
  throttle.targetFPS = fps
  throttle.frameInterval = 1000 / fps
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Estimate memory pressure (when Performance Memory API is available)
 */
export const getMemoryPressure = () => {
  // @ts-ignore - Performance memory API
  if (performance.memory) {
    // @ts-ignore
    const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory
    return usedJSHeapSize / jsHeapSizeLimit
  }
  return 0.5  // Assume moderate if unavailable
}

/**
 * Check if under memory pressure
 */
export const isMemoryConstrained = () => {
  const pressure = getMemoryPressure()
  return pressure > 0.8
}

// ═══════════════════════════════════════════════════════════════════════════════
// OFFSCREEN DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create visibility state tracker
 */
export const createVisibilityTracker = () => ({
  isVisible: !document.hidden,
  handleVisibilityChange: null,
})

/**
 * Setup visibility change listener
 */
export const setupVisibilityTracking = (tracker, onVisibilityChange) => {
  tracker.handleVisibilityChange = () => {
    tracker.isVisible = !document.hidden
    onVisibilityChange?.(tracker.isVisible)
  }
  
  document.addEventListener('visibilitychange', tracker.handleVisibilityChange)
  
  return () => {
    document.removeEventListener('visibilitychange', tracker.handleVisibilityChange)
  }
}
