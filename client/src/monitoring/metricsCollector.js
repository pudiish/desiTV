/**
 * Metrics Collector - Tracks performance and usage metrics
 * Collects data on API calls, cache usage, and system performance
 */

import { CACHE } from '../config/constants'

export class MetricsCollector {
  constructor() {
    this.metrics = {
      apiCalls: {
        total: 0,
        success: 0,
        failed: 0,
        pending: 0,
      },
      responseTimes: [],
      errorCounts: {},
      cacheHits: 0,
      cacheMisses: 0,
      memoryUsage: {},
    }
    this.listeners = []
    this.startTime = Date.now()
  }

  /**
   * Record start of API request
   */
  recordRequestStart(url) {
    this.metrics.apiCalls.pending++
    this.metrics.apiCalls.total++
  }

  /**
   * Record end of API request
   */
  recordRequestEnd(status, duration) {
    this.metrics.apiCalls.pending = Math.max(0, this.metrics.apiCalls.pending - 1)

    if (status >= 200 && status < 300) {
      this.metrics.apiCalls.success++
    } else {
      this.metrics.apiCalls.failed++
    }

    // Track response times (keep last 100)
    this.metrics.responseTimes.push({
      status,
      duration,
      timestamp: Date.now(),
    })

    if (this.metrics.responseTimes.length > 100) {
      this.metrics.responseTimes.shift()
    }

    this.notifyListeners()
  }

  /**
   * Record error
   */
  recordError(errorType = 'unknown') {
    this.metrics.errorCounts[errorType] =
      (this.metrics.errorCounts[errorType] || 0) + 1
    this.notifyListeners()
  }

  /**
   * Record cache hit
   */
  recordCacheHit() {
    this.metrics.cacheHits++
    this.notifyListeners()
  }

  /**
   * Record cache miss
   */
  recordCacheMiss() {
    this.metrics.cacheMisses++
    this.notifyListeners()
  }

  /**
   * Get average response time
   */
  getAverageResponseTime() {
    if (this.metrics.responseTimes.length === 0) return 0
    const total = this.metrics.responseTimes.reduce((sum, r) => sum + r.duration, 0)
    return Math.round(total / this.metrics.responseTimes.length)
  }

  /**
   * Get cache hit rate
   */
  getCacheHitRate() {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses
    if (total === 0) return 0
    return Math.round((this.metrics.cacheHits / total) * 100)
  }

  /**
   * Get uptime
   */
  getUptime() {
    return Date.now() - this.startTime
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      averageResponseTime: this.getAverageResponseTime(),
      cacheHitRate: this.getCacheHitRate(),
      uptime: this.getUptime(),
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      apiCalls: {
        total: 0,
        success: 0,
        failed: 0,
        pending: 0,
      },
      responseTimes: [],
      errorCounts: {},
      cacheHits: 0,
      cacheMisses: 0,
      memoryUsage: {},
    }
    this.startTime = Date.now()
    this.notifyListeners()
  }

  /**
   * Subscribe to metrics updates
   */
  onMetricsChange(listener) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  /**
   * Notify listeners
   */
  notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.getMetrics())
      } catch (err) {
        console.error('[MetricsCollector] Error in listener:', err)
      }
    })
  }
}

export default MetricsCollector
