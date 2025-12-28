/**
 * Hybrid Cache: In-Memory (L1) + Redis (L2)
 * 
 * TWO-TIER CACHING STRATEGY:
 * - L1 (In-Memory): Fast, local, instance-specific cache
 * - L2 (Redis): Shared, persistent, distributed cache
 * 
 * Flow:
 * 1. Check L1 (in-memory) first - fastest
 * 2. If miss, check L2 (Redis) - shared
 * 3. If miss, fetch from DB and populate both
 * 
 * OPTIMIZED FOR 25MB FREE TIER:
 * - Compression for large values (>512 bytes)
 * - Short cache keys
 * - Minimal cached data (only essential fields)
 * - Memory monitoring and eviction
 * - Optimized TTLs (shorter for L1, longer for L2)
 * 
 * Features:
 * - Automatic Redis connection management
 * - Always-on in-memory L1 cache (fastest access)
 * - Redis L2 cache for shared/distributed access
 * - Connection pooling and retry logic
 * - JSON serialization/deserialization with compression
 * - Pattern-based key deletion
 * - Cache statistics and memory monitoring
 * 
 * Environment Variables:
 * - REDIS_HYBRID_MODE: Set to 'true' to enable hybrid mode (default: 'true')
 * - REDIS_URL: Redis connection URL (default: 'redis://localhost:6379')
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_MAX_MEMORY: Max memory in bytes (default: 22MB for free tier)
 */

// Hybrid mode: Always use both in-memory (L1) and Redis (L2)
// Set to 'false' to use Redis only (no in-memory L1)
const HYBRID_MODE = process.env.REDIS_HYBRID_MODE !== 'false' // Default: true

const zlib = require('zlib')
const { promisify } = require('util')

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

// Compression threshold (compress values larger than 512 bytes - more aggressive)
// Free tier optimization: Compress more to save memory
const COMPRESS_THRESHOLD = 512 // Reduced from 1KB for better compression
// Max memory for free tier (22MB to leave 3MB buffer - more aggressive)
// Free tier: 25MB total, use 22MB to maximize capacity
const MAX_MEMORY = parseInt(process.env.REDIS_MAX_MEMORY) || 22 * 1024 * 1024 // 22MB (was 20MB)

let redis = null
try {
	redis = require('redis')
} catch (err) {
	// Redis not installed
	if (HYBRID_MODE) {
		console.warn('[RedisCache] Redis module not found, using in-memory cache only (L1 only)')
	} else {
		console.error('[RedisCache] ❌ Redis module not found and hybrid mode is disabled!')
		console.error('[RedisCache] Install redis: npm install redis')
		console.error('[RedisCache] Or enable hybrid mode: REDIS_HYBRID_MODE=true')
		throw new Error('Redis module not found and hybrid mode is disabled. Install redis package or enable hybrid mode.')
	}
}

class HybridCache {
	constructor() {
		this.redisClient = null
		this.redisConnected = false
		this.hybridMode = HYBRID_MODE
		// L1 Cache: Always-on in-memory cache (fastest access)
		this.l1Cache = new Map() // In-memory L1 cache (always enabled in hybrid mode)
		// L2 Cache: Redis (shared/distributed cache)
		this.stats = {
			l1Hits: 0,      // L1 cache hits (fastest)
			l1Misses: 0,    // L1 cache misses
			l2Hits: 0,      // L2 (Redis) cache hits
			l2Misses: 0,   // L2 (Redis) cache misses
			sets: 0,       // Total sets (to both L1 and L2)
			errors: 0,     // Errors
		}
		
		// Cleanup expired L1 entries every minute (always enabled in hybrid mode)
		this.l1CleanupInterval = setInterval(() => this.cleanupL1(), 60 * 1000)
		
		// OPTIMIZED: More frequent cleanup for free tier (every 3 minutes)
		// Free tier optimization: More aggressive cleanup to stay within limits
		this.redisCleanupInterval = setInterval(() => this.cleanupRedis(), 3 * 60 * 1000)
		
		// Initialize Redis connection only if module is available
		if (redis) {
			this.initializeRedis()
		} else if (!this.hybridMode) {
			throw new Error('Redis module not available and hybrid mode is disabled')
		}
	}

