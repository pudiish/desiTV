/**
 * Ultra-Optimized Hybrid Cache for Free Tier
 * 
 * L1: In-Memory (instant, local)
 * L2: Redis (shared, compressed)
 * 
 * OPTIMIZED FOR 25MB FREE TIER - MAXIMUM EFFICIENCY
 */

const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Config: Aggressive optimization for free tier
const CONFIG = {
  COMPRESS_THRESHOLD: 256,        // Compress anything > 256 bytes
  MAX_MEMORY_MB: 23,              // Use 23MB of 25MB (leave buffer)
  L1_MAX_ENTRIES: 500,            // Limit L1 entries to save Node memory
  L1_DEFAULT_TTL: 30,             // 30 second L1 TTL (fast refresh)
  L2_DEFAULT_TTL: 120,            // 2 minute L2 TTL (longer persistence)
  CLEANUP_INTERVAL: 60000,        // Cleanup every minute
  EVICT_THRESHOLD: 0.70,          // Start evicting at 70% memory
  EVICT_AGGRESSIVE: 0.85,         // Aggressive evict at 85%
};

const HYBRID_MODE = process.env.REDIS_HYBRID_MODE !== 'false';

let redis = null;
try {
  redis = require('redis');
} catch (err) {
  if (!HYBRID_MODE) throw new Error('Redis module required when hybrid mode disabled');
}

class UltraCache {
  constructor() {
    this.redis = null;
    this.connected = false;
    this.l1 = new Map();
    this.l1Order = [];  // LRU tracking
    this.stats = { l1Hit: 0, l1Miss: 0, l2Hit: 0, l2Miss: 0, sets: 0, compressed: 0, saved: 0 };
    
    // Start cleanup
    this.cleanupTimer = setInterval(() => this._cleanup(), CONFIG.CLEANUP_INTERVAL);
    
    // Initialize Redis
    if (redis) this._initRedis();
  }

