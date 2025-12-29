/**
 * Live State Controller - Minimal HTTP layer with ETag support
 * Server does ALL computation, client just renders
 * 
 * Features:
 * - ETag for 304 Not Modified responses
 * - Cache-Control headers for CDN
 */

const liveStateService = require('../services/liveStateService');
const crypto = require('crypto');

// Generate ETag from state (video index + position rounded to 1s)
function generateETag(state) {
  const key = `${state.live.categoryId}-${state.live.videoIndex}-${Math.floor(state.live.position)}`;
  return crypto.createHash('md5').update(key).digest('hex').substring(0, 16);
}

/**
 * GET /api/live-state?categoryId=xxx&includeNext=true
 * Returns EVERYTHING client needs in ONE call
 * Supports ETag for 304 responses
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
    
    // Generate ETag
    const etag = generateETag(state);
    
    // Check If-None-Match header
    const clientETag = req.headers['if-none-match'];
    if (clientETag === etag) {
      // Content hasn't changed significantly
      res.set({
        'ETag': etag,
        'Cache-Control': 'private, max-age=1',
        'X-Server-Time': Date.now().toString(),
      });
      return res.status(304).end();
    }
    
    // Set response headers
    res.set({
      'ETag': etag,
      'Cache-Control': 'private, max-age=1, stale-while-revalidate=5',
      'X-Server-Time': Date.now().toString(),
    });
    
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
    res.set('Cache-Control', 'private, max-age=2');
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
 * GET /api/live-state/manifest?categoryId=xxx
 * Returns FULL playlist manifest for predictive engine
 * Client downloads once, computes locally forever
 */
exports.getManifest = async (req, res) => {
  try {
    const { categoryId } = req.query;
    
    if (!categoryId) {
      return res.status(400).json({ error: 'categoryId required' });
    }

    const manifest = await liveStateService.getManifest(categoryId);
    
    // Cache aggressively - manifest rarely changes
    res.set({
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      'X-Server-Time': Date.now().toString(),
    });
    
    res.json(manifest);
  } catch (error) {
    console.error('[LiveState] Manifest error:', error.message);
    res.status(500).json({ error: error.message });
  }
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
