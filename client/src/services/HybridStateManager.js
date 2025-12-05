/**
 * HybridStateManager - Smart Local/Backend State Management
 * 
 * Philosophy:
 * - Local first: Keep data in memory with TTL caching
 * - Backend sync: Only persist critical/changed data
 * - Smart invalidation: Refresh only when stale or manually requested
 * - Cost optimized: Reduces API calls by batching and selective syncing
 */

class HybridStateManager {
  constructor(options = {}) {
    // Cache configuration
    this.cache = {} // { key: { data, timestamp, ttl, isDirty } }
    this.cacheDefaults = {
      channels: { ttl: 300000 }, // 5 minutes - channels rarely change
      broadcastStates: { ttl: 60000 }, // 1 minute - active data
      health: { ttl: 60000 }, // 1 minute - health status
      systemStats: { ttl: 120000 }, // 2 minutes - general stats
    }
    
    // Sync queue for batching writes
    this.syncQueue = {}
    this.syncTimeout = null
    this.syncIntervalMs = options.syncIntervalMs || 3000 // Batch saves every 3s
    
    // Subscriptions
    this.listeners = {}
    
    // Track what's changed
    this.dirtyKeys = new Set()
  }

  /**
   * GET DATA - Check local cache first, then backend
   * @param {string} key - Cache key (e.g., 'channels', 'broadcastStates')
   * @param {function} fetchFn - Async function to fetch from backend if needed
   * @returns {Promise<any>} - Cached or fetched data
   */
  async get(key, fetchFn) {
    // Check if we have valid cached data
    const cached = this.cache[key]
    if (cached && !this.isCacheExpired(key)) {
      console.log(`[HSM] Cache hit for ${key} (${this.getTimeRemaining(key)}ms remaining)`)
      return cached.data
    }

    // Cache miss or expired - fetch from backend
    console.log(`[HSM] Cache miss/expired for ${key} - fetching from backend`)
    try {
      const data = await fetchFn()
      this.set(key, data) // Update cache
      return data
    } catch (err) {
      console.error(`[HSM] Error fetching ${key}:`, err)
      // Return stale data if available
      if (cached) {
        console.warn(`[HSM] Using stale cache for ${key} due to fetch error`)
        return cached.data
      }
      throw err
    }
  }

  /**
   * SET DATA - Store in local cache and mark for backend sync
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {boolean} isDirty - Whether this needs backend sync
   */
  set(key, data, isDirty = false) {
    const ttl = this.cacheDefaults[key]?.ttl || 60000
    
    this.cache[key] = {
      data,
      timestamp: Date.now(),
      ttl,
      isDirty,
    }

    if (isDirty) {
      this.dirtyKeys.add(key)
      this.queueSync()
    }

    this.notifyListeners(key, data)
  }

  /**
   * UPDATE DATA - Merge with existing cache
   * @param {string} key - Cache key
   * @param {object} updates - Partial updates to merge
   * @param {boolean} syncToBackend - Whether to sync this change
   */
  update(key, updates, syncToBackend = true) {
    const cached = this.cache[key]
    if (!cached) {
      this.set(key, updates, syncToBackend)
      return
    }

    // Merge updates with existing data
    const merged = Array.isArray(cached.data)
      ? this.mergeArrays(cached.data, updates)
      : { ...cached.data, ...updates }

    this.set(key, merged, syncToBackend)
  }

  /**
   * INVALIDATE CACHE - Force refresh on next get
   * @param {string} key - Cache key to invalidate
   */
  invalidate(key) {
    if (this.cache[key]) {
      this.cache[key].timestamp = 0 // Mark as expired
      console.log(`[HSM] Cache invalidated for ${key}`)
    }
  }

  /**
   * QUEUE SYNC - Batch backend writes
   * Only syncs dirty keys to reduce API calls
   */
  queueSync() {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
    }

