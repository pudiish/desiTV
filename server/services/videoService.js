/**
 * Video Service
 * 
 * Business logic for video operations within channels.
 * Handles video CRUD, bulk operations, and metadata fetching.
 */

const Channel = require('../models/Channel');
const channelService = require('./channelService');

class VideoService {
  /**
   * Extract YouTube video ID from text/URL
   * @param {string} text - Text that may contain YouTube URL or ID
   * @returns {string|null} YouTube video ID or null
   */
  extractVideoId(text) {
    if (!text) return null;
    const trimmedText = text.trim();
    
    // If it's already an 11-character ID, return it
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmedText)) {
      return trimmedText;
    }
    
    // Try to extract from URL patterns anywhere in the text
    const urlPatterns = [
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of urlPatterns) {
      const match = trimmedText.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Extract all YouTube IDs from a line (handles multiple URLs per line)
   * @param {string} text - Text containing YouTube URLs
   * @returns {Array<string>} Array of YouTube video IDs
   */
  extractAllVideoIds(text) {
    if (!text) return [];
    const videoIds = [];
    
    // Global pattern to find all YouTube URLs/IDs
    const globalPattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/g;
    let match;
    while ((match = globalPattern.exec(text)) !== null) {
      if (match[1] && !videoIds.includes(match[1])) {
        videoIds.push(match[1]);
      }
    }
    
    return videoIds;
  }

  /**
   * Fetch YouTube metadata using oEmbed (no API key required)
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object|null>} Video metadata or null on failure
   */
  async fetchYouTubeMetadata(videoId) {
    try {
      const oembedUrl = `https:// www.youtube.com/oembed?url=https:// www.youtube.com/watch?v=${videoId}&format=json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(oembedUrl, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return {
        title: data.title || 'Untitled',
        author: data.author_name
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Fetch YouTube metadata using Data API (requires API key)
   * @param {string} videoId - YouTube video ID
   * @returns {Promise<Object|null>} Video metadata or null on failure
   */
  async fetchYouTubeDataAPIMetadata(videoId) {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return null;
    }

    try {
      const metadataUrl = `https:// www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const metadataResponse = await fetch(metadataUrl, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!metadataResponse.ok) {
        return null;
      }
      
      const data = await metadataResponse.json();
      if (data.items && data.items[0]) {
        const item = data.items[0];
        const title = item.snippet.title;
        const durationString = item.contentDetails?.duration;
        
        let duration = 30; // Default
        if (durationString) {
          const durationMatch = durationString.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
          if (durationMatch) {
            const hours = parseInt(durationMatch[1] || 0, 10);
            const minutes = parseInt(durationMatch[2] || 0, 10);
            const seconds = parseInt(durationMatch[3] || 0, 10);
            duration = hours * 3600 + minutes * 60 + seconds;
          }
        }
        
        return { title, duration };
      }
      
      return null;
    } catch (error) {
      console.warn(`[VideoService] YouTube API failed for ${videoId}:`, error.message);
      return null;
    }
  }

  /**
   * Parse file content into video objects
   * Supports JSON array, CSV, or newline-separated URLs
   * @param {string} fileContent - File content string
   * @returns {Promise<Array>} Array of video objects
   */
  async parseFileContent(fileContent) {
    const videos = [];
    const lines = fileContent.trim().split('\n').filter(line => line.trim());

    // Try JSON format first
    if (fileContent.trim().startsWith('[') || fileContent.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(fileContent);
        const array = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of array) {
          if (item.youtubeId || item.videoId || item.url) {
            const videoId = item.youtubeId || item.videoId || this.extractVideoId(item.url);
            if (videoId) {
              videos.push({
                youtubeId: videoId,
                title: item.title || 'Untitled',
                duration: item.duration || 30,
                year: item.year,
                tags: item.tags || [],
                category: item.category
              });
            }
          }
        }
      } catch (jsonError) {
        // Not JSON, continue to other formats
      }
    }

    // If no videos parsed yet, try CSV or TXT format
    if (videos.length === 0) {
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) continue; // Skip empty lines and comments

        // Extract all YouTube IDs from this line
        const foundIds = this.extractAllVideoIds(trimmedLine);
        
        if (foundIds.length > 0) {
          for (const videoId of foundIds) {
            videos.push({
              youtubeId: videoId,
              title: 'Untitled',
              duration: 30
            });
          }
        } else if (trimmedLine.includes(',')) {
          // Try CSV format: url,title or id,title
          const parts = trimmedLine.split(',').map(part => part.trim());
          if (parts.length >= 1) {
            const videoId = this.extractVideoId(parts[0]);
            if (videoId) {
              videos.push({
                youtubeId: videoId,
                title: parts[1] || 'Untitled',
                duration: 30
              });
            }
          }
        } else {
          // Try plain video ID
          const videoId = this.extractVideoId(trimmedLine);
          if (videoId) {
            videos.push({
              youtubeId: videoId,
              title: 'Untitled',
              duration: 30
            });
          }
        }
      }
    }

    return videos;
  }

  /**
   * Enrich video metadata if title is missing
   * @param {Object} video - Video object
   * @returns {Promise<Object>} Video with enriched metadata
   */
  async enrichVideoMetadata(video) {
    if (video.title !== 'Untitled') {
      return video;
    }

    // First try oEmbed (free, no API key required)
    const oembedData = await this.fetchYouTubeMetadata(video.youtubeId);
    if (oembedData && oembedData.title) {
      video.title = oembedData.title;
      return video;
    }

    // Fallback to YouTube Data API if available
    const apiData = await this.fetchYouTubeDataAPIMetadata(video.youtubeId);
    if (apiData) {
      if (apiData.title) video.title = apiData.title;
      if (apiData.duration) video.duration = apiData.duration;
    }

    return video;
  }

  /**
   * Add single video to channel
   * @param {string} channelId - Channel ID
   * @param {Object} videoData - Video data (title, youtubeId, duration, etc.)
   * @returns {Promise<Object>} Updated channel
   * @throws {Error} If channel not found or video already exists
   */
  async addVideoToChannel(channelId, videoData) {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check if video already exists
    const exists = channel.items.some(item => item.youtubeId === videoData.youtubeId);
    if (exists) {
      throw new Error('Video already exists in this channel');
    }

    // Enrich metadata if needed
    const enrichedVideo = await this.enrichVideoMetadata({
      ...videoData,
      title: videoData.title || 'Untitled',
      duration: videoData.duration || 30
    });

    // Add video to channel
    channel.items.push({
      title: enrichedVideo.title,
      youtubeId: enrichedVideo.youtubeId,
      duration: enrichedVideo.duration || 30,
      year: enrichedVideo.year,
      tags: enrichedVideo.tags || [],
      category: enrichedVideo.category
    });

    await channel.save();
    await channelService.invalidateCache(channelId);
    await channelService.regenerateStaticJSON();

    return channel;
  }

  /**
   * Bulk add videos to channel from file content
   * @param {string} channelId - Channel ID
   * @param {string} fileContent - File content string
   * @returns {Promise<Object>} Result with counts and errors
   */
  async bulkAddVideos(channelId, fileContent) {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const parsedVideos = await this.parseFileContent(fileContent);
    
    if (parsedVideos.length === 0) {
      throw new Error('No valid YouTube links found in file. Supported formats: JSON array, CSV (url,title), or text with YouTube URLs');
    }

    let addedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const video of parsedVideos) {
      try {
        // Check if video already exists
        const exists = channel.items.some(item => item.youtubeId === video.youtubeId);
        if (exists) {
          skippedCount++;
          continue;
        }

        // Enrich metadata if needed
        const enrichedVideo = await this.enrichVideoMetadata(video);

        // Add video to channel
        channel.items.push({
          title: enrichedVideo.title,
          youtubeId: enrichedVideo.youtubeId,
          duration: enrichedVideo.duration || 30,
          year: enrichedVideo.year,
          tags: enrichedVideo.tags || [],
          category: enrichedVideo.category
        });

        addedCount++;
      } catch (videoError) {
        errors.push(`Error processing ${video.youtubeId}: ${videoError.message}`);
      }
    }

    if (addedCount > 0) {
      await channel.save();
      await channelService.invalidateCache(channelId);
      await channelService.regenerateStaticJSON();
    }

    return {
      message: `Successfully added ${addedCount} video(s)${skippedCount > 0 ? `, skipped ${skippedCount} duplicate(s)` : ''}`,
      count: addedCount,
      skipped: skippedCount,
      total: parsedVideos.length,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Remove video from channel
   * @param {string} channelId - Channel ID
   * @param {string} videoId - Video ID (can be MongoDB _id or youtubeId)
   * @returns {Promise<Object>} Updated channel
   * @throws {Error} If channel or video not found
   */
  async removeVideoFromChannel(channelId, videoId) {
    const channel = await Channel.findById(channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const originalItemCount = channel.items.length;

    // Try to remove by _id first
    let updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $pull: { items: { _id: videoId } } },
      { new: true }
    );

    // If not found, try by youtubeId
    if (!updatedChannel || updatedChannel.items.length === originalItemCount) {
      updatedChannel = await Channel.findByIdAndUpdate(
        channelId,
        { $pull: { items: { youtubeId: videoId } } },
        { new: true }
      );
    }

    if (!updatedChannel || updatedChannel.items.length === originalItemCount) {
      throw new Error('Video not found');
    }

    await channelService.invalidateCache(channelId);
    await channelService.regenerateStaticJSON();

    return updatedChannel;
  }
}

module.exports = new VideoService();


