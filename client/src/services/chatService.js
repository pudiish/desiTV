/**
 * Chat Service
 * 
 * Client-side service for DesiTV VJ Assistant
 */

const API_BASE = import.meta.env.VITE_API_BASE || '';

let sessionId = null;

/**
 * Send a message to VJ Assistant
 * @param {string} message - User's message
 * @param {Object} context - Current context (channel, etc.)
 * @returns {Promise<Object>} Response with AI message
 */
export async function sendMessage(message, context = {}) {
  try {
    const response = await fetch(`${API_BASE}/api/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        sessionId,
        context
      })
    });

    // Check if response is ok first
    if (!response.ok) {
      let errorMsg = 'Chat request failed';
      try {
        const error = await response.json();
        errorMsg = error.error || errorMsg;
      } catch (e) {
        // Response wasn't JSON
        errorMsg = `Server error (${response.status})`;
      }
      throw new Error(errorMsg);
    }

    // Try to parse JSON response
    let data;
    try {
      const text = await response.text();
      if (!text) {
        throw new Error('Empty response from server');
      }
      data = JSON.parse(text);
    } catch (e) {
      throw new Error('Invalid response from server');
    }
    
    sessionId = data.sessionId;
    
    return {
      response: data.response,
      toolUsed: data.toolUsed,
      action: data.action || null // Include action for UI to execute
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
    const response = await fetch(`${API_BASE}/api/chat/suggestions`);
    if (!response.ok) throw new Error('Failed to get suggestions');
    
    const data = await response.json();
    return data.suggestions || [];
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
