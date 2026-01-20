const EnhancedVJCore = require('../mcp/enhancedVJCore');
const userMemory = require('../mcp/userMemory');
const broadcastStateService = require('../services/broadcastStateService');

const conversations = new Map();
const CONVERSATION_TTL = 30 * 60 * 1000; // 30 minutes

let vjCore = null;

async function initVJCore() {
  if (!vjCore) {
    vjCore = new EnhancedVJCore(userMemory, broadcastStateService);
  }
  return vjCore;
}

/**
 * Generate session ID
 */
function generateSessionId() {
  return `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Clean up old conversations
 */
function cleanupConversations() {
  const now = Date.now();
  for (const [id, history] of conversations) {
    // Simple TTL check could be added here if we tracked last access time
    // For now, just random cleanup or size limit
  }
  // Implementation from original controller
  if (conversations.size > 1000) {
    conversations.clear(); // Drastic but effective for memory safety
  }
}

/**
 * Process a chat message
 * @param {Object} params
 * @param {string} params.message - User message
 * @param {string} [params.sessionId] - Session ID
 * @param {string} [params.userId] - User ID (Socket ID)
 * @param {string} [params.userIp] - User IP Address (for persistent memory)
 * @param {string} [params.channelId] - Channel ID
 * @returns {Promise<Object>} Response object
 */
async function processMessage({ message, sessionId, userId, channelId, userIp }) {
  if (!message || typeof message !== 'string') {
    throw new Error('Message is required');
  }

  if (message.length > 500) {
    throw new Error('Message too long');
  }

  const vj = await initVJCore();
  const convId = sessionId || generateSessionId();
  let history = conversations.get(convId) || [];

  // Use IP as the persistent ID for VJ Core (memory), fallback to userId/sessionId
  const persistentId = userIp || userId || convId;

  console.log('[ChatLogic] Processing:', { message, persistentId, channelId });

  const result = await vj.processMessage(message, persistentId, channelId);

  if (result.blocked) {
    return { 
      response: result.response, 
      blocked: true,
      sessionId: convId 
    };
  }

  let response = result.response;
  const action = result.action || null;

  history.push({ role: 'user', content: message });
  history.push({ role: 'assistant', content: response });
  
  if (history.length > 10) {
    history = history.slice(-10);
  }
  
  conversations.set(convId, history);

  if (Math.random() < 0.1) {
    cleanupConversations();
  }

  return {
    response,
    sessionId: convId,
    action
  };
}

/**
 * Get suggestions
 */
function getSuggestions() {
  return [
    "What's playing now? 🎵",
    "Play party music 🎉",
    "Random song 🎸",
    "Comedy videos 😂"
  ];
}

module.exports = {
  processMessage,
  getSuggestions
};
