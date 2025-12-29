/**
 * Live State Service - Server-Authoritative LIVE Position
 * 
 * THE BRAIN: Server calculates EVERYTHING, client just renders
 * Optimized for minimal client computation
 */

const GlobalEpoch = require('../models/GlobalEpoch');
const Channel = require('../models/Channel');
const cache = require('../utils/cache');

// Pre-computed data cache
let channelCache = new Map();
let durationCache = new Map();
let epochMs = null;
let lastEpochCheck = 0;

// Constants
const EPOCH_REFRESH_MS = 60000; // Refresh epoch every minute
const CHANNEL_CACHE_TTL = 120000; // 2 minutes for channel data

class LiveStateService {
  
  /**
   * Initialize/refresh epoch (called once, cached)
   */
  async _getEpochMs() {
    const now = Date.now();
    if (!epochMs || now - lastEpochCheck > EPOCH_REFRESH_MS) {
      const globalEpoch = await GlobalEpoch.getOrCreate();
      epochMs = new Date(globalEpoch.epoch).getTime();
      lastEpochCheck = now;
    }
    return epochMs;
  }

  /**
   * Get channel with pre-computed durations (cached)
   */
  async _getChannelData(categoryId) {
    const cacheKey = `cd:${categoryId}`;
    const now = Date.now();
    
    // Check in-memory cache first
    const cached = channelCache.get(cacheKey);
    if (cached && now - cached.ts < CHANNEL_CACHE_TTL) {
      return cached.data;
    }

    // Try Redis cache
    const redisCached = await cache.get(cacheKey);
    if (redisCached) {
      channelCache.set(cacheKey, { data: redisCached, ts: now });
      return redisCached;
    }

    // Fetch from DB and pre-compute
    let channel = null;
    try {
      channel = await Channel.findById(categoryId).lean();
    } catch (e) {
      channel = await Channel.findOne({ name: categoryId }).lean();
    }

    if (!channel) return null;

    // Pre-compute durations and total (HEAVY WORK DONE ONCE)
    const videos = channel.items || [];
    const durations = videos.map(v => (typeof v.duration === 'number' && v.duration > 0) ? v.duration : 300);
    const totalDuration = durations.reduce((a, b) => a + b, 0);
    
    // Pre-compute cumulative positions (so client lookup is O(1))
    const cumulativeStart = [];
    let cumulative = 0;
    for (let i = 0; i < durations.length; i++) {
      cumulativeStart.push(cumulative);
      cumulative += durations[i];
    }

    const data = {
      _id: channel._id.toString(),
      name: channel.name,
      videos: videos.map((v, i) => ({
        id: v.youtubeId || v.videoId,
        title: v.title,
        duration: durations[i],
        start: cumulativeStart[i], // Pre-computed start position in cycle
      })),
      totalDuration,
      videoCount: videos.length,
    };

    // Cache in both layers
    await cache.set(cacheKey, data, 120);
    channelCache.set(cacheKey, { data, ts: now });

    return data;
  }

