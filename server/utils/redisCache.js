/**
 * Redis Cache with Optional In-Memory Fallback
 * 
 * Provides high-performance distributed caching with optional fallback
 * to in-memory cache if Redis is unavailable
 * 
 * Features:
 * - Automatic Redis connection management
 * - Optional graceful fallback to in-memory cache (controlled by REDIS_FALLBACK_ENABLED)
 * - Connection pooling and retry logic
 * - JSON serialization/deserialization
 * - Pattern-based key deletion
 * - Cache statistics
 * 
 * Environment Variables:
 * - REDIS_FALLBACK_ENABLED: Set to 'true' to enable in-memory fallback (default: 'false')
 * - REDIS_URL: Redis connection URL (default: 'redis://localhost:6379')
 * - REDIS_PASSWORD: Redis password (optional)
 */

// Check if fallback is enabled (default: false - Redis only)
const FALLBACK_ENABLED = process.env.REDIS_FALLBACK_ENABLED === 'true'

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
		
		const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://localhost:6379'
		const redisPassword = process.env.REDIS_PASSWORD
		
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
	 * Get value from cache (Redis first, fallback to memory)
	 * @param {string} key - Cache key
	 * @returns {Promise<any|null>} - Cached value or null
	 */
	async get(key) {
		// Try Redis first if connected
		if (this.redisConnected && this.redisClient) {
			try {
				const value = await this.redisClient.get(key)
				if (value !== null) {
					this.stats.redisHits++
					return JSON.parse(value)
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
	 * Set value in cache (Redis first, fallback to memory)
	 * @param {string} key - Cache key
	 * @param {any} value - Value to cache
	 * @param {number} ttl - Time to live in seconds (default: 60)
	 */
	async set(key, value, ttl = 60) {
		this.stats.sets++
		
		// Try Redis first if connected
		if (this.redisConnected && this.redisClient) {
			try {
				const serialized = JSON.stringify(value)
				await this.redisClient.setEx(key, ttl, serialized)
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
	 * Get cache statistics
	 */
	getStats() {
		const totalHits = this.stats.redisHits + this.stats.fallbackHits
		const totalMisses = this.stats.redisMisses + this.stats.fallbackMisses
		const total = totalHits + totalMisses
		
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

