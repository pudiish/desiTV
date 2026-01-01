/**
 * Chat Routes
 * 
 * API endpoints for DesiTV VJ Assistant
 */

const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Rate limiting for chat (simple implementation)
const rateLimitMap = new Map();
const RATE_LIMIT = 20; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  let record = rateLimitMap.get(ip);
  if (!record || now - record.windowStart > RATE_WINDOW) {
    record = { count: 0, windowStart: now };
  }
  
  record.count++;
  rateLimitMap.set(ip, record);
  
  if (record.count > RATE_LIMIT) {
    return res.status(429).json({ 
      error: 'Arre yaar, thoda slow! 🐢 Too many messages. Wait a minute.' 
    });
  }
  
  next();
}

/**
 * POST /api/chat/message
 * Send a message and get AI response
 */
router.post('/message', rateLimiter, chatController.handleMessage);

/**
 * GET /api/chat/suggestions
 * Get contextual suggestions
 */
router.get('/suggestions', chatController.getSuggestions);

module.exports = router;
