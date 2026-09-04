/**
 * ChannelManager.js
 * 
 * ARCHITECTURE: MongoDB → Server Cache → API → Client Cache
 * - Fetches from /api/channels (not static JSON file)
 * - Server handles MongoDB + caching
 * - Client has localStorage cache for offline/instant load
 * 
 * STRUCTURE:
 * - Categories (like "Bollywood", "Music") are playlists
 * - Videos within a category are "channels" you switch between
 */

import { envConfig } from '../../config/environment'

const CHANNELS_CACHE_KEY = 'desitv-channels-cache'
const CHANNELS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes (shorter TTL since WebSocket pushes updates)

class ChannelManager {
  constructor() {
    this.rawChannels = []
    this.categories = []
    this.loaded = false
    this.loadError = null
    this.cachedVersion = null
  }

  /**
   * Get API base URL
   */
  getApiBase() {
    return envConfig.apiBaseUrl
  }

  /**
   * Get cached channels from localStorage
   */
  getCachedChannels() {
    try {
      const cached = localStorage.getItem(CHANNELS_CACHE_KEY)
      if (!cached) return null
      
      const data = JSON.parse(cached)
      const age = Date.now() - data.timestamp
      
      if (age < CHANNELS_CACHE_TTL && data.channels && data.channels.length > 0) {
        return {
          channels: data.channels,
          version: data.version
        }
      }
    } catch {
      // Ignore cache errors
    }
    return null
  }

