/**
 * YouTube Controller
 * 
 * Handles HTTP requests/responses for YouTube endpoints.
 * Delegates business logic to YouTubeService.
 */

const youtubeService = require('../services/youtubeService');

class YouTubeController {
  /**
   * GET /api/youtube/metadata?youtubeId=...
   * Get video metadata from YouTube API
   */
  async getVideoMetadata(request, response) {
    try {
      const { youtubeId } = request.query;
      const metadata = await youtubeService.getVideoMetadata(youtubeId);
      response.json(metadata);
    } catch (error) {
      if (error.message === 'Missing youtubeId') {
        return response.status(400).json({ message: error.message });
      }
      if (error.message === 'YOUTUBE_API_KEY not configured on server') {
        return response.status(500).json({ message: error.message });
      }
      if (error.message === 'Video not found') {
        return response.status(404).json({ message: error.message });
      }
      console.error('[YouTubeController] YouTube API error:', error.message);
      response.status(500).json({ 
        message: 'YouTube API error', 
        error: error.message 
      });
    }
  }
}

module.exports = new YouTubeController();


