/**
 * Broadcast State Service
 * 
 * Business logic for broadcast state operations.
 * Manages timeline tracking and position calculations.
 */

const BroadcastState = require('../models/BroadcastState');

class BroadcastStateService {
  /**
   * Get all broadcast states (diagnostic/admin only)
   * @returns {Promise<Array>} Array of all broadcast states
   */
  async getAllStates() {
    const states = await BroadcastState.find({}).sort({ lastAccessTime: -1 });

    return {
      count: states.length,
      states: states.map((state) => state.toObject()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get broadcast state for a channel
   * Calculates virtual position based on elapsed time
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Broadcast state with calculated position
   * @throws {Error} If state not found
   */
  async getStateByChannelId(channelId) {
    const state = await BroadcastState.findOne({ channelId });

    if (!state) {
      throw new Error('State not found');
    }

    const currentTimestamp = new Date();
    const lastSessionEndTime = new Date(state.lastSessionEndTime);
    const elapsedSinceLastSessionMs = currentTimestamp.getTime() - lastSessionEndTime.getTime();
    const elapsedSinceLastSessionSec = elapsedSinceLastSessionMs / 1000;

    state.virtualElapsedTime = state.virtualElapsedTime + elapsedSinceLastSessionSec;

    let cyclePosition = state.virtualElapsedTime;
    let videoIndex = 0;
    let currentTime = 0;

    if (state.videoDurations && state.videoDurations.length > 0) {
      let accumulatedTime = 0;
      const playlistDuration = state.playlistTotalDuration || 3600;

      cyclePosition = state.virtualElapsedTime % playlistDuration;

      for (let videoIndexIterator = 0; videoIndexIterator < state.videoDurations.length; videoIndexIterator++) {
        if (accumulatedTime + state.videoDurations[videoIndexIterator] > cyclePosition) {
          videoIndex = videoIndexIterator;
          currentTime = cyclePosition - accumulatedTime;
          break;
        }
        accumulatedTime += state.videoDurations[videoIndexIterator];
      }
    }

    return {
      ...state.toObject(),
      videoIndex,
      currentTime,
      cyclePosition,
      timeSinceLastSession: elapsedSinceLastSessionSec,
      calculatedAt: currentTime.toISOString(),
    };
  }

  /**
   * Calculate current timeline position for a channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Timeline calculation result
   * @throws {Error} If state not found
   */
  async calculateTimeline(channelId) {
    const state = await BroadcastState.findOne({ channelId });

    if (!state) {
      throw new Error('State not found');
    }

    const currentTime = new Date();
    const playlistStart = new Date(state.playlistStartEpoch);
    const lastSessionEnd = new Date(state.lastSessionEndTime);

    const totalElapsedMs = currentTime.getTime() - playlistStart.getTime();
    const totalElapsedSec = totalElapsedMs / 1000;

    const sessionGapMs = currentTime.getTime() - lastSessionEnd.getTime();
    const sessionGapSec = sessionGapMs / 1000;

    const playlistDurationSec = state.playlistTotalDuration || 3600;
    const cyclePosition = totalElapsedSec % playlistDurationSec;

    return {
      channelId,
      currentTime: currentTime.toISOString(),
      playlistStartEpoch: playlistStart.toISOString(),
      lastSessionEndTime: lastSessionEnd.toISOString(),
      totalElapsedMs,
      totalElapsedSec: Math.floor(totalElapsedSec),
      sessionGapSec: Math.floor(sessionGapSec),
      playlistDurationSec,
      cyclePosition: Math.floor(cyclePosition),
      cycleCount: Math.floor(totalElapsedSec / playlistDurationSec),
      virtualElapsedTime: state.virtualElapsedTime + sessionGapSec,
    };
  }

  /**
   * Save or update broadcast state for a channel
   * @param {string} channelId - Channel ID
   * @param {Object} stateData - State data to save
   * @returns {Promise<Object>} Saved state
   */
  async saveState(channelId, stateData) {
    if (!stateData) {
      throw new Error('No state data provided');
    }

    const currentTime = new Date();

    const state = await BroadcastState.findOneAndUpdate(
      { channelId },
      {
        channelId,
        channelName: stateData.channelName || 'Unknown',
        playlistStartEpoch: stateData.playlistStartEpoch || currentTime,
        currentVideoIndex: stateData.currentVideoIndex || 0,
        currentTime: stateData.currentTime || 0,
        lastSessionEndTime: currentTime,
        lastAccessTime: currentTime,
        playlistTotalDuration: stateData.playlistTotalDuration || 3600,
        videoDurations: stateData.videoDurations || [],
        playbackRate: stateData.playbackRate || 1.0,
        virtualElapsedTime: stateData.virtualElapsedTime || 0,
        playlistCycleCount: stateData.playlistCycleCount || 0,
        updatedAt: currentTime,
      },
      { upsert: true, new: true }
    );

    return {
      success: true,
      message: 'Broadcast state saved to MongoDB',
      state: state.toObject(),
      savedAt: currentTime.toISOString(),
    };
  }

  /**
   * Clear broadcast state for a channel
   * @param {string} channelId - Channel ID
   * @returns {Promise<Object>} Deletion result
   */
  async clearState(channelId) {
    await BroadcastState.deleteOne({ channelId });

    return {
      success: true,
      message: 'Broadcast state cleared',
      channelId,
    };
  }
}

module.exports = new BroadcastStateService();

