const broadcastStateService = require('../services/broadcastStateService');

const conversations = new Map();
const CONVERSATION_TTL = 30 * 60 * 1000; // 30 minutes

// Simple chat responses (VJ Core removed)
const basicResponses = {
  hello: "👋 Hey there! What's up?",
  hi: "👋 Hey! How can I help?",
  help: "📚 I can help with music info, channel details, and more!",
  channels: "🎵 You can browse all the latest channels and playlists!",
  default: "🎵 That's interesting! Tell me more about what you'd like to know."
};

function getBasicResponse(message) {
  const lower = message.toLowerCase();
  for (const [key, response] of Object.entries(basicResponses)) {
    if (lower.includes(key)) return response;
  }
  return basicResponses.default;
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

  const convId = sessionId || generateSessionId();
  let history = conversations.get(convId) || [];

  console.log('[ChatLogic] Processing:', { message, userId, channelId });

  // Use basic response (VJ Core removed)
  const response = getBasicResponse(message);

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
    action: null
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
