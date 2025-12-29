/**
 * Live State Service - Server-authoritative LIVE position calculation
 */

const GlobalEpoch = require('../models/GlobalEpoch');
const Channel = require('../models/Channel');

class LiveStateService {
  /**
   * Calculate the authoritative LIVE state for a category
   * NO CACHING - every request gets fresh calculation for tight sync
   */
  async getLiveState(categoryId, includeNext = false) {
    if (!categoryId) {
      throw new Error('categoryId is required');
    }

    // Get the epoch
    const globalEpoch = await GlobalEpoch.getOrCreate();
    const epoch = new Date(globalEpoch.epoch);
    
    // Get the category/playlist
    const category = await this.getCategoryWithVideos(categoryId);
    
    if (!category) {
      throw new Error(`Category ${categoryId} not found`);
    }

    // Calculate position with HIGH PRECISION timing
    const serverTime = Date.now(); // Use milliseconds for precision
    const liveState = this.calculatePosition(epoch.getTime(), serverTime, category);

    // Build response with precise timestamps
    const response = {
      live: {
        categoryId: category._id.toString(),
        categoryName: category.name,
        videoIndex: liveState.videoIndex,
        videoId: liveState.video?.youtubeId || liveState.video?.videoId || null,
        videoTitle: liveState.video?.title || 'Unknown Video',
        position: liveState.position, // Full precision
        duration: liveState.duration,
        remaining: liveState.remaining,
      },
      slot: {
        cyclePosition: liveState.cyclePosition,
        cycleCount: liveState.cycleCount,
        totalDuration: liveState.totalDuration,
      },
      sync: {
        epoch: epoch.toISOString(),
        serverTime: new Date(serverTime).toISOString(),
        serverTimeMs: serverTime, // Milliseconds for precise client sync
      }
    };

    // Include next video if requested
    if (includeNext && category.items.length > 1) {
      const nextIndex = (liveState.videoIndex + 1) % category.items.length;
      const nextVideo = category.items[nextIndex];
      response.next = {
        videoIndex: nextIndex,
        videoId: nextVideo?.youtubeId || nextVideo?.videoId || null,
        videoTitle: nextVideo?.title || 'Unknown Video',
        duration: nextVideo?.duration || 300,
      };
    }

    return response;
  }

  /**
   * Calculate exact position in playlist with millisecond precision
   */
  calculatePosition(epochMs, serverTimeMs, category) {
    const videos = category.items || [];
    
    if (videos.length === 0) {
      return {
        videoIndex: 0,
        video: null,
        position: 0,
        duration: 0,
        remaining: 0,
        cyclePosition: 0,
        cycleCount: 0,
        totalDuration: 0,
      };
    }

    // Get durations - default to 300s if unknown
    const durations = videos.map(v => {
      const d = v.duration;
      return (typeof d === 'number' && d > 0) ? d : 300;
    });

    const totalDuration = durations.reduce((a, b) => a + b, 0);

    if (totalDuration === 0) {
      return {
        videoIndex: 0,
        video: videos[0],
        position: 0,
        duration: 300,
        remaining: 300,
        cyclePosition: 0,
        cycleCount: 0,
        totalDuration: 0,
      };
    }

    // PRECISE CALCULATION using milliseconds
    const elapsedMs = serverTimeMs - epochMs;
    const elapsedSec = elapsedMs / 1000;

    // How many times have we looped through the entire playlist?
    const cycleCount = Math.floor(elapsedSec / totalDuration);
    
    // Where are we in the current loop? (with sub-second precision)
    const cyclePosition = elapsedSec % totalDuration;

    // Walk through videos to find current one
    let accumulated = 0;
    let videoIndex = 0;
    let position = 0;

    for (let i = 0; i < videos.length; i++) {
      const videoDuration = durations[i];
      
      if (accumulated + videoDuration > cyclePosition) {
        videoIndex = i;
        position = cyclePosition - accumulated;
        break;
      }
      
      accumulated += videoDuration;
    }

    // Edge case: if we somehow went past all videos
    // (shouldn't happen with modulo but defensive coding never hurt anyone)
    if (videoIndex >= videos.length) {
      videoIndex = videos.length - 1;
      position = 0;
    }

    const currentVideo = videos[videoIndex];
    const videoDuration = durations[videoIndex];
    const remaining = Math.max(0, videoDuration - position);

    return {
      videoIndex,
      video: currentVideo,
      position,
      duration: videoDuration,
      remaining,
      cyclePosition,
      cycleCount,
      totalDuration,
    };
  }

  /**
   * Get category with its videos
   * First tries cache, then DB, then cries
   */
  async getCategoryWithVideos(categoryId) {
    // Try to get from channels collection
    try {
      const channel = await Channel.findById(categoryId);
      if (channel) {
        return channel;
      }
    } catch (err) {
      // Maybe it's not a valid ObjectId, try other methods
    }

    // Try to find by name (fallback for legacy support)
    try {
      const channel = await Channel.findOne({ name: categoryId });
      if (channel) {
        return channel;
      }
    } catch (err) {
      console.warn('[LiveState] Error finding category:', err.message);
    }

    return null;
  }

  /**
   * Bulk get live state for multiple categories
   * For when the admin dashboard wants to flex
   */
  async getAllLiveStates() {
    const channels = await Channel.find({}).lean();
    const globalEpoch = await GlobalEpoch.getOrCreate();
    const epoch = new Date(globalEpoch.epoch);
    const serverTime = new Date();

    const states = channels.map(category => {
      const state = this.calculatePosition(epoch, serverTime, category);
      return {
        categoryId: category._id.toString(),
        categoryName: category.name,
        videoIndex: state.videoIndex,
        videoTitle: state.video?.title || 'Unknown',
        position: Math.round(state.position),
        remaining: Math.round(state.remaining),
        cycleCount: state.cycleCount,
      };
    });

    return {
      states,
      serverTime: serverTime.toISOString(),
      epoch: epoch.toISOString(),
      count: states.length,
    };
  }
}

module.exports = new LiveStateService();
