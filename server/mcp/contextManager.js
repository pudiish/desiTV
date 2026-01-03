const { BroadcastState } = require('../models/BroadcastState');
const UserSession = require('../models/UserSession');
const liveStateService = require('../services/liveStateService');

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
    if (!channelId) {
      console.log('[ContextManager] No channelId provided');
      return { status: 'unavailable' };
    }
    
    try {
      // Try LiveStateService first (modern system)
      try {
        const liveState = await liveStateService.getLiveState(channelId, true);
        if (liveState && liveState.live) {
          return {
            status: 'active',
            channelId,
            currentSong: {
              videoId: liveState.live.videoId,
              title: liveState.live.videoTitle || 'Unknown',
              artist: 'Unknown', // LiveState doesn't currently return artist separately
              duration: liveState.live.duration || 0
            },
            timeline: {
              position: liveState.live.position || 0,
              total: liveState.live.duration || 0,
              progress: (liveState.live.position / liveState.live.duration) || 0
            },
            queue: {
              next: liveState.next ? { 
                videoId: liveState.next.videoId, 
                title: liveState.next.videoTitle 
              } : null,
              remaining: liveState.playlist?.videoCount || 0
            }
          };
        }
      } catch (liveErr) {
        // Fallback to legacy broadcast state if live state fails
        // console.log('[ContextManager] LiveState lookup failed, trying legacy:', liveErr.message);
      }

      const state = await this.broadcastStateService?.getStateByChannelId(channelId);
      if (!state) {
        console.log('[ContextManager] No broadcast state found for channel:', channelId);
        return { status: 'no_broadcast' };
      }

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
      // Return degraded context instead of error - chat should work without broadcast
      return { status: 'unavailable', reason: err.message };
    }
  }

  async getUserContext(userId) {
    if (!userId) return { authenticated: false };

    try {
      // Check if userId is a valid MongoDB ObjectId format
      const isValidObjectId = /^[a-f\d]{24}$/i.test(userId);
      
      let session = null;
      if (isValidObjectId) {
        session = await UserSession?.findById(userId).lean();
      }
      
      // Use getUserProfile instead of getMemory
      const memory = await this.userMemory?.getUserProfile(userId);

      return {
        authenticated: !!session,
        userId,
        preferences: {
          favoriteArtists: memory?.favoriteArtists || [],
          favoriteGenres: memory?.favoriteGenres || [],
          mood: memory?.detectedMood || memory?.preferredMood || 'neutral',
          language: session?.language || 'en'
        },
        history: {
          recentSongs: memory?.songsPlayed?.slice(0, 5) || [],
          suggestedCount: memory?.interactionCount || 0,
          acceptedCount: 0 // Not currently tracked in simple profile
        }
      };
    } catch (err) {
      console.error('[ContextManager] User context error:', err.message);
      // Return partial context instead of failing completely
      return { 
        authenticated: false, 
        userId,
        preferences: {
          favoriteArtists: [],
          favoriteGenres: [],
          mood: 'neutral',
          language: 'en'
        },
        history: {
          recentSongs: [],
          suggestedCount: 0,
          acceptedCount: 0
        }
      };
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
    // Player context can be in various states - unavailable, no_broadcast, error are all OK
    // The important thing is that we have SOME context data
    const playerValid = playerContext && playerContext !== null;
    // User context can be anonymous - don't require authenticated session
    const userValid = userContext && !userContext.error;
    // We can proceed with degraded context (no broadcast, anonymous user)
    // Only fail if both are missing
    return (playerValid || userContext) && userValid;
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
