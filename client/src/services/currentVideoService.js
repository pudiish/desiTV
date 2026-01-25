/**
 * Current Video Service
 * 
 * Provides a reliable, single source of truth for the currently playing video.
 * This service ensures the chat agent and other components always know what's
 * ACTUALLY playing, not just what state says.
 * 
 * Priority order:
 * 1. External video (YouTube search result)
 * 2. PlaybackInfo from Player (actual YouTube player state)
 * 3. State-based fallback
 */

/**
 * Get the current playing video from the most reliable source
 * 
 * @param {Object} options
 * @param {Object} options.externalVideo - External video state { videoId, videoTitle, thumbnail }
 * @param {Object} options.playbackInfo - Playback info from Player { video, videoId, videoTitle, videoIndex }
 * @param {Array} options.videosInCategory - All videos in current category
 * @param {Number} options.activeVideoIndex - State-based video index (fallback)
 * @returns {Object|null} Current video object or null
 */
export function getCurrentVideo({ 
  externalVideo, 
  playbackInfo, 
  videosInCategory = [], 
  activeVideoIndex = 0 
}) {
  // Priority 1: External video (YouTube search result playing on TV)
  if (externalVideo?.videoId) {
    return {
      title: externalVideo.videoTitle || 'Unknown',
      youtubeId: externalVideo.videoId,
      id: externalVideo.videoId,
      duration: 0, // External videos don't have duration in state
      thumbnail: externalVideo.thumbnail || null,
      source: 'external' // Track source for debugging
    }
  }
  
  // Priority 2: PlaybackInfo from Player (actual YouTube player state - most reliable)
  if (playbackInfo?.video) {
    return {
      ...playbackInfo.video,
      source: 'playbackInfo.video' // Track source
    }
  }
  
  // Priority 3: PlaybackInfo has videoId but no video object - construct from info
  if (playbackInfo?.videoId && playbackInfo?.videoTitle) {
    // Try to find in current category
    const foundVideo = videosInCategory.find(v => 
      v.youtubeId === playbackInfo.videoId || v.id === playbackInfo.videoId
    )
    
    if (foundVideo) {
      return {
        ...foundVideo,
        source: 'playbackInfo+category' // Track source
      }
    }
    
    // Fallback: construct minimal video object from playbackInfo
    return {
      title: playbackInfo.videoTitle,
      youtubeId: playbackInfo.videoId,
      id: playbackInfo.videoId,
      duration: playbackInfo.duration || 0,
      source: 'playbackInfo' // Track source
    }
  }
  
  // Priority 4: State-based fallback (may be stale but better than nothing)
  const stateVideo = videosInCategory[activeVideoIndex]
  if (stateVideo) {
    return {
      ...stateVideo,
      source: 'state' // Track source
    }
  }
  
  return null
}

/**
 * Get the current video index from the most reliable source
 * 
 * @param {Object} options
 * @param {Object} options.playbackInfo - Playback info from Player
 * @param {Number} options.activeVideoIndex - State-based index (fallback)
 * @returns {Number} Current video index
 */
export function getCurrentVideoIndex({ playbackInfo, activeVideoIndex = 0 }) {
  // Use playbackInfo index if available (more reliable)
  if (playbackInfo?.videoIndex !== undefined && playbackInfo.videoIndex >= 0) {
    return playbackInfo.videoIndex
  }
  
  // Fallback to state
  return activeVideoIndex
}

/**
 * Get the next video in the playlist
 * 
 * @param {Object} options
 * @param {Object} options.externalVideo - External video state
 * @param {Object} options.playbackInfo - Playback info from Player
 * @param {Array} options.videosInCategory - All videos in current category
 * @param {Number} options.activeVideoIndex - State-based index (fallback)
 * @returns {Object|null} Next video object or null
 */
export function getNextVideo({ 
  externalVideo, 
  playbackInfo, 
  videosInCategory = [], 
  activeVideoIndex = 0 
}) {
  // External videos don't have next
  if (externalVideo) {
    return null
  }
  
  // Use playbackInfo index if available
  const currentIndex = getCurrentVideoIndex({ playbackInfo, activeVideoIndex })
  
  if (videosInCategory.length > 0) {
    const nextIndex = (currentIndex + 1) % videosInCategory.length
    return videosInCategory[nextIndex] || videosInCategory[0] || null
  }
  
  return null
}

/**
 * Create a normalized video object for consistent API responses
 * 
 * @param {Object} video - Video object from any source
 * @returns {Object} Normalized video object
 */
export function normalizeVideo(video) {
  if (!video) return null
  
  return {
    title: video.title || 'Unknown',
    youtubeId: video.youtubeId || video.id || null,
    id: video.youtubeId || video.id || null,
    duration: video.duration || 0,
    thumbnail: video.thumbnail || null,
    // Preserve source for debugging
    _source: video.source || 'unknown'
  }
}
