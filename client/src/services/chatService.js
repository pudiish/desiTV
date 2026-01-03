/**
 * Chat Service
 * 
 * Client-side service for DesiTV VJ Assistant
 * Uses Unified Socket Bus for real-time communication
 */

import { getSocket } from './socket';

let sessionId = null;

/**
 * Send a message to VJ Assistant via Socket
 * @param {string} message - User's message
 * @param {Object} context - Current context (channel, etc.)
 * @returns {Promise<Object>} Response with AI message
 */
export async function sendMessage(message, context = {}) {
  const socket = getSocket();
  
  return new Promise((resolve, reject) => {
    // Ensure socket is connected
    if (!socket.connected) {
      // Attempt to connect if not connected, but usually getSocket() handles this.
      // If it's still connecting, we might want to wait for 'connect' event.
      // For simplicity, we'll proceed and let socket.io buffer or fail.
    }

    // Emit with acknowledgement callback
    socket.emit('chat:message', {
      message,
      sessionId,
      context
    }, (response) => {
      if (response && response.success) {
        const data = response.data;
        
        // Update session ID if provided
        if (data.sessionId) {
          sessionId = data.sessionId;
        }
        
        resolve({
          response: data.response,
          toolUsed: data.toolUsed,
          action: data.action || null
        });
      } else {
        reject(new Error(response?.error || 'Chat request failed'));
      }
    });

    // Timeout fallback (10 seconds)
    setTimeout(() => {
      reject(new Error('Chat request timed out'));
    }, 10000);
  });
}

/**
 * Get chat suggestions via Socket
 * @returns {Promise<string[]>} Array of suggestion strings
 */
export async function getSuggestions() {
  const socket = getSocket();
  
  return new Promise((resolve) => {
    // Emit with acknowledgement callback
    socket.emit('chat:suggestions', (response) => {
      if (response && response.success) {
        resolve(response.data || []);
      } else {
        resolve(getDefaultSuggestions());
      }
    });
    
    // Timeout fallback (2 seconds)
    setTimeout(() => {
      resolve(getDefaultSuggestions());
    }, 2000);
  });
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
