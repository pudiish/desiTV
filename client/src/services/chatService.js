/**
 * Chat Service
 * 
 * Client-side service for DesiTV VJ Assistant
 * Now uses unified apiClientV2 for consistent error handling and caching
 */

import apiClientV2 from './apiClientV2';

let sessionId = null;

/**
 * Send a message to VJ Assistant
 * @param {string} message - User's message
 * @param {Object} context - Current context (channel, etc.)
 * @returns {Promise<Object>} Response with AI message
 */
export async function sendMessage(message, context = {}) {
  try {
    const result = await apiClientV2.sendChatMessage({
      message,
      sessionId,
      context
    });

    if (!result.success) {
      throw new Error(result.error?.userMessage || 'Chat request failed');
    }

    // Update session ID if provided
    if (result.data.sessionId) {
      sessionId = result.data.sessionId;
    }
    
    return {
      response: result.data.response,
      toolUsed: result.data.toolUsed,
      action: result.data.action || null // Include action for UI to execute
    };
  } catch (error) {
    console.error('[ChatService] Error:', error);
    throw error;
  }
}

/**
 * Get chat suggestions
 * @returns {Promise<string[]>} Array of suggestion strings
 */
export async function getSuggestions() {
  try {
    const result = await apiClientV2.getChatSuggestions();
    
    if (!result.success) {
      // Return fallback suggestions on error
      console.warn('[ChatService] Failed to fetch suggestions, using defaults');
      return [
        "What's playing?",
        "I'm in a party mood",
        "Show me channels"
      ];
    }
    
    return result.data.suggestions || [];
  } catch (error) {
    console.error('[ChatService] Suggestions error:', error);
    return [
      "What's playing?",
      "I'm in a party mood",
      "Show me channels"
    ];
  }
}

/**
 * Reset chat session
 */
export function resetSession() {
  sessionId = null;
}

export default {
  sendMessage,
  getSuggestions,
  resetSession
};
