const {
  ResponseCache,
  IntentDetector,
  SemanticSearcher,
  SuggestionEngine,
  INTENT_PATTERNS
} = require('./advancedVJCore');

const Channel = require('../models/Channel');
const { searchYouTube } = require('./youtubeSearch');
const ContextManager = require('./contextManager');

class EnhancedVJCore {
  constructor(userMemoryModule, broadcastStateService) {
    this.userMemory = userMemoryModule;
    this.broadcastStateService = broadcastStateService;
    
    this.cache = new ResponseCache(30 * 60 * 1000);
    this.intentDetector = new IntentDetector();
    this.semanticSearcher = new SemanticSearcher();
    this.suggestionEngine = new SuggestionEngine(this.semanticSearcher);
    this.contextManager = new ContextManager(broadcastStateService, userMemoryModule);

    this.initializeSemanticSearch();
  }

  async initializeSemanticSearch() {
    try {
      const songs = await Channel.find({}).lean();
      this.semanticSearcher.indexSongs(songs);
    } catch (err) {
      console.error('[EnhancedVJCore] Semantic search init error:', err.message);
    }
  }

  async processMessage(message, userId = 'anonymous', channelId = null) {
    const blockCheck = this.detectIfBlocked(message);
    if (blockCheck.blocked) {
      return {
        response: blockCheck.message,
        action: null,
        blocked: true
      };
    }

    try {
      const context = await this.contextManager.buildContext(userId, channelId, message);
      const detectedIntent = this.intentDetector.detect(message);
      
      if (!detectedIntent) {
        return {
          response: '🤔 Hmm, not sure. Try searching for a song!',
          action: null,
          intent: null
        };
      }

      const cacheKey = this.cache.generateKey(message, { userId, channelId });
      const cachedResult = this.cache.get(cacheKey);
      
      if (cachedResult && detectedIntent.confidence > 0.9) {
        return cachedResult;
      }

      const result = await this.handleIntent(detectedIntent, message, context);

      if (result && !result.blocked && detectedIntent.confidence > 0.9) {
        this.cache.set(cacheKey, result);
      }

      return result;
    } catch (err) {
      console.error('[EnhancedVJCore] Processing error:', err.message);
      return {
        response: 'Error processing request',
        action: null,
        error: err.message
      };
    }
  }

  async handleIntent(detectedIntent, message, context) {
    const { intent, payload } = detectedIntent;

    switch (intent) {
      case 'play_suggestion':
        return await this.handlePlaySuggestion(payload, context);
      case 'search_song':
        return await this.handleSongSearch(payload, context);
      case 'mood_suggestion':
        return await this.handleMoodBasedSuggestion(payload, context);
      case 'artist_search':
        return await this.handleArtistSearch(payload, context);
      case 'genre_search':
        return await this.handleGenreSearch(payload, context);
      case 'current_playing':
        return await this.handleGetNowPlaying(context);
      case 'yes_response':
        return await this.handleConfirmSuggestion(context);
      case 'no_response':
        return await this.handleRejectSuggestion(context);
      default:
        return { response: '🎵 Try searching for a song!', action: null };
    }
  }

  async handlePlaySuggestion(songQuery, context) {
    const songs = await Channel.find({
      $or: [
        { title: { $regex: songQuery, $options: 'i' } },
        { artist: { $regex: songQuery, $options: 'i' } }
      ]
    }).limit(1).lean();

    if (songs.length > 0) {
      const song = songs[0];
      this.intentDetector.setLastSuggestion(song);
      return {
        response: `🎵 Playing: **${song.title}** by ${song.artist}`,
        action: {
          type: 'PLAY_EXTERNAL',
          videoId: song.videoId || song._id,
          title: song.title,
          autoPlay: true
        },
        intent: 'play_suggestion'
      };
    }

    const youtubeResults = await searchYouTube(songQuery);
    if (youtubeResults.length > 0) {
      const topResult = youtubeResults[0];
      return {
        response: `🎵 Playing: **${topResult.title}**`,
        action: {
          type: 'PLAY_YOUTUBE',
          videoId: topResult.id,
          title: topResult.title,
          autoPlay: true
        },
        intent: 'play_suggestion'
      };
    }

    return {
      response: `❌ Couldn't find: **${songQuery}**`,
      action: null
    };
  }

  async handleSongSearch(query, context) {
    const result = await this.suggestionEngine.getSuggestions(query, context.userContext.preferences, 3);
    return {
      response: result.message,
      action: {
        type: 'SHOW_OPTIONS',
        suggestions: result.suggestions,
        autoPlay: true
      },
      intent: 'search_song',
      suggestions: result.suggestions
    };
  }

