/**
 * Cache Monitor - Tracks cache usage and provides cache management
 * Monitors localStorage, sessionStorage, and browser cache
 */

import { STORAGE, CACHE } from '../config/constants'

export class CacheMonitor {
  constructor() {
    this.cacheStats = {
      localStorage: {
        size: 0,
        items: 0,
        details: {},
      },
      sessionStorage: {
        size: 0,
        items: 0,
        details: {},
      },
      browserCache: {
        size: 0,
        count: 0,
      },
    }
    this.listeners = []
  }

  /**
   * Calculate cache size
   */
  calculateSize(obj) {
    if (obj === null || obj === undefined) return 0
    if (typeof obj === 'string') return new Blob([obj]).size
    if (typeof obj === 'object') return new Blob([JSON.stringify(obj)]).size
    return 0
  }

  /**
   * Get localStorage stats
   */
  getLocalStorageStats() {
    const stats = {
      size: 0,
      items: 0,
      details: {},
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      const value = localStorage.getItem(key)
      const size = this.calculateSize(value)

      stats.size += size
      stats.items++
      stats.details[key] = {
        size,
        sizeKB: (size / 1024).toFixed(2),
        type: this.getStorageType(key),
      }
    }

    stats.sizeKB = (stats.size / 1024).toFixed(2)
    stats.sizeMB = (stats.size / (1024 * 1024)).toFixed(2)

    return stats
  }

  /**
   * Get sessionStorage stats
   */
  getSessionStorageStats() {
    const stats = {
      size: 0,
      items: 0,
      details: {},
    }

    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      const value = sessionStorage.getItem(key)
      const size = this.calculateSize(value)

      stats.size += size
      stats.items++
      stats.details[key] = {
        size,
        sizeKB: (size / 1024).toFixed(2),
        type: this.getStorageType(key),
      }
    }

    stats.sizeKB = (stats.size / 1024).toFixed(2)
    stats.sizeMB = (stats.size / (1024 * 1024)).toFixed(2)

    return stats
  }

  /**
   * Get browser cache stats
   */
  async getBrowserCacheStats() {
    const stats = {
      size: 0,
      count: 0,
      available: false,
    }

    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys()
        stats.available = true
        stats.count = cacheNames.length

        for (const cacheName of cacheNames) {
          const cache = await caches.open(cacheName)
          const requests = await cache.keys()
          stats.size += requests.length
        }
      } catch (err) {
        console.warn('[CacheMonitor] Error getting browser cache:', err)
      }
    }

    return stats
  }

  /**
   * Get storage type
   */
  getStorageType(key) {
    if (key.includes('session')) return 'session'
    if (key.includes('channel')) return 'channels'
    if (key.includes('broadcast')) return 'broadcast'
    if (key.includes('player')) return 'player'
    if (key.includes('cache')) return 'cache'
    if (key.includes('api')) return 'api'
    return 'other'
  }

  /**
   * Update all cache stats
   */
  async updateStats() {
    this.cacheStats.localStorage = this.getLocalStorageStats()
    this.cacheStats.sessionStorage = this.getSessionStorageStats()
    this.cacheStats.browserCache = await this.getBrowserCacheStats()

    this.notifyListeners()
  }

  /**
   * Get cache stats
   */
  getStats() {
    return { ...this.cacheStats }
  }

  /**
   * Get total cache size
   */
  getTotalSize() {
    const totalBytes =
      this.cacheStats.localStorage.size +
      this.cacheStats.sessionStorage.size

    return {
      bytes: totalBytes,
      KB: (totalBytes / 1024).toFixed(2),
      MB: (totalBytes / (1024 * 1024)).toFixed(2),
    }
  }

  /**
   * Clear localStorage
   */
  clearLocalStorage(preserve = []) {
    const toPreserve = {}
    preserve.forEach((key) => {
      toPreserve[key] = localStorage.getItem(key)
    })

    localStorage.clear()

    Object.entries(toPreserve).forEach(([key, value]) => {
      localStorage.setItem(key, value)
    })

    this.updateStats()
    console.log('[CacheMonitor] ✓ localStorage cleared')
  }

  /**
   * Clear sessionStorage
   */
  clearSessionStorage() {
    sessionStorage.clear()
    this.updateStats()
    console.log('[CacheMonitor] ✓ sessionStorage cleared')
  }

  /**
   * Clear browser cache
   */
  async clearBrowserCache() {
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys()
        await Promise.all(cacheNames.map((name) => caches.delete(name)))
        console.log('[CacheMonitor] ✓ Browser cache cleared')
      } catch (err) {
        console.error('[CacheMonitor] Error clearing browser cache:', err)
      }
    }
    this.updateStats()
  }

  /**
   * Clear specific storage item
   */
  clearStorageItem(key, storage = 'localStorage') {
    try {
      if (storage === 'localStorage') {
        localStorage.removeItem(key)
      } else if (storage === 'sessionStorage') {
        sessionStorage.removeItem(key)
      }
      this.updateStats()
      console.log(`[CacheMonitor] ✓ Cleared ${storage}[${key}]`)
    } catch (err) {
      console.error(`[CacheMonitor] Error clearing ${storage}[${key}]:`, err)
    }
  }

  /**
   * Full cache cleanup (before TV session)
   */
  async fullCleanup(preserveKeys = []) {
    console.log('[CacheMonitor] Starting full cache cleanup...')

    // Clear sessionStorage
    this.clearSessionStorage()

    // Clear localStorage with preservation
    this.clearLocalStorage(preserveKeys)

    // Clear browser cache
    await this.clearBrowserCache()

    await this.updateStats()
    console.log('[CacheMonitor] ✓ Full cleanup complete')
  }

  /**
   * Subscribe to cache stats updates
   */
  onStatsChange(listener) {
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
        listener(this.getStats())
      } catch (err) {
        console.error('[CacheMonitor] Error in listener:', err)
      }
    })
  }
}

export default CacheMonitor
