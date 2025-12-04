/**
 * useCache - Hook for accessing and managing cache statistics
 */

import { useState, useEffect } from 'react'

export function useCache(cacheMonitor) {
  const [cacheStats, setCacheStats] = useState({
    localStorage: { size: 0, items: 0, details: {} },
    sessionStorage: { size: 0, items: 0, details: {} },
    browserCache: { size: 0, count: 0 },
  })

  useEffect(() => {
    if (!cacheMonitor) {
      console.warn('[useCache] No cache monitor provided')
      return
    }

    // Subscribe to cache stats changes
    const unsubscribe = cacheMonitor.onStatsChange((stats) => {
      setCacheStats(stats)
    })

    // Initial stats
    cacheMonitor.updateStats().then(() => {
      setCacheStats(cacheMonitor.getStats())
    })

    return () => {
      unsubscribe()
    }
  }, [cacheMonitor])

  // Methods for cache management
  const methods = {
    clearLocalStorage: (preserve = []) => cacheMonitor?.clearLocalStorage(preserve),
    clearSessionStorage: () => cacheMonitor?.clearSessionStorage(),
    clearBrowserCache: () => cacheMonitor?.clearBrowserCache(),
    clearStorageItem: (key, storage = 'localStorage') =>
      cacheMonitor?.clearStorageItem(key, storage),
    fullCleanup: (preserveKeys = []) => cacheMonitor?.fullCleanup(preserveKeys),
    getTotalSize: () => cacheMonitor?.getTotalSize(),
  }

  return {
    stats: cacheStats,
    ...methods,
  }
}

export default useCache
