/**
 * Global Epoch Controller
 * 
 * Handles HTTP requests/responses for global epoch endpoints.
 * Delegates business logic to GlobalEpochService.
 */

const globalEpochService = require('../services/globalEpochService');

class GlobalEpochController {
  /**
   * GET /api/global-epoch
   * Get the current global epoch (public endpoint - all users need this)
   * Cached for 2 hours since epoch never changes
   */
  async getGlobalEpoch(request, response) {
    try {
      const epochData = await globalEpochService.getGlobalEpoch();
      response.json(epochData);
    } catch (error) {
      console.error('[GlobalEpochController] GET error:', error);
      response.status(500).json({ 
        error: 'Failed to get global epoch', 
        details: error.message 
      });
    }
  }

  /**
   * POST /api/global-epoch/reset
   * Reset the global epoch (admin only - use with extreme caution!)
   * This will affect ALL users - only use if absolutely necessary
   */
  async resetGlobalEpoch(request, response) {
    try {
      const adminUsername = request.admin?.username || 'unknown';
      console.log(`[GlobalEpochController] Reset by admin ${adminUsername}`);
      
      const result = await globalEpochService.resetGlobalEpoch();
      response.json(result);
    } catch (error) {
      console.error('[GlobalEpochController] Reset error:', error);
      response.status(500).json({ 
        error: 'Failed to reset global epoch', 
        details: error.message 
      });
    }
  }
}

module.exports = new GlobalEpochController();


