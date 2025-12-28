/**
 * Cache interface for DesiTV API
 * 
 * Exports Redis cache (with in-memory fallback) or pure in-memory cache
 * depending on Redis availability.
 */

// Try to use Redis cache, fallback to simple cache
const FALLBACK_ENABLED = process.env.REDIS_FALLBACK_ENABLED === 'true'

let cache
try {
	const redisCache = require('./redisCache')
	// Use Redis cache (with optional fallback built-in)
	cache = redisCache
	// Redis connection is async, so we'll check status after a short delay
	// This prevents false "not connected" messages during startup
	setTimeout(() => {
		if (redisCache.isRedisConnected && redisCache.isRedisConnected()) {
			const hybridMode = process.env.REDIS_HYBRID_MODE !== 'false'
			if (hybridMode) {
				console.log('[Cache] ✅ Hybrid mode: L1 (in-memory) + L2 (Redis) active')
			} else {
				console.log('[Cache] ✅ Using L2 (Redis) cache only (hybrid mode disabled)')
			}
		} else {
			const hybridMode = process.env.REDIS_HYBRID_MODE !== 'false'
			if (hybridMode) {
				console.log('[Cache] Using L1 (in-memory) cache only (Redis not available)')
			} else {
				console.error('[Cache] ❌ Redis not available and hybrid mode is disabled!')
			}
		}
	}, 1000) // Check after 1 second to allow Redis to connect
} catch (err) {
	// This catch handles require() errors (module not found, etc.)
	if (FALLBACK_ENABLED) {
		console.warn('[Cache] Redis cache module error, using in-memory cache only:', err.message)
	} else {
		console.error('[Cache] ❌ Redis cache module error and fallback is disabled:', err.message)
		throw err // Re-throw if fallback is disabled
	}
	// Fallback to simple cache
	class SimpleCache {
  constructor() {
    this.cache = new Map()
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
    }
    
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000)
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.cache.get(key)
    
    if (!entry) {
      this.stats.misses++
      return null
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }
    
    this.stats.hits++
    return entry.value
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default: 60)
   */
  set(key, value, ttl = 60) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttl * 1000),
      createdAt: Date.now(),
    })
    this.stats.sets++
  }

  /**
   * Delete specific key
   * @param {string} key - Cache key
   */
  delete(key) {
    this.cache.delete(key)
  }

  /**
   * Delete all keys matching a pattern
   * @param {string} pattern - Pattern to match (simple string match)
   */
  deletePattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear()
    this.stats = { hits: 0, misses: 0, sets: 0 }
  }

  /**
   * Clean up expired entries
   */
  cleanup() {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? (this.stats.hits / total * 100).toFixed(2) + '%' : '0%',
    }
  }

  /**
   * Stop cleanup interval (for graceful shutdown)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.clear()
  }
}

	// Export singleton instance
	cache = new SimpleCache()
}

// Make cache methods async-compatible (for both Redis and in-memory)
// If cache methods are already async, they'll work as-is
// If they're sync, wrap them in async functions
if (cache && typeof cache.get === 'function' && cache.get.constructor.name !== 'AsyncFunction') {
	// Wrap sync methods to be async-compatible
	const originalGet = cache.get.bind(cache)
	const originalSet = cache.set.bind(cache)
	const originalDelete = cache.delete.bind(cache)
	const originalDeletePattern = cache.deletePattern.bind(cache)
	const originalClear = cache.clear.bind(cache)
	
	cache.get = async (key) => originalGet(key)
	cache.set = async (key, value, ttl) => originalSet(key, value, ttl)
	cache.delete = async (key) => originalDelete(key)
	cache.deletePattern = async (pattern) => originalDeletePattern(pattern)
	cache.clear = async () => originalClear()
}

module.exports = cache
