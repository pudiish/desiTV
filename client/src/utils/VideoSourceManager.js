/**
 * Video Source Manager - Multiple Source Fallback System
 * 
 * Provides fallback video sources when primary source fails
 * Supports multiple strategies:
 * - Alternative YouTube IDs
 * - Different video formats
 * - Backup sources
 * 
 * Usage:
 *   const sourceManager = new VideoSourceManager(video)
 *   const sources = sourceManager.getSources()
 *   const nextSource = sourceManager.getNextSource()
 */

class VideoSourceManager {
  constructor(video, options = {}) {
    this.video = video || {}
    this.currentSourceIndex = 0
    this.failedSources = new Set()
    this.options = {
      maxFallbacks: options.maxFallbacks || 3,
      enableAlternativeIds: options.enableAlternativeIds !== false, // Default true
      ...options
    }
  }

  /**
   * Get all available sources for this video
   * Priority order:
   * 1. Primary YouTube ID (youtubeId)
   * 2. Alternative YouTube IDs (altYoutubeId, backupYoutubeId)
   * 3. Mirror sources (mirrorYoutubeId)
   */
  getSources() {
    const sources = []

    // Primary source
    if (this.video.youtubeId) {
      sources.push({
        type: 'youtube',
        id: this.video.youtubeId,
        priority: 1,
        label: 'primary'
      })
    }

    // Alternative YouTube IDs (if enabled)
    if (this.options.enableAlternativeIds) {
      // Check for altYoutubeId
      if (this.video.altYoutubeId && this.video.altYoutubeId !== this.video.youtubeId) {
        sources.push({
          type: 'youtube',
          id: this.video.altYoutubeId,
          priority: 2,
          label: 'alternative'
        })
      }

      // Check for backupYoutubeId
      if (this.video.backupYoutubeId && 
          this.video.backupYoutubeId !== this.video.youtubeId &&
          this.video.backupYoutubeId !== this.video.altYoutubeId) {
        sources.push({
          type: 'youtube',
          id: this.video.backupYoutubeId,
          priority: 3,
          label: 'backup'
        })
      }

      // Check for mirrorYoutubeId
      if (this.video.mirrorYoutubeId && 
          this.video.mirrorYoutubeId !== this.video.youtubeId &&
          this.video.mirrorYoutubeId !== this.video.altYoutubeId &&
          this.video.mirrorYoutubeId !== this.video.backupYoutubeId) {
        sources.push({
          type: 'youtube',
          id: this.video.mirrorYoutubeId,
          priority: 4,
          label: 'mirror'
        })
      }
    }

    // Sort by priority
    return sources.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Get current source
   */
  getCurrentSource() {
    const sources = this.getSources()
    if (sources.length === 0) return null
    
    const validIndex = Math.min(this.currentSourceIndex, sources.length - 1)
    return sources[validIndex]
  }

  /**
   * Get next fallback source
   * Returns null if no more sources available
   */
  getNextSource() {
    const sources = this.getSources()
    
    // Find next source that hasn't failed
    for (let i = this.currentSourceIndex + 1; i < sources.length; i++) {
      const source = sources[i]
      const sourceKey = `${source.type}-${source.id}`
      
      if (!this.failedSources.has(sourceKey)) {
        this.currentSourceIndex = i
        return source
      }
    }

    // No more sources
    return null
  }

  /**
   * Mark current source as failed
   */
  markCurrentSourceFailed() {
    const current = this.getCurrentSource()
    if (current) {
      const sourceKey = `${current.type}-${current.id}`
      this.failedSources.add(sourceKey)
      console.log(`[VideoSourceManager] Marked source as failed: ${current.label} (${current.id})`)
    }
  }

  /**
   * Reset to first source
   */
  reset() {
    this.currentSourceIndex = 0
    this.failedSources.clear()
  }

  /**
   * Check if there are more sources available
   */
  hasMoreSources() {
    const sources = this.getSources()
    return this.currentSourceIndex < sources.length - 1
  }

  /**
   * Get total number of available sources
   */
  getSourceCount() {
    return this.getSources().length
  }

  /**
   * Get failed sources count
   */
  getFailedCount() {
    return this.failedSources.size
  }

  /**
   * Check if all sources have been tried
   */
  allSourcesFailed() {
    const sources = this.getSources()
    return sources.length > 0 && this.failedSources.size >= sources.length
  }

  /**
   * Get source info for debugging
   */
  getSourceInfo() {
    const sources = this.getSources()
    const current = this.getCurrentSource()
    
    return {
      total: sources.length,
      current: this.currentSourceIndex + 1,
      failed: this.failedSources.size,
      currentSource: current,
      allSources: sources,
      hasMore: this.hasMoreSources(),
      allFailed: this.allSourcesFailed()
    }
  }
}

/**
 * Helper function to create a VideoSourceManager instance
 */
export function createVideoSourceManager(video, options) {
  return new VideoSourceManager(video, options)
}

/**
 * Helper function to get YouTube ID with fallback
 * Returns the best available YouTube ID for a video
 */
export function getBestYouTubeId(video, options = {}) {
  const manager = new VideoSourceManager(video, options)
  const current = manager.getCurrentSource()
  return current ? current.id : video?.youtubeId || null
}

export default VideoSourceManager

