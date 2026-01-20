/**
 * DesiAgent Core - Client-Side AI Assistant
 * Handles intent detection, actions, and AI responses
 * 
 * REWRITTEN: Now properly handles YouTube search via server API
 */

import { chat } from './geminiService';
import { getUserProfile, updateUserPreferences } from './userMemory';
import { channelManager } from '../../logic/channel';

// Server API base URL
const API_BASE = import.meta.env.VITE_API_URL || '';

class DesiAgentCore {
  constructor() {
    this.conversations = new Map();
  }

  /**
   * Process message and return response
   */
  async processMessage(message, userId = 'default', context = {}) {
    if (!message || typeof message !== 'string') {
      throw new Error('Message is required');
    }

    if (message.length > 500) {
      throw new Error('Message too long');
    }

    // Get conversation history
    const convId = userId;
    let history = this.conversations.get(convId) || [];

    // Detect intent
    const intent = this.detectIntent(message);
    console.log('[DesiAgentCore] Detected intent:', intent, 'for message:', message);

    // Handle specific intents
    if (intent === 'greeting') {
      return {
        response: `👋 Hey! I'm DesiAgent, your AI assistant. Say "play tum se hi from youtube" to search YouTube!`,
        action: null
      };
    }

    if (intent === 'current_playing') {
      return await this.handleNowPlaying(context);
    }

    if (intent === 'channels_list') {
      return await this.handleChannelsList(context);
    }

    // YOUTUBE SEARCH - Use server API for proper YouTube search
    if (intent === 'youtube_search') {
      return await this.handleYouTubeSearch(message, context);
    }

    if (intent === 'search_song') {
      return await this.handleSongSearch(message, context);
    }

    // Default: Use Gemini for general chat
    try {
      const response = await chat(message, history, context);
      
      // Update history
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: response });
      if (history.length > 10) history = history.slice(-10);
      this.conversations.set(convId, history);
      
      return {
        response,
        action: null
      };
    } catch (err) {
      console.error('[DesiAgentCore] Error:', err);
      return {
        response: "My brain is buffering... 🤯 Try again?",
        action: null
      };
    }
  }

  /**
   * Detect intent from message
   * FIXED: Now properly detects YouTube search requests
   */
  detectIntent(message) {
    const lower = message.toLowerCase().trim();
    
    // Check for YouTube search FIRST (highest priority)
    // Matches: "play X from youtube", "search X on youtube", "find X youtube"
    if (/(from youtube|on youtube|youtube search|search.*youtube|play.*youtube|youtube.*play)/i.test(lower)) {
      return 'youtube_search';
    }
    
    // Check for general play commands (without "youtube")
    // Matches: "play tum se hi", "play some music", "play party songs"
    if (/^play\s+.+/i.test(lower)) {
      // If it explicitly says "from youtube", that's already handled above
      // Otherwise, first check local library, then fall back to YouTube
      return 'search_song';
    }
    
    if (/^(hi|hello|hey|namaste)/i.test(lower)) return 'greeting';
    if (/(what.*playing|now playing|current song)/i.test(lower)) return 'current_playing';
    if (/(channels|list.*channels|what.*channels)/i.test(lower)) return 'channels_list';
    if (/(search|find).*(song|music|video)/i.test(lower)) return 'search_song';
    
    return 'chat';
  }

  /**
   * Handle "what's playing" intent
   */
  async handleNowPlaying(context) {
    const video = context.currentVideo;
    const channel = context.currentChannel;
    
    if (video && channel) {
      return {
        response: `🎵 Currently playing: "${video.title}" on ${channel}`,
        action: null
      };
    }
    
    return {
      response: "No video is currently playing. Want me to suggest something?",
      action: null
    };
  }

  /**
   * Handle channels list intent
   */
  async handleChannelsList(context) {
    try {
      const channels = await channelManager.loadChannels();
      const channelNames = channels.slice(0, 10).map(ch => ch.name).join(', ');
      
      return {
        response: `📺 Available channels: ${channelNames}${channels.length > 10 ? '...' : ''}`,
        action: null
      };
    } catch (err) {
      return {
        response: "Couldn't load channels right now. Try again?",
        action: null
      };
    }
  }

  /**
   * Handle YouTube search - calls server API
   * This uses the AI-powered YouTube search on the server
   */
  async handleYouTubeSearch(message, context) {
    try {
      // Extract song name from message
      const songQuery = message
        .replace(/from youtube|on youtube|youtube|search|play|find/gi, '')
        .trim();
      
      console.log('[DesiAgentCore] YouTube search for:', songQuery);
      
      if (!songQuery) {
        return {
          response: "What song would you like me to search on YouTube? 🎵",
          action: null
        };
      }

      // Call server API for YouTube search
      const response = await fetch(`${API_BASE}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `play ${songQuery} from youtube`,
          context: {
            currentChannelId: context.currentChannelId || null,
            currentChannel: context.currentChannel || null
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      console.log('[DesiAgentCore] Server response:', result);

      // Return the server response with action
      return {
        response: result.response || `🔍 Searching YouTube for "${songQuery}"...`,
        action: result.action || null
      };
    } catch (err) {
      console.error('[DesiAgentCore] YouTube search error:', err);
      
      // Fallback: Search YouTube directly via iframe (basic fallback)
      const songQuery = message.replace(/from youtube|on youtube|youtube|search|play|find/gi, '').trim();
      const searchTermEncoded = encodeURIComponent(songQuery);
      
      return {
        response: `🎵 Searching for "${songQuery}" on YouTube...`,
        action: {
          type: 'PLAY_EXTERNAL',
          videoId: null, // Will trigger a search fallback
          videoTitle: songQuery,
          searchQuery: songQuery
        }
      };
    }
  }

  /**
   * Handle song search intent - searches local library first, then YouTube
   */
  async handleSongSearch(message, context) {
    try {
      const channels = await channelManager.loadChannels();
      
      // Extract search term
      const searchTerm = message
        .replace(/^play\s+/i, '')
        .replace(/song|music|video|from|search|find/gi, '')
        .trim()
        .toLowerCase();
      
      console.log('[DesiAgentCore] Local search for:', searchTerm);
      
      // Search in local channels
      const matches = [];
      for (const channel of channels) {
        for (const item of (channel.items || [])) {
          const title = (item.title || '').toLowerCase();
          if (title.includes(searchTerm) || searchTerm.includes(title.split('-')[0].trim())) {
            matches.push({
              title: item.title,
              videoId: item.youtubeId || item.id,
              channelId: channel._id,
              channelName: channel.name
            });
            if (matches.length >= 5) break;
          }
        }
        if (matches.length >= 5) break;
      }
      
      // Found in local library - play it!
      if (matches.length > 0) {
        const first = matches[0];
        console.log('[DesiAgentCore] Found in library:', first);
        return {
          response: `🎵 Playing "${first.title}" from ${first.channelName}!`,
          action: {
            type: 'PLAY_EXTERNAL',
            videoId: first.videoId,
            videoTitle: first.title
          }
        };
      }
      
      // Not found locally - search YouTube via server
      console.log('[DesiAgentCore] Not found locally, searching YouTube...');
      return await this.handleYouTubeSearch(`play ${searchTerm} from youtube`, context);
      
    } catch (err) {
      console.error('[DesiAgentCore] Search error:', err);
      return {
        response: "Search failed. Try again? 🔍",
        action: null
      };
    }
  }
}

// Export singleton
export const desiAgentCore = new DesiAgentCore();
