/**
 * Analytics Service - Stub
 * 
 * Provides basic analytics tracking hooks.
 * In production, these could be connected to a real analytics service.
 */

// No-op analytics for now (can be connected to actual analytics later)
export const analytics = {
  trackChannelChange: (direction, fromChannel, toChannel, categoryName) => {
    // console.log('[Analytics] Channel change:', { direction, fromChannel, toChannel, categoryName })
  },
  
  trackVolumeChange: (volume, direction) => {
    // console.log('[Analytics] Volume change:', { volume, direction })
  },
  
  trackMenuOpen: () => {
    // console.log('[Analytics] Menu opened')
  },
  
  trackMenuClose: () => {
    // console.log('[Analytics] Menu closed')
  },
  
  trackPerformance: (metric, value) => {
    // console.log('[Analytics] Performance:', { metric, value })
  },
  
  trackError: (error, context) => {
    console.error('[Analytics] Error:', error, context)
  },
  
  trackEvent: (eventName, properties) => {
    // console.log('[Analytics] Event:', eventName, properties)
  },
}

// Performance monitoring utilities
export const performanceMonitor = {
  trackChannelSwitch: (startTime) => {
    const duration = performance.now() - startTime
    // console.log('[Performance] Channel switch:', duration, 'ms')
    return duration
  },
  
  trackMenuOpen: (startTime) => {
    const duration = performance.now() - startTime
    // console.log('[Performance] Menu open:', duration, 'ms')
    return duration
  },
  
  trackVideoLoad: (startTime) => {
    const duration = performance.now() - startTime
    // console.log('[Performance] Video load:', duration, 'ms')
    return duration
  },
  
  mark: (name) => {
    if (typeof performance !== 'undefined' && performance.mark) {
      performance.mark(name)
    }
  },
  
  measure: (name, startMark, endMark) => {
    if (typeof performance !== 'undefined' && performance.measure) {
      try {
        performance.measure(name, startMark, endMark)
      } catch (e) {
        // Marks may not exist
      }
    }
  },
}

export default { analytics, performanceMonitor }
