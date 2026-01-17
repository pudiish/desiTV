/**
 * Chat Service - Client-Side DesiAgent
 * 
 * Fully client-side AI assistant - no server needed!
 * Uses Gemini API directly from browser
 */

import { desiAgentCore } from './desiAgent/desiAgentCore';
import { getUserProfile } from './desiAgent/userMemory';

let sessionId = null;

/**
 * Send a message to DesiAgent (client-side)
 * @param {string} message - User's message
 * @param {Object} context - Current context (channel, etc.)
 * @returns {Promise<Object>} Response with AI message
 */
export async function sendMessage(message, context = {}) {
  try {
    // Generate session ID if not exists
    if (!sessionId) {
      sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Get user profile for context
    const userProfile = getUserProfile(sessionId);
    
    // Build enriched context
    const enrichedContext = {
      ...context,
      userProfile,
      currentChannel: context.currentChannel,
      currentVideo: context.currentVideo,
      mode: context.mode || 'live'
    };

    // Process message client-side
    const result = await desiAgentCore.processMessage(message, sessionId, enrichedContext);
    
    return {
      response: result.response || 'No response',
      toolUsed: null,
      action: result.action || null
    };
  } catch (error) {
    const errorMessage = error.message || error.toString() || 'Chat request failed';
    console.error('[ChatService] Error:', errorMessage, error);
    
    // Check if it's API key error
    if (errorMessage.includes('VITE_GOOGLE_AI_KEY')) {
      throw new Error('AI service not configured. Please set VITE_GOOGLE_AI_KEY in your environment.');
    }
    
    throw new Error(errorMessage);
  }
}

/**
 * Get chat suggestions (client-side)
 * @returns {Promise<string[]>} Array of suggestion strings
 */
export async function getSuggestions() {
  try {
    const { getPersonalizedSuggestions } = await import('./desiAgent/userMemory');
    const sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return getPersonalizedSuggestions(sessionId);
  } catch (error) {
    return getDefaultSuggestions();
  }
}

function getDefaultSuggestions() {
  return [
    "What's playing?",
    "I'm in a party mood",
    "Show me channels"
  ];
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
