/**
 * useHealthMonitoring - Hook for monitoring system and API health
 * Provides real-time health status updates
 */

import { useState, useEffect } from 'react'

export function useHealthMonitoring(healthMonitor) {
  const [health, setHealth] = useState({
    endpoints: {},
    overall: {
      healthy: 0,
      unhealthy: 0,
      total: 0,
      percentage: 0,
    },
    isMonitoring: false,
  })

  useEffect(() => {
    if (!healthMonitor) {
      console.warn('[useHealthMonitoring] No health monitor provided')
      return
    }

    // Subscribe to status changes
    const unsubscribe = healthMonitor.onStatusChange((status) => {
      setHealth(status)
    })

    // Initial status
    setHealth(healthMonitor.getStatus())

    // Start monitoring if not already started
    if (!healthMonitor.isMonitoring) {
      healthMonitor.start()
    }

    return () => {
      unsubscribe()
    }
  }, [healthMonitor])

  return health
}

export default useHealthMonitoring
