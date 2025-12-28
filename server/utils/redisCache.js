/**
 * Redis Cache with Optional In-Memory Fallback
 * 
 * OPTIMIZED FOR 25MB FREE TIER:
 * - Compression for large values (>1KB)
 * - Short cache keys
 * - Minimal cached data (only essential fields)
 * - Memory monitoring and eviction
 * - Reduced TTLs
 * 
 * Features:
 * - Automatic Redis connection management
 * - Optional graceful fallback to in-memory cache (controlled by REDIS_FALLBACK_ENABLED)
 * - Connection pooling and retry logic
 * - JSON serialization/deserialization with compression
 * - Pattern-based key deletion
 * - Cache statistics and memory monitoring
 * 
 * Environment Variables:
 * - REDIS_FALLBACK_ENABLED: Set to 'true' to enable in-memory fallback (default: 'false')
 * - REDIS_URL: Redis connection URL (default: 'redis://localhost:6379')
 * - REDIS_PASSWORD: Redis password (optional)
 * - REDIS_MAX_MEMORY: Max memory in bytes (default: 20MB for free tier safety)
 */

// Check if fallback is enabled (default: false - Redis only)
const FALLBACK_ENABLED = process.env.REDIS_FALLBACK_ENABLED === 'true'

const zlib = require('zlib')
const { promisify } = require('util')

const gzip = promisify(zlib.gzip)
const gunzip = promisify(zlib.gunzip)

// Compression threshold (compress values larger than 1KB)
const COMPRESS_THRESHOLD = 1024
// Max memory for free tier (20MB to leave 5MB buffer)
const MAX_MEMORY = parseInt(process.env.REDIS_MAX_MEMORY) || 20 * 1024 * 1024 // 20MB

let redis = null
try {
	redis = require('redis')
} catch (err) {
	// Redis not installed
	if (FALLBACK_ENABLED) {
		console.warn('[RedisCache] Redis module not found, using in-memory cache only')
	} else {
		console.error('[RedisCache] ❌ Redis module not found and fallback is disabled!')
		console.error('[RedisCache] Install redis: npm install redis')
		console.error('[RedisCache] Or enable fallback: REDIS_FALLBACK_ENABLED=true')
		throw new Error('Redis module not found and fallback is disabled. Install redis package or enable fallback.')
	}
}

