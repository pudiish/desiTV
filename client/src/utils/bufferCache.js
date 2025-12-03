/**
 * Buffer Caching Mechanism POC
 * Caches video metadata and playback information to improve performance
 * and reduce server requests
 */

class BufferCache {
  constructor(maxSize = 50, ttl = 3600000) { // 50 items, 1 hour TTL
    this.cache = new Map()
    this.maxSize = maxSize
    this.ttl = ttl // Time to live in milliseconds
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    }
  }

  /**
   * Generate cache key from channel and video info
   */
  generateKey(channelId, videoId) {
    return `${channelId}:${videoId}`
  }

  /**
   * Set item in cache with timestamp
   */
  set(channelId, videoId, data) {
    const key = this.generateKey(channelId, videoId)
    
    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
      this.stats.evictions++
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      accessCount: 0
    })

    console.log(`[BufferCache] Cached: ${key}`)
  }

  /**
   * Get item from cache if not expired
   */
  get(channelId, videoId) {
    const key = this.generateKey(channelId, videoId)
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      console.log(`[BufferCache] MISS: ${key}`)
      return null
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      this.stats.misses++
      console.log(`[BufferCache] EXPIRED: ${key}`)
      return null
    }

    // Update access info
    entry.accessCount++
    this.stats.hits++
    console.log(`[BufferCache] HIT: ${key} (access #${entry.accessCount})`)
    
    return entry.data
  }

  /**
   * Cache video metadata
   */
  cacheVideoMetadata(channelId, videoId, metadata) {
    this.set(channelId, videoId, {
      type: 'metadata',
      title: metadata.title,
      duration: metadata.duration,
      youtubeId: metadata.youtubeId,
      tags: metadata.tags || [],
      cachedAt: new Date().toISOString()
    })
  }

  /**
   * Get cached video metadata
   */
  getVideoMetadata(channelId, videoId) {
    const cached = this.get(channelId, videoId)
    return cached?.type === 'metadata' ? cached : null
  }

  /**
   * Cache playback position
   */
  cachePlaybackPosition(channelId, videoId, position) {
    const existing = this.cache.get(this.generateKey(channelId, videoId))
    const data = existing?.data || { type: 'playback' }
    
    this.set(channelId, videoId, {
      ...data,
      type: 'playback',
      position,
      positionUpdatedAt: Date.now()
    })
  }

  /**
   * Get cached playback position
   */
  getPlaybackPosition(channelId, videoId) {
    const cached = this.get(channelId, videoId)
    return cached?.position ?? null
  }

  /**
   * Cache playlist for a channel
   */
  cachePlaylist(channelId, playlist) {
    this.set(channelId, 'playlist', {
      type: 'playlist',
      items: playlist,
      itemCount: playlist.length,
      cachedAt: new Date().toISOString()
    })
  }

  /**
   * Get cached playlist
   */
  getPlaylist(channelId) {
    const cached = this.get(channelId, 'playlist')
    return cached?.type === 'playlist' ? cached.items : null
  }

  /**
   * Clear specific entry
   */
  clear(channelId, videoId) {
    const key = this.generateKey(channelId, videoId)
    if (this.cache.has(key)) {
      this.cache.delete(key)
      console.log(`[BufferCache] Cleared: ${key}`)
    }
  }

  /**
   * Clear all cache
   */
  clearAll() {
    const size = this.cache.size
    this.cache.clear()
    console.log(`[BufferCache] Cleared all (${size} entries)`)
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses
    const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : 0
    
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`,
      memoryEstimate: `${(this.cache.size * 0.5).toFixed(2)}KB` // Rough estimate
    }
  }

  /**
   * Print cache statistics to console
   */
  printStats() {
    const stats = this.getStats()
    console.log('[BufferCache Statistics]')
    console.log(`  Cache Size: ${stats.size}/${stats.maxSize}`)
    console.log(`  Hits: ${stats.hits}`)
    console.log(`  Misses: ${stats.misses}`)
    console.log(`  Hit Rate: ${stats.hitRate}`)
    console.log(`  Evictions: ${stats.evictions}`)
    console.log(`  Est. Memory: ${stats.memoryEstimate}`)
  }

  /**
   * Warm up cache with initial data
   */
  warmUp(channelId, videos) {
    console.log(`[BufferCache] Warming up cache with ${videos.length} videos...`)
    videos.forEach((video, idx) => {
      this.cacheVideoMetadata(channelId, video._id || video.youtubeId, video)
    })
  }
}

// Create singleton instance
const bufferCache = new BufferCache()

export default bufferCache
