/**
 * Health Monitor - Tracks API and system health
 * Provides real-time status of backend services
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
    ]
    this.checkInterval = null
    this.lastCheck = null
    this.listeners = []
    this.isMonitoring = false
  }

  /**
   * Start health monitoring
   */
  start() {
    if (this.isMonitoring) {
      console.warn('[HealthMonitor] Already monitoring')
      return
    }

    console.log('[HealthMonitor] Starting health monitoring...')
    this.isMonitoring = true

    // Initial check
    this.checkHealth()

    // Periodic checks
    this.checkInterval = setInterval(() => {
      this.checkHealth()
    }, TIMING.HEALTH_CHECK_INTERVAL)
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
   * Check health of all endpoints
   */
  async checkHealth() {
    const checks = this.endpoints.map(async (endpoint) => {
      try {
        const startTime = performance.now()
        await this.apiService.client.get(endpoint)
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

    this.lastCheck = new Date().toISOString()
    this.notifyListeners()

    return results
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
