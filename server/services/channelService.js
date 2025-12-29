/**
 * Channel Service
 * 
 * Business logic for channel operations.
 * Handles channel CRUD, video management, and cache invalidation.
 */

const Channel = require('../models/Channel');
const cache = require('../utils/cache');
const { minimizeChannel, minimizeChannels, CACHE_TTL } = require('../utils/cacheWarmer');
const { addChecksum } = require('../utils/checksum');
const { regenerateChannelsJSON } = require('../utils/generateJSON');
const { getCachedPosition } = require('../utils/positionCalculator');

const CACHE_TTL_CONFIG = CACHE_TTL || {
  CHANNELS_LIST: 300,
  CHANNEL_DETAIL: 600,
  CURRENT_VIDEO: 5,
};

class ChannelService {
  /**
   * Get all channels with caching
   * @returns {Promise<Array>} Array of minimized channels with checksum
   */
  async getAllChannels() {
    const cacheKey = 'ch:all';
    const cached = await cache.get(cacheKey);
    if (cached) {
      return addChecksum(cached, 'channels');
    }

    const channels = await Channel.find()
      .select('name playlistStartEpoch items._id items.youtubeId items.title items.duration items.thumbnail')
      .lean();
    
    const minimizedChannels = minimizeChannels(channels);
    await cache.set(cacheKey, minimizedChannels, CACHE_TTL_CONFIG.CHANNELS_LIST);
    
    return addChecksum(minimizedChannels, 'channels');
  }

  /**
   * Get single channel by ID with caching
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Minimized channel with checksum
   * @throws {Error} If channel not found
   */
  async getChannelById(channelId) {
    const channelHash = channelId.toString().substring(18, 24);
    const cacheKey = `ch:${channelHash}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return addChecksum(cached, 'channels');
    }

    const channel = await Channel.findById(channelId).lean();
    if (!channel) {
      throw new Error('Channel not found');
    }
    
    const minimizedChannel = minimizeChannel(channel);
    await cache.set(cacheKey, minimizedChannel, CACHE_TTL_CONFIG.CHANNEL_DETAIL);
    
    return addChecksum(minimizedChannel, 'channels');
  }

  /**
   * Get current playback position for a channel
   * @param {string} channelId - Channel ID
   * @param {Object} request - Express request object (for timezone)
   * @returns {Promise<Object>} Current position with channel metadata
   * @throws {Error} If channel not found
   */
  async getCurrentPosition(channelId, request) {
    const channel = await Channel.findById(channelId).lean();
    if (!channel) {
      throw new Error('Channel not found');
    }
    
    const position = await getCachedPosition(channel, null, request);
    
    return {
      ...position,
      channelId: channel._id,
      channelName: channel.name,
    };
  }

  /**
   * Invalidate channel-related caches
   * @param {string} channelId - Channel ID (optional)
   */
  async invalidateCache(channelId = null) {
    if (channelId) {
      const channelHash = channelId.toString().substring(18, 24);
      await cache.delete(`ch:${channelHash}`);
      await cache.deletePattern(`ch:${channelHash}`);
    }
    await cache.delete('ch:all');
  }

  /**
   * Regenerate channels.json after channel mutations
   */
  async regenerateStaticJSON() {
    try {
      await regenerateChannelsJSON();
    } catch (error) {
      console.error('[ChannelService] Failed to regenerate JSON:', error);
      // Don't throw - regeneration failure shouldn't break the operation
    }
  }

  /**
   * Create a new channel
   * @param {string} name - Channel name
   * @param {Date} playlistStartEpoch - Optional start epoch
   * @returns {Promise<Object>} Created channel
   * @throws {Error} If channel name already exists
   */
  async createChannel(name, playlistStartEpoch = null) {
    const existingChannel = await Channel.findOne({ name });
    if (existingChannel) {
      throw new Error('Channel already exists');
    }

    const channel = await Channel.create({ 
      name, 
      playlistStartEpoch: playlistStartEpoch || new Date('2020-01-01T00:00:00Z')
    });

    const minimized = minimizeChannel(channel);
    const channelHash = channel._id.toString().substring(18, 24);
    await cache.set(`ch:${channelHash}`, minimized, CACHE_TTL_CONFIG.CHANNEL_DETAIL);
    await this.invalidateCache();

    await this.regenerateStaticJSON();

    return channel;
  }

  /**
   * Delete a channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Deleted channel
   * @throws {Error} If channel not found
   */
  async deleteChannel(channelId) {
    const channel = await Channel.findByIdAndDelete(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const channelHash = channelId.toString().substring(18, 24);
    await cache.delete(`ch:${channelHash}`);
    await this.invalidateCache();

    await this.regenerateStaticJSON();

    return channel;
  }

  /**
   * Get cache statistics (admin endpoint)
   * @returns {Promise<Object>} Cache statistics
   */
  async getCacheStats() {
    return await cache.getStats();
  }
}

module.exports = new ChannelService();