  /**
   * Binary search for video at position (O(log n) instead of O(n))
   */
  _findVideoAtPosition(channelData, cyclePosition) {
    const videos = channelData.videos;
    if (!videos.length) return { index: 0, position: 0 };

    // Binary search
    let left = 0, right = videos.length - 1;
    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2);
      if (videos[mid].start <= cyclePosition) {
        left = mid;
      } else {
        right = mid - 1;
      }
    }

    return {
      index: left,
      position: cyclePosition - videos[left].start,
    };
  }

  /**
   * MAIN API: Get LIVE state with ALL computation done server-side
   * Client receives ready-to-play data
   */
  async getLiveState(categoryId, includeNext = false) {
    if (!categoryId) throw new Error('categoryId required');

    // Get cached data (minimal DB calls)
    const [epoch, channelData] = await Promise.all([
      this._getEpochMs(),
      this._getChannelData(categoryId),
    ]);

    if (!channelData) throw new Error(`Category ${categoryId} not found`);

    // HIGH PRECISION timing
    const serverTimeMs = Date.now();
    const elapsedMs = serverTimeMs - epoch;
    const elapsedSec = elapsedMs / 1000;

    // Calculate position
    const cycleCount = Math.floor(elapsedSec / channelData.totalDuration);
    const cyclePosition = elapsedSec % channelData.totalDuration;
    
    // Fast binary search for current video
    const { index, position } = this._findVideoAtPosition(channelData, cyclePosition);
    const currentVideo = channelData.videos[index];

    // Build response with ALL data client needs
    const response = {
      // Current video - ready to play
      live: {
        categoryId: channelData._id,
        categoryName: channelData.name,
        videoIndex: index,
        videoId: currentVideo.id,
        videoTitle: currentVideo.title,
        position: Math.round(position * 1000) / 1000, // 3 decimal places
        duration: currentVideo.duration,
        remaining: Math.round((currentVideo.duration - position) * 1000) / 1000,
      },
      // Sync data - for client clock correction
      sync: {
        serverTimeMs,
        epochMs: epoch,
        // Client can calculate: localDrift = Date.now() - serverTimeMs
      },
      // Playlist metadata
      playlist: {
        totalDuration: channelData.totalDuration,
        videoCount: channelData.videoCount,
        cycleCount,
        cyclePosition: Math.round(cyclePosition * 1000) / 1000,
      },
    };

    // Next video (optional)
    if (includeNext && channelData.videos.length > 1) {
      const nextIndex = (index + 1) % channelData.videos.length;
      const nextVideo = channelData.videos[nextIndex];
      response.next = {
        videoIndex: nextIndex,
        videoId: nextVideo.id,
        videoTitle: nextVideo.title,
        duration: nextVideo.duration,
        // Time until this video starts
        startsIn: Math.round((currentVideo.duration - position) * 1000) / 1000,
      };
    }

    return response;
  }

  /**
   * Get FULL manifest for predictive engine
   * Client downloads once, computes locally forever
   */
  async getManifest(categoryId) {
    if (!categoryId) throw new Error('categoryId required');

    const [epoch, channelData] = await Promise.all([
      this._getEpochMs(),
      this._getChannelData(categoryId),
    ]);

    if (!channelData) throw new Error(`Category ${categoryId} not found`);

    return {
      // Category info
      categoryId: channelData._id,
      categoryName: channelData.name,
      
      // Full playlist with pre-computed positions
      playlist: {
        videos: channelData.videos, // Includes startTime for each video
        totalDuration: channelData.totalDuration,
        videoCount: channelData.videoCount,
      },
      
      // Sync anchor
      sync: {
        epochMs: epoch,
        serverTimeMs: Date.now(),
      },
      
      // Manifest metadata
      meta: {
        version: 1,
        generatedAt: Date.now(),
        ttlSeconds: 300, // Suggest client refresh after 5 min
      },
    };
  }

  /**
   * BATCH API: Get state for ALL categories at once
   * Useful for admin or multi-channel view
   */
  async getAllLiveStates() {
    const channels = await Channel.find({}).select('_id name').lean();
    const serverTimeMs = Date.now();

    const states = await Promise.all(
      channels.map(async ch => {
        try {
          const state = await this.getLiveState(ch._id.toString(), false);
          return {
            categoryId: ch._id.toString(),
            categoryName: ch.name,
            videoIndex: state.live.videoIndex,
            videoTitle: state.live.videoTitle,
            position: Math.round(state.live.position),
            remaining: Math.round(state.live.remaining),
          };
        } catch (e) {
          return { categoryId: ch._id.toString(), error: e.message };
        }
      })
    );

    return {
      states,
      serverTimeMs,
      count: states.length,
    };
  }

  /**
   * Pre-warm cache for all channels (call on server start)
   */
  async warmCache() {
    console.log('[LiveState] 🔥 Warming cache...');
    const channels = await Channel.find({}).select('_id').lean();
    
    await Promise.all(channels.map(ch => this._getChannelData(ch._id.toString())));
    
    console.log(`[LiveState] ✅ Warmed ${channels.length} channels`);
  }

  /**
   * Clear all caches (call when data changes)
   */
  clearCache() {
    channelCache.clear();
    durationCache.clear();
    console.log('[LiveState] 🗑️ Cache cleared');
  }
}

module.exports = new LiveStateService();