  async _initRedis() {
    const url = process.env.REDIS_URL || process.env.REDISCLOUD_URL;
    if (!url) {
      console.log('[Cache] No REDIS_URL, using L1 only');
      return;
    }

    try {
      this.redis = redis.createClient({
        url,
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (r) => r > 5 ? new Error('Max retries') : Math.min(r * 200, 2000),
        },
      });

      this.redis.on('ready', () => {
        this.connected = true;
        console.log('[Cache] ✅ Redis connected - Hybrid L1+L2 active');
        this._configureRedis();
      });

      this.redis.on('error', (e) => {
        this.connected = false;
        console.warn('[Cache] Redis error:', e.message);
      });

      this.redis.on('end', () => {
        this.connected = false;
      });

      await this.redis.connect();
    } catch (err) {
      console.warn('[Cache] Redis init failed:', err.message);
    }
  }

  async _configureRedis() {
    try {
      // Set optimal eviction policy
      await this.redis.configSet('maxmemory-policy', 'allkeys-lru');
      await this.redis.configSet('maxmemory', `${CONFIG.MAX_MEMORY_MB}mb`);
    } catch (e) {
      // Managed Redis may not allow config
    }
  }

  // Fast L1 operations
  _l1Get(key) {
    const entry = this.l1.get(key);
    if (!entry) return null;
    if (Date.now() > entry.exp) {
      this.l1.delete(key);
      return null;
    }
    // Update LRU order
    const idx = this.l1Order.indexOf(key);
    if (idx > -1) {
      this.l1Order.splice(idx, 1);
      this.l1Order.push(key);
    }
    return entry.v;
  }

  _l1Set(key, value, ttl) {
    // Evict if at capacity
    while (this.l1.size >= CONFIG.L1_MAX_ENTRIES && this.l1Order.length > 0) {
      const oldest = this.l1Order.shift();
      this.l1.delete(oldest);
    }
    
    this.l1.set(key, { v: value, exp: Date.now() + ttl * 1000 });
    this.l1Order.push(key);
  }

  _l1Del(key) {
    this.l1.delete(key);
    const idx = this.l1Order.indexOf(key);
    if (idx > -1) this.l1Order.splice(idx, 1);
  }

  // Compression helpers
  async _compress(data) {
    const json = JSON.stringify(data);
    const size = Buffer.byteLength(json);
    
    if (size < CONFIG.COMPRESS_THRESHOLD) {
      return { data: json, compressed: false, size };
    }

    try {
      const compressed = await gzip(json, { level: 6 }); // Level 6 = good balance
      if (compressed.length < size * 0.9) { // Only if 10%+ savings
        this.stats.compressed++;
        this.stats.saved += (size - compressed.length);
        return { data: compressed.toString('base64'), compressed: true, size: compressed.length };
      }
    } catch (e) {}
    
    return { data: json, compressed: false, size };
  }

  async _decompress(data, isCompressed) {
    if (!isCompressed) return JSON.parse(data);
    
    try {
      const buffer = Buffer.from(data, 'base64');
      const decompressed = await gunzip(buffer);
      return JSON.parse(decompressed.toString());
    } catch (e) {
      return JSON.parse(data);
    }
  }

  // Main cache operations
  async get(key) {
    // L1 first (instant)
    const l1Val = this._l1Get(key);
    if (l1Val !== null) {
      this.stats.l1Hit++;
      return l1Val;
    }
    this.stats.l1Miss++;

    // L2 (Redis)
    if (!this.connected || !this.redis) {
      this.stats.l2Miss++;
      return null;
    }

    try {
      const raw = await this.redis.get(key);
      if (!raw) {
        this.stats.l2Miss++;
        return null;
      }

      this.stats.l2Hit++;
      
      // Parse wrapper
      let parsed;
      if (raw.startsWith('{') && raw.includes('"_c":')) {
        const wrapper = JSON.parse(raw);
        parsed = await this._decompress(wrapper.d, wrapper._c);
      } else {
        parsed = JSON.parse(raw);
      }

      // Populate L1 for faster future access
      this._l1Set(key, parsed, CONFIG.L1_DEFAULT_TTL);
      
      return parsed;
    } catch (err) {
      this.stats.l2Miss++;
      return null;
    }
  }

  async set(key, value, ttl = CONFIG.L2_DEFAULT_TTL) {
    this.stats.sets++;

    // Always set L1 (fast local access)
    const l1Ttl = Math.min(ttl, CONFIG.L1_DEFAULT_TTL);
    this._l1Set(key, value, l1Ttl);

    // Set L2 (Redis) if connected
    if (!this.connected || !this.redis) return;

    try {
      // Check memory before write
      await this._checkMemory();

      // Compress and store
      const { data, compressed } = await this._compress(value);
      
      // Wrap with compression flag
      const wrapper = compressed ? JSON.stringify({ _c: true, d: data }) : data;
      
      await this.redis.setEx(key, ttl, wrapper);
    } catch (err) {
      console.warn('[Cache] Set error:', err.message);
    }
  }

  async delete(key) {
    this._l1Del(key);
    if (this.connected && this.redis) {
      try {
        await this.redis.del(key);
      } catch (e) {}
    }
  }

  async deletePattern(pattern) {
    // L1
    for (const k of this.l1.keys()) {
      if (k.includes(pattern)) this._l1Del(k);
    }
    
    // L2
    if (!this.connected || !this.redis) return;
    
    try {
      const keys = [];
      for await (const k of this.redis.scanIterator({ MATCH: `*${pattern}*`, COUNT: 100 })) {
        keys.push(k);
        if (keys.length >= 100) break; // Limit for free tier
      }
      if (keys.length) await this.redis.del(keys);
    } catch (e) {}
  }

  async clear() {
    this.l1.clear();
    this.l1Order = [];
    if (this.connected && this.redis) {
      try {
        await this.redis.flushDb();
      } catch (e) {}
    }
  }

  // Memory management
  async _checkMemory() {
    if (!this.connected || !this.redis) return;

    try {
      const info = await this.redis.info('memory');
      const match = info.match(/used_memory:(\d+)/);
      if (!match) return;

      const used = parseInt(match[1]);
      const max = CONFIG.MAX_MEMORY_MB * 1024 * 1024;
      const usage = used / max;

      if (usage > CONFIG.EVICT_AGGRESSIVE) {
        await this._evict(0.4); // Evict 40%
      } else if (usage > CONFIG.EVICT_THRESHOLD) {
        await this._evict(0.2); // Evict 20%
      }
    } catch (e) {}
  }

  async _evict(percent) {
    if (!this.connected || !this.redis) return;

    try {
      const keys = [];
      for await (const k of this.redis.scanIterator({ COUNT: 100 })) {
        const ttl = await this.redis.ttl(k);
        if (ttl > 0) keys.push({ k, ttl });
        if (keys.length >= 200) break;
      }

      if (!keys.length) return;

      // Sort by TTL, evict shortest first
      keys.sort((a, b) => a.ttl - b.ttl);
      const toEvict = keys.slice(0, Math.ceil(keys.length * percent));
      
      if (toEvict.length) {
        await this.redis.del(toEvict.map(x => x.k));
        console.log(`[Cache] Evicted ${toEvict.length} keys`);
      }
    } catch (e) {}
  }

  _cleanup() {
    // L1 cleanup
    const now = Date.now();
    for (const [k, v] of this.l1.entries()) {
      if (now > v.exp) this._l1Del(k);
    }
  }

  // Stats
  async getStats() {
    const total = this.stats.l1Hit + this.stats.l1Miss + this.stats.l2Hit + this.stats.l2Miss;
    const hits = this.stats.l1Hit + this.stats.l2Hit;
    
    let memInfo = {};
    if (this.connected && this.redis) {
      try {
        const info = await this.redis.info('memory');
        const match = info.match(/used_memory:(\d+)/);
        if (match) {
          const used = parseInt(match[1]);
          memInfo = {
            usedMB: (used / 1024 / 1024).toFixed(2),
            maxMB: CONFIG.MAX_MEMORY_MB,
            usage: ((used / (CONFIG.MAX_MEMORY_MB * 1024 * 1024)) * 100).toFixed(1) + '%',
          };
        }
      } catch (e) {}
    }

    return {
      l1: { hits: this.stats.l1Hit, misses: this.stats.l1Miss, size: this.l1.size },
      l2: { hits: this.stats.l2Hit, misses: this.stats.l2Miss, connected: this.connected },
      total: { hits, misses: total - hits, hitRate: total ? ((hits / total) * 100).toFixed(1) + '%' : '0%' },
      compression: { count: this.stats.compressed, savedKB: (this.stats.saved / 1024).toFixed(1) },
      memory: memInfo,
    };
  }

  isRedisConnected() {
    return this.connected;
  }

  async destroy() {
    clearInterval(this.cleanupTimer);
    this.l1.clear();
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (e) {}
    }
  }
}

// Singleton
const cache = new UltraCache();

process.on('SIGINT', () => cache.destroy());
process.on('SIGTERM', () => cache.destroy());

module.exports = cache;
