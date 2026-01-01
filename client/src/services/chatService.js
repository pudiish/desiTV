/**
 * Chat Service
 * 
 * Client-side service for DesiTV VJ Assistant
 * Now uses unified apiClientV2 for consistent error handling and caching
 * 
 * IMPORTANT: This service is CLIENT-ONLY and must not be used in SSR contexts.
 * All functions accept sessionId as a parameter to avoid cross-request/user leakage.
 * Callers should manage sessionId in component state or a session manager.
 */

import apiClientV2 from './apiClientV2';

// Guard against SSR usage
if (typeof window === 'undefined') {
  console.warn('[ChatService] WARNING: This service is client-only and should not be used in SSR contexts.');
}

/**
 * Send a message to VJ Assistant
 * @param {string} message - User's message
 * @param {Object} context - Current context (channel, etc.)
 * @param {string|null} sessionId - Current session ID (null for new sessions)
 * @returns {Promise<Object>} Response with AI message and updated sessionId
 */
export async function sendMessage(message, context = {}, sessionId = null) {
  try {
    const result = await apiClientV2.sendChatMessage({
      message,
      sessionId,
      context
    });

    if (!result.success) {
      throw new Error(result.error?.userMessage || 'Chat request failed');
    }

    // Return updated session ID if provided
    const updatedSessionId = result.data.sessionId || sessionId;
    
    return {
      response: result.data.response,
      toolUsed: result.data.toolUsed,
      action: result.data.action || null, // Include action for UI to execute
      sessionId: updatedSessionId // Return updated session ID for caller to manage
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

export default {
  sendMessage,
  getSuggestions
};
