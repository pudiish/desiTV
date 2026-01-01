/**
 * Chat Controller - Minimal Clean Architecture
 * 
 * RULE: Use VJCore for all message processing
 * VJCore handles factual queries with pre-built messages (NO AI)
 * Only general conversation goes to AI
 */

const vjCore = require('../mcp/vjCore');
const { gemini } = require('../mcp');
const { 
  getUserProfile, 
  updateUserPreferences, 
  getPersonalizedSuggestions,
  extractPreferencesFromMessage 
} = require('../mcp/userMemory');

// In-memory conversation cache
const conversations = new Map();
const CONVERSATION_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Handle chat message - MINIMAL VERSION
 */
async function handleMessage(req, res) {
  try {
    const { message, sessionId, context = {} } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Message too long (max 500 chars)' });
    }

    // Get or create session
    const convId = sessionId || generateSessionId();
    let history = conversations.get(convId) || [];

    // Log context for debugging
    console.log('[Chat] Input:', { 
      message, 
      channel: context.currentChannel,
      video: context.currentVideo?.title 
    });

    // =========================================================================
    // CORE LOGIC: Process through VJCore
    // VJCore returns pre-built messages for factual queries (no hallucination)
    // Only passes to AI for general conversation
    // =========================================================================
    const result = await vjCore.processMessage(message, context);
    console.log('[Chat] VJCore result:', { 
      success: result.success, 
      hasMessage: !!result.message,
      passToAI: result.passToAI,
      action: result.action
    });

    let response;
    let action = result.action || null;

    if (result.passToAI) {
      // Only for general conversation - AI can respond
      const userProfile = getUserProfile(convId);
      response = await gemini.chat(message, history, {
        ...context,
        userProfile
      });
    } else if (result.message) {
      // Use pre-built message directly (NO AI HALLUCINATION)
      response = result.message;
    } else {
      response = '🤔 Samajh nahi aaya. Phir se bolo?';
    }

    // Update preferences if action taken
    if (action) {
      if (action.type === 'CHANGE_CHANNEL') {
        updateUserPreferences(convId, { channel: action.channelName });
      } else if (action.type === 'PLAY_VIDEO') {
        updateUserPreferences(convId, { 
          song: action.videoTitle,
          channel: action.channelName 
        });
      }
    }

    // Extract and update preferences from message
    const extractedPrefs = extractPreferencesFromMessage(message);
    if (Object.keys(extractedPrefs).length > 0) {
      updateUserPreferences(convId, extractedPrefs);
    }

    // Update conversation history
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: response });
    
    // Keep only last 10 messages
    if (history.length > 10) {
      history = history.slice(-10);
    }
    
    conversations.set(convId, history);

    // Clean up old conversations periodically
    if (Math.random() < 0.1) {
      cleanupConversations();
    }

    console.log('[Chat] Final response:', {
      action
    });

    res.json({
      response,
      sessionId: convId,
      action
    });

  } catch (error) {
    console.error('[Chat] Error:', error.message);
    console.error('[Chat] Full error:', error);
    
    // Friendly error messages
    if (error.message?.includes('API key')) {
      return res.status(503).json({ 
        error: 'VJ is taking a chai break ☕ Try again later!' 
      });
    }
    
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      return res.status(503).json({ 
        error: 'VJ is too popular today! 🔥 Free quota hit - try again in a few seconds or tomorrow!' 
      });
    }
    
    res.status(500).json({ 
      error: 'Oops! VJ got confused 😅 Try asking differently?' 
    });
  }
}

/**
 * Get suggestions based on context and user history
 */
async function getSuggestions(req, res) {
  try {
    const { sessionId } = req.query;
    
    let suggestions;
    if (sessionId) {
      suggestions = getPersonalizedSuggestions(sessionId);
    } else {
      suggestions = [
        "What's playing now? 🎵",
        "What channels do you have? 📺",
        "Play some party music 🎉",
        "Give me a trivia! 🎯",
        "Share a shayari 💕"
      ];
    }

    res.json({ suggestions });
  } catch (error) {
    console.error('[Chat] Suggestions error:', error);
    res.status(500).json({ error: 'Failed to get suggestions' });
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
