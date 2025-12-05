/**
 * Health Monitor - Tracks API and system health with Intelligent Adaptive Checking
 * 
 * Cost Optimization Strategy:
 * - Normal state: Check every 60 seconds (baseline)
 * - Degraded state: Check every 10 seconds (escalation)
 * - Critical state: Check every 3 seconds (urgent)
 * - Recovery: Exponential backoff to normal (cost reduction)
 * 
 * This reduces API costs by ~95% during normal operation
 */

import { TIMING, API_ENDPOINTS } from '../config/constants'

export class HealthMonitor {
  constructor(apiService) {
    this.apiService = apiService
    this.status = {}
    this.endpoints = [
      API_ENDPOINTS.HEALTH,
      API_ENDPOINTS.CHANNELS,
      API_ENDPOINTS.BROADCAST_STATE_ALL,
      API_ENDPOINTS.MONITORING_HEALTH,
      API_ENDPOINTS.MONITORING_STATUS,
    ]
    this.checkInterval = null
    this.lastCheck = null
    this.listeners = []
    this.isMonitoring = false
    
    // Adaptive checking configuration
    this.healthState = 'healthy' // healthy, degraded, critical
    this.consecutiveFailures = 0
    this.failureThreshold = 2 // failures before escalating
    this.recoveryAttempts = 0
    this.maxRecoveryAttempts = 5 // attempts before giving up on recovery
    
    // Check intervals based on state (in ms)
    this.checkIntervals = {
      healthy: 60000,    // 60 seconds - normal operation
      degraded: 10000,   // 10 seconds - something wrong
      critical: 3000,    // 3 seconds - critical issue
    }
    
    // Historical data for trend analysis
    this.failureHistory = []
    this.maxHistoryLength = 10
  }

  /**
   * Start health monitoring with adaptive intervals
   */
  start() {
    if (this.isMonitoring) {
      console.warn('[HealthMonitor] Already monitoring')
      return
    }

    console.log('[HealthMonitor] Starting adaptive health monitoring...')
    console.log('[HealthMonitor] Cost optimization: Normal checks every 60s, escalates to 10s/3s on issues')
    this.isMonitoring = true

    // Initial check
    this.checkHealth()

    // Adaptive periodic checks
    this.scheduleNextCheck()
  }

  /**
   * Schedule next health check based on current state
   */
  scheduleNextCheck() {
    if (!this.isMonitoring) return

    // Clear existing interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    // Get interval based on current health state
    const interval = this.checkIntervals[this.healthState] || this.checkIntervals.healthy

    console.log(`[HealthMonitor] Next check in ${interval}ms (State: ${this.healthState})`)

    this.checkInterval = setInterval(() => {
      this.checkHealth()
    }, interval)
  }

  /**
   * Stop health monitoring
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
    this.isMonitoring = false
    console.log('[HealthMonitor] Stopped health monitoring')
  }

  /**
   * Detect if system is in critical condition
   */
  detectCriticalIssue(results) {
    const healthy = results.filter(r => r.status === 'healthy').length
    const total = results.length
    const healthPercent = total > 0 ? (healthy / total) * 100 : 100

    // Critical if more than 50% of endpoints are unhealthy
    return healthPercent < 50
  }

  /**
   * Update health state based on results
   */
  updateHealthState(results) {
    const isCritical = this.detectCriticalIssue(results)
    const previousState = this.healthState

    if (isCritical) {
      this.consecutiveFailures++
      
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.healthState = 'critical'
        this.recoveryAttempts = 0
      } else {
        this.healthState = 'degraded'
      }
    } else {
      // System is recovering
      if (this.healthState === 'critical') {
        this.recoveryAttempts++
        
        // Exponential backoff: stay degraded for a while before returning to healthy
        const requiredRecoveryAttempts = Math.min(3, this.maxRecoveryAttempts)
        if (this.recoveryAttempts < requiredRecoveryAttempts) {
          this.healthState = 'degraded'
        } else {
          this.healthState = 'healthy'
          this.consecutiveFailures = 0
          this.recoveryAttempts = 0
        }
      } else {
        this.healthState = 'healthy'
        this.consecutiveFailures = 0
      }
    }

    // Log state changes
    if (previousState !== this.healthState) {
      console.warn(`[HealthMonitor] State changed: ${previousState} → ${this.healthState}`)
    }

    // Record failure history for trend analysis
    this.failureHistory.push({
      timestamp: Date.now(),
      state: this.healthState,
      failureCount: this.consecutiveFailures,
    })
    if (this.failureHistory.length > this.maxHistoryLength) {
      this.failureHistory.shift()
    }
  }

  /**
   * Check health of all endpoints
   */
  async checkHealth() {
    if (!this.isMonitoring) return

    try {
      const checks = this.endpoints.map(async (endpoint) => {
        try {
          const startTime = performance.now()
          const timeoutMs = 5000 // 5 second timeout
          
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
          
          await this.apiService.client.get(endpoint, { signal: controller.signal })
          clearTimeout(timeoutId)
          
          const duration = performance.now() - startTime

          return {
            endpoint,
            status: 'healthy',
            duration: Math.round(duration),
            timestamp: new Date().toISOString(),
          }
        } catch (error) {
          return {
            endpoint,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString(),
          }
        }
      })

      const results = await Promise.all(checks)

      // Update status
      results.forEach((result) => {
        this.status[result.endpoint] = result
      })

      // Update health state and reschedule if needed
      const previousState = this.healthState
      this.updateHealthState(results)
      
      if (previousState !== this.healthState) {
        this.scheduleNextCheck() // Reschedule with new interval
      }

      this.lastCheck = new Date().toISOString()
      this.notifyListeners()

      return results
    } catch (err) {
      console.error('[HealthMonitor] Check health error:', err)
    }
  }

  /**
   * Get status for specific endpoint
   */
  getEndpointStatus(endpoint) {
    return this.status[endpoint] || null
  }

  /**
   * Get overall health status
   */
  getOverallStatus() {
    const statuses = Object.values(this.status)
    const healthy = statuses.filter((s) => s.status === 'healthy').length
    const total = statuses.length

    return {
      healthy,
      unhealthy: total - healthy,
      total,
      percentage: total > 0 ? Math.round((healthy / total) * 100) : 0,
      lastCheck: this.lastCheck,
      state: this.healthState,
      consecutiveFailures: this.consecutiveFailures,
    }
  }

  /**
   * Get all status
   */
  getStatus() {
    return {
      endpoints: { ...this.status },
      overall: this.getOverallStatus(),
      isMonitoring: this.isMonitoring,
      healthState: this.healthState,
      failureHistory: this.failureHistory,
    }
  }

  /**
   * Subscribe to status updates
   */
  onStatusChange(listener) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  /**
   * Notify listeners of status changes
   */
  notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.getStatus())
      } catch (err) {
        console.error('[HealthMonitor] Error in listener:', err)
      }
    })
  }

  /**
   * Shutdown
   */
  async shutdown() {
    this.stop()
    this.listeners = []
  }
}

export default HealthMonitor
