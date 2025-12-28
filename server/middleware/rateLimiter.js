/**
 * Custom Rate Limiter Middleware
 * Replaces express-rate-limit with lightweight in-memory implementation
 * 
 * Features:
 * - In-memory storage (lightweight, no Redis dependency)
 * - Configurable windows and limits
 * - IP-based tracking
 * - Automatic cleanup of expired entries
 */

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000 // 15 minutes default
    this.max = options.max || 100 // 100 requests default
    this.message = options.message || { error: 'Too many requests' }
    this.skip = options.skip || (() => false)
    this.keyGenerator = options.keyGenerator || ((req) => req.ip || 'unknown')
    
    // Store: Map<key, { count: number, resetTime: number }>
    this.store = new Map()
    
    // OPTIMIZED: More frequent cleanup for free tier (every 2 minutes)
    // Reduces memory usage of rate limiter
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 2 * 60 * 1000) // 2 minutes (reduced from 5)
  }

  /**
   * Get current count for a key
   */
  getCount(key) {
    const entry = this.store.get(key)
    if (!entry) return 0
    
    const now = Date.now()
    if (now > entry.resetTime) {
      // Expired, remove and return 0
      this.store.delete(key)
      return 0
    }
    
    return entry.count
  }

  /**
   * Increment count for a key
   */
  increment(key) {
    const now = Date.now()
    const entry = this.store.get(key)
    
    if (!entry || now > entry.resetTime) {
      // New entry or expired
      this.store.set(key, {
        count: 1,
        resetTime: now + this.windowMs
      })
      return 1
    }
    
    // Increment existing entry
    entry.count++
    return entry.count
  }

  /**
   * Reset count for a key
   */
  reset(key) {
    this.store.delete(key)
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key) {
    const count = this.getCount(key)
    return Math.max(0, this.max - count)
  }

  /**
   * Get reset time for a key
   */
  getResetTime(key) {
    const entry = this.store.get(key)
    if (!entry) return Date.now() + this.windowMs
    return entry.resetTime
  }

  /**
   * Cleanup expired entries
   */
  cleanup() {
    const now = Date.now()
    let cleaned = 0
    
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      console.log(`[RateLimiter] Cleaned up ${cleaned} expired entries`)
    }
  }

  /**
   * Get middleware function
   */
  middleware() {
    return (req, res, next) => {
      // Skip if skip function returns true
      if (this.skip(req)) {
        return next()
      }

      const key = this.keyGenerator(req)
      const count = this.increment(key)
      const remaining = this.max - count
      const resetTime = this.getResetTime(key)

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.max)
      res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining))
      res.setHeader('X-RateLimit-Reset', new Date(resetTime).toISOString())

      // Check if limit exceeded
      if (count > this.max) {
        res.status(429).json({
          ...this.message,
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
        })
        return
      }

      next()
    }
  }

  /**
   * Destroy the rate limiter (cleanup)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.store.clear()
  }
}

/**
 * Create a rate limiter middleware
 */
function createRateLimiter(options = {}) {
  const limiter = new RateLimiter(options)
  return limiter.middleware()
}

module.exports = {
  RateLimiter,
  createRateLimiter
}