    // Wait before syncing to batch multiple changes
    this.syncTimeout = setTimeout(() => {
      this.syncDirtyKeys()
    }, this.syncIntervalMs)
  }

  /**
   * SYNC DIRTY KEYS - Save changed data to backend
   * Only syncs keys marked as dirty
   */
  async syncDirtyKeys() {
    if (this.dirtyKeys.size === 0) {
      return // Nothing to sync
    }

    console.log(`[HSM] Syncing ${this.dirtyKeys.size} dirty keys to backend`)

    for (const key of this.dirtyKeys) {
      const cached = this.cache[key]
      if (cached && cached.isDirty) {
        try {
          // Call registered sync function for this key
          const syncFn = this.syncQueue[key]
          if (syncFn) {
            await syncFn(cached.data)
          }

          // Mark as clean
          cached.isDirty = false
          this.dirtyKeys.delete(key)
        } catch (err) {
          console.error(`[HSM] Error syncing ${key}:`, err)
          // Keep in dirty set for retry
        }
      }
    }

    console.log(`[HSM] Sync complete. Dirty keys remaining: ${this.dirtyKeys.size}`)
  }

  /**
   * REGISTER SYNC FUNCTION - Define how to sync a key
   * @param {string} key - Cache key
   * @param {function} syncFn - Async function(data) to sync to backend
   */
  registerSync(key, syncFn) {
    this.syncQueue[key] = syncFn
  }

  /**
   * SUBSCRIBE TO CHANGES
   * @param {string} key - Cache key to listen to
   * @param {function} callback - Called when key changes
   */
  subscribe(key, callback) {
    if (!this.listeners[key]) {
      this.listeners[key] = []
    }
    this.listeners[key].push(callback)

    // Return unsubscribe function
    return () => {
      this.listeners[key] = this.listeners[key].filter((cb) => cb !== callback)
    }
  }

  /**
   * NOTIFY LISTENERS - Emit change events
   */
  notifyListeners(key, data) {
    if (this.listeners[key]) {
      this.listeners[key].forEach((callback) => {
        try {
          callback(data)
        } catch (err) {
          console.error(`[HSM] Listener error for ${key}:`, err)
        }
      })
    }
  }

  /**
   * CHECK IF CACHE EXPIRED
   */
  isCacheExpired(key) {
    const cached = this.cache[key]
    if (!cached) return true
    const age = Date.now() - cached.timestamp
    return age > cached.ttl
  }

  /**
   * GET TIME REMAINING in cache
   */
  getTimeRemaining(key) {
    const cached = this.cache[key]
    if (!cached) return 0
    const remaining = cached.ttl - (Date.now() - cached.timestamp)
    return Math.max(0, remaining)
  }

  /**
   * MERGE ARRAYS - Smart merge for array data
   * Prevents duplicates, maintains order
   */
  mergeArrays(existing, updates) {
    if (!Array.isArray(updates)) {
      return updates
    }

    // If updates has an _id field, it's item-based
    if (updates[0]?._id) {
      const existingMap = new Map(existing.map((item) => [item._id, item]))
      updates.forEach((item) => {
        existingMap.set(item._id, item)
      })
      return Array.from(existingMap.values())
    }

    // Otherwise, replace entirely
    return updates
  }

  /**
   * CLEAR CACHE
   */
  clearCache(key = null) {
    if (key) {
      delete this.cache[key]
      this.dirtyKeys.delete(key)
    } else {
      this.cache = {}
      this.dirtyKeys.clear()
    }
    console.log(`[HSM] Cache cleared${key ? ` for ${key}` : ' (all)'}`)
  }

  /**
   * GET DIAGNOSTICS
   */
  getDiagnostics() {
    return {
      cacheSize: Object.keys(this.cache).length,
      dirtyKeys: Array.from(this.dirtyKeys),
      cacheEntries: Object.entries(this.cache).map(([key, entry]) => ({
        key,
        age: Date.now() - entry.timestamp,
        ttl: entry.ttl,
        isDirty: entry.isDirty,
        isExpired: this.isCacheExpired(key),
        dataSize: JSON.stringify(entry.data).length,
      })),
    }
  }
}

export default new HybridStateManager()
