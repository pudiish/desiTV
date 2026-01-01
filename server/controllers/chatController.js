/**
 * Chat Controller
 * 
 * Handles chat requests for DesiTV VJ Assistant
 */

const { gemini, tools } = require('../mcp');

// In-memory conversation cache (simple implementation)
const conversations = new Map();
const CONVERSATION_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Handle chat message
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

    // Log incoming context for debugging
    console.log('[Chat] Received context:', {
      currentChannel: context.currentChannel,
      currentVideo: context.currentVideo?.title,
      currentVideoIndex: context.currentVideoIndex
    });

    // Check for quick response first
    const quickResponse = gemini.getQuickResponse(message);
    if (quickResponse) {
      return res.json({
        response: quickResponse,
        sessionId: sessionId || generateSessionId()
      });
    }

    // Get or create conversation history
    const convId = sessionId || generateSessionId();
    let history = conversations.get(convId) || [];

    // Detect if we need to use tools
    const intent = tools.detectIntent(message);
    let toolResults = null;
    let action = null;

    if (intent) {
      try {
        // Pass context to tools that need it (like get_now_playing)
        if (intent.usesContext) {
          toolResults = await tools.executeTool(intent.tool, intent.params, context);
        } else {
          toolResults = await tools.executeTool(intent.tool, intent.params);
        }
        
        // Extract action if present (for channel change, play video, etc.)
        if (toolResults?.action) {
          action = toolResults.action;
        }
      } catch (err) {
        console.error('[Chat] Tool execution error:', err);
      }
    }

    // Get AI response (or use tool's pre-built message for actions)
    let response;
    if (action && toolResults?.message) {
      // For actions, use the tool's message directly for speed
      response = toolResults.message;
    } else {
      response = await gemini.chat(message, history, {
        ...context,
        toolResults
      });
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

    res.json({
      response,
      sessionId: convId,
      toolUsed: intent?.tool || null,
      action: action // Include action for frontend to execute
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
 * Get suggestions based on context
 */
async function getSuggestions(req, res) {
  try {
    const suggestions = [
      "What channels do you have? 📺",
      "Play some party music 🎉",
      "Switch to Retro Gold",
      "I'm feeling romantic 💕",
      "Play Honey Singh"
    ];

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
    // Extract timestamp from session ID
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