class HybridCache {
	constructor() {
		this.redisClient = null
		this.redisConnected = false
		this.fallbackEnabled = FALLBACK_ENABLED
		this.fallbackCache = FALLBACK_ENABLED ? new Map() : null // In-memory fallback (only if enabled)
		this.stats = {
			redisHits: 0,
			redisMisses: 0,
			fallbackHits: 0,
			fallbackMisses: 0,
			sets: 0,
			errors: 0,
		}
		
		// Cleanup expired fallback entries every minute (only if fallback enabled)
		if (this.fallbackEnabled) {
			this.cleanupInterval = setInterval(() => this.cleanupFallback(), 60 * 1000)
		}
		
		// Redis cleanup job - runs every 5 minutes
		// Cleans up expired keys and monitors memory
		this.redisCleanupInterval = setInterval(() => this.cleanupRedis(), 5 * 60 * 1000)
		
		// Initialize Redis connection only if module is available
		if (redis) {
			this.initializeRedis()
		} else if (!this.fallbackEnabled) {
			throw new Error('Redis module not available and fallback is disabled')
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
			if (this.fallbackEnabled) {
				console.warn(`[Redis] ${errorMsg} - Using fallback cache`)
				this.redisConnected = false
				return
			} else {
				throw new Error(`Redis URL not configured correctly: ${errorMsg}. Set REDIS_URL environment variable or enable fallback with REDIS_FALLBACK_ENABLED=true`)
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
				if (this.fallbackEnabled) {
					console.log('[Cache] ✅ Now using Redis cache with in-memory fallback')
				} else {
					console.log('[Cache] ✅ Now using Redis cache only (fallback disabled)')
				}
			})
			
			this.redisClient.on('error', (err) => {
				this.redisConnected = false
				this.stats.errors++
				if (this.fallbackEnabled) {
					console.warn('[Redis] Error:', err.message, '- Using fallback cache')
				} else {
					console.error('[Redis] ❌ Error:', err.message, '- Fallback disabled, cache operations will fail!')
				}
			})
			
			this.redisClient.on('end', () => {
				this.redisConnected = false
				if (this.fallbackEnabled) {
					console.warn('[Redis] Connection ended - Using fallback cache')
				} else {
					console.error('[Redis] ❌ Connection ended - Fallback disabled, cache operations will fail!')
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
			if (this.fallbackEnabled) {
				console.warn('[Redis] Failed to initialize:', err.message, '- Using fallback cache')
			} else {
				console.error('[Redis] ❌ Failed to initialize:', err.message)
				console.error('[Redis] ⚠️  Fallback is disabled but server will continue without Redis')
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
	 * Get value from cache (Redis first, fallback to memory)
	 * @param {string} key - Cache key
	 * @returns {Promise<any|null>} - Cached value or null
	 */
	async get(key) {
		// Try Redis first if connected
		if (this.redisConnected && this.redisClient) {
			try {
				const value = await this.redisClient.get(key)
				if (value !== null && value !== '') {
					this.stats.redisHits++
					// Decompress if needed
					const decompressed = await this.decompressValue(value)
					return JSON.parse(decompressed)
				}
				this.stats.redisMisses++
			} catch (err) {
				this.stats.errors++
				console.warn(`[Redis] Get error for key "${key}":`, err.message)
				// Fall through to fallback
			}
		}
		
		// Fallback to in-memory cache (only if enabled)
		if (!this.fallbackEnabled || !this.fallbackCache) {
			this.stats.fallbackMisses++
			return null
		}
		
		const entry = this.fallbackCache.get(key)
		if (!entry) {
			this.stats.fallbackMisses++
			return null
		}
		
		// Check if expired
		if (Date.now() > entry.expiresAt) {
			this.fallbackCache.delete(key)
			this.stats.fallbackMisses++
			return null
		}
		
		this.stats.fallbackHits++
		return entry.value
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
				
				// If over 80% of max memory, evict old keys
				if (usagePercent > 80) {
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
			// Get all keys
			const keys = []
			for await (const key of this.redisClient.scanIterator({ COUNT: 100 })) {
				keys.push(key)
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
			
			// Sort by TTL (shortest first) and evict 20% of keys
			keysWithTTL.sort((a, b) => a.ttl - b.ttl)
			const keysToEvict = keysWithTTL.slice(0, Math.ceil(keysWithTTL.length * 0.2))
			
			if (keysToEvict.length > 0) {
				const keysToDelete = keysToEvict.map(k => k.key)
				await this.redisClient.del(keysToDelete)
				console.log(`[Redis] Evicted ${keysToDelete.length} old keys to free memory`)
			}
		} catch (err) {
			console.warn('[Redis] Error during eviction:', err.message)
		}
	}

	/**
	 * Periodic Redis cleanup job
	 * - Removes expired keys (Redis does this automatically, but we verify)
	 * - Checks memory usage
	 * - Evicts old keys if needed
	 */
	async cleanupRedis() {
		if (!this.redisConnected || !this.redisClient) return
		
		try {
			// Check memory and evict if needed
			await this.checkMemoryAndEvict()
			
			// Count keys
			let keyCount = 0
			for await (const _ of this.redisClient.scanIterator({ COUNT: 100 })) {
				keyCount++
			}
			
			// Log cleanup stats
			if (keyCount > 0) {
				const info = await this.redisClient.info('memory')
				const usedMemoryMatch = info.match(/used_memory:(\d+)/)
				if (usedMemoryMatch) {
					const usedMemory = parseInt(usedMemoryMatch[1])
					const usageMB = (usedMemory / 1024 / 1024).toFixed(2)
					const usagePercent = ((usedMemory / MAX_MEMORY) * 100).toFixed(1)
					console.log(`[Redis] Cleanup: ${keyCount} keys, ${usageMB}MB (${usagePercent}% of limit)`)
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
						
						// Only use compression if it actually saves space (at least 10% reduction)
						if (compressedSize < originalSize * 0.9) {
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
		
		// Fallback to in-memory cache (only if enabled)
		if (this.fallbackEnabled && this.fallbackCache) {
			this.fallbackCache.set(key, {
				value,
				expiresAt: Date.now() + (ttl * 1000),
				createdAt: Date.now(),
			})
		} else if (!this.redisConnected) {
			// If Redis is not connected and fallback is disabled, this is an error
			throw new Error('Cannot set cache: Redis not connected and fallback is disabled')
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
		
		// Delete from fallback (only if enabled)
		if (this.fallbackEnabled && this.fallbackCache) {
			this.fallbackCache.delete(key)
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
		
		// Delete from fallback (only if enabled)
		if (this.fallbackEnabled && this.fallbackCache) {
			for (const key of this.fallbackCache.keys()) {
				if (key.includes(pattern)) {
					this.fallbackCache.delete(key)
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
		
		// Clear fallback (only if enabled)
		if (this.fallbackEnabled && this.fallbackCache) {
			this.fallbackCache.clear()
		}
		this.stats = {
			redisHits: 0,
			redisMisses: 0,
			fallbackHits: 0,
			fallbackMisses: 0,
			sets: 0,
			errors: 0,
		}
	}

	/**
	 * Clean up expired fallback entries
	 */
	cleanupFallback() {
		if (!this.fallbackEnabled || !this.fallbackCache) {
			return
		}
		const now = Date.now()
		for (const [key, entry] of this.fallbackCache.entries()) {
			if (now > entry.expiresAt) {
				this.fallbackCache.delete(key)
			}
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
			fallbackEnabled: this.fallbackEnabled,
			fallbackSize: this.fallbackEnabled && this.fallbackCache ? this.fallbackCache.size : 0,
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
		
		if (this.fallbackEnabled && this.fallbackCache) {
			this.fallbackCache.clear()
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

