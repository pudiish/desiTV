/**
 * Channel Data Service - MongoDB + Memory Cache + WebSocket Push
 * 
 * Industry-grade architecture:
 * - MongoDB Atlas as source of truth (reliable, scalable)
 * - In-memory cache for fast reads (no repeated DB calls)
 * - WebSocket push for instant client updates (no polling)
 * - Version tracking for efficient sync
 * 
 * Data Flow:
 * READ:  Client → Cache → MongoDB (cache miss only)
 * WRITE: Admin → MongoDB → Invalidate Cache → Push to all clients
 */

const Channel = require('../models/Channel');
const cache = require('../utils/cache');
const { minimizeChannel, minimizeChannels, CACHE_TTL } = require('../utils/cacheWarmer');
const { addChecksum } = require('../utils/checksum');
const crypto = require('crypto');

// Cache configuration
const CACHE_TTL_CONFIG = CACHE_TTL || {
  CHANNELS_LIST: 300,    // 5 minutes for list
  CHANNEL_DETAIL: 600,   // 10 minutes for single channel
  CURRENT_VIDEO: 5,      // 5 seconds for position
};

// In-memory version tracking (faster than cache lookup)
let currentVersion = Date.now();
let channelsCache = null;
let cacheExpiry = 0;

class ChannelDataService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Get current data version
   */
  getVersion() {
    return currentVersion;
  }

  /**
   * Invalidate all caches and bump version
   */
  async invalidateCache(channelId = null) {
    currentVersion = Date.now();
    channelsCache = null;
    cacheExpiry = 0;
    
    if (channelId) {
      const channelHash = channelId.toString().substring(18, 24);
      await cache.delete(`ch:${channelHash}`);
    }
    await cache.delete('ch:all');
    
    console.log(`[ChannelDataService] Cache invalidated, new version: ${currentVersion}`);
  }

  /**
   * Push update to all connected clients via WebSocket
   */
  pushUpdate(eventType = 'channels:updated', data = {}) {
    if (global.io) {
      global.io.emit(eventType, {
        version: currentVersion,
        timestamp: Date.now(),
        ...data
      });
      console.log(`[ChannelDataService] Pushed ${eventType} to all clients`);
    }
  }

  /**
   * Get all channels - cached
   * @returns {Promise<Object>} Channels with version and checksum
   */
  async getAllChannels() {
    // L1: In-memory cache (fastest)
    if (channelsCache && Date.now() < cacheExpiry) {
      return addChecksum({
        version: currentVersion,
        generatedAt: new Date(currentVersion).toISOString(),
        data: channelsCache
      }, 'channels');
    }

    // L2: Redis/external cache
    const cacheKey = 'ch:all';
    const cached = await cache.get(cacheKey);
    if (cached) {
      channelsCache = cached;
      cacheExpiry = Date.now() + (CACHE_TTL_CONFIG.CHANNELS_LIST * 1000);
      return addChecksum({
        version: currentVersion,
        generatedAt: new Date(currentVersion).toISOString(),
        data: cached
      }, 'channels');
    }

    // L3: MongoDB (source of truth)
    const channels = await Channel.find({ isActive: { $ne: false } })
      .lean()
      .exec();
    
    const minimized = minimizeChannels(channels);
    
    // Store in both cache layers
    await cache.set(cacheKey, minimized, CACHE_TTL_CONFIG.CHANNELS_LIST);
    channelsCache = minimized;
    cacheExpiry = Date.now() + (CACHE_TTL_CONFIG.CHANNELS_LIST * 1000);

    return addChecksum({
      version: currentVersion,
      generatedAt: new Date(currentVersion).toISOString(),
      data: minimized
    }, 'channels');
  }

  /**
   * Get single channel by ID - cached
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Channel with checksum
   */
  async getChannelById(channelId) {
    const channelHash = channelId.toString().substring(18, 24);
    const cacheKey = `ch:${channelHash}`;
    
    // Check cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      return addChecksum(cached, 'channels');
    }

    // Fetch from MongoDB
    const channel = await Channel.findById(channelId).lean().exec();
    if (!channel) {
      throw new Error('Channel not found');
    }

    const minimized = minimizeChannel(channel);
    await cache.set(cacheKey, minimized, CACHE_TTL_CONFIG.CHANNEL_DETAIL);

    return addChecksum(minimized, 'channels');
  }

  /**
   * Create a new channel
   * @param {string} name - Channel name
   * @param {Date} playlistStartEpoch - Optional start epoch
   * @returns {Promise<Object>} Created channel
   */
  async createChannel(name, playlistStartEpoch = null) {
    // Check if exists
    const existing = await Channel.findOne({ name }).lean().exec();
    if (existing) {
      throw new Error('Channel already exists');
    }

    const channel = new Channel({
      name,
      playlistStartEpoch: playlistStartEpoch || new Date('2020-01-01T00:00:00Z'),
      items: [],
      isActive: true
    });

    await channel.save();

    // Invalidate cache and push to clients
    await this.invalidateCache();
    this.pushUpdate('channels:created', { channelId: channel._id, name });

    return channel.toObject();
  }

  /**
   * Add video to channel
   * @param {string} channelId - Channel ID
   * @param {Object} videoData - Video data
   * @returns {Promise<Object>} Updated channel
   */
  async addVideo(channelId, videoData) {
    const channel = await Channel.findById(channelId).exec();
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check for duplicate
    const exists = channel.items.some(item => item.youtubeId === videoData.youtubeId);
    if (exists) {
      throw new Error('Video already exists in this channel');
    }

    // Add video
    channel.items.push({
      title: videoData.title,
      youtubeId: videoData.youtubeId,
      duration: Number(videoData.duration) || 30,
      year: videoData.year || null,
      tags: videoData.tags || [],
      category: videoData.category || null,
    });

    await channel.save();

    // Invalidate cache and push to clients
    await this.invalidateCache(channelId);
    this.pushUpdate('channels:videoAdded', { 
      channelId, 
      videoId: videoData.youtubeId,
      title: videoData.title 
    });

    return channel.toObject();
  }

  /**
   * Delete video from channel
   * @param {string} channelId - Channel ID
   * @param {string} videoId - Video ID
   * @returns {Promise<Object>} Updated channel
   */
  async deleteVideo(channelId, videoId) {
    const channel = await Channel.findById(channelId).exec();
    if (!channel) {
      throw new Error('Channel not found');
    }

    const videoIndex = channel.items.findIndex(item => item._id.toString() === videoId);
    if (videoIndex === -1) {
      throw new Error('Video not found');
    }

    channel.items.splice(videoIndex, 1);
    await channel.save();

    // Invalidate cache and push to clients
    await this.invalidateCache(channelId);
    this.pushUpdate('channels:videoRemoved', { channelId, videoId });

    return channel.toObject();
  }

  /**
   * Delete channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Deleted channel
   */
  async deleteChannel(channelId) {
    const channel = await Channel.findByIdAndDelete(channelId).lean().exec();
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Invalidate cache and push to clients
    await this.invalidateCache(channelId);
    this.pushUpdate('channels:deleted', { channelId });

    return channel;
  }

  /**
   * Bulk add videos to channel
   * @param {string} channelId - Channel ID
   * @param {Array} videos - Array of video data
   * @returns {Promise<Object>} Result summary
   */
  async bulkAddVideos(channelId, videos) {
    const channel = await Channel.findById(channelId).exec();
    if (!channel) {
      throw new Error('Channel not found');
    }

    let addedCount = 0;
    let skippedCount = 0;

    for (const video of videos) {
      const exists = channel.items.some(item => item.youtubeId === video.youtubeId);
      if (exists) {
        skippedCount++;
        continue;
      }

      channel.items.push({
        title: video.title || 'Untitled',
        youtubeId: video.youtubeId,
        duration: Number(video.duration) || 30,
        year: video.year || null,
        tags: video.tags || [],
        category: video.category || null,
      });
      addedCount++;
    }

    if (addedCount > 0) {
      await channel.save();
      await this.invalidateCache(channelId);
      this.pushUpdate('channels:bulkAdded', { channelId, count: addedCount });
    }

    return { addedCount, skippedCount, total: videos.length };
  }

  /**
   * Import data from JSON (migration)
   * @param {Object} jsonData - JSON data with channels array
   * @returns {Promise<Object>} Import result
   */
  async importFromJSON(jsonData) {
    if (!jsonData || !jsonData.channels || !Array.isArray(jsonData.channels)) {
      throw new Error('Invalid JSON structure');
    }

    let imported = 0;
    let skipped = 0;
    let errors = [];

    for (const channelData of jsonData.channels) {
      try {
        // Check if channel already exists by name
        const existing = await Channel.findOne({ name: channelData.name }).exec();
        if (existing) {
          skipped++;
          continue;
        }

        // Create channel with all data
        const channel = new Channel({
          name: channelData.name,
          playlistStartEpoch: channelData.playlistStartEpoch || new Date('2020-01-01T00:00:00Z'),
          items: channelData.items || [],
          timeBasedPlaylists: channelData.timeBasedPlaylists || {},
          dayBasedPlaylists: channelData.dayBasedPlaylists || {},
          description: channelData.description || '',
          thumbnail: channelData.thumbnail || '',
          isActive: true
        });

        await channel.save();
        imported++;
      } catch (err) {
        errors.push(`Failed to import ${channelData.name}: ${err.message}`);
      }
    }

    // Invalidate cache after bulk import
    await this.invalidateCache();

    return { imported, skipped, errors, total: jsonData.channels.length };
  }

  /**
   * Get service statistics
   */
  async getStats() {
    const channelCount = await Channel.countDocuments({ isActive: { $ne: false } });
    const cacheStats = await cache.getStats();

    return {
      version: currentVersion,
      channelCount,
      cacheStats,
      inMemoryCacheActive: channelsCache !== null,
      inMemoryCacheExpiry: cacheExpiry > 0 ? new Date(cacheExpiry).toISOString() : null
    };
  }
}

module.exports = new ChannelDataService();
