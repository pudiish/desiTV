/**
 * Live State Controller - Minimal HTTP layer
 * Server does ALL computation, client just renders
 */

const liveStateService = require('../services/liveStateService');

/**
 * GET /api/live-state?categoryId=xxx&includeNext=true
 * Returns EVERYTHING client needs in ONE call
 */
exports.getLiveState = async (req, res) => {
  try {
    const { categoryId, includeNext } = req.query;
    
    if (!categoryId) {
      return res.status(400).json({ error: 'categoryId required' });
    }

    const state = await liveStateService.getLiveState(
      categoryId, 
      includeNext === 'true' || includeNext === '1'
    );
    
    res.json(state);
  } catch (error) {
    console.error('[LiveState] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/live-state/all
 * Returns state for ALL channels (admin/multi-view)
 */
exports.getAllLiveStates = async (req, res) => {
  try {
    const states = await liveStateService.getAllLiveStates();
    res.json(states);
  } catch (error) {
    console.error('[LiveState] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/live-state/health
 * Quick health check
 */
exports.getHealth = async (req, res) => {
  res.json({
    status: 'ok',
    serverTimeMs: Date.now(),
    service: 'live-state',
  });
};

/**
 * POST /api/live-state/warm
 * Pre-warm cache (call on deploy or admin action)
 */
exports.warmCache = async (req, res) => {
  try {
    await liveStateService.warmCache();
    res.json({ success: true, message: 'Cache warmed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/live-state/clear-cache
 * Clear cache (call when data changes)
 */
exports.clearCache = async (req, res) => {
  try {
    liveStateService.clearCache();
    res.json({ success: true, message: 'Cache cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
