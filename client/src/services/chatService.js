/**
 * Chat Service - Server-Side Only
 * 
 * SINGLE SOURCE OF TRUTH: All chat goes through server API
 * Server has AI, YouTube search, context management
 * NO client-side AI, NO fallbacks
 */

// Server API base URL
const API_BASE = import.meta.env.VITE_API_URL || '';

let sessionId = null;

/**
 * Generate unique session ID
 */
function getSessionId() {
  if (!sessionId) {
    sessionId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  return sessionId;
}

/**
 * Send a message to DesiAgent via Server API
 * @param {string} message - User's message
 * @param {Object} context - Current context (channel, video, etc.)
 * @returns {Promise<Object>} Response with AI message and action
 */
export async function sendMessage(message, context = {}) {
  console.log('[ChatService] Sending to server:', message);
  
  const response = await fetch(`${API_BASE}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      sessionId: getSessionId(),
      context: {
        currentChannelId: context.currentChannelId || null,
        currentChannel: context.currentChannel || null,
        currentVideo: context.currentVideo || null,
        nextVideo: context.nextVideo || null,
        currentVideoIndex: context.currentVideoIndex ?? 0,
        totalVideos: context.totalVideos ?? 0,
        mode: context.mode || 'live',
        isPlaying: context.isPlaying ?? false
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ChatService] Server error:', response.status, errorText);
    throw new Error(`Server error: ${response.status}`);
  }

  const result = await response.json();
  console.log('[ChatService] Server response:', result);

  return {
    response: result.response || 'No response',
    action: result.action || null,
    sessionId: result.sessionId
  };
}

/**
 * Get chat suggestions from server
 * @returns {Promise<string[]>} Array of suggestion strings
 */
export async function getSuggestions() {
  try {
    const response = await fetch(`${API_BASE}/api/chat/suggestions`);
    if (!response.ok) throw new Error('Failed to get suggestions');
    const data = await response.json();
    return data.suggestions || getDefaultSuggestions();
  } catch (error) {
    console.error('[ChatService] Suggestions error:', error);
    return getDefaultSuggestions();
  }
}

function getDefaultSuggestions() {
  return [
    "What's playing?",
    "Play party songs",
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
