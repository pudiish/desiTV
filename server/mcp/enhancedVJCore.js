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
const gemini = require('./gemini');

class EnhancedVJCore {
  constructor(userMemoryModule, broadcastStateService) {
    this.userMemory = userMemoryModule;
    this.broadcastStateService = broadcastStateService;
    
    this.cache = new ResponseCache(30 * 60 * 1000);
    this.semanticSearcher = new SemanticSearcher();
    this.intentDetector = new IntentDetector(this.semanticSearcher); // Pass semanticSearcher to IntentDetector
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
        // Fallback to Gemini for general chat if no specific intent is detected
        return await this.handleChat(message, context);
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
      case 'greeting':
        return {
          response: `👋 Hey there! I'm DesiAgent, your personal AI DJ. Try asking me to "play a song", or "what's playing?" - I can search our library and help you discover new vibes!`,
          action: null
        };
      case 'goodbye':
        return {
          response: `👋 Catch you later! Enjoy the vibes on DesiTV! 🎵`,
          action: null
        };
      case 'gratitude':
        return {
          response: `😊 My pleasure, yaar! Always happy to help you find the perfect song!`,
          action: null
        };
      case 'joke':
        return {
          response: `😂 Yaar, I'm a music DJ, not a comedy one! But here's one for you: Why did the music student get locked out of class? Because they lost their keys! 🎹 Now let's get back to the music!`,
          action: null
        };
      case 'channels_list':
        return await this.handleChannelsList(context);
      case 'suggestion':
        return await this.handleMoodBasedSuggestion('chill', context);
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
      case 'chat':
        return await this.handleChat(message, context);
      default:
        return await this.handleChat(message, context);
    }
  }

  async handleChat(message, context) {
    try {
      const response = await gemini.chat(message, [], context);
      return {
        response,
        action: null,
        intent: 'chat'
      };
    } catch (err) {
      console.error('[EnhancedVJCore] Chat error:', err);
      return {
        response: "My brain is buffering... 🤯 Ask me again?",
        action: null
      };
    }
  }

  async handlePlaySuggestion(songQuery, context) {
    try {
      // Clean up the query - remove common noise words
      let cleanQuery = songQuery
        .replace(/from\s+(youtube|spotify|saavn|wynk)/gi, '')
        .replace(/\s+(official|video|song|music|full|hd|lyrics|lyrical)\s*/gi, ' ')
        .replace(/by\s+/gi, '')
        .trim();

      console.log('[EnhancedVJCore] Play suggestion query:', { original: songQuery, clean: cleanQuery });

      // INTELLIGENCE CHECK: Is this a mood/vibe request or a specific song?
      // If the query is long (> 4 words) or contains "mood", "feel", "sad", "happy", etc.
      // treat it as a mood request, not a literal song search.
      const isMoodRequest = /mood|feel|vibe|sad|happy|party|chill|relax|dance|cry|broken/i.test(cleanQuery) || cleanQuery.split(' ').length > 4;

      if (isMoodRequest) {
        // Use Gemini to recommend a song based on the description
        // IMPORTANT: Gender-neutral, official music videos only
        const recommendation = await gemini.chat(
          `Recommend a popular OFFICIAL MUSIC VIDEO for: "${songQuery}".
Rules:
- Gender-neutral selection (no assumptions about listener's gender)
- Must be from official artist/label YouTube channels (VEVO, T-Series, etc.)
- Only suggest actual music videos, not lyric videos or fan uploads
- Prefer high-energy, universally loved tracks
- Return ONLY the song title and artist name, nothing else.
Example: "Michael Bublé - Feeling Good [Official 4K Remastered Music Video]"`, 
          [], 
          context
        );
        
        // If Gemini returns a song name, search for THAT
        if (recommendation && recommendation.length < 60) {
           cleanQuery = recommendation.replace(/["']/g, '').trim() + ' official music video';
           console.log('[EnhancedVJCore] AI Recommendation:', cleanQuery);
        } else {
           // Fallback to mood suggestion if AI is chatty
           return await this.handleMoodBasedSuggestion(cleanQuery, context);
        }
      }

      // Strategy 1: Search database first (faster results)
      const songs = await Channel.find({
        $or: [
          { title: { $regex: cleanQuery, $options: 'i' } },
          { artist: { $regex: cleanQuery, $options: 'i' } }
        ]
      }).limit(3).lean();

      if (songs.length > 0) {
        const song = songs[0];
        this.intentDetector.setLastSuggestion(song);
        return {
          response: `🎵 Found in library! Playing: **${song.title}** by ${song.artist || 'Unknown'}`,
          action: {
            type: 'PLAY_EXTERNAL',
            videoId: song.videoId || song._id,
            title: song.title,
            autoPlay: true
          },
          intent: 'play_suggestion'
        };
      }

      // Strategy 2: Search YouTube with cleaned query
      const youtubeSearchResult = await searchYouTube(cleanQuery);
      if (youtubeSearchResult && youtubeSearchResult.videos && youtubeSearchResult.videos.length > 0) {
        const videos = youtubeSearchResult.videos;
        
        // If we have multiple results, show options instead of auto-playing
        if (videos.length > 1) {
          return {
            response: `🎵 Found ${videos.length} results for **"${cleanQuery}"**. Pick one:`,
            action: {
              type: 'SHOW_OPTIONS',
              suggestions: videos.slice(0, 5).map(r => ({
                id: r.youtubeId,
                title: r.title,
                thumbnail: r.thumbnail
              })),
              autoPlay: false
            },
            intent: 'play_suggestion'
          };
        }

        // Single result fallback
        const topResult = videos[0];
        return {
          response: `🎵 Found on YouTube! Playing: **${topResult.title}**`,
          action: {
            type: 'PLAY_YOUTUBE',
            videoId: topResult.youtubeId,
            title: topResult.title,
            autoPlay: true
          },
          intent: 'play_suggestion'
        };
      }

      // Strategy 3: Try semantic search as last resort
      const semanticResults = this.semanticSearcher.quickSearch(cleanQuery);
      if (semanticResults.length > 0 && semanticResults[0].score > 20) {
        const topResult = semanticResults[0];
        return {
          response: `🎵 Best match: **${topResult.title}** by ${topResult.artist || 'Unknown'}`,
          action: {
            type: 'PLAY_EXTERNAL',
            videoId: topResult.id,
            title: topResult.title,
            autoPlay: false
          },
          intent: 'play_suggestion'
        };
      }

      // Strategy 4: Get random song from library as last resort
      const channels = await Channel.find({ items: { $exists: true, $ne: [] } }).lean();
      if (channels.length > 0) {
        const randomChannel = channels[Math.floor(Math.random() * channels.length)];
        if (randomChannel.items && randomChannel.items.length > 0) {
          const randomVideo = randomChannel.items[Math.floor(Math.random() * randomChannel.items.length)];
          return {
            response: `🎵 Couldn't find **"${songQuery}"**, but here's from our library: **${randomVideo.title}**`,
            action: {
              type: 'PLAY_EXTERNAL',
              videoId: randomVideo.youtubeId || randomVideo._id,
              title: randomVideo.title,
              autoPlay: false
            },
            intent: 'play_suggestion'
          };
        }
      }

      return {
        response: `❌ Sorry, couldn't find **"${songQuery}"**. Try another song or ask "what's playing?"`,
        action: null
      };
    } catch (err) {
      console.error('[EnhancedVJCore] Play suggestion error:', err.message);
      return {
        response: '🎵 Let me search for that...',
        action: null,
        error: err.message
      };
    }
  }

  async handleSongSearch(query, context) {
    try {
      // Clean the query
      let cleanQuery = query
        .replace(/from\s+(youtube|spotify|saavn|wynk)/gi, '')
        .replace(/\s+(official|video|song|music|full|hd|lyrics|lyrical)\s*/gi, ' ')
        .trim();

      // Strategy 1: Direct semantic search in database
      const semanticResults = this.semanticSearcher.quickSearch(cleanQuery);
      
      if (semanticResults.length > 0 && semanticResults[0].score > 15) {
        const topResult = semanticResults[0];
        return {
          response: `🎵 Found it! **${topResult.title}** by ${topResult.artist || 'Unknown'}`,
          action: {
            type: 'PLAY_EXTERNAL',
            videoId: topResult.id,
            title: topResult.title,
            autoPlay: true
          },
          intent: 'search_song',
          suggestions: semanticResults.slice(0, 5)
        };
      }

      // Strategy 2: YouTube search
      const youtubeSearchResult = await searchYouTube(cleanQuery);
      if (youtubeSearchResult && youtubeSearchResult.videos && youtubeSearchResult.videos.length > 0) {
        const videos = youtubeSearchResult.videos;
        const topResult = videos[0];
        return {
          response: `🎵 Found on YouTube! **${topResult.title}**\n💡 Showing ${Math.min(videos.length, 5)} results`,
          action: {
            type: 'SHOW_OPTIONS',
            suggestions: videos.slice(0, 5).map(r => ({
              id: r.youtubeId,
              title: r.title,
              thumbnail: r.thumbnail
            })),
            autoPlay: false
          },
          intent: 'search_song',
          suggestions: videos.slice(0, 5)
        };
      }

      // Strategy 3: Use suggestion engine as fallback
      const result = await this.suggestionEngine.getSuggestions(cleanQuery, context?.userContext?.preferences || {}, 5);
      if (result.suggestions && result.suggestions.length > 0) {
        return {
          response: result.message,
          action: {
            type: 'SHOW_OPTIONS',
            suggestions: result.suggestions,
            autoPlay: false
          },
          intent: 'search_song',
          suggestions: result.suggestions
        };
      }

      return {
        response: `🎵 No results for **"${query}"**. Try different keywords or ask me to "suggest a song"!`,
        action: null,
        intent: 'search_song'
      };
    } catch (err) {
      console.error('[EnhancedVJCore] Song search error:', err.message);
      return {
        response: '🎵 Let me search for that song...',
        action: null,
        intent: 'search_song'
      };
    }
  }

  async handleMoodBasedSuggestion(mood, context) {
    // Use Gemini to generate a witty response for the mood
    let wittyResponse = `Here's a vibe for you!`;
    try {
        wittyResponse = await gemini.chat(
            `Suggest a short, witty one-liner for someone who is feeling "${mood}". Keep it "Desi" style.`,
            [],
            context
        );
    } catch (e) {
        console.warn('Gemini mood response failed, using default');
    }

    // Get all channels and pick a random one with songs
    const channels = await Channel.find({ items: { $exists: true, $ne: [] } }).lean();

    if (channels.length === 0) {
      return { response: `🎵 No songs available for ${mood} mood`, action: null };
    }

    // Get a random channel and a random song from it
    const randomChannel = channels[Math.floor(Math.random() * channels.length)];
    const randomVideo = randomChannel.items[Math.floor(Math.random() * randomChannel.items.length)];

    return {
      response: `🎵 ${wittyResponse}\nPlaying: **${randomVideo.title}**`,
      action: {
        type: 'PLAY_EXTERNAL',
        videoId: randomVideo.youtubeId || randomVideo._id,
        title: randomVideo.title,
        autoPlay: false
      },
      intent: 'mood_suggestion'
    };
  }

  async handleArtistSearch(artist, context) {
    try {
      // Search for songs by this artist in database
      const songs = await Channel.find({
        $or: [
          { artist: { $regex: artist, $options: 'i' } },
          { items: { $elemMatch: { artist: { $regex: artist, $options: 'i' } } } }
        ]
      }).limit(5).lean();

      if (songs.length > 0) {
        const song = songs[0];
        return {
          response: `🎤 **${artist}** - Found some great tracks! Now playing: **${song.title || song.items?.[0]?.title || 'Unknown'}**`,
          action: {
            type: 'PLAY_EXTERNAL',
            videoId: song.videoId || song.items?.[0]?.youtubeId || song._id,
            title: song.title || song.items?.[0]?.title,
            autoPlay: false
          },
          intent: 'artist_search'
        };
      }

      // Try YouTube search as fallback
      const youtubeSearchResult = await searchYouTube(`${artist} songs`);
      if (youtubeSearchResult && youtubeSearchResult.videos && youtubeSearchResult.videos.length > 0) {
        const topResult = youtubeSearchResult.videos[0];
        return {
          response: `🎤 **${artist}** - Great choice! Playing: **${topResult.title}**`,
          action: {
            type: 'PLAY_YOUTUBE',
            videoId: topResult.youtubeId,
            title: topResult.title,
            autoPlay: false
          },
          intent: 'artist_search'
        };
      }

      // Final fallback
      const channels = await Channel.find({ items: { $exists: true, $ne: [] } }).lean();
      if (channels.length > 0) {
        const randomChannel = channels[Math.floor(Math.random() * channels.length)];
        const randomVideo = randomChannel.items[Math.floor(Math.random() * randomChannel.items.length)];
        return {
          response: `🎤 Couldn't find **${artist}**, but here's a great song: **${randomVideo.title}**`,
          action: {
            type: 'PLAY_EXTERNAL',
            videoId: randomVideo.youtubeId || randomVideo._id,
            title: randomVideo.title,
            autoPlay: false
          },
          intent: 'artist_search'
        };
      }

      return { response: `🎤 No songs found for **${artist}**`, action: null };
    } catch (err) {
      console.error('[EnhancedVJCore] Artist search error:', err.message);
      return { response: `Error searching for ${artist}`, action: null };
    }
  }

  async handleGenreSearch(genre, context) {
    // Fallback: Get random songs from any channel
    const channels = await Channel.find({ items: { $exists: true, $ne: [] } }).lean();
    
    if (channels.length === 0) {
      return { response: `❌ No songs in **${genre}** genre`, action: null };
    }

    // Get a random channel and random song
    const randomChannel = channels[Math.floor(Math.random() * channels.length)];
    const randomVideo = randomChannel.items[Math.floor(Math.random() * randomChannel.items.length)];

    return {
      response: `🎵 Here's a ${genre} track: **${randomVideo.title}**`,
      action: {
        type: 'PLAY_EXTERNAL',
        videoId: randomVideo.youtubeId || randomVideo._id,
        title: randomVideo.title,
        autoPlay: false
      },
      intent: 'genre_search'
    };
  }

  async handleChannelsList(context) {
    try {
      // Fetch all channels from database
      const channels = await Channel.find({}, { name: 1, description: 1, _id: 1 }).lean();
      
      if (!channels || channels.length === 0) {
        return {
          response: '📺 No channels available right now. Try again later!',
          action: null
        };
      }

      // Format channel list
      const channelNames = channels.map(ch => ch.name).filter(Boolean);
      const channelList = channelNames.slice(0, 10).join(', ');
      const totalChannels = channels.length;

      return {
        response: `📺 **Available Channels (${totalChannels}):**\n${channelList}\n\n🎵 Pick one and let's explore!`,
        action: {
          type: 'SHOW_CHANNELS',
          channels: channels.map(ch => ({
            id: ch._id,
            name: ch.name,
            description: ch.description
          }))
        },
        intent: 'channels_list',
        channels
      };
    } catch (err) {
      console.error('[EnhancedVJCore] Error listing channels:', err.message);
      return {
        response: '📺 Let me fetch the channels for you...',
        action: null
      };
    }
  }

  async handleGetNowPlaying(context) {
    const song = context.playerContext?.currentSong;
    
    if (!song || song.title === 'Unknown') {
      // Return a fun response instead of "nothing playing"
      return { 
        response: '🎵 Currently vibing to the sound of silence! 🔇 Try searching for a song or pick a channel first!', 
        action: null 
      };
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
