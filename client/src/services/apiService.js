/**
 * API Service - High-level API calls wrapper
 * Provides clean interface to backend APIs with error handling
 * All API calls should go through this service
 */

import { apiClient } from './apiClient'
import { API_ENDPOINTS } from '../config/constants'

export class APIService {
  constructor(client = apiClient) {
    this.client = client
  }

  // ===== BROADCAST STATE =====

  /**
   * Get broadcast state for a channel
   */
  async getBroadcastState(channelId) {
    try {
      return await this.client.get(`${API_ENDPOINTS.BROADCAST_STATE}/${channelId}`)
    } catch (error) {
      console.error(`[APIService] Error fetching broadcast state for ${channelId}:`, error)
      throw error
    }
  }

  /**
   * Get all broadcast states
   */
  async getAllBroadcastStates() {
    try {
      return await this.client.get(API_ENDPOINTS.BROADCAST_STATE_ALL)
    } catch (error) {
      console.error('[APIService] Error fetching all broadcast states:', error)
      throw error
    }
  }

  /**
   * Save broadcast state for a channel
   */
  async saveBroadcastState(channelId, state) {
    try {
      return await this.client.post(`${API_ENDPOINTS.BROADCAST_STATE}/${channelId}`, state)
    } catch (error) {
      console.error(`[APIService] Error saving broadcast state for ${channelId}:`, error)
      throw error
    }
  }

  // ===== SESSION =====

  /**
   * Get session state
   */
  async getSession(sessionId) {
    try {
      return await this.client.get(`${API_ENDPOINTS.SESSION}/${sessionId}`)
    } catch (error) {
      console.error(`[APIService] Error fetching session ${sessionId}:`, error)
      throw error
    }
  }

  /**
   * Save session state
   */
  async saveSession(sessionId, state) {
    try {
      return await this.client.post(`${API_ENDPOINTS.SESSION}/${sessionId}`, state)
    } catch (error) {
      console.error(`[APIService] Error saving session ${sessionId}:`, error)
      throw error
    }
  }

  // ===== CHANNELS =====

  /**
   * Get all channels
   */
  async getChannels() {
    try {
      return await this.client.get(API_ENDPOINTS.CHANNELS)
    } catch (error) {
      console.error('[APIService] Error fetching channels:', error)
      throw error
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
      console.error(`[APIService] Error fetching channel ${channelId}:`, error)
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
      console.error('[APIService] Error creating channel:', error)
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
      console.error(`[APIService] Error updating channel ${channelId}:`, error)
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
      console.error(`[APIService] Error deleting channel ${channelId}:`, error)
      throw error
    }
  }

  // ===== CATEGORIES =====

  /**
   * Get all categories
   */
  async getCategories() {
    try {
      return await this.client.get(API_ENDPOINTS.CATEGORIES)
    } catch (error) {
      console.error('[APIService] Error fetching categories:', error)
      throw error
    }
  }

  // ===== AUTH =====

  /**
   * Login user
   */
  async login(username, password) {
    try {
      return await this.client.post(API_ENDPOINTS.AUTH_LOGIN, { username, password })
    } catch (error) {
      console.error('[APIService] Error during login:', error)
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
      console.error('[APIService] Error during registration:', error)
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
      console.error('[APIService] Error during logout:', error)
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
      console.error('[APIService] Error checking health:', error)
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
      console.error('[APIService] Error searching YouTube:', error)
      throw error
    }
  }

  // ===== MONITORING =====

  /**
   * Get API request logs
   */
  getRequestLogs() {
    return this.client.getRequestLogs()
  }

  /**
   * Clear API request logs
   */
  clearRequestLogs() {
    this.client.clearRequestLogs()
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
}

// Create singleton instance
export const apiService = new APIService(apiClient)

export default APIService
