/**
 * Live State Routes - Server-Authoritative LIVE sync
 */

const express = require('express');
const router = express.Router();
const liveStateController = require('../controllers/liveStateController');
const sseController = require('../controllers/sseController');
const manifestGenerator = require('../utils/manifestGenerator');

// Health check
router.get('/health', liveStateController.getHealth);

// All states (admin)
router.get('/all', liveStateController.getAllLiveStates);

// SSE Stream endpoint (push-only, replaces polling)
router.get('/stream', sseController.streamLiveState);

// SSE Stats (admin)
router.get('/sse-stats', sseController.getSSEStats);

// ═══════════════════════════════════════════════════════════════════
// CDN-READY MANIFEST ENDPOINTS (Netflix approach)
// ═══════════════════════════════════════════════════════════════════

// Full manifest (all categories, pre-computed positions)
router.get('/manifest/full', async (req, res) => {
  try {
    const manifest = await manifestGenerator.generateFullManifest();
    
    // ADAPTIVE TTL: Based on shortest video duration
    // If shortest video is 2 min, TTL should be < 2 min to avoid stale data
    const shortestVideo = Object.values(manifest.categories)
      .flatMap(c => c.playlist || [])
      .reduce((min, v) => Math.min(min, v.duration || 300), Infinity);
    
    // TTL = 80% of shortest video duration, capped at 5 min, minimum 30s
    const adaptiveTTL = Math.max(30, Math.min(300, Math.floor(shortestVideo * 0.8)));
    
    res.set({
      'Cache-Control': `public, max-age=${adaptiveTTL}, stale-while-revalidate=${adaptiveTTL * 2}`,
      'Content-Type': 'application/json',
      'X-Manifest-Version': manifest.version,
      'X-Adaptive-TTL': adaptiveTTL,
      'X-Shortest-Video': shortestVideo,
    });
    
    res.json(manifest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Light manifest (minimal bandwidth, client computes positions)
router.get('/manifest/light', async (req, res) => {
  try {
    const manifest = await manifestGenerator.generateLightManifest();
    
    // ADAPTIVE TTL for light manifest too
    const shortestVideo = Object.values(manifest.c)
      .flatMap(c => c.d || [])
      .reduce((min, d) => Math.min(min, d || 300), Infinity);
    
    const adaptiveTTL = Math.max(30, Math.min(300, Math.floor(shortestVideo * 0.8)));
    
    res.set({
      'Cache-Control': `public, max-age=${adaptiveTTL}, stale-while-revalidate=${adaptiveTTL * 2}`,
      'Content-Type': 'application/json',
      'X-Adaptive-TTL': adaptiveTTL,
    });
    
    res.json(manifest);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manifest stats (admin - shows size comparison)
router.get('/manifest/stats', async (req, res) => {
  try {
    const stats = await manifestGenerator.getManifestWithStats();
    res.json({
      full: { sizeKB: stats.full.sizeKB, sizeBytes: stats.full.sizeBytes },
      light: { sizeKB: stats.light.sizeKB, sizeBytes: stats.light.sizeBytes },
      savings: `${Math.round((1 - stats.light.sizeBytes / stats.full.sizeBytes) * 100)}%`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════

// Cache management (admin)
router.post('/warm', liveStateController.warmCache);
router.post('/clear-cache', liveStateController.clearCache);

// Main endpoint - returns EVERYTHING client needs
router.get('/', liveStateController.getLiveState);

// Manifest endpoint (full playlist for predictive engine)
router.get('/manifest', liveStateController.getManifest);

module.exports = router;
