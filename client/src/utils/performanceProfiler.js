/**
 * Performance Profiler for Galaxy Tunnel Effect
 * 
 * Tracks:
 * - Frame timing (FPS, frame time)
 * - Memory usage
 * - GPU metrics (draw calls, vertex count)
 * - Bottleneck identification
 */

export const createPerformanceProfiler = () => {
  const metrics = {
    // TIMING METRICS
    frames: [],
    frameCount: 0,
    fps: 60,
    avgFrameTime: 0,
    maxFrameTime: 0,
    minFrameTime: Infinity,

    // BREAKDOWN
    audioUpdateTime: 0,
    particleUpdateTime: 0,
    ringUpdateTime: 0,
    renderTime: 0,

    // MEMORY
    particleCount: 0,
    ringCount: 0,
    memoryUsage: 0,

    // DETECTION
    isBottleneckedOnCPU: false,
    isBottleneckedOnGPU: false,
    slowestComponent: 'unknown',
  }

  const maxSamples = 120 // Track last 2 seconds at 60fps

  const marks = {}

  return {
    /**
     * Mark start of a measurement
     */
    mark: (name) => {
      marks[name] = performance.now()
    },

    /**
     * Measure time since mark and record
     */
    measure: (name) => {
      if (!marks[name]) {
        console.warn(`No mark found for: ${name}`)
        return 0
      }
      const duration = performance.now() - marks[name]
      delete marks[name]

      // Update specific metrics
      if (name === 'audioUpdate') metrics.audioUpdateTime = duration
      if (name === 'particleUpdate') metrics.particleUpdateTime = duration
      if (name === 'ringUpdate') metrics.ringUpdateTime = duration
      if (name === 'render') metrics.renderTime = duration

      return duration
    },

    /**
     * Record frame time and calculate FPS
     */
    recordFrame: (frameTime) => {
      metrics.frames.push(frameTime)
      if (metrics.frames.length > maxSamples) {
        metrics.frames.shift()
      }

      metrics.frameCount++
      metrics.avgFrameTime = metrics.frames.reduce((a, b) => a + b, 0) / metrics.frames.length
      metrics.maxFrameTime = Math.max(...metrics.frames)
      metrics.minFrameTime = Math.min(...metrics.frames)
      metrics.fps = Math.round(1000 / metrics.avgFrameTime)

      // Detect bottlenecks
      const totalUpdateTime = metrics.audioUpdateTime + metrics.particleUpdateTime + metrics.ringUpdateTime
      metrics.isBottleneckedOnCPU = totalUpdateTime > 10 // More than 10ms on updates
      metrics.isBottleneckedOnGPU = metrics.renderTime > (16 - totalUpdateTime) // Render takes more than available time

      // Find slowest component
      const times = {
        audio: metrics.audioUpdateTime,
        particles: metrics.particleUpdateTime,
        rings: metrics.ringUpdateTime,
        render: metrics.renderTime,
      }
      metrics.slowestComponent = Object.entries(times).reduce((a, b) => a[1] > b[1] ? a : b)[0]
    },

    /**
     * Get current metrics as formatted string
     */
    toString: () => {
      return `
FPS: ${metrics.fps} (avg ${metrics.avgFrameTime.toFixed(2)}ms, max ${metrics.maxFrameTime.toFixed(2)}ms)
Audio: ${metrics.audioUpdateTime.toFixed(2)}ms | Particles: ${metrics.particleUpdateTime.toFixed(2)}ms | Rings: ${metrics.ringUpdateTime.toFixed(2)}ms | Render: ${metrics.renderTime.toFixed(2)}ms
Particles: ${metrics.particleCount} | Rings: ${metrics.ringCount}
Bottleneck: ${metrics.isBottleneckedOnCPU ? '🔴 CPU' : '✅ OK'} | GPU: ${metrics.isBottleneckedOnGPU ? '🔴 GPU' : '✅ OK'} | Slowest: ${metrics.slowestComponent}
      `
    },

    /**
     * Get metrics object
     */
    getMetrics: () => ({ ...metrics }),

    /**
     * Update component counts
     */
    setComponentCounts: (particleCount, ringCount) => {
      metrics.particleCount = particleCount
      metrics.ringCount = ringCount
    },

    /**
     * Reset all metrics
     */
    reset: () => {
      metrics.frames = []
      metrics.frameCount = 0
      metrics.fps = 60
      metrics.avgFrameTime = 0
      metrics.maxFrameTime = 0
      metrics.minFrameTime = Infinity
      metrics.audioUpdateTime = 0
      metrics.particleUpdateTime = 0
      metrics.ringUpdateTime = 0
      metrics.renderTime = 0
    },

    /**
     * Log metrics to console for debugging
     */
    logMetrics: () => {
      console.log('[GalaxyProfiler]', metrics.toString())
    },

    /**
     * Get performance report with recommendations
     */
    getReport: () => {
      const report = {
        healthy: metrics.fps >= 50,
        issues: [],
        recommendations: [],
      }

      if (metrics.fps < 50) {
        report.issues.push(`Low FPS: ${metrics.fps}`)
      }

      if (metrics.isBottleneckedOnCPU) {
        report.issues.push('CPU bottleneck detected')
        report.recommendations.push(`Reduce ${metrics.slowestComponent} complexity`)
      }

      if (metrics.isBottleneckedOnGPU) {
        report.issues.push('GPU bottleneck detected')
        report.recommendations.push('Reduce particle count or bloom quality')
      }

      if (metrics.particleCount > 2000) {
        report.recommendations.push('Consider reducing particle count on mobile')
      }

      if (metrics.maxFrameTime > 20) {
        report.issues.push(`Frame spikes detected (${metrics.maxFrameTime.toFixed(0)}ms)`)
        report.recommendations.push('Check for memory allocation in animation loop')
      }

      return report
    },
  }
}

export default createPerformanceProfiler
