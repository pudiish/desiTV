/**
 * Tests for Rate Limiter Middleware
 */

const { RateLimiter, createRateLimiter } = require('./rateLimiter')

describe('RateLimiter', () => {
  let limiter

  beforeEach(() => {
    limiter = new RateLimiter({
      windowMs: 1000, // 1 second for testing
      max: 5 // 5 requests max
    })
  })

  afterEach(() => {
    if (limiter) {
      limiter.destroy()
      limiter = null
    }
    // Clear any remaining timers
    jest.clearAllTimers()
  })

  describe('increment', () => {
    it('should increment count for a key', () => {
      const count = limiter.increment('test-key')
      expect(count).toBe(1)

      const count2 = limiter.increment('test-key')
      expect(count2).toBe(2)
    })

    it('should reset after window expires', (done) => {
      jest.useFakeTimers()
      limiter.increment('test-key')
      limiter.increment('test-key')

      jest.advanceTimersByTime(1100)
      
      // After window expires, count should reset
      const count = limiter.getCount('test-key')
      expect(count).toBe(0)
      
      jest.useRealTimers()
      done()
    })
  })

  describe('getCount', () => {
    it('should return 0 for non-existent key', () => {
      expect(limiter.getCount('non-existent')).toBe(0)
    })

    it('should return current count', () => {
      limiter.increment('test-key')
      limiter.increment('test-key')
      expect(limiter.getCount('test-key')).toBe(2)
    })
  })

  describe('getRemaining', () => {
    it('should return max when no requests', () => {
      expect(limiter.getRemaining('test-key')).toBe(5)
    })

    it('should decrease as requests increase', () => {
      limiter.increment('test-key')
      expect(limiter.getRemaining('test-key')).toBe(4)

      limiter.increment('test-key')
      expect(limiter.getRemaining('test-key')).toBe(3)
    })
  })

  describe('middleware', () => {
    it('should allow requests under limit', () => {
      const req = { ip: '127.0.0.1', path: '/test' }
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      }
      const next = jest.fn()

      const middleware = limiter.middleware()
      middleware(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('should block requests over limit', () => {
      const req = { ip: '127.0.0.1', path: '/test' }
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      }
      const next = jest.fn()

      const middleware = limiter.middleware()

      // Make 6 requests (over limit of 5)
      for (let i = 0; i < 6; i++) {
        middleware(req, res, next)
      }

      // Last request should be blocked
      expect(res.status).toHaveBeenCalledWith(429)
      expect(res.json).toHaveBeenCalled()
      expect(next).not.toHaveBeenCalledTimes(6)
    })

    it('should set rate limit headers', () => {
      const req = { ip: '127.0.0.1', path: '/test' }
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      }
      const next = jest.fn()

      const middleware = limiter.middleware()
      middleware(req, res, next)

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5)
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number))
    })

    it('should skip when skip function returns true', () => {
      const customLimiter = new RateLimiter({
        windowMs: 1000,
        max: 5,
        skip: (req) => req.path === '/health'
      })

      const req = { ip: '127.0.0.1', path: '/health' }
      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      }
      const next = jest.fn()

      const middleware = customLimiter.middleware()
      
      // Make 10 requests (over limit)
      for (let i = 0; i < 10; i++) {
        middleware(req, res, next)
      }

      // Should not be blocked because skip returns true
      expect(res.status).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledTimes(10)

      customLimiter.destroy()
    })
  })

  describe('cleanup', () => {
    it('should remove expired entries', (done) => {
      limiter.increment('key1')
      limiter.increment('key2')

      setTimeout(() => {
        limiter.cleanup()
        expect(limiter.getCount('key1')).toBe(0)
        expect(limiter.getCount('key2')).toBe(0)
        done()
      }, 1100)
    })
  })
})

describe('createRateLimiter', () => {
  it('should create a middleware function', () => {
    const middleware = createRateLimiter({
      windowMs: 1000,
      max: 5
    })

    expect(typeof middleware).toBe('function')
  })
})

