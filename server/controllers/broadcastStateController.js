/**
 * Broadcast State Controller
 * 
 * Handles HTTP requests/responses for broadcast state endpoints.
 * Delegates business logic to BroadcastStateService.
 */

const broadcastStateService = require('../services/broadcastStateService');

class BroadcastStateController {
  /**
   * GET /api/broadcast-state/all
   * Get all broadcast states (diagnostic/admin only)
   */
  async getAllStates(request, response) {
    try {
      const result = await broadcastStateService.getAllStates();
      response.json(result);
    } catch (error) {
      console.error('[BroadcastStateController] GetAll error:', error);
      response.status(500).json({ error: 'Failed to get all states', details: error.message });
    }
  }

  /**
   * GET /api/broadcast-state/:channelId
   * Get broadcast state for a channel
   * Calculates virtual position based on elapsed time
   */
  async getStateByChannelId(request, response) {
    try {
      const { channelId } = request.params;
      const state = await broadcastStateService.getStateByChannelId(channelId);
      response.json(state);
    } catch (error) {
      if (error.message === 'State not found') {
        return response.status(404).json({
          error: 'State not found',
          channelId: request.params.channelId,
          message: 'No broadcast state exists for this channel yet',
        });
      }
      console.error('[BroadcastStateController] GET error:', error);
      response.status(500).json({ error: 'Failed to retrieve state', details: error.message });
    }
  }

  /**
   * POST /api/broadcast-state/:channelId
   * Save or update broadcast state for a channel
   */
  async saveState(request, response) {
    try {
      const { channelId } = request.params;
      const stateData = request.body;
      const result = await broadcastStateService.saveState(channelId, stateData);
      response.json(result);
    } catch (error) {
      if (error.message === 'No state data provided') {
        return response.status(400).json({ error: error.message });
      }
      console.error('[BroadcastStateController] POST error:', error);
      response.status(500).json({ error: 'Failed to save state', details: error.message });
    }
  }

  /**
   * GET /api/broadcast-state/:channelId/timeline
   * Calculate current timeline position
   */
  async calculateTimeline(request, response) {
    try {
      const { channelId } = request.params;
      const result = await broadcastStateService.calculateTimeline(channelId);
      response.json(result);
    } catch (error) {
      if (error.message === 'State not found') {
        return response.status(404).json({ error: 'State not found', channelId: request.params.channelId });
      }
      console.error('[BroadcastStateController] Timeline error:', error);
      response.status(500).json({ error: 'Failed to get timeline', details: error.message });
    }
  }

  /**
   * DELETE /api/broadcast-state/:channelId
   * Clear broadcast state for a channel
   */
  async clearState(request, response) {
    try {
      const { channelId } = request.params;
      const result = await broadcastStateService.clearState(channelId);
      response.json(result);
    } catch (error) {
      console.error('[BroadcastStateController] DELETE error:', error);
      response.status(500).json({ error: 'Failed to clear state', details: error.message });
    }
  }
}

module.exports = new BroadcastStateController();


