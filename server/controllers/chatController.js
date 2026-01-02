const EnhancedVJCore = require('../mcp/enhancedVJCore');
const userMemory = require('../mcp/userMemory');
const broadcastStateService = require('../services/broadcastStateService');

const conversations = new Map();
const CONVERSATION_TTL = 30 * 60 * 1000;

let vjCore = null;

async function initVJCore() {
  if (!vjCore) {
    vjCore = new EnhancedVJCore(userMemory, broadcastStateService);
  }
  return vjCore;
}

async function handleMessage(req, res) {
  try {
    const { message, sessionId, userId, channelId, context } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Message too long' });
    }

    // Extract channelId from context if not at top level
    const actualChannelId = channelId || context?.currentChannelId;

    const vj = await initVJCore();
    const convId = sessionId || generateSessionId();
    let history = conversations.get(convId) || [];

    console.log('[Chat] Processing:', { message, userId, channelId: actualChannelId });

    const result = await vj.processMessage(message, userId || convId, actualChannelId);

    if (result.blocked) {
      return res.status(400).json({ response: result.response, blocked: true });
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

    res.json({
      response,
      sessionId: convId,
      action
    });

  } catch (error) {
    console.error('[Chat] Error:', error.message);
    res.status(500).json({ error: 'Processing failed' });
  }
}

async function getSuggestions(req, res) {
  try {
    const { sessionId } = req.query;
    const suggestions = [
      "What's playing now? 🎵",
      "Play party music 🎉",
      "Random song 🎸",
      "Comedy videos 😂"
    ];
    res.json({ suggestions });
  } catch (error) {
    console.error('[Chat] Suggestions error:', error.message);
    res.status(500).json({ error: 'Failed' });
  }
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
  for (const [id, _] of conversations) {
    const match = id.match(/chat_(\d+)_/);
    if (match) {
      const created = parseInt(match[1], 10);
      if (now - created > CONVERSATION_TTL) {
        conversations.delete(id);
      }
    }
  }
}

module.exports = {
  handleMessage,
  getSuggestions
};
