/**
 * Shared Animation Utilities
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Animation frame management, timing, and performance utilities.
 * Centralizes animation loop logic for consistent behavior across effects.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATION FRAME MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a managed animation loop with FPS control
 * @param {Object} options - Animation options
 * @returns {Object} - Animation controller
 */
export const createAnimationLoop = (options = {}) => {
  const {
    targetFPS = 60,
    onFrame = () => {},
    onStart = () => {},
    onStop = () => {},
  } = options
  
  let animationId = null
  let lastTime = 0
  let isRunning = false
  let frameInterval = targetFPS > 0 ? 1000 / targetFPS : 0
  
  const loop = (timestamp) => {
    if (!isRunning) return
    
    // FPS throttling
    if (frameInterval > 0) {
      const elapsed = timestamp - lastTime
      if (elapsed < frameInterval) {
        animationId = requestAnimationFrame(loop)
        return
      }
    }
    
    // Calculate delta time (capped at 50ms to prevent huge jumps)
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05)
    lastTime = timestamp
    
    // Call frame callback
    onFrame(dt, timestamp)
    
    // Schedule next frame
    animationId = requestAnimationFrame(loop)
  }
  
  return {
    start: () => {
      if (isRunning) return
      isRunning = true
      lastTime = performance.now()
      onStart()
      animationId = requestAnimationFrame(loop)
    },
    
    stop: () => {
      if (!isRunning) return
      isRunning = false
      if (animationId) {
        cancelAnimationFrame(animationId)
        animationId = null
      }
      onStop()
    },
    
    setTargetFPS: (fps) => {
      frameInterval = fps > 0 ? 1000 / fps : 0
    },
    
    isRunning: () => isRunning,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create time state for animation
 */
export const createTimeState = () => ({
  total: 0,        // Total elapsed time
  delta: 0,        // Time since last frame
  scale: 1,        // Time scale multiplier
  paused: false,
})

/**
 * Update time state
 */
export const updateTime = (state, dt, isPlaying = true, volume = 0.5) => {
  if (state.paused) {
    state.delta = 0
    return state.total
  }
  
  // Time flows faster when playing music
  const speedMult = isPlaying ? (0.8 + volume * 0.4) : 0.5
  const scaledDt = dt * state.scale * speedMult
  
  state.delta = scaledDt
  state.total += scaledDt
  
  return state.total
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTENSITY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create intensity state for effects
 */
export const createIntensityState = (initial = 0.7) => ({
  current: initial,
  target: initial,
  velocity: 0,
})

/**
 * Update intensity with smooth interpolation
 */
export const updateIntensity = (state, audioEnergy = 0, boost = 1, dt = 0.016) => {
  state.target = (0.6 + audioEnergy * 0.4) * boost
  state.current += (state.target - state.current) * Math.min(1, dt * 3)
  return state.current
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTICLE LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create particle pool for efficient memory management
 * @param {number} maxCount - Maximum particles
 * @param {Function} createFn - Factory function for new particles
 */
export const createParticlePool = (maxCount, createFn) => {
  const active = []
  const inactive = []
  
  // Pre-allocate particles
  for (let i = 0; i < maxCount; i++) {
    inactive.push(createFn(i))
  }
  
  return {
    spawn: (initFn) => {
      let particle = inactive.pop()
      if (!particle && active.length < maxCount) {
        particle = createFn(active.length)
      }
      if (particle) {
        initFn(particle)
        active.push(particle)
      }
      return particle
    },
    
    release: (particle) => {
      const index = active.indexOf(particle)
      if (index > -1) {
        active.splice(index, 1)
        inactive.push(particle)
      }
    },
    
    forEach: (fn) => {
      for (let i = active.length - 1; i >= 0; i--) {
        const shouldRemove = fn(active[i], i)
        if (shouldRemove) {
          inactive.push(active.splice(i, 1)[0])
        }
      }
    },
    
    getActive: () => active,
    getCount: () => active.length,
    clear: () => {
      while (active.length) {
        inactive.push(active.pop())
      }
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPAWN TIMING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create spawn timer for periodic effects (shooting stars, etc)
 */
export const createSpawnTimer = (minInterval, maxInterval) => {
  let lastSpawnTime = 0
  let nextInterval = minInterval + Math.random() * (maxInterval - minInterval)
  
  return {
    check: (timestamp) => {
      if (timestamp - lastSpawnTime > nextInterval) {
        lastSpawnTime = timestamp
        nextInterval = minInterval + Math.random() * (maxInterval - minInterval)
        return true
      }
      return false
    },
    
    reset: () => {
      lastSpawnTime = 0
    },
    
    setInterval: (min, max) => {
      minInterval = min
      maxInterval = max
    },
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VISIBILITY DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create visibility observer for pausing when off-screen
 */
export const createVisibilityObserver = (element, onVisible, onHidden) => {
  // Page visibility
  const handleVisibilityChange = () => {
    if (document.hidden) {
      onHidden?.()
    } else {
      onVisible?.()
    }
  }
  
  document.addEventListener('visibilitychange', handleVisibilityChange)
  
  // Intersection observer for scroll-based visibility
  let observer = null
  if (element && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            onVisible?.()
          } else {
            onHidden?.()
          }
        })
      },
      { threshold: 0.1 }
    )
    observer.observe(element)
  }
  
  return {
    destroy: () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      observer?.disconnect()
    }
  }
}
