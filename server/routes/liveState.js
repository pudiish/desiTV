/**
 * Live State Routes - Simplified (Client-side calculation)
 * 
 * NOTE: Clients calculate position locally using BroadcastStateManager.
 * These endpoints are kept for admin/debugging purposes only.
 */

const express = require('express');
const router = express.Router();
const liveStateController = require('../controllers/liveStateController');

// Health check
router.get('/health', liveStateController.getHealth);

// All states (admin/debugging only)
router.get('/all', liveStateController.getAllLiveStates);

// SSE and WebSocket removed - clients calculate position locally

// ═══════════════════════════════════════════════════════════════════
// NOTE: Manifest endpoints removed - clients use channels.json directly
// Clients calculate position locally using BroadcastStateManager
// ═══════════════════════════════════════════════════════════════════

// Cache management (admin/debugging only)
router.post('/warm', liveStateController.warmCache);
router.post('/clear-cache', liveStateController.clearCache);

// Main endpoint (admin/debugging only - clients don't use this)
router.get('/', liveStateController.getLiveState);

// Manifest endpoint (admin/debugging only)
router.get('/manifest', liveStateController.getManifest);

module.exports = router;
