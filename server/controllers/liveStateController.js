/**
 * Live State Controller
 * 
 * The bouncer at the club 🚪
 * 
 * Validates requests, calls the service, sends responses.
 * Keeps the riffraff (bad requests) out and lets the VIPs
 * (valid requests) through to the service layer.
 */

const liveStateService = require('../services/liveStateService');

class LiveStateController {
  /**
   * GET /api/live-state
   * 
   * The main event! Returns exactly where a category should be playing.
   * 
   * Query params:
   * - categoryId (required): Which playlist are we talking about?
   * - includeNext (optional): Want a preview of what's coming? (default: false)
   */
  async getLiveState(req, res) {
    const startTime = Date.now();

    try {
      const { categoryId, includeNext } = req.query;

      // Validation - because garbage in, garbage out
      if (!categoryId) {
        return res.status(400).json({
          error: 'Missing categoryId parameter',
          hint: 'Try /api/live-state?categoryId=your_category_id',
          suggestion: 'Check /api/channels to see available categories',
        });
      }

      // Get the LIVE state - the moment of truth!
      const liveState = await liveStateService.getLiveState(
        categoryId,
        includeNext === 'true' || includeNext === '1'
      );

      // Add response timing because we're performance nerds
      const responseTime = Date.now() - startTime;

      res.json({
        ...liveState,
        _meta: {
          responseTimeMs: responseTime,
          endpoint: '/api/live-state',
        }
      });

    } catch (error) {
      console.error('[LiveStateController] Error:', error.message);

      // Don't expose internal errors to clients
      // They don't need to know our dirty laundry
      const statusCode = error.message.includes('not found') ? 404 : 500;
      
      res.status(statusCode).json({
        error: statusCode === 404 ? 'Category not found' : 'Failed to calculate live state',
        message: error.message,
        serverTime: new Date().toISOString(),
      });
    }
  }

  /**
   * GET /api/live-state/all
   * 
   * Admin endpoint to see ALL live states at once.
   * Like a security camera wall but for playlists.
   */
  async getAllLiveStates(req, res) {
    try {
      const states = await liveStateService.getAllLiveStates();
      res.json(states);
    } catch (error) {
      console.error('[LiveStateController] getAllLiveStates error:', error.message);
      res.status(500).json({
        error: 'Failed to get all live states',
        message: error.message,
      });
    }
  }

  /**
   * GET /api/live-state/health
   * 
   * Quick check that the live state system is working.
   * Returns server time and epoch - basic sanity check.
   */
  async healthCheck(req, res) {
    try {
      const GlobalEpoch = require('../models/GlobalEpoch');
      const globalEpoch = await GlobalEpoch.getOrCreate();
      
      res.json({
        status: 'healthy',
        serverTime: new Date().toISOString(),
        epoch: globalEpoch.epoch.toISOString(),
        uptime: process.uptime(),
        message: 'LIVE state service is running smoothly 🚀',
      });
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        error: error.message,
        serverTime: new Date().toISOString(),
      });
    }
  }
}

module.exports = new LiveStateController();
