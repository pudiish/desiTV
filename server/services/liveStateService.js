/**
 * Live State Service
 * 
 * THE BIG BRAIN OF LIVE BROADCAST 🧠
 * 
 * This is where the magic happens, buddy. Server calculates EXACTLY
 * where everyone should be watching - like a DJ who knows the exact
 * beat drop for the whole club.
 * 
 * Why does this exist? Because having clients calculate their own
 * "live" position is like letting students grade their own exams.
 * Sure, everyone passes, but nobody learned anything! 
 */

const GlobalEpoch = require('../models/GlobalEpoch');
const Channel = require('../models/Channel');
const cache = require('../utils/cache');

// Cache keys - short because we're not made of RAM here
const LIVE_STATE_CACHE_PREFIX = 'ls:'; // "live-state" but we're cheap
const LIVE_STATE_TTL = 1; // 1 second - LIVE state is like milk, goes bad FAST

class LiveStateService {
  /**
   * Calculate the authoritative LIVE state for a category
   * 
   * This is THE formula. THE sauce. THE reason 500 people can watch
   * the same video at the same time without arguing about who's ahead.
   * 
   * @param {string} categoryId - The category/playlist ID
   * @param {boolean} includeNext - Include next video info (for previews)
   * @returns {Promise<Object>} The gospel truth of what should be playing
   */
  async getLiveState(categoryId, includeNext = false) {
    if (!categoryId) {
      throw new Error('categoryId is required - we\'re not mind readers here');
    }

    // Check cache first - because hitting the DB every second is a crime
    const cacheKey = `${LIVE_STATE_CACHE_PREFIX}${categoryId}`;
    const cached = await cache.get(cacheKey);
    
    if (cached) {
      // Add fresh serverTime even for cached responses
      // Because time waits for no cache!
      return {
        ...cached,
        sync: {
          ...cached.sync,
          serverTime: new Date().toISOString(),
          cached: true,
        }
      };
    }

    // Get the sacred epoch - the beginning of all things DesiTV
    const globalEpoch = await GlobalEpoch.getOrCreate();
    const epoch = new Date(globalEpoch.epoch);
    
    // Get the category/playlist
    // Using the channel model because someone named playlists "channels"
    // and we're just living in their world now 🤷
    const category = await this.getCategoryWithVideos(categoryId);
    
    if (!category) {
      throw new Error(`Category ${categoryId} not found - did it run away?`);
    }

    // THE CALCULATION - where dreams become reality
    const serverTime = new Date();
    const liveState = this.calculatePosition(epoch, serverTime, category);

    // Build the response - clean, mean, JSON machine
    const response = {
      live: {
        categoryId: category._id.toString(),
        categoryName: category.name,
        videoIndex: liveState.videoIndex,
        videoId: liveState.video?.youtubeId || liveState.video?.videoId || null,
        videoTitle: liveState.video?.title || 'Unknown Video',
        position: Math.round(liveState.position * 100) / 100, // 2 decimal places, we're not NASA
        duration: liveState.duration,
        remaining: Math.round(liveState.remaining * 100) / 100,
      },
      slot: {
        cyclePosition: Math.round(liveState.cyclePosition * 100) / 100,
        cycleCount: liveState.cycleCount,
        totalDuration: liveState.totalDuration,
      },
      sync: {
        epoch: epoch.toISOString(),
        serverTime: serverTime.toISOString(),
        cached: false,
      }
    };

    // Include next video if requested (for those sweet preview overlays)
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

    // Cache it - but not for long, this data is SPICY and FRESH
    await cache.set(cacheKey, response, LIVE_STATE_TTL);

    return response;
  }

  /**
   * THE FORMULA - Calculate exact position in playlist
   * 
   * Math time, baby! 🧮
   * 
   * elapsed = (now - epoch) in seconds
   * cyclePosition = elapsed % totalPlaylistDuration
   * Then we walk through videos until we find where cyclePosition lands
   * 
   * It's like a musical chairs but the music NEVER stops and
   * everyone knows exactly which chair they should be sitting in.
   */
  calculatePosition(epoch, serverTime, category) {
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

    // Get durations - default to 300s (5 min) because some videos are lazy
    // and didn't tell us how long they are
    const durations = videos.map(v => {
      const d = v.duration;
      return (typeof d === 'number' && d > 0) ? d : 300;
    });

    const totalDuration = durations.reduce((a, b) => a + b, 0);

    if (totalDuration === 0) {
      // This shouldn't happen but if it does, we're not crashing
      console.warn('[LiveState] Total duration is 0 - something sus is going on');
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

    // THE BIG CALCULATION
    const elapsedMs = serverTime.getTime() - epoch.getTime();
    const elapsedSec = elapsedMs / 1000;

    // How many times have we looped through the entire playlist?
    const cycleCount = Math.floor(elapsedSec / totalDuration);
    
    // Where are we in the current loop?
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
