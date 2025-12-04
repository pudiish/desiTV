/**
 * useMetrics - Hook for accessing performance and usage metrics
 */

import { useState, useEffect } from 'react'

export function useMetrics(metricsCollector) {
  const [metrics, setMetrics] = useState({
    apiCalls: { total: 0, success: 0, failed: 0, pending: 0 },
    averageResponseTime: 0,
    cacheHitRate: 0,
    uptime: 0,
  })

  useEffect(() => {
    if (!metricsCollector) {
      console.warn('[useMetrics] No metrics collector provided')
      return
    }

    // Subscribe to metrics changes
    const unsubscribe = metricsCollector.onMetricsChange((newMetrics) => {
      setMetrics(newMetrics)
    })

    // Initial metrics
    setMetrics(metricsCollector.getMetrics())

    return () => {
      unsubscribe()
    }
  }, [metricsCollector])

  return metrics
}

export default useMetrics
