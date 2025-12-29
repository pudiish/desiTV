/**
 * Channel Controller
 * 
 * Handles HTTP requests/responses for channel endpoints.
 * Delegates business logic to ChannelService and VideoService.
 */

const channelService = require('../services/channelService');
const videoService = require('../services/videoService');

class ChannelController {
  /**
   * GET /api/channels
   * Get all channels
   */
  async getAllChannels(request, response) {
    try {
      const channels = await channelService.getAllChannels();
      response.json(channels);
    } catch (error) {
      console.error('[ChannelController] GET /api/channels error:', error);
      response.status(500).json({ message: 'Server error' });
    }
  }

  /**
   * GET /api/channels/:id
   * Get single channel by ID
   */
  async getChannelById(request, response) {
    try {
      const { id } = request.params;
      const channel = await channelService.getChannelById(id);
      response.json(channel);
    } catch (error) {
      if (error.message === 'Channel not found') {
        response.status(404).json({ message: 'Channel not found' });
      } else {
        console.error('[ChannelController] GET /api/channels/:id error:', error);
        response.status(500).json({ message: 'Server error' });
      }
    }
  }

  /**
   * GET /api/channels/:id/current
   * Get current playback position for a channel
   */
  async getCurrentPosition(request, response) {
    try {
      const { id } = request.params;
      const position = await channelService.getCurrentPosition(id, request);
      response.json(position);
    } catch (error) {
      if (error.message === 'Channel not found') {
        response.status(404).json({ message: 'Channel not found' });
      } else {
        console.error('[ChannelController] GET /api/channels/:id/current error:', error);
        response.status(500).json({ message: 'Server error', error: error.message });
      }
    }
  }

  /**
   * GET /api/channels/:id/position
   * Alias for getCurrentPosition (backward compatibility)
   */
  async getPosition(request, response) {
    return this.getCurrentPosition(request, response);
  }

  /**
   * POST /api/channels
   * Create a new channel
   */
  async createChannel(request, response) {
    try {
      const { name, playlistStartEpoch } = request.body;
      if (!name) {
        return response.status(400).json({ message: 'Missing name' });
      }

      const channel = await channelService.createChannel(name, playlistStartEpoch);
      response.json(channel);
    } catch (error) {
      if (error.message === 'Channel already exists') {
        response.status(400).json({ message: 'Channel already exists' });
      } else {
        console.error('[ChannelController] POST /api/channels error:', error);
        response.status(500).json({ message: 'Server error' });
      }
    }
  }

  /**
   * DELETE /api/channels/:channelId
   * Delete a channel
   */
  async deleteChannel(request, response) {
    try {
      const { channelId } = request.params;
      const adminUsername = request.admin?.username;
      console.log(`[ChannelController] Admin "${adminUsername}" attempting to delete channel: ${channelId}`);

      const channel = await channelService.deleteChannel(channelId);
      response.json({ message: 'Channel deleted successfully', channel });
    } catch (error) {
      if (error.message === 'Channel not found') {
        response.status(404).json({ message: 'Channel not found' });
      } else {
        console.error('[ChannelController] DELETE /api/channels/:channelId error:', error);
        response.status(500).json({ message: error.message || 'Server error' });
      }
    }
  }

  /**
   * POST /api/channels/:channelId/videos
   * Add a video to a channel
   */
  async addVideo(request, response) {
    try {
      const { channelId } = request.params;
      const { title, youtubeId, duration, year, tags, category } = request.body;

      if (!youtubeId || !title) {
        return response.status(400).json({ message: 'Missing youtubeId or title' });
      }

      const channel = await videoService.addVideoToChannel(channelId, {
        title,
        youtubeId,
        duration,
        year,
        tags,
        category
      });

      response.json(channel);
    } catch (error) {
      if (error.message === 'Channel not found') {
        response.status(404).json({ message: 'Channel not found' });
      } else if (error.message === 'Video already exists in this channel') {
        response.status(400).json({ message: error.message });
      } else {
        console.error('[ChannelController] POST /api/channels/:channelId/videos error:', error);
        response.status(500).json({ message: 'Server error' });
      }
    }
  }

  /**
   * POST /api/channels/:id/add-video
   * Add a video to a channel (alternative endpoint)
   */
  async addVideoAlternative(request, response) {
    try {
      const channelId = request.params.id;
      const { title, youtubeId } = request.body;

      if (!youtubeId || !title) {
        return response.status(400).json({ 
          message: 'Missing required fields: youtubeId, title' 
        });
      }

      const channel = await videoService.addVideoToChannel(channelId, {
        title,
        youtubeId,
        duration: 30
      });

      response.json({ 
        message: 'Video added successfully', 
        video: channel.items[channel.items.length - 1],
        channel 
      });
    } catch (error) {
      if (error.message === 'Channel not found') {
        response.status(404).json({ message: 'Channel not found' });
      } else if (error.message === 'Video already exists in this channel') {
        response.status(400).json({ message: error.message });
      } else {
        console.error('[ChannelController] POST /api/channels/:id/add-video error:', error);
        response.status(500).json({ message: error.message || 'Failed to add video' });
      }
    }
  }

  /**
   * DELETE /api/channels/:channelId/videos/:videoId
   * Remove a video from a channel
   */
  async removeVideo(request, response) {
    try {
      const { channelId, videoId } = request.params;
      const adminUsername = request.admin?.username;
      console.log(`[ChannelController] Admin "${adminUsername}" deleting video: ${videoId} from channel: ${channelId}`);

      if (!videoId) {
        return response.status(400).json({ message: 'Video ID is required' });
      }

      const updatedChannel = await videoService.removeVideoFromChannel(channelId, videoId);
      response.json(updatedChannel);
    } catch (error) {
      if (error.message === 'Channel not found' || error.message === 'Video not found') {
        response.status(404).json({ message: error.message });
      } else {
        console.error('[ChannelController] DELETE /api/channels/:channelId/videos/:videoId error:', error);
        response.status(500).json({ message: error.message || 'Server error' });
      }
    }
  }

  /**
   * POST /api/channels/:channelId/bulk-upload
   * Bulk upload videos from file content
   */
  async bulkUploadVideos(request, response) {
    try {
      const { channelId } = request.params;
      const { fileContent } = request.body;

      if (!fileContent || typeof fileContent !== 'string') {
        return response.status(400).json({ 
          message: 'Missing or invalid fileContent' 
        });
      }

      const result = await videoService.bulkAddVideos(channelId, fileContent);
      response.json(result);
    } catch (error) {
      if (error.message === 'Channel not found') {
        response.status(404).json({ message: 'Channel not found' });
      } else if (error.message.includes('No valid YouTube links')) {
        response.status(400).json({ message: error.message });
      } else {
        console.error('[ChannelController] POST /api/channels/:channelId/bulk-upload error:', error);
        response.status(500).json({ message: error.message || 'Failed to bulk upload videos' });
      }
    }
  }

  /**
   * GET /api/channels/admin/cache-stats
   * Get cache statistics (admin only)
   */
  async getCacheStats(request, response) {
    try {
      const stats = await channelService.getCacheStats();
      response.json(stats);
    } catch (error) {
      console.error('[ChannelController] GET /api/channels/admin/cache-stats error:', error);
      response.status(500).json({ message: 'Server error' });
    }
  }
}

module.exports = new ChannelController();

