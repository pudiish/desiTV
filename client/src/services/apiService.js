/**
 * API Service - High-level API calls wrapper
 * Provides clean interface to backend APIs with error handling
 * All API calls should go through this service
 * 
 * Now uses apiClientV2 (unified, cached, reliable)
 */

import apiClientV2 from './apiClientV2'
import { API_ENDPOINTS } from '../config/constants'
import logger from '../utils/logger.js'

export class APIService {
  constructor(client = apiClientV2) {
    this.client = client
  }

  // ===== BROADCAST STATE & SESSION =====
  // REMOVED: These are now handled client-side via BroadcastStateManager and SessionManager
  // No server API calls needed

  // ===== CHANNELS =====

  /**
   * Get all channels
   * Prefers channels.json (fast, no server), falls back to API if JSON fails
   */
  async getChannels() {
    // Try JSON first (fast, no server dependency, works offline)
    try {
      const staticResponse = await fetch('/data/channels.json?t=' + Date.now())
      
      if (staticResponse.ok) {
        const staticData = await staticResponse.json()
        const channels = staticData.channels || staticData || []
        
        // If the JSON is directly an array, use it
        if (Array.isArray(staticData) && !staticData.channels) {
          logger.info('[APIService] ✓ Loaded channels from JSON:', staticData.length, 'channels')
          return staticData
        }
        
        logger.info('[APIService] ✓ Loaded channels from JSON:', channels.length, 'channels')
        return channels
      }
    } catch (jsonError) {
      logger.warn('[APIService] JSON load failed, trying API fallback:', jsonError.message)
    }
    
    // Fallback to API if JSON fails (for backward compatibility)
    try {
      return await this.client.get(API_ENDPOINTS.CHANNELS)
    } catch (error) {
      logger.error('[APIService] ✗ Both JSON and API failed:', error)
      throw new Error(`Failed to load channels: ${error.message}`)
    }
  }

  /**
   * Get single channel
   */
  async getChannel(channelId) {
    try {
      return await this.client.get(
        API_ENDPOINTS.CHANNEL.replace(':id', channelId)
      )
    } catch (error) {
      logger.error(`[APIService] Error fetching channel ${channelId}:`, error)
      throw error
    }
  }

  /**
   * Create new channel
   */
  async createChannel(data) {
    try {
      return await this.client.post(API_ENDPOINTS.CHANNELS, data)
    } catch (error) {
      logger.error('[APIService] Error creating channel:', error)
      throw error
    }
  }

  /**
   * Update channel
   */
  async updateChannel(channelId, data) {
    try {
      return await this.client.put(
        API_ENDPOINTS.CHANNEL.replace(':id', channelId),
        data
      )
    } catch (error) {
      logger.error(`[APIService] Error updating channel ${channelId}:`, error)
      throw error
    }
  }

  /**
   * Delete channel
   */
  async deleteChannel(channelId) {
    try {
      return await this.client.delete(
        API_ENDPOINTS.CHANNEL.replace(':id', channelId)
      )
    } catch (error) {
      logger.error(`[APIService] Error deleting channel ${channelId}:`, error)
      throw error
    }
  }

  // ===== CATEGORIES =====

  /**
   * Get all categories - REMOVED
   * Categories are derived client-side from channels in ChannelManager
   * Use ChannelManager.getAllCategories() instead
   */
  async getCategories() {
    logger.warn('[APIService] getCategories() is deprecated - use ChannelManager.getAllCategories() instead')
    return []
  }

  // ===== AUTH =====

  /**
   * Login user
   */
  async login(username, password) {
    try {
      return await this.client.post(API_ENDPOINTS.AUTH_LOGIN, { username, password })
    } catch (error) {
      logger.error('[APIService] Error during login:', error)
      throw error
    }
  }

  /**
   * Register user
   */
  async register(username, password) {
    try {
      return await this.client.post(API_ENDPOINTS.AUTH_REGISTER, { username, password })
    } catch (error) {
      logger.error('[APIService] Error during registration:', error)
      throw error
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      return await this.client.post(API_ENDPOINTS.AUTH_LOGOUT)
    } catch (error) {
      logger.error('[APIService] Error during logout:', error)
      throw error
    }
  }

  // ===== HEALTH =====

  /**
   * Check server health
   */
  async checkHealth() {
    try {
      return await this.client.get(API_ENDPOINTS.HEALTH)
    } catch (error) {
      logger.error('[APIService] Error checking health:', error)
      throw error
    }
  }

  // ===== YOUTUBE =====

  /**
   * Search for YouTube videos
   */
  async searchYouTube(query, options = {}) {
    try {
      const params = new URLSearchParams({
        q: query,
        ...options,
      })
      return await this.client.get(`${API_ENDPOINTS.YOUTUBE_SEARCH}?${params}`)
    } catch (error) {
      logger.error('[APIService] Error searching YouTube:', error)
      throw error
    }
  }

  // ===== MONITORING =====

  /**
   * Get cache stats (for debugging) - Replaces request logs
   */
  getCacheStats() {
    return this.client.getCacheStats ? this.client.getCacheStats() : null
  }

  /**
   * Clear cache
   */
  clearCache() {
    if (this.client.clearCache) {
      this.client.clearCache()
    }
  }

  /**
   * Get API health status
   */
  async getHealthStatus() {
    try {
      const result = await this.checkHealth()
      return {
        status: 'online',
        timestamp: new Date().toISOString(),
        data: result,
      }
    } catch (error) {
      return {
        status: 'offline',
        timestamp: new Date().toISOString(),
        error: error.message,
      }
    }
  }

  // ===== MONITORING =====
  // REMOVED: Monitoring is server-side only, client doesn't need these endpoints
}

// Create singleton instance (using apiClientV2)
export const apiService = new APIService(apiClientV2)

export default APIService
