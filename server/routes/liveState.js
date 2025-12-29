/**
 * Live State Routes
 * 
 * API endpoints for the LIVE broadcast state.
 * 
 * This is where clients come to ask "What should I be watching RIGHT NOW?"
 * And we tell them. No arguments. Server is KING. 👑
 */

const express = require('express');
const router = express.Router();
const liveStateController = require('../controllers/liveStateController');

/**
 * GET /api/live-state/health
 * Health check endpoint - always define specific routes BEFORE parameterized ones!
 * (Learned this the hard way, didn't we? 😅)
 */
router.get('/health', liveStateController.healthCheck.bind(liveStateController));

/**
 * GET /api/live-state/all
 * Get live state for ALL categories (admin/debug)
 */
router.get('/all', liveStateController.getAllLiveStates.bind(liveStateController));

/**
 * GET /api/live-state?categoryId=xxx&includeNext=true
 * 
 * THE MAIN ENDPOINT 🌟
 * 
 * Returns the authoritative live state for a category.
 * 
 * Query Parameters:
 * - categoryId (required): The category/playlist ID
 * - includeNext (optional): Include next video info for previews
 * 
 * Response:
 * {
 *   live: { videoIndex, position, duration, remaining, ... },
 *   slot: { cyclePosition, cycleCount, ... },
 *   sync: { epoch, serverTime },
 *   next: { videoIndex, videoId, ... } // if includeNext=true
 * }
 * 
 * This endpoint is:
 * - Public (no auth required - everyone needs to sync)
 * - Cached for 1 second (LIVE data goes stale FAST)
 * - Rate limited (don't spam us bro)
 */
router.get('/', liveStateController.getLiveState.bind(liveStateController));

module.exports = router;
