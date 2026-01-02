const { BroadcastState } = require('../models/BroadcastState');
const UserSession = require('../models/UserSession');

class ContextManager {
  constructor(broadcastStateService, userMemory) {
    this.broadcastStateService = broadcastStateService;
    this.userMemory = userMemory;
    this.conversationHistory = new Map();
  }

  async buildContext(userId, channelId, message) {
    try {
      const playerContext = await this.getPlayerContext(channelId);
      const userContext = await this.getUserContext(userId);
      const messageContext = this.getMessageContext(userId, message);
      const safetyContext = this.getSafetyContext();

      return {
        userId,
        channelId,
        timestamp: Date.now(),
        playerContext,
        userContext,
        messageContext,
        safetyContext,
        isValid: this.validateContext(playerContext, userContext)
      };
    } catch (err) {
      console.error('[ContextManager] Error building context:', err.message);
      return this.getEmergencyContext(userId, channelId);
    }
  }

  async getPlayerContext(channelId) {
    if (!channelId) return { status: 'unavailable' };
    
    try {
      const state = await this.broadcastStateService?.getStateByChannelId(channelId);
      if (!state) return { status: 'no_broadcast' };

      return {
        status: 'active',
        channelId,
        currentSong: {
          videoId: state.currentVideoId,
          title: state.currentTitle || 'Unknown',
          artist: state.currentArtist || 'Unknown',
          duration: state.currentDuration || 0
        },
        timeline: {
          position: state.position || 0,
          total: state.totalDuration || 0,
          progress: state.progress || 0
        },
        queue: {
          next: state.nextVideoId ? { videoId: state.nextVideoId, title: state.nextTitle } : null,
          remaining: state.queueLength || 0
        }
      };
    } catch (err) {
      console.error('[ContextManager] Player context error:', err.message);
      return { status: 'error', error: err.message };
    }
  }

  async getUserContext(userId) {
    if (!userId) return { authenticated: false };

    try {
      const session = await UserSession?.findById(userId).lean();
      const memory = await this.userMemory?.getMemory(userId);

      return {
        authenticated: !!session,
        userId,
        preferences: {
          favoriteArtists: memory?.favoriteArtists || [],
          favoriteGenres: memory?.favoriteGenres || [],
          mood: memory?.currentMood || 'neutral',
          language: session?.language || 'en'
        },
        history: {
          recentSongs: memory?.recentSongs?.slice(0, 5) || [],
          suggestedCount: memory?.suggestedCount || 0,
          acceptedCount: memory?.acceptedCount || 0
        }
      };
    } catch (err) {
      console.error('[ContextManager] User context error:', err.message);
      return { authenticated: false, error: err.message };
    }
  }

  getMessageContext(userId, message) {
    let history = this.conversationHistory.get(userId) || [];
    
    if (history.length >= 10) history = history.slice(-10);
    
    history.push({ message, timestamp: Date.now() });
    this.conversationHistory.set(userId, history);

    return {
      currentMessage: message,
      messageLength: message.length,
      history: history.slice(0, -1).map(h => h.message),
      conversationTurn: history.length
    };
  }

  getSafetyContext() {
    return {
      availableData: ['playerState', 'userPreferences', 'conversationHistory'],
      restrictions: {
        canPlaySongs: true,
        canModifyQueue: false,
        canAccessUserData: true,
        canAccessChannelData: true
      },
      hallucination_prevention: {
        requirePlayerDataForPlayback: true,
        validateSongExistence: true,
        requireUserContextForPreferences: true
      }
    };
  }

  validateContext(playerContext, userContext) {
    const playerValid = playerContext && playerContext.status !== 'error';
    const userValid = userContext && !userContext.error;
    return playerValid && userValid;
  }

  getEmergencyContext(userId, channelId) {
    return {
      userId,
      channelId,
      timestamp: Date.now(),
      playerContext: { status: 'unavailable' },
      userContext: { authenticated: false },
      messageContext: { history: [] },
      safetyContext: this.getSafetyContext(),
      isValid: false,
      warning: 'Emergency context - limited functionality'
    };
  }

  clearHistory(userId) {
    this.conversationHistory.delete(userId);
  }

  clearAllHistory() {
    this.conversationHistory.clear();
  }
}

module.exports = ContextManager;