  /**
   * Cache channels in localStorage
   */
  setCachedChannels(channels, version) {
    try {
      localStorage.setItem(CHANNELS_CACHE_KEY, JSON.stringify({
        channels,
        version,
        timestamp: Date.now()
      }))
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Load channels from API (MongoDB → Server Cache → API)
   */
  async loadChannels() {
    // Return in-memory cache if valid
    if (this.loaded && this.categories.length > 0) {
      return this.categories
    }
    
    if (this.loaded && this.categories.length === 0) {
      console.log('[ChannelManager] Previous load was empty, forcing reload...')
      this.loaded = false
    }

    try {
      let rawChannels = []
      let currentVersion = null

      // Step 1: Try localStorage cache first (instant, works offline)
      const cached = this.getCachedChannels()
      if (cached) {
        rawChannels = cached.channels
        this.cachedVersion = cached.version
        console.log('[ChannelManager] ✓ Loaded from localStorage cache:', rawChannels.length, 'channels')
      }

      // Step 2: Fetch from API (MongoDB → Server Cache → API)
      try {
        const apiBase = this.getApiBase()
        const response = await fetch(`${apiBase}/api/channels?t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'pragma': 'no-cache' }
        })
    
        if (response.ok) {
          const apiData = await response.json()
          
          // Handle wrapped response
          const channelsData = apiData.data || apiData
          currentVersion = channelsData.version || apiData.version || Date.now()
          
          // Extract channels array
          let apiChannels = []
          if (Array.isArray(channelsData)) {
            apiChannels = channelsData
          } else if (channelsData.channels && Array.isArray(channelsData.channels)) {
            apiChannels = channelsData.channels
          } else if (Array.isArray(channelsData.data)) {
            apiChannels = channelsData.data
          }
          
          // If we got channels and version changed, use fresh data
          if (apiChannels.length > 0 && (!cached || currentVersion !== this.cachedVersion)) {
            rawChannels = apiChannels
            console.log('[ChannelManager] ✓ Loaded fresh channels from API:', rawChannels.length, 'channels')
            this.setCachedChannels(rawChannels, currentVersion)
            this.cachedVersion = currentVersion
          } else if (apiChannels.length > 0) {
            console.log('[ChannelManager] ✓ Using cached channels (version unchanged)')
          }
        } else {
          throw new Error(`API returned ${response.status}`)
        }
      } catch (apiError) {
        // API failed - use cached data if available
        if (cached && cached.channels && cached.channels.length > 0) {
          console.warn('[ChannelManager] API failed, using cached data:', apiError.message)
          rawChannels = cached.channels
        } else {
          // Try static JSON as last resort
          try {
            const staticResponse = await fetch('/data/channels.json?t=' + Date.now())
            if (staticResponse.ok) {
              const staticData = await staticResponse.json()
              if (staticData.channels && staticData.channels.length > 0) {
                rawChannels = staticData.channels
                console.log('[ChannelManager] ✓ Fallback: Loaded from static JSON:', rawChannels.length, 'channels')
              }
            }
          } catch {
            console.error('[ChannelManager] All sources failed')
            throw new Error(`Failed to load channels: ${apiError.message}`)
          }
        }
      }
      
      if (rawChannels.length === 0) {
        console.warn('[ChannelManager] No channels found')
        this.loadError = new Error('No channels found')
        this.rawChannels = []
        this.categories = []
        this.loaded = true
        return this.categories
      }
      
      this.rawChannels = rawChannels
      if (currentVersion) {
        this.cachedVersion = currentVersion
      }
      
      // Restructure: Each channel becomes a category/playlist
      const categoryMap = new Map()
      
      rawChannels.forEach(channel => {
        const categoryName = channel.name
        
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, {
            _id: channel._id,
            name: categoryName,
            playlistStartEpoch: channel.playlistStartEpoch || new Date('2020-01-01T00:00:00.000Z'),
            items: []
          })
        }
        
        // Add all videos from this channel to the category
        if (channel.items && Array.isArray(channel.items)) {
          channel.items.forEach(video => {
            categoryMap.get(categoryName).items.push({
              ...video,
              category: categoryName
            })
          })
        }
      })
      
      this.categories = Array.from(categoryMap.values())
      
      this.loaded = true
      this.loadError = null
      console.log(`[ChannelManager] ✓ Loaded ${this.categories.length} categories from ${rawChannels.length} channels`)
      
      return this.categories
    } catch (err) {
      console.error('[ChannelManager] Load failed:', err)
      this.loadError = err
      this.rawChannels = []
      this.categories = []
      this.loaded = true
      throw new Error(`Failed to load channels: ${err.message}`)
    }
  }

  /**
   * Get all categories (playlists)
   */
  getAllCategories() {
    return this.categories
  }

  /**
   * Get all channels (backward compatibility)
   */
  getAllChannels() {
    return this.categories
  }

  /**
   * Get category by ID
   */
  getCategoryById(categoryId) {
    return this.categories.find(cat => cat._id === categoryId)
  }

  /**
   * Get category by name
   */
  getCategoryByName(name) {
    return this.categories.find(cat => cat.name === name)
  }

  /**
   * Get channel by ID (backward compatibility)
   */
  getChannelById(channelId) {
    return this.getCategoryById(channelId)
  }

  /**
   * Get channel by name (backward compatibility)
   */
  getChannelByName(name) {
    return this.getCategoryByName(name)
  }

  /**
   * Filter categories by names
   */
  filterCategories(selectedNames = []) {
    if (selectedNames.length === 0) {
      return this.categories
    }
    return this.categories.filter(cat => selectedNames.includes(cat.name))
  }

  /**
   * Filter channels (backward compatibility)
   */
  filterChannels(selectedNames = []) {
    return this.filterCategories(selectedNames)
  }

  /**
   * Get all category names
   */
  getCategoryNames() {
    return this.categories.map(cat => cat.name)
  }

  /**
   * Get videos for a category
   */
  getVideosForCategory(categoryName) {
    const category = this.getCategoryByName(categoryName)
    return category ? category.items : []
  }

  /**
   * Get current version
   */
  getVersion() {
    return this.cachedVersion
  }

  /**
   * Reload channels (force refresh)
   */
  async reload() {
    this.loaded = false
    try {
      localStorage.removeItem(CHANNELS_CACHE_KEY)
    } catch {
      // Ignore
    }
    return this.loadChannels()
  }
}

// Export singleton
const channelManager = new ChannelManager()
export default channelManager
