/**
 * Simple In-Memory Cache for DesiTV™ API
 * Reduces database calls for frequently accessed data
 * 
 * Usage:
 *   cache.set('key', data, ttlSeconds)
 *   cache.get('key') // returns null if expired
 *   cache.delete('key')
 *   cache.clear()
 */

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
const cache = new SimpleCache()

module.exports = cache
