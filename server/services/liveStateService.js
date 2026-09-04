/**
 * Live State Service - Server-Authoritative LIVE Position
 * 
 * THE BRAIN: Server calculates EVERYTHING, client just renders
 * Optimized for minimal client computation
 */

const { findChannelById, findOneChannel } = require('../utils/channelJSONReader');
const cache = require('../utils/cache');

// shared/ is ESM and this file is CommonJS, so it loads dynamically. Cached
// because import() resolves to the same module instance every time anyway.
let sharedPositionPromise = null;
function loadSharedPosition() {
  if (!sharedPositionPromise) {
    sharedPositionPromise = import('../../shared/broadcastPosition.js');
  }
  return sharedPositionPromise;
}

// Pre-computed data cache
let channelCache = new Map();

// Constants
const CHANNEL_CACHE_TTL = 120000; // 2 minutes for channel data

class LiveStateService {

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

    // Fetch from JSON and pre-compute
    let channel = await findChannelById(categoryId);
    if (!channel) {
      channel = await findOneChannel({ name: categoryId });
    }

    if (!channel) return null;

    const { totalDurationOf } = await loadSharedPosition();
    const videos = channel.items || [];
    const durations = videos.map(v => (typeof v.duration === 'number' && v.duration > 0) ? v.duration : 300);

    const data = {
      _id: channel._id.toString(),
      name: channel.name,
      // The epoch travels with the channel, so the playlist and the timeline
      // it is measured against are always the same version.
      epochMs: new Date(channel.playlistStartEpoch).getTime(),
      videos: videos.map((v, i) => ({
        id: v.youtubeId || v.videoId,
        title: v.title,
        duration: durations[i],
      })),
      totalDuration: totalDurationOf(videos),
      videoCount: videos.length,
    };

    // Cache in both layers
    await cache.set(cacheKey, data, 120);
    channelCache.set(cacheKey, { data, ts: now });

    return data;
  }

  /**
   * MAIN API: Get LIVE state
   *
   * Uses the same shared/broadcastPosition.js the player uses, from the same
   * per-channel epoch, so this can never name a different video than the
   * viewer is actually watching.
   */
  async getLiveState(categoryId, includeNext = false) {
    if (!categoryId) throw new Error('categoryId required');

    const [{ positionAt }, channelData] = await Promise.all([
      loadSharedPosition(),
      this._getChannelData(categoryId),
    ]);

    if (!channelData) throw new Error(`Category ${categoryId} not found`);

    const epoch = channelData.epochMs;
    const serverTimeMs = Date.now();

    const live = positionAt(serverTimeMs, epoch, channelData.videos);
    if (!live.isValid) {
      throw new Error(`Category ${categoryId} has no playable videos`);
    }

    const index = live.videoIndex;
    const position = live.offset;
    const { cyclePosition, cycleCount } = live;
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

    const channelData = await this._getChannelData(categoryId);

    if (!channelData) throw new Error(`Category ${categoryId} not found`);

    const epoch = channelData.epochMs;

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
    const { findChannels } = require('../utils/channelJSONReader');
    const allChannels = await findChannels({}, { _id: 1, name: 1 });
    const channels = allChannels.map(ch => ({ _id: ch._id, name: ch.name }));
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
    const { findChannels } = require('../utils/channelJSONReader');
    const allChannels = await findChannels({}, { _id: 1 });
    const channels = allChannels.map(ch => ({ _id: ch._id }));
    
    await Promise.all(channels.map(ch => this._getChannelData(ch._id.toString())));
    
    console.log(`[LiveState] ✅ Warmed ${channels.length} channels`);
  }

  /**
   * Clear all caches (call when data changes)
   */
  clearCache() {
    channelCache.clear();
    console.log('[LiveState] 🗑️ Cache cleared');
  }
}

module.exports = new LiveStateService();