  async handleMoodBasedSuggestion(mood, context) {
    const moodMap = {
      happy: { genres: ['pop', 'dance'] },
      sad: { genres: ['ballad', 'romantic'] },
      energetic: { genres: ['dance', 'edm'] },
      chill: { genres: ['lo-fi', 'ambient'] },
      romantic: { genres: ['romantic', 'ballad'] },
      party: { genres: ['dance', 'edm'] }
    };

    const config = moodMap[mood.toLowerCase()] || moodMap.chill;
    const songs = await Channel.find({ genre: { $in: config.genres } }).limit(10).lean();

    if (songs.length === 0) {
      return { response: `🎵 No songs found for ${mood} mood`, action: null };
    }

    const ranked = await this.suggestionEngine.rankSuggestions(songs, context.userContext.preferences);
    const topSongs = ranked.slice(0, 3);

    let msg = `## 🎵 ${mood.charAt(0).toUpperCase() + mood.slice(1)} Vibes\n\n`;
    const emojis = ['🥇', '🥈', '🥉'];
    topSongs.forEach((s, i) => {
      msg += `${emojis[i]} [${s.title} - ${s.artist}](play:${s._id || s.id})\n`;
    });

    return {
      response: msg,
      action: { type: 'SHOW_OPTIONS', suggestions: topSongs, autoPlay: true },
      intent: 'mood_suggestion'
    };
  }

  async handleArtistSearch(artist, context) {
    const songs = await Channel.find({ artist: { $regex: artist, $options: 'i' } }).limit(5).lean();
    
    if (songs.length === 0) {
      return { response: `❌ No songs found by **${artist}**`, action: null };
    }

    let msg = `## 🎤 Songs by ${artist}\n\n`;
    songs.forEach((s, i) => {
      msg += `**${i + 1}. ${s.title}** → [Play](play:${s._id || s.id})\n`;
    });

    return {
      response: msg,
      action: { type: 'SHOW_OPTIONS', suggestions: songs, autoPlay: true },
      intent: 'artist_search'
    };
  }

  async handleGenreSearch(genre, context) {
    const songs = await Channel.find({ genre: { $regex: genre, $options: 'i' } }).limit(5).lean();
    
    if (songs.length === 0) {
      return { response: `❌ No songs in **${genre}** genre`, action: null };
    }

    let msg = `## 🎵 ${genre} Songs\n\n`;
    songs.forEach((s, i) => {
      msg += `**${i + 1}. ${s.title}** - ${s.artist} → [Play](play:${s._id || s.id})\n`;
    });

    return {
      response: msg,
      action: { type: 'SHOW_OPTIONS', suggestions: songs, autoPlay: true },
      intent: 'genre_search'
    };
  }

  async handleGetNowPlaying(context) {
    const song = context.playerContext?.currentSong;
    
    if (!song || song.title === 'Unknown') {
      return { response: '🎧 Nothing playing right now', action: null };
    }

    return {
      response: `🎵 Now playing: **${song.title}** by ${song.artist}`,
      action: { type: 'NOW_PLAYING', song },
      intent: 'current_playing'
    };
  }

  async handleConfirmSuggestion(context) {
    const lastSong = this.intentDetector.getLastSuggestion();
    
    if (!lastSong) {
      return { response: '🤔 No suggestion to confirm', action: null };
    }

    return {
      response: `🎵 Playing: **${lastSong.title}** by ${lastSong.artist}`,
      action: {
        type: 'PLAY_EXTERNAL',
        videoId: lastSong._id || lastSong.videoId,
        title: lastSong.title,
        autoPlay: true
      },
      intent: 'yes_response'
    };
  }

  async handleRejectSuggestion(context) {
    return {
      response: '👍 Got it! Search for something else.',
      action: null,
      intent: 'no_response'
    };
  }

  detectIfBlocked(message) {
    const BLOCKED_PATTERNS = {
      explicit: [
        /sex|porn|xxx|nude|adult|18\+|masturbat|dildo|gay|lesbian|kiss|romance|dating|bed room|bedroom/i,
        /mms|leak|viral|hot body|bikini|swimsuit/i,
        /relationship|crush|propose|marriage tips|how to impress/i,
      ],
      general_knowledge: [
        /^(?:what|who|when|where|why|how)\s+(?!.*(?:song|music|comedy|movie|channel|video))/i,
        /physics|chemistry|math|biology|history|geography|science|coding|programming|algorithm/i,
        /covid|vaccine|election|politics|war|military|terrorism/i,
        /investment|stock|crypto|forex|trading|business plan/i,
        /homework|assignment|exam|study|tutorial/i
      ]
    };

    const msg = message.toLowerCase();
    
    for (const pattern of BLOCKED_PATTERNS.explicit) {
      if (pattern.test(msg)) {
        return { blocked: true, reason: 'explicit', message: '🎧 Only songs and clean stuff!' };
      }
    }
    
    const isDesiTV = /song|music|comedy|funny|movie|channel|video|play|gaana|chal/i.test(msg);
    
    for (const pattern of BLOCKED_PATTERNS.general_knowledge) {
      if (pattern.test(msg) && !isDesiTV) {
        return { blocked: true, reason: 'general_knowledge', message: '😅 I only know music and comedy!' };
      }
    }
    
    return { blocked: false };
  }

  getMetrics() {
    return {
      cache: this.cache.stats(),
      semanticSearchVocab: this.semanticSearcher.vocabulary.size,
      indexedSongs: this.semanticSearcher.documents.length
    };
  }
}

module.exports = EnhancedVJCore;
