/**
 * VideoCore - Core video playback logic
 * Handles video loading, switching, error recovery, and preloading
 */

class VideoCore {
  constructor() {
    this.currentVideo = null;
    this.currentChannel = null;
    this.playerRef = null;
    this.failedVideos = new Set();
    this.preloadedVideos = new Map();
  }

  /**
   * Set YouTube player reference
   */
  setPlayer(player) {
    this.playerRef = player;
  }

  /**
   * Set current channel
   */
  setChannel(channel) {
    this.currentChannel = channel;
    this.failedVideos.clear();
  }

  /**
   * Load video by YouTube ID
   */
  async loadVideo(youtubeId, startSeconds = 0) {
    if (!this.playerRef) {
      throw new Error('Player not initialized');
    }

    try {
      this.playerRef.loadVideoById({
        videoId: youtubeId,
        startSeconds: Math.floor(startSeconds),
      });
      return true;
    } catch (error) {
      throw new Error(`Failed to load video: ${error.message}`);
    }
  }

  /**
   * Play current video
   */
  async play() {
    if (!this.playerRef) return false;
    try {
      await this.playerRef.playVideo();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Pause current video
   */
  pause() {
    if (!this.playerRef) return;
    try {
      this.playerRef.pauseVideo();
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Seek to position
   */
  seekTo(seconds) {
    if (!this.playerRef) return;
    try {
      this.playerRef.seekTo(seconds, true);
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume) {
    if (!this.playerRef) return;
    try {
      this.playerRef.setVolume(volume * 100);
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Mark video as failed
   */
  markVideoFailed(youtubeId) {
    this.failedVideos.add(youtubeId);
  }

  /**
   * Check if video has failed
   */
  isVideoFailed(youtubeId) {
    return this.failedVideos.has(youtubeId);
  }

  /**
   * Get next available video (skip failed ones)
   */
  getNextAvailableVideo(playlist, currentIndex) {
    if (!playlist || playlist.length === 0) return null;

    const startIndex = (currentIndex + 1) % playlist.length;
    let attempts = 0;

    while (attempts < playlist.length) {
      const index = (startIndex + attempts) % playlist.length;
      const video = playlist[index];

      if (video && video.youtubeId && !this.isVideoFailed(video.youtubeId)) {
        return { video, index };
      }

      attempts++;
    }

    // All videos failed, return first one anyway
    return playlist[0] ? { video: playlist[0], index: 0 } : null;
  }

  /**
   * Preload next video (for smooth transitions)
   */
  preloadVideo(youtubeId) {
    // YouTube player handles preloading automatically
    // This is a placeholder for future optimizations
    this.preloadedVideos.set(youtubeId, Date.now());
  }

  /**
   * Clear preloaded videos
   */
  clearPreloaded() {
    this.preloadedVideos.clear();
  }

  /**
   * Reset state
   */
  reset() {
    this.currentVideo = null;
    this.failedVideos.clear();
    this.clearPreloaded();
  }
}

// Export singleton instance
export const videoCore = new VideoCore();
export default videoCore;


