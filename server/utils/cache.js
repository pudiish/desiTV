/**
 * Cache Interface - Exports the optimized hybrid cache
 * Provides Redis L2 with in-memory L1 fallback
 */

let cache;

try {
  cache = require('./redisCache');
  
  // Check connection after a delay
  setTimeout(() => {
    if (cache.isRedisConnected && cache.isRedisConnected()) {
      console.log('[Cache] ✅ Hybrid mode active (L1 + Redis L2)');
    } else {
      console.log('[Cache] Using L1 (in-memory) only');
    }
  }, 2000);
  
} catch (err) {
  console.warn('[Cache] Redis unavailable, using in-memory only:', err.message);
  
  // Simple in-memory fallback
  class SimpleCache {
    constructor() {
      this.cache = new Map();
    }

    async get(key) {
      const entry = this.cache.get(key);
      if (!entry) return null;
      if (Date.now() > entry.exp) {
        this.cache.delete(key);
        return null;
      }
      return entry.v;
    }

    async set(key, value, ttl = 60) {
      this.cache.set(key, { v: value, exp: Date.now() + ttl * 1000 });
    }

    async delete(key) {
      this.cache.delete(key);
    }

    async deletePattern(pattern) {
      for (const k of this.cache.keys()) {
        if (k.includes(pattern)) this.cache.delete(k);
      }
    }

    async clear() {
      this.cache.clear();
    }

    async getStats() {
      return { size: this.cache.size, type: 'memory-only' };
    }

    isRedisConnected() {
      return false;
    }
  }
  
  cache = new SimpleCache();
}

module.exports = cache;
