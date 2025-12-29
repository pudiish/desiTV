/**
 * Live State Routes - Server-Authoritative LIVE sync
 */

const express = require('express');
const router = express.Router();
const liveStateController = require('../controllers/liveStateController');

// Health check
router.get('/health', liveStateController.getHealth);

// All states (admin)
router.get('/all', liveStateController.getAllLiveStates);

// Cache management (admin)
router.post('/warm', liveStateController.warmCache);
router.post('/clear-cache', liveStateController.clearCache);

// Main endpoint - returns EVERYTHING client needs
router.get('/', liveStateController.getLiveState);

module.exports = router;
