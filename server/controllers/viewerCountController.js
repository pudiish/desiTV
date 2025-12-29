/**
 * Viewer Count Controller
 * 
 * Handles HTTP requests/responses for viewer count endpoints.
 * Delegates business logic to ViewerCountService.
 */

const viewerCountService = require('../services/viewerCountService');

class ViewerCountController {
  /**
   * POST /api/viewer-count/:channelId/join
   * User joins a channel (increment viewer count)
   */
  async joinChannel(request, response) {
    try {
      const { channelId } = request.params;
      const { channelName } = request.body;
      const result = await viewerCountService.joinChannel(channelId, channelName);
      response.json(result);
    } catch (error) {
      // Never return 500 - viewer count is non-critical
      console.warn('[ViewerCountController] Join error (non-critical):', error.message);
      // Always return 200 OK
      response.json({
        success: true,
        channelId: request.params.channelId || 'unknown',
        activeViewers: 0,
        totalViews: 0,
      });
    }
  }

  /**
   * POST /api/viewer-count/:channelId/leave
   * User leaves a channel (decrement viewer count)
   */
  async leaveChannel(request, response) {
    try {
      const { channelId } = request.params;
      const result = await viewerCountService.leaveChannel(channelId);
      response.json(result);
    } catch (error) {
      // Never return 500 - viewer count is non-critical
      console.warn('[ViewerCountController] Leave error (non-critical):', error.message);
      // Always return 200 OK
      response.json({
        success: true,
        channelId: request.params.channelId || 'unknown',
        activeViewers: 0,
      });
    }
  }

  /**
   * GET /api/viewer-count/:channelId
   * Get current viewer count for a channel
   */
  async getViewerCount(request, response) {
    try {
      const { channelId } = request.params;
      const result = await viewerCountService.getViewerCount(channelId);
      response.json(result);
    } catch (error) {
      console.error('[ViewerCountController] GET error:', error);
      response.status(500).json({ error: 'Failed to get viewer count', details: error.message });
    }
  }

  /**
   * GET /api/viewer-count/all
   * Get viewer counts for all channels (for admin/stats)
   */
  async getAllViewerCounts(request, response) {
    try {
      const result = await viewerCountService.getAllViewerCounts();
      response.json(result);
    } catch (error) {
      console.error('[ViewerCountController] GetAll error:', error);
      response.status(500).json({ error: 'Failed to get all viewer counts', details: error.message });
    }
  }
}

module.exports = new ViewerCountController();