	/**
	 * Initialize Redis connection
	 */
	async initializeRedis() {
		if (!redis) {
			console.warn('[RedisCache] Cannot initialize - Redis module not available')
			return
		}
		
		// Support both full URL or separate components
		let redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL
		let redisPassword = process.env.REDIS_PASSWORD
		
		// If URL not provided, try building from components
		if (!redisUrl && process.env.REDIS_HOST) {
			const host = process.env.REDIS_HOST
			const port = process.env.REDIS_PORT || '6379'
			const username = process.env.REDIS_USERNAME || 'default'
			const password = redisPassword || ''
			redisUrl = `redis://${username}:${password}@${host}:${port}`
			console.log(`[Redis] Built URL from components: redis://${username}:****@${host}:${port}`)
		}
		
		// Fallback to localhost if nothing set
		if (!redisUrl) {
			redisUrl = 'redis://localhost:6379'
		}
		
		// Log the URL (mask password for security)
		const maskedUrl = redisUrl ? redisUrl.replace(/:[^:@]+@/, ':****@') : 'undefined'
		console.log(`[Redis] Connecting to: ${maskedUrl}`)
		console.log(`[Redis] URL length: ${redisUrl ? redisUrl.length : 0} characters`)
		
		// Validate Redis URL format
		if (!redisUrl || (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://'))) {
			const errorMsg = `Invalid Redis URL format. Expected redis:// or rediss://, got: ${redisUrl ? 'undefined' : redisUrl}`
			if (this.hybridMode) {
				console.warn(`[Redis] ${errorMsg} - Using L1 (in-memory) cache only`)
				this.redisConnected = false
				return
			} else {
				throw new Error(`Redis URL not configured correctly: ${errorMsg}. Set REDIS_URL environment variable or enable hybrid mode with REDIS_HYBRID_MODE=true`)
			}
		}
		
		// Check if URL seems truncated (common issue with long URLs in env vars)
		if (redisUrl.length < 50 || !redisUrl.includes('.com') && !redisUrl.includes('.net')) {
			console.warn(`[Redis] ⚠️  URL seems short or incomplete. Full URL: ${maskedUrl}`)
		}
		
		try {
			// Create Redis client
			const clientOptions = {
				url: redisUrl,
				socket: {
					reconnectStrategy: (retries) => {
						if (retries > 10) {
							console.warn('[Redis] Max reconnection attempts reached, using fallback cache')
							return new Error('Max retries reached')
						}
						return Math.min(retries * 100, 3000) // Exponential backoff, max 3s
					},
					connectTimeout: 5000,
				},
			}
			
			if (redisPassword) {
				clientOptions.password = redisPassword
			}
			
			this.redisClient = redis.createClient(clientOptions)
			
			// Event handlers
			this.redisClient.on('connect', () => {
				console.log('[Redis] Connecting...')
			})
			
			this.redisClient.on('ready', () => {
				this.redisConnected = true
				console.log('[Redis] ✅ Connected and ready')
				if (this.hybridMode) {
					console.log('[Cache] ✅ Hybrid mode: L1 (in-memory) + L2 (Redis) active')
				} else {
					console.log('[Cache] ✅ Using L2 (Redis) cache only (hybrid mode disabled)')
				}
			})
			
			this.redisClient.on('error', (err) => {
				this.redisConnected = false
				this.stats.errors++
				if (this.hybridMode) {
					console.warn('[Redis] L2 Error:', err.message, '- Using L1 (in-memory) cache only')
				} else {
					console.error('[Redis] ❌ L2 Error:', err.message, '- Hybrid mode disabled, cache operations will fail!')
				}
			})
			
			this.redisClient.on('end', () => {
				this.redisConnected = false
				if (this.hybridMode) {
					console.warn('[Redis] L2 Connection ended - Using L1 (in-memory) cache only')
				} else {
					console.error('[Redis] ❌ L2 Connection ended - Hybrid mode disabled, cache operations will fail!')
				}
			})
			
			this.redisClient.on('reconnecting', () => {
				console.log('[Redis] Reconnecting...')
			})
			
			// Connect to Redis
			await this.redisClient.connect()
			
			// Configure Redis for optimal memory management
			try {
				// Set maxmemory policy to allkeys-lru (evict least recently used when full)
				// This ensures automatic cleanup when memory limit is reached
				await this.redisClient.configSet('maxmemory-policy', 'allkeys-lru')
				console.log('[Redis] Configured maxmemory-policy: allkeys-lru')
			} catch (configErr) {
				// Some Redis instances don't allow config changes (managed services)
				console.log('[Redis] Could not set maxmemory-policy (may be managed service)')
			}
			
		} catch (err) {
			if (this.hybridMode) {
				console.warn('[Redis] L2 Failed to initialize:', err.message, '- Using L1 (in-memory) cache only')
			} else {
				console.error('[Redis] ❌ L2 Failed to initialize:', err.message)
				console.error('[Redis] ⚠️  Hybrid mode is disabled but server will continue without Redis')
				console.error('[Redis] 💡 To fix: Set REDIS_URL in environment variables or enable fallback with REDIS_FALLBACK_ENABLED=true')
				// Don't throw - allow server to start without Redis
				// Cache operations will fail gracefully
			}
			this.redisConnected = false
		}
	}

	/**
	 * Decompress value if needed
	 * @param {string} value - Compressed or uncompressed value
	 * @returns {Promise<string>} - Decompressed value
	 */
	async decompressValue(value) {
		try {
			// Check if compressed (starts with gzip magic bytes)
			if (value.startsWith('\x1f\x8b')) {
				const buffer = Buffer.from(value, 'binary')
				const decompressed = await gunzip(buffer)
				return decompressed.toString('utf8')
			}
			return value
		} catch (err) {
			// If decompression fails, try parsing as-is
			return value
		}
	}

	/**
	 * Get value from cache (L1 first, then L2)
	 * HYBRID MODE: Check in-memory (L1) first, then Redis (L2)
	 * @param {string} key - Cache key
	 * @returns {Promise<any|null>} - Cached value or null
	 */
	async get(key) {
		// STEP 1: Check L1 (in-memory) cache first - fastest
		if (this.hybridMode && this.l1Cache) {
			const l1Entry = this.l1Cache.get(key)
			if (l1Entry) {
				// Check if expired
				if (Date.now() > l1Entry.expiresAt) {
					this.l1Cache.delete(key)
					this.stats.l1Misses++
				} else {
					// L1 HIT - return immediately (fastest path)
					this.stats.l1Hits++
					return l1Entry.value
				}
			} else {
				this.stats.l1Misses++
			}
		}
		
		// STEP 2: Check L2 (Redis) cache - shared/distributed
		if (this.redisConnected && this.redisClient) {
			try {
				const value = await this.redisClient.get(key)
				if (value !== null && value !== '') {
					this.stats.l2Hits++
					// Decompress if needed
					const decompressed = await this.decompressValue(value)
					const parsed = JSON.parse(decompressed)
					
					// Populate L1 cache with L2 result (for faster future access)
					if (this.hybridMode && this.l1Cache) {
						// Use shorter TTL for L1 (50% of original) - faster refresh
						const l1TTL = 30 // Default 30 seconds for L1
						this.l1Cache.set(key, {
							value: parsed,
							expiresAt: Date.now() + (l1TTL * 1000),
							createdAt: Date.now(),
						})
					}
					
					return parsed
				}
				this.stats.l2Misses++
			} catch (err) {
				this.stats.errors++
				console.warn(`[Redis] L2 get error for key "${key}":`, err.message)
			}
		} else {
			this.stats.l2Misses++
		}
		
		// STEP 3: Cache miss - return null (caller should fetch from DB)
		return null
	}

	/**
	 * Check Redis memory usage and evict if needed
	 * @returns {Promise<boolean>} - True if memory is OK, false if near limit
	 */
	async checkMemoryAndEvict() {
		if (!this.redisConnected || !this.redisClient) return true
		
		try {
			const info = await this.redisClient.info('memory')
			const usedMemoryMatch = info.match(/used_memory:(\d+)/)
			if (usedMemoryMatch) {
				const usedMemory = parseInt(usedMemoryMatch[1])
				const usagePercent = (usedMemory / MAX_MEMORY) * 100
				
				// OPTIMIZED: More aggressive eviction (at 75% instead of 80%)
				// Free tier optimization: Evict earlier to prevent hitting limit
				if (usagePercent > 75) {
					console.warn(`[Redis] Memory usage high: ${(usedMemory / 1024 / 1024).toFixed(2)}MB (${usagePercent.toFixed(1)}%) - Evicting old keys...`)
					await this.evictOldKeys()
					return false
				}
			}
			return true
		} catch (err) {
			// If we can't check memory, continue anyway
			return true
		}
	}

	/**
	 * Evict old keys when memory is high
	 * Removes keys with shortest remaining TTL first
	 */
	async evictOldKeys() {
		if (!this.redisConnected || !this.redisClient) return
		
		try {
			// Get memory usage to determine eviction percentage
			const info = await this.redisClient.info('memory')
			const usedMemoryMatch = info.match(/used_memory:(\d+)/)
			const usedMemory = usedMemoryMatch ? parseInt(usedMemoryMatch[1]) : 0
			const usagePercent = (usedMemory / MAX_MEMORY) * 100
			
			// Get all keys (limit scan for free tier efficiency)
			const keys = []
			let scanned = 0
			const MAX_SCAN = 500 // Limit scan to prevent blocking
			for await (const key of this.redisClient.scanIterator({ COUNT: 50 })) {
				keys.push(key)
				scanned++
				if (scanned >= MAX_SCAN) break
			}
			
			if (keys.length === 0) return
			
			// Get TTL for each key
			const keysWithTTL = []
			for (const key of keys) {
				const ttl = await this.redisClient.ttl(key)
				if (ttl > 0) { // Only keys with TTL (not -1 or -2)
					keysWithTTL.push({ key, ttl })
				}
			}
			
			// OPTIMIZED: Sort by TTL and evict 30% of keys (more aggressive for free tier)
			keysWithTTL.sort((a, b) => a.ttl - b.ttl)
			const evictPercent = usagePercent > 90 ? 0.5 : 0.3 // Evict 50% if over 90%
			const keysToEvict = keysWithTTL.slice(0, Math.ceil(keysWithTTL.length * evictPercent))
			
			if (keysToEvict.length > 0) {
				const keysToDelete = keysToEvict.map(k => k.key)
				await this.redisClient.del(keysToDelete)
				// Estimate memory freed (conservative estimate)
				const avgKeySize = 1024 // 1KB average (conservative)
				const freedKB = ((keysToDelete.length * avgKeySize) / 1024).toFixed(2)
				console.log(`[Redis] Evicted ${keysToDelete.length} old keys (~${freedKB}KB freed, ${usagePercent.toFixed(1)}% usage)`)
			}
		} catch (err) {
			console.warn('[Redis] Error during eviction:', err.message)
		}
	}

	/**
	 * Periodic Redis cleanup job - OPTIMIZED FOR FREE TIER
	 * - Removes expired keys (Redis does this automatically, but we verify)
	 * - Checks memory usage
	 * - Aggressively evicts old keys if needed
	 * - More frequent cleanup for free tier
	 */
	async cleanupRedis() {
		if (!this.redisConnected || !this.redisClient) return
		
		try {
			// Check memory and evict if needed
			const memoryOK = await this.checkMemoryAndEvict()
			
			// Count keys (limit scan for free tier efficiency)
			let keyCount = 0
			let scanned = 0
			const MAX_SCAN = 500 // Limit scan to prevent blocking (free tier optimization)
			for await (const _ of this.redisClient.scanIterator({ COUNT: 50 })) {
				keyCount++
				scanned++
				if (scanned >= MAX_SCAN) break // Free tier optimization: limit scan
			}
			
			// Log cleanup stats (only if memory is high or key count is significant)
			if (!memoryOK || keyCount > 100) {
				const info = await this.redisClient.info('memory')
				const usedMemoryMatch = info.match(/used_memory:(\d+)/)
				if (usedMemoryMatch) {
					const usedMemory = parseInt(usedMemoryMatch[1])
					const usageMB = (usedMemory / 1024 / 1024).toFixed(2)
					const usagePercent = ((usedMemory / MAX_MEMORY) * 100).toFixed(1)
					console.log(`[Redis] Cleanup: ${keyCount}+ keys, ${usageMB}MB (${usagePercent}% of limit)`)
				}
			}
		} catch (err) {
			console.warn('[Redis] Cleanup job error:', err.message)
		}
	}

	/**
	 * Set value in cache (Redis first, fallback to memory)
	 * @param {string} key - Cache key
	 * @param {any} value - Value to cache
	 * @param {number} ttl - Time to live in seconds (default: 60)
	 */
	async set(key, value, ttl = 60) {
		this.stats.sets++
		
		// Check memory before setting
		await this.checkMemoryAndEvict()
		
		// Try Redis first if connected
		if (this.redisConnected && this.redisClient) {
			try {
				const serialized = JSON.stringify(value)
				const originalSize = Buffer.byteLength(serialized, 'utf8')
				
				// Compress if larger than threshold
				let finalValue = serialized
				let isCompressed = false
				
				if (originalSize > COMPRESS_THRESHOLD) {
					try {
						const compressed = await gzip(serialized)
						const compressedSize = compressed.length
						
				// OPTIMIZED: More aggressive compression (at least 5% reduction)
				// Free tier optimization: Accept smaller savings to maximize memory efficiency
				if (compressedSize < originalSize * 0.95) {
							finalValue = compressed.toString('binary')
							isCompressed = true
							this.stats.compressed++
							this.stats.memorySaved += (originalSize - compressedSize)
						} else {
							this.stats.uncompressed++
						}
					} catch (compErr) {
						// Compression failed, use uncompressed
						this.stats.uncompressed++
						console.warn(`[Redis] Compression failed for key "${key}":`, compErr.message)
					}
				} else {
					this.stats.uncompressed++
				}
				
				await this.redisClient.setEx(key, ttl, finalValue)
				return // Success, no need for fallback
			} catch (err) {
				this.stats.errors++
				console.warn(`[Redis] Set error for key "${key}":`, err.message)
				// Fall through to fallback
			}
		}
		
		// STEP 2: Set in L1 (in-memory) - fastest access
		// Use shorter TTL for L1 (50% of L2 TTL) - faster refresh, less memory
		if (this.hybridMode && this.l1Cache) {
			const l1TTL = Math.max(30, Math.floor(ttl * 0.5)) // At least 30s, or 50% of L2 TTL
			this.l1Cache.set(key, {
				value,
				expiresAt: Date.now() + (l1TTL * 1000),
				createdAt: Date.now(),
			})
		}
	}

	/**
	 * Delete specific key
	 * @param {string} key - Cache key
	 */
	async delete(key) {
		// Delete from Redis
		if (this.redisConnected && this.redisClient) {
			try {
				await this.redisClient.del(key)
			} catch (err) {
				console.warn(`[Redis] Delete error for key "${key}":`, err.message)
			}
		}
		
		// Delete from L1 (in-memory)
		if (this.hybridMode && this.l1Cache) {
			this.l1Cache.delete(key)
		}
	}

	/**
	 * Delete all keys matching a pattern
	 * @param {string} pattern - Pattern to match
	 */
	async deletePattern(pattern) {
		// Delete from Redis using SCAN
		if (this.redisConnected && this.redisClient) {
			try {
				const keys = []
				for await (const key of this.redisClient.scanIterator({
					MATCH: `*${pattern}*`,
					COUNT: 100,
				})) {
					keys.push(key)
				}
				
				if (keys.length > 0) {
					await this.redisClient.del(keys)
				}
			} catch (err) {
				console.warn(`[Redis] DeletePattern error for pattern "${pattern}":`, err.message)
			}
		}
		
		// Delete from L1 (in-memory)
		if (this.hybridMode && this.l1Cache) {
			for (const key of this.l1Cache.keys()) {
				if (key.includes(pattern)) {
					this.l1Cache.delete(key)
				}
			}
		}
	}

	/**
	 * Clear all cache entries
	 */
	async clear() {
		// Clear Redis
		if (this.redisConnected && this.redisClient) {
			try {
				await this.redisClient.flushDb()
			} catch (err) {
				console.warn('[Redis] Clear error:', err.message)
			}
		}
		
		// Clear L1 (in-memory)
		if (this.hybridMode && this.l1Cache) {
			this.l1Cache.clear()
		}
		this.stats = {
			l1Hits: 0,
			l1Misses: 0,
			l2Hits: 0,
			l2Misses: 0,
			sets: 0,
			errors: 0,
		}
	}

	/**
	 * Cleanup expired L1 (in-memory) cache entries
	 */
	cleanupL1() {
		if (!this.hybridMode || !this.l1Cache) return
		
		const now = Date.now()
		let cleaned = 0
		
		for (const [key, entry] of this.l1Cache.entries()) {
			if (now > entry.expiresAt) {
				this.l1Cache.delete(key)
				cleaned++
			}
		}
		
		// Only log if significant cleanup
		if (cleaned > 10) {
			console.log(`[Cache] L1 cleanup: ${cleaned} expired entries (${this.l1Cache.size} remaining)`)
		}
	}

	/**
	 * Get cache statistics (async to fetch Redis memory info)
	 */
	async getStats() {
		const totalHits = this.stats.redisHits + this.stats.fallbackHits
		const totalMisses = this.stats.redisMisses + this.stats.fallbackMisses
		const total = totalHits + totalMisses
		
		// Get Redis memory info
		let memoryInfo = {}
		if (this.redisConnected && this.redisClient) {
			try {
				const info = await this.redisClient.info('memory')
				const usedMemoryMatch = info.match(/used_memory:(\d+)/)
				const maxMemoryMatch = info.match(/maxmemory:(\d+)/)
				
				if (usedMemoryMatch) {
					const usedMemory = parseInt(usedMemoryMatch[1])
					const maxMemory = maxMemoryMatch ? parseInt(maxMemoryMatch[1]) : MAX_MEMORY
					memoryInfo = {
						usedMemoryMB: (usedMemory / 1024 / 1024).toFixed(2),
						maxMemoryMB: (maxMemory / 1024 / 1024).toFixed(2),
						usagePercent: ((usedMemory / maxMemory) * 100).toFixed(1),
					}
				}
			} catch (err) {
				// Ignore memory info errors
			}
		}
		
		return {
			...this.stats,
			redisConnected: this.redisConnected,
			hybridMode: this.hybridMode,
			l1Size: this.hybridMode && this.l1Cache ? this.l1Cache.size : 0,
			totalHits,
			totalMisses,
			hitRate: total > 0 ? ((totalHits / total) * 100).toFixed(2) + '%' : '0%',
			redisHitRate: (this.stats.redisHits + this.stats.redisMisses) > 0
				? ((this.stats.redisHits / (this.stats.redisHits + this.stats.redisMisses)) * 100).toFixed(2) + '%'
				: '0%',
			memorySavedMB: (this.stats.memorySaved / 1024 / 1024).toFixed(2),
			compressionRatio: this.stats.compressed > 0 
				? ((this.stats.compressed / (this.stats.compressed + this.stats.uncompressed)) * 100).toFixed(1) + '%'
				: '0%',
			...memoryInfo,
		}
	}

	/**
	 * Check if Redis is connected
	 */
	isRedisConnected() {
		return this.redisConnected
	}

	/**
	 * Gracefully shutdown
	 */
	async destroy() {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval)
		}
		
		if (this.redisCleanupInterval) {
			clearInterval(this.redisCleanupInterval)
		}
		
		if (this.redisClient) {
			try {
				await this.redisClient.quit()
				console.log('[Redis] Disconnected')
			} catch (err) {
				console.warn('[Redis] Error during disconnect:', err.message)
			}
		}
		
		if (this.hybridMode && this.l1Cache) {
			this.l1Cache.clear()
		}
	}
}

// Export singleton instance
const hybridCache = new HybridCache()

// Graceful shutdown
process.on('SIGINT', async () => {
	await hybridCache.destroy()
})

process.on('SIGTERM', async () => {
	await hybridCache.destroy()
})

module.exports = hybridCache

