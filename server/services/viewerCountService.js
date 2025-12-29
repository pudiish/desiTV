/**
 * Viewer Count Service
 * 
 * Business logic for viewer count operations.
 * Tracks active viewers and total views per channel.
 */

const mongoose = require('mongoose');
const ViewerCount = require('../models/ViewerCount');
const cache = require('../utils/cache');

// Cache TTL for viewer counts (30 seconds - optimized for free tier)
const VIEWER_COUNT_CACHE_TTL = 30;

/**
 * Generate cache key for viewer count
 * Handles short channelIds gracefully
 */
function getCacheKey(channelId) {
  const channelIdString = channelId.toString();
  const channelHash = channelIdString.length >= 24 
    ? channelIdString.substring(18, 24)
    : channelIdString.substring(Math.max(0, channelIdString.length - 6));
  return `vc:${channelHash}`; // Shortened from 'viewer-count:xxx'
}

class ViewerCountService {
  /**
   * User joins a channel (increment viewer count)
   * @param {string} channelId - Channel ID
   * @param {string} channelName - Channel name
   * @returns {Promise<Object>} Updated viewer count
   */
  async joinChannel(channelId, channelName) {
    if (!channelId) {
      throw new Error('Channel ID required');
    }

    // Check MongoDB connection before attempting database operation
    if (mongoose.connection.readyState !== 1) {
      console.warn('[ViewerCountService] MongoDB not connected, skipping viewer count update');
      // Return success anyway - viewer count is non-critical
      return {
        success: true,
        channelId,
        activeViewers: 0,
        totalViews: 0,
        skipped: true,
      };
    }

    let viewerCount = null;
    try {
      viewerCount = await ViewerCount.incrementViewer(
        channelId,
        channelName || 'Unknown Channel'
      );
    } catch (databaseError) {
      console.warn('[ViewerCountService] Increment failed (non-critical):', databaseError.message);
      // Continue - viewer count is optional
    }

    // Clear cache - handle errors gracefully
    try {
      const cacheKey = getCacheKey(channelId);
      await cache.delete(cacheKey);
    } catch (cacheError) {
      console.warn('[ViewerCountService] Cache delete failed (non-critical):', cacheError.message);
    }

    // Always return success - viewer count is non-critical
    return {
      success: true,
      channelId,
      activeViewers: viewerCount ? viewerCount.activeViewers : 0,
      totalViews: viewerCount ? viewerCount.totalViews : 0,
    };
  }

  /**
   * User leaves a channel (decrement viewer count)
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Updated viewer count
   */
  async leaveChannel(channelId) {
    if (!channelId) {
      throw new Error('Channel ID required');
    }

    // Check MongoDB connection
    if (mongoose.connection.readyState !== 1) {
      console.warn('[ViewerCountService] MongoDB not connected, skipping viewer count update');
      return {
        success: true,
        channelId,
        activeViewers: 0,
        skipped: true,
      };
    }

    let viewerCount = null;
    try {
      viewerCount = await ViewerCount.decrementViewer(channelId);
    } catch (databaseError) {
      console.warn('[ViewerCountService] Decrement failed (non-critical):', databaseError.message);
    }

    // Clear cache
    try {
      const cacheKey = getCacheKey(channelId);
      await cache.delete(cacheKey);
    } catch (cacheError) {
      console.warn('[ViewerCountService] Cache delete failed (non-critical):', cacheError.message);
    }

    return {
      success: true,
      channelId,
      activeViewers: viewerCount ? viewerCount.activeViewers : 0,
    };
  }

  /**
   * Get current viewer count for a channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Viewer count data
   */
  async getViewerCount(channelId) {
    const cacheKey = getCacheKey(channelId);
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      return {
        channelId,
        activeViewers: cached.activeViewers || cached.a || 0,
        totalViews: cached.totalViews || cached.t || 0,
        cached: true,
      };
    }

    const viewerCount = await ViewerCount.findOne({ channelId });

    // Prepare minimal cached data for free tier optimization
    const response = {
      a: viewerCount ? viewerCount.activeViewers : 0, // 'a' = activeViewers
      t: viewerCount ? viewerCount.totalViews : 0, // 't' = totalViews
      // Backward compatibility
      activeViewers: viewerCount ? viewerCount.activeViewers : 0,
      totalViews: viewerCount ? viewerCount.totalViews : 0,
    };

    // Cache for 30 seconds
    await cache.set(cacheKey, response, VIEWER_COUNT_CACHE_TTL);

    return {
      channelId,
      ...response,
      cached: false,
    };
  }

  /**
   * Get viewer counts for all channels (for admin/stats)
   * @returns {Promise<Object>} All viewer counts
   */
  async getAllViewerCounts() {
    const viewerCounts = await ViewerCount.find({ activeViewers: { $gt: 0 } })
      .sort({ activeViewers: -1 })
      .limit(50)
      .lean();

    return {
      count: viewerCounts.length,
      channels: viewerCounts.map(viewerCount => ({
        channelId: viewerCount.channelId,
        channelName: viewerCount.channelName,
        activeViewers: viewerCount.activeViewers,
        totalViews: viewerCount.totalViews,
      })),
    };
  }
}

module.exports = new ViewerCountService();


