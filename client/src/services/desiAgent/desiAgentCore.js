/**
 * DesiAgent Core - Client-Side AI Assistant
 * Handles intent detection, actions, and AI responses
 */

import { chat } from './geminiService';
import { getUserProfile, updateUserPreferences } from './userMemory';
import { channelManager } from '../../logic/channel';

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

    // Handle specific intents
    if (intent === 'greeting') {
      return {
        response: `👋 Hey! I'm DesiAgent, your AI assistant. Ask me about songs, channels, or what's playing!`,
        action: null
      };
    }

    if (intent === 'current_playing') {
      return await this.handleNowPlaying(context);
    }

    if (intent === 'channels_list') {
      return await this.handleChannelsList(context);
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
   */
  detectIntent(message) {
    const lower = message.toLowerCase().trim();
    
    if (/^(hi|hello|hey|namaste)/i.test(lower)) return 'greeting';
    if (/(what.*playing|now playing|current song)/i.test(lower)) return 'current_playing';
    if (/(channels|list.*channels|what.*channels)/i.test(lower)) return 'channels_list';
    if (/(play|search|find).*(song|music)/i.test(lower)) return 'search_song';
    
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
        response: `🎵 Currently playing: "${video.title}" on ${channel.name}`,
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
   * Handle song search intent
   */
  async handleSongSearch(message, context) {
    try {
      const channels = await channelManager.loadChannels();
      const searchTerm = message.toLowerCase();
      
      // Simple search in channels
      const matches = [];
      for (const channel of channels.slice(0, 5)) {
        for (const item of (channel.items || []).slice(0, 20)) {
          if (item.title?.toLowerCase().includes(searchTerm) || 
              item.youtubeId?.toLowerCase().includes(searchTerm)) {
            matches.push({
              title: item.title,
              videoId: item.youtubeId,
              channelId: channel._id,
              channelName: channel.name
            });
            if (matches.length >= 5) break;
          }
        }
        if (matches.length >= 5) break;
      }
      
      if (matches.length > 0) {
        const first = matches[0];
        return {
          response: `🎵 Found "${first.title}"! Want me to play it?`,
          action: {
            type: 'PLAY_EXTERNAL',
            videoId: first.videoId,
            videoTitle: first.title
          }
        };
      }
      
      return {
        response: `Couldn't find "${message}" in our library. Want to search YouTube?`,
        action: null
      };
    } catch (err) {
      return {
        response: "Search failed. Try again?",
        action: null
      };
    }
  }
}

// Export singleton
export const desiAgentCore = new DesiAgentCore();
