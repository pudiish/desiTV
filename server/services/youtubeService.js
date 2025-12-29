/**
 * YouTube Service
 * 
 * Business logic for YouTube API operations.
 * Handles video metadata fetching and validation.
 */

/**
 * Parse ISO 8601 duration to seconds (PT#H#M#S)
 * @param {string} duration - ISO 8601 duration string
 * @returns {number} Duration in seconds
 */
function parseISODuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);
  return hours * 3600 + minutes * 60 + seconds;
}

class YouTubeService {
  /**
   * Fetch video metadata from YouTube API
   * @param {string} youtubeId - YouTube video ID
   * @returns {Promise<Object>} Video metadata (title, duration, embeddable)
   * @throws {Error} If API key not configured or video not found
   */
  async getVideoMetadata(youtubeId) {
    if (!youtubeId) {
      throw new Error('Missing youtubeId');
    }

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error('YOUTUBE_API_KEY not configured on server');
    }

    try {
      // Request status to check embeddable flag as well
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${encodeURIComponent(youtubeId)}&key=${apiKey}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`YouTube API error: ${errorData.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const item = data.items && data.items[0];
      
      if (!item) {
        throw new Error('Video not found');
      }

      const title = item.snippet.title;
      const duration = parseISODuration(item.contentDetails.duration || 'PT0S');
      const embeddable = item.status && typeof item.status.embeddable !== 'undefined' 
        ? item.status.embeddable 
        : true;

      return { title, duration, embeddable };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('YouTube API request timeout');
      }
      throw error;
    }
  }
}

module.exports = new YouTubeService();


