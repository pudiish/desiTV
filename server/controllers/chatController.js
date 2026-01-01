/**
 * Chat Controller
 * 
 * Handles chat requests for DesiTV VJ Assistant
 */

const { gemini, tools } = require('../mcp');
const { 
  getUserProfile, 
  updateUserPreferences, 
  getPersonalizedSuggestions,
  extractPreferencesFromMessage 
} = require('../mcp/userMemory');

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

    // Build context with sessionId for trivia tracking
    const fullContext = {
      ...context,
      sessionId: convId
    };

    // Detect if we need to use tools
    const intent = tools.detectIntent(message);
    let toolResults = null;
    let action = null;

    // Check if this might be a trivia answer (short message, no detected intent)
    if (!intent && message.length < 50) {
      // Could be a trivia answer - check with the check_trivia_answer tool
      try {
        const answerCheck = await tools.executeTool('check_trivia_answer', 
          { answer: message, sessionId: convId }, 
          fullContext
        );
        if (answerCheck && answerCheck.success !== false) {
          toolResults = answerCheck;
        }
      } catch (err) {
        // Not a trivia answer, continue normally
      }
    }

    if (intent && !toolResults) {
      try {
        // Pass context to tools that need it (like get_now_playing)
        if (intent.usesContext) {
          toolResults = await tools.executeTool(intent.tool, intent.params, fullContext);
        } else {
          toolResults = await tools.executeTool(intent.tool, intent.params);
        }
        
        // Extract action if present (for channel change, play video, etc.)
        if (toolResults?.action) {
          action = toolResults.action;
          
          // Update user preferences based on action
          if (action.type === 'CHANGE_CHANNEL') {
            updateUserPreferences(convId, { channel: action.channelName });
          } else if (action.type === 'PLAY_VIDEO') {
            updateUserPreferences(convId, { 
              song: action.videoTitle,
              channel: action.channelName 
            });
          }
        }
        
        // Track trivia results
        if (toolResults?.correct !== undefined) {
          updateUserPreferences(convId, { triviaResult: toolResults.correct });
        }
      } catch (err) {
        console.error('[Chat] Tool execution error:', err);
      }
    }
    
    // Extract and update preferences from message
    const extractedPrefs = extractPreferencesFromMessage(message);
    if (Object.keys(extractedPrefs).length > 0) {
      updateUserPreferences(convId, extractedPrefs);
    }

    // Get AI response (or use tool's pre-built message)
    let response;
    if (toolResults?.message) {
      // Use tool's pre-built message directly (for trivia, shayari, actions)
      response = toolResults.message;
      console.log('[Chat] Using pre-built message from tool');
    } else {
      // Add user profile to context for personalization
      const userProfile = getUserProfile(convId);
      response = await gemini.chat(message, history, {
        ...context,
        toolResults,
        userProfile
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
 * Get suggestions based on context and user history
 */
async function getSuggestions(req, res) {
  try {
    const { sessionId } = req.query;
    
    // Get personalized suggestions if we have a session
    let suggestions;
    if (sessionId) {
      suggestions = getPersonalizedSuggestions(sessionId);
    } else {
      // Default suggestions for new users
      suggestions = [
        "What channels do you have? 📺",
        "Play some party music 🎉",
        "Give me a trivia! 🎯",
        "Share a romantic shayari 💕",
        "Switch to Retro Gold"
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
