/**
 * MCP Tools for DesiTV Chatbot
 * 
 * ARCHITECTURE:
 * - INFO tools: Use real-time context passed from frontend
 * - SEARCH tools: Query MongoDB database OR Knowledge Base
 * - ACTION tools: Return actions for frontend to execute
 * - EXTERNAL: Search YouTube for songs NOT in our database
 * 
 * The context object contains:
 * - currentChannel: Channel name
 * - currentChannelId: Channel ID
 * - currentVideo: {title, artist, duration, youtubeId}
 * - currentVideoIndex: Position in playlist
 * - totalVideos: Total videos in channel
 * - availableChannels: [{id, name}]
 * 
 * KNOWLEDGE BASE:
 * All queries first check the knowledge base (fast, indexed)
 * If not found, falls back to YouTube search for external content
 */

const Channel = require('../models/Channel');
const path = require('path');
const fs = require('fs');

// Import Knowledge Base and YouTube Search services
const knowledgeBase = require('./knowledgeBase');
const youtubeSearch = require('./youtubeSearch');

// Load VJ content data
let vjContent = {};
try {
  const contentPath = path.join(__dirname, '../data/vjContent.json');
  vjContent = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  console.log('[Tools] Loaded VJ content data');
} catch (err) {
  console.warn('[Tools] Could not load vjContent.json:', err.message);
}

/**
 * Tool definitions for the AI
 */
const toolDefinitions = {
  get_now_playing: {
    name: 'get_now_playing',
    description: 'Get what is currently playing (uses real-time context)',
    execute: getNowPlaying,
    usesContext: true
  },
  get_up_next: {
    name: 'get_up_next',
    description: 'Get the next video that will play (uses real-time context)',
    execute: getUpNext,
    usesContext: true
  },
  get_channels: {
    name: 'get_channels',
    description: 'Get list of TV channels/categories',
    execute: getChannels
  },
  search_videos: {
    name: 'search_videos',
    description: 'Search for videos by title, artist, or keywords',
    execute: searchVideos
  },
  get_whats_playing: {
    name: 'get_whats_playing',
    description: 'Get what videos are in a channel playlist',
    execute: getWhatsPlaying
  },
  get_channel_songs: {
    name: 'get_channel_songs',
    description: 'List all songs/videos in a specific channel',
    execute: getChannelSongs
  },
  get_recommendations: {
    name: 'get_recommendations',
    description: 'Get video recommendations based on mood',
    execute: getRecommendations
  },
  change_channel: {
    name: 'change_channel',
    description: 'Change to a specific channel',
    execute: changeChannel
  },
  // NEW: YouTube Search for external songs
  search_youtube: {
    name: 'search_youtube',
    description: 'Search YouTube for songs NOT in our database',
    execute: searchYouTubeForSong
  },
  play_external: {
    name: 'play_external',
    description: 'Play a song from YouTube (not in our database)',
    execute: playExternalVideo
  },
  // Knowledge Base queries
  get_artists: {
    name: 'get_artists',
    description: 'List all available artists in our database',
    execute: getArtists
  },
  get_songs_by_artist: {
    name: 'get_songs_by_artist',
    description: 'Get all songs by a specific artist',
    execute: getSongsByArtist
  },
  get_genres: {
    name: 'get_genres',
    description: 'List all available music genres',
    execute: getGenres
  },
  get_songs_by_genre: {
    name: 'get_songs_by_genre',
    description: 'Get songs in a specific genre',
    execute: getSongsByGenre
  },
  get_db_stats: {
    name: 'get_db_stats',
    description: 'Get database statistics',
    execute: getDbStats
  },
  smart_play: {
    name: 'smart_play',
    description: 'Intelligently play content - tries DB first, then YouTube',
    execute: smartPlay
  },
  // Interactive features
  get_trivia: {
    name: 'get_trivia',
    description: 'Get a music trivia question',
    execute: getTrivia,
    usesContext: true  // Needs sessionId for answer tracking
  },
  check_trivia_answer: {
    name: 'check_trivia_answer',
    description: 'Check if trivia answer is correct',
    execute: checkTriviaAnswer,
    usesContext: true
  },
  reveal_trivia: {
    name: 'reveal_trivia',
    description: 'Reveal the trivia answer',
    execute: (params, context) => revealTriviaAnswer(context.sessionId),
    usesContext: true
  },
  get_shayari: {
    name: 'get_shayari',
    description: 'Get a romantic/mood-based shayari',
    execute: getShayari
  },
  this_day_in_history: {
    name: 'this_day_in_history',
    description: 'Get music/movie history for today',
    execute: getThisDayInHistory
  },
  dedicate_song: {
    name: 'dedicate_song',
    description: 'Dedicate a song to someone with VJ intro',
    execute: dedicateSong
  },
  get_movie_memory: {
    name: 'get_movie_memory',
    description: 'Get facts and memories about a classic movie',
    execute: getMovieMemory
  },
  get_similar: {
    name: 'get_similar',
    description: 'Get similar songs/channels based on what is playing',
    execute: getSimilar,
    usesContext: true
  },
  play_video: {
    name: 'play_video',
    description: 'Play a specific video by search',
    execute: playVideo
  }
};

/**
 * Get what's currently playing - uses REAL-TIME context from frontend
 * This is the key tool for "what's playing now?" questions
 */
function getNowPlaying(params = {}, context = {}) {
  const { currentChannel, currentVideo, currentVideoIndex, totalVideos } = context;
  
  if (!currentVideo) {
    return {
      success: false,
      error: 'No video currently playing',
      message: '🤔 Nothing playing right now! Try switching to a channel first.'
    };
  }
  
  const artist = currentVideo.artist || currentVideo.channelTitle || 'Unknown Artist';
  return {
    success: true,
    nowPlaying: {
      title: currentVideo.title,
      artist,
      channel: currentChannel,
      position: `Video ${(currentVideoIndex || 0) + 1} of ${totalVideos || '?'}`,
      duration: currentVideo.duration
    },
    message: `🎵 Now Playing on ${currentChannel}:\n\n"${currentVideo.title}"\nby ${artist}\n\n(Track ${(currentVideoIndex || 0) + 1} of ${totalVideos || '?'})`
  };
}

/**
 * Get what's up next - uses REAL-TIME context from frontend
 * This is the key tool for "what's next?" questions
 */
function getUpNext(params = {}, context = {}) {
  const { currentChannel, nextVideo, currentVideoIndex, totalVideos } = context;
  
  if (!nextVideo) {
    return {
      success: false,
      error: 'No information about upcoming video',
      message: '🔮 Not sure what\'s next - playlist might be at the end!'
    };
  }
  
  const artist = nextVideo.artist || nextVideo.channelTitle || 'Unknown Artist';
  return {
    success: true,
    upNext: {
      title: nextVideo.title,
      artist,
      channel: currentChannel,
      position: `Will be video ${(currentVideoIndex || 0) + 2} of ${totalVideos || '?'}`
    },
    message: `🔮 Up Next on ${currentChannel}:\n\n"${nextVideo.title}"\nby ${artist}`
  };
}

/**
 * Get all channels/categories
 */
async function getChannels(params = {}) {
  try {
    const { limit = 10 } = params;
    
    const channels = await Channel.find({ isActive: true })
      .select('name category description items')
      .limit(limit)
      .lean();

    const channelList = channels.map(ch => `📺 ${ch.name} (${ch.items?.length || 0} videos)`).join('\n');
    
    return {
      success: true,
      channels: channels.map(ch => ({
        name: ch.name,
        category: ch.category,
        description: ch.description,
        videoCount: ch.items?.length || 0
      })),
      message: `🎬 Available Channels:\n\n${channelList}\n\nSay "switch to [channel name]" to tune in!`
    };
  } catch (error) {
    console.error('[Tools] getChannels error:', error);
    return { success: false, error: error.message, message: 'Oops! Failed to load channels 😅' };
  }
}

/**
 * Search videos by query
 */
async function searchVideos(params = {}) {
  try {
    const { query, limit = 5 } = params;
    
    if (!query) {
      return { success: false, error: 'Query required', message: '🤔 What should I search for?' };
    }

    // Search in channel items
    const channels = await Channel.find({
      isActive: true,
      'items.title': { $regex: query, $options: 'i' }
    })
      .select('name category items')
      .lean();

    // Extract matching videos
    const results = [];
    for (const channel of channels) {
      for (const item of channel.items || []) {
        if (item.title?.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            title: item.title,
            channel: channel.name,
            category: channel.category,
            duration: item.duration
          });
          if (results.length >= limit) break;
        }
      }
      if (results.length >= limit) break;
    }

    if (results.length === 0) {
      return {
        success: false,
        query,
        results: [],
        total: 0,
        message: `🔍 No results for "${query}". Try:\n• Different artist name\n• Song title\n• Channel name`
      };
    }

    const resultList = results.map(r => `• "${r.title}" on ${r.channel}`).join('\n');
    return {
      success: true,
      query,
      results,
      total: results.length,
      message: `🔍 Found ${results.length} result(s) for "${query}":\n\n${resultList}\n\nSay "play [song name]" to play!`
    };
  } catch (error) {
    console.error('[Tools] searchVideos error:', error);
    return { success: false, error: error.message, message: 'Search failed! Try again? 😅' };
  }
}

/**
 * Get videos in a specific channel
 */
async function getWhatsPlaying(params = {}) {
  try {
    const { channelName, limit = 5 } = params;

    let query = { isActive: true };
    if (channelName) {
      query.name = { $regex: channelName, $options: 'i' };
    }

    const channel = await Channel.findOne(query)
      .select('name category items')
      .lean();

    if (!channel) {
      return { success: false, error: 'Channel not found' };
    }

    const videos = (channel.items || []).slice(0, limit).map(item => ({
      title: item.title,
      duration: item.duration
    }));

    return {
      success: true,
      channel: channel.name,
      category: channel.category,
      videos,
      totalVideos: channel.items?.length || 0
    };
  } catch (error) {
    console.error('[Tools] getWhatsPlaying error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all songs in a specific channel
 */
async function getChannelSongs(params = {}) {
  try {
    const { channelName, limit = 10 } = params;
    
    if (!channelName) {
      return { success: false, error: 'Channel name required', message: '🤔 Which channel?' };
    }

    const channel = await Channel.findOne({
      isActive: true,
      $or: [
        { name: { $regex: channelName, $options: 'i' } },
        { category: { $regex: channelName, $options: 'i' } }
      ]
    })
      .select('name category items')
      .lean();

    if (!channel) {
      return { 
        success: false, 
        error: `Channel "${channelName}" not found`,
        message: `🤔 No channel called "${channelName}". Try "what channels do you have?"`
      };
    }

    const songs = (channel.items || []).slice(0, limit).map((item, i) => ({
      index: i,
      title: item.title,
      duration: item.duration
    }));

    const songList = songs.map((s, i) => `${i + 1}. ${s.title}`).join('\n');
    const hasMore = (channel.items?.length || 0) > limit;
    
    return {
      success: true,
      channel: channel.name,
      songs,
      totalSongs: channel.items?.length || 0,
      message: `🎵 Songs on ${channel.name}:\n\n${songList}${hasMore ? `\n\n...and ${channel.items.length - limit} more!` : ''}\n\nSay "play [song name]" to play!`
    };
  } catch (error) {
    console.error('[Tools] getChannelSongs error:', error);
    return { success: false, error: error.message, message: 'Failed to get songs 😅' };
  }
}

/**
 * Get recommendations based on mood
 */
async function getRecommendations(params = {}) {
  try {
    const { mood = 'party' } = params;

    // Map moods to categories
    const moodToCategory = {
      party: ['Party Anthems', 'Club Nights', 'Desi Beats'],
      chill: ['Retro Gold', 'Late Night'],
      romantic: ['Romantic Hits', 'Love Songs'],
      nostalgic: ['Retro Gold', '2000s Hits', '9XM Classics'],
      sad: ['Retro Gold', 'Late Night'],
      happy: ['Party Anthems', 'Desi Beats'],
      energetic: ['Club Nights', 'Party Anthems']
    };

    const categories = moodToCategory[mood.toLowerCase()] || moodToCategory.party;

    const channels = await Channel.find({
      isActive: true,
      $or: [
        { category: { $in: categories } },
        { name: { $in: categories } }
      ]
    })
      .select('name category items _id')
      .limit(3)
      .lean();

    const buildMessage = (chans, moodText) => {
      if (chans.length === 0) return `🤔 No channels found for "${moodText}" mood!`;
      const list = chans.map(ch => `📺 ${ch.name}`).join('\n');
      return `🎵 For "${moodText}" mood, try:\n\n${list}\n\nSay "switch to [channel]" to tune in!`;
    };

    if (channels.length === 0) {
      // Fallback: get any active channels
      const fallback = await Channel.find({ isActive: true })
        .select('name category items _id')
        .limit(3)
        .lean();
      
      return {
        success: true,
        mood,
        recommendations: fallback.map(ch => ({
          channel: ch.name,
          channelId: ch._id.toString(),
          category: ch.category,
          sampleVideos: (ch.items || []).slice(0, 2).map(v => v.title)
        })),
        message: buildMessage(fallback, mood)
      };
    }

    return {
      success: true,
      mood,
      recommendations: channels.map(ch => ({
        channel: ch.name,
        channelId: ch._id.toString(),
        category: ch.category,
        sampleVideos: (ch.items || []).slice(0, 2).map(v => v.title)
      })),
      message: buildMessage(channels, mood)
    };
  } catch (error) {
    console.error('[Tools] getRecommendations error:', error);
    return { success: false, error: error.message, message: 'Oops! Recommendations failed 😅' };
  }
}

/**
 * Change to a specific channel - returns action for frontend
 */
async function changeChannel(params = {}) {
  try {
    const { channelName } = params;
    
    if (!channelName) {
      return { success: false, error: 'Channel name required' };
    }

    // Find matching channel
    const channel = await Channel.findOne({
      isActive: true,
      $or: [
        { name: { $regex: channelName, $options: 'i' } },
        { category: { $regex: channelName, $options: 'i' } }
      ]
    })
      .select('name category _id items')
      .lean();

    if (!channel) {
      // Return available channels if not found
      const available = await Channel.find({ isActive: true })
        .select('name')
        .lean();
      const channelList = available.map(c => c.name).slice(0, 5).join(', ');
      return { 
        success: false, 
        error: `Channel "${channelName}" not found`,
        message: `🤔 No channel called "${channelName}". Available: ${channelList}...`
      };
    }

    return {
      success: true,
      action: {
        type: 'CHANGE_CHANNEL',
        channelId: channel._id.toString(),
        channelName: channel.name,
        category: channel.category
      },
      message: `Switching to ${channel.name}! 📺`
    };
  } catch (error) {
    console.error('[Tools] changeChannel error:', error);
    return { success: false, error: error.message, message: 'Oops! Channel change failed 😅' };
  }
}

/**
 * Play a specific video - returns action for frontend
 */
async function playVideo(params = {}) {
  try {
    const { query, channelName } = params;
    
    if (!query) {
      return { success: false, error: 'Video search query required' };
    }

    // Build search query
    let searchQuery = { 
      isActive: true,
      'items.title': { $regex: query, $options: 'i' }
    };

    // Optional: filter by channel
    if (channelName) {
      searchQuery.name = { $regex: channelName, $options: 'i' };
    }

    const channels = await Channel.find(searchQuery)
      .select('name category items _id')
      .lean();

    // Find first matching video
    for (const channel of channels) {
      const videoIndex = (channel.items || []).findIndex(
        item => item.title?.toLowerCase().includes(query.toLowerCase())
      );
      
      if (videoIndex >= 0) {
        const video = channel.items[videoIndex];
        return {
          success: true,
          action: {
            type: 'PLAY_VIDEO',
            channelId: channel._id.toString(),
            channelName: channel.name,
            videoIndex: videoIndex,
            videoTitle: video.title,
            videoId: video.youtubeId || video.id
          },
          message: `Playing "${video.title}" on ${channel.name}! 🎵`
        };
      }
    }

    return { 
      success: false, 
      error: `Couldn't find a video matching "${query}"`,
      message: `🤔 Hmm, couldn't find "${query}" in our library.\n\nWant me to search YouTube? Say "play ${query} from youtube"`
    };
  } catch (error) {
    console.error('[Tools] playVideo error:', error);
    return { success: false, error: error.message, message: 'Oops! Something went wrong searching. Try again? 😅' };
  }
}

/**
 * NEW: Search YouTube for songs NOT in our database
 */
async function searchYouTubeForSong(params = {}) {
  const { query, artist, movie } = params;
  
  if (!query) {
    return { success: false, error: 'Search query required' };
  }
  
  try {
    // First check if it's in our database
    const dbResult = knowledgeBase.searchVideos(query, { limit: 1 });
    if (dbResult.found) {
      return {
        success: true,
        source: 'database',
        video: dbResult.bestMatch,
        message: `🎵 Found "${dbResult.bestMatch.title}" in our library!\n\nSay "play ${dbResult.bestMatch.title}" to play it!`
      };
    }
    
    // Not in database - search YouTube
    const ytResult = await youtubeSearch.searchSong(query, { artist, movie });
    
    if (!ytResult.success || !ytResult.found) {
      return {
        success: false,
        error: 'Song not found',
        message: `🔍 Could not find "${query}" on YouTube. Try:\n• Different song name\n• Add artist name\n• Check spelling`
      };
    }
    
    const video = ytResult.bestMatch;
    return {
      success: true,
      source: 'youtube',
      video: {
        title: video.title,
        youtubeId: video.youtubeId,
        channel: video.channel,
        thumbnail: video.thumbnail,
        duration: video.durationFormatted
      },
      message: `🎵 Found on YouTube!\n\n"${video.title}"\nby ${video.channel}\n\n⏱️ Duration: ${video.durationFormatted || 'Unknown'}\n\nSay "play this" to play it!`,
      action: {
        type: 'PLAY_EXTERNAL',
        videoId: video.youtubeId,
        videoTitle: video.title
      }
    };
  } catch (error) {
    console.error('[Tools] searchYouTubeForSong error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * NEW: Play external video from YouTube (not in database)
 */
async function playExternalVideo(params = {}) {
  const { youtubeId, query } = params;
  
  // If youtubeId provided directly
  if (youtubeId) {
    // Verify it's valid and appropriate
    const verification = await youtubeSearch.verifyVideo(youtubeId);
    if (!verification.valid) {
      return {
        success: false,
        error: verification.reason,
        message: `❌ Cannot play this video: ${verification.reason}`
      };
    }
    
    return {
      success: true,
      action: {
        type: 'PLAY_EXTERNAL',
        videoId: youtubeId,
        videoTitle: verification.video?.title || 'Unknown'
      },
      message: `🎵 Playing: "${verification.video?.title}"!`
    };
  }
  
  // If query provided, search first
  if (query) {
    const searchResult = await searchYouTubeForSong({ query });
    if (searchResult.success && searchResult.action) {
      return searchResult;
    }
    return {
      success: false,
      error: 'Video not found',
      message: `🤔 Could not find "${query}". Try a different search?`
    };
  }
  
  return { success: false, error: 'Either youtubeId or query required' };
}

/**
 * NEW: Smart Play - tries database first, then YouTube
 * This is the MAIN play function for comprehensive coverage
 */
async function smartPlay(params = {}) {
  const { query, channelName, forceExternal = false } = params;
  
  if (!query) {
    return { success: false, error: 'What should I play?' };
  }
  
  // Step 1: Check knowledge base (fast)
  if (!forceExternal) {
    const kbResult = knowledgeBase.searchVideos(query, { channel: channelName, limit: 1 });
    
    if (kbResult.found && kbResult.bestMatch) {
      const video = kbResult.bestMatch;
      
      // Find channel ID for this video
      const channel = await Channel.findOne({
        name: video.channel,
        isActive: true
      }).select('_id items').lean();
      
      if (channel) {
        const videoIndex = channel.items.findIndex(i => i.youtubeId === video.youtubeId);
        
        return {
          success: true,
          source: 'database',
          action: {
            type: 'PLAY_VIDEO',
            channelId: channel._id.toString(),
            channelName: video.channel,
            videoIndex: videoIndex >= 0 ? videoIndex : 0,
            videoTitle: video.title,
            videoId: video.youtubeId
          },
          message: `🎵 Playing "${video.title}" on ${video.channel}!`
        };
      }
    }
  }
  
  // Step 2: Not in database - search YouTube
  console.log(`[SmartPlay] "${query}" not in database, searching YouTube...`);
  
  const ytResult = await youtubeSearch.searchSong(query);
  
  if (ytResult.success && ytResult.found) {
    const video = ytResult.bestMatch;
    
    return {
      success: true,
      source: 'youtube',
      action: {
        type: 'PLAY_EXTERNAL',
        videoId: video.youtubeId,
        videoTitle: video.title
      },
      message: `🎵 Found on YouTube!\n\n"${video.title}"\n\n⏱️ ${video.durationFormatted || ''}\n\n(Note: This is from YouTube, not our library)`
    };
  }
  
  return {
    success: false,
    error: 'Song not found',
    message: `🤔 Sorry, couldn't find "${query}" in our library or on YouTube!\n\nTry:\n• Different song name\n• Artist + song name\n• Check spelling`
  };
}

/**
 * NEW: Get all artists from knowledge base
 */
function getArtists() {
  const result = knowledgeBase.getAllArtists();
  
  if (result.count === 0) {
    return { success: false, message: '🤔 No artists indexed yet!' };
  }
  
  const artistList = result.artists
    .sort((a, b) => b.songCount - a.songCount)
    .slice(0, 15)
    .map(a => `• ${a.name} (${a.songCount} songs)`)
    .join('\n');
  
  return {
    success: true,
    artists: result.artists,
    count: result.count,
    message: `🎤 Artists in our library:\n\n${artistList}\n\nSay "songs by [artist]" for their songs!`
  };
}

/**
 * NEW: Get songs by a specific artist
 */
function getSongsByArtist(params = {}) {
  const { artistName } = params;
  
  if (!artistName) {
    return getArtists(); // Show all artists if no name provided
  }
  
  const result = knowledgeBase.getSongsByArtist(artistName);
  
  if (!result.found) {
    // Check if partial match exists
    const allArtists = knowledgeBase.getAllArtists();
    const similar = allArtists.artists.filter(a => 
      a.name.toLowerCase().includes(artistName.toLowerCase()) ||
      artistName.toLowerCase().includes(a.name.toLowerCase().split(' ')[0])
    );
    
    if (similar.length > 0) {
      return {
        success: false,
        message: `🤔 "${artistName}" not found. Did you mean:\n${similar.map(a => `• ${a.name}`).join('\n')}?`
      };
    }
    
    return {
      success: false,
      message: `🤔 No songs found for "${artistName}" in our library.\n\nTry searching YouTube: "play ${artistName} song from youtube"`
    };
  }
  
  const songList = result.songs
    .slice(0, 10)
    .map((s, i) => `${i + 1}. ${s.title}`)
    .join('\n');
  
  return {
    success: true,
    artist: result.artist,
    songCount: result.songCount,
    songs: result.songs,
    message: `🎤 ${result.artist} - ${result.songCount} songs:\n\n${songList}${result.songCount > 10 ? `\n\n...and ${result.songCount - 10} more!` : ''}\n\nSay "play [song name]" to play!`
  };
}

/**
 * NEW: Get all genres
 */
function getGenres() {
  const result = knowledgeBase.getAllGenres();
  
  if (result.count === 0) {
    return { success: false, message: '🤔 No genres indexed yet!' };
  }
  
  const genreList = result.genres
    .map(g => `• ${g.genre} (${g.songCount} songs)`)
    .join('\n');
  
  return {
    success: true,
    genres: result.genres,
    count: result.count,
    message: `🎵 Music genres:\n\n${genreList}\n\nSay "play [genre] songs" for that vibe!`
  };
}

/**
 * NEW: Get songs by genre
 */
function getSongsByGenre(params = {}) {
  const { genre } = params;
  
  if (!genre) {
    return getGenres();
  }
  
  const result = knowledgeBase.getSongsByGenre(genre);
  
  if (!result.found) {
    return {
      success: false,
      message: `🤔 No "${genre}" songs found. Try: party, romantic, sad, retro, punjabi...`
    };
  }
  
  const songList = result.songs
    .slice(0, 8)
    .map((s, i) => `${i + 1}. ${s.title}`)
    .join('\n');
  
  return {
    success: true,
    genre: result.genre,
    songCount: result.songCount,
    songs: result.songs,
    message: `🎵 ${result.genre.toUpperCase()} songs (${result.songCount}):\n\n${songList}\n\nSay "play [song]" to play!`
  };
}

/**
 * NEW: Get database statistics
 */
function getDbStats() {
  const stats = knowledgeBase.getStats();
  
  return {
    success: true,
    stats,
    message: `📊 DesiTV Library Stats:\n\n📺 ${stats.totalChannels} Channels\n🎵 ${stats.totalVideos} Songs/Videos\n🎤 ${stats.totalArtists} Artists\n🎶 ${stats.totalGenres} Genres\n\nWhat do you want to watch?`
  };
}

/**
 * Execute a tool by name
 * @param {string} toolName - Name of the tool to execute
 * @param {object} params - Tool parameters
 * @param {object} context - Real-time context from frontend (for context-aware tools)
 */
async function executeTool(toolName, params = {}, context = {}) {
  const tool = toolDefinitions[toolName];
  if (!tool) {
    return { success: false, error: `Unknown tool: ${toolName}` };
  }
  
  // Pass context to tools that need it
  if (tool.usesContext) {
    return tool.execute(params, context);
  }
  
  return tool.execute(params);
}

/**
 * Detect which tools to use based on user message
 */
function detectIntent(message) {
  const lower = message.toLowerCase();
  
  // INFO: What's playing NOW? (uses real-time context)
  const nowPlayingPatterns = [
    /what(?:'s| is)\s*(?:this|playing|on|the song|the video)/i,
    /what\s*(?:song|video|track)\s*is\s*(?:this|playing|on)/i,
    /which\s*(?:song|video|track)/i,
    /current(?:ly)?\s*(?:playing|song|video)/i,
    /tell\s*me\s*(?:about\s*)?(?:this\s*)?(?:song|video|track)/i,
    /name\s*of\s*(?:this\s*)?(?:song|video)/i,
    /what\s*am\s*i\s*(?:watching|listening)/i
  ];
  
  for (const pattern of nowPlayingPatterns) {
    if (pattern.test(lower)) {
      return { tool: 'get_now_playing', params: {}, usesContext: true };
    }
  }
  
  // INFO: What's UP NEXT? (uses real-time context)
  const upNextPatterns = [
    /what(?:'s| is| will be)?\s*(?:up\s*)?next/i,
    /next\s*(?:song|video|track)/i,
    /what(?:'s| is)\s*coming\s*(?:up|next)/i,
    /after\s*this/i,
    /upcoming/i
  ];
  
  for (const pattern of upNextPatterns) {
    if (pattern.test(lower)) {
      return { tool: 'get_up_next', params: {}, usesContext: true };
    }
  }
  
  // PRIORITY 1: Dedication patterns (BEFORE shayari - catches "dedicate song")
  if (/dedicate\s+(?:a\s+)?(?:song|gaana)/i.test(lower) || /dedication/i.test(lower)) {
    const dedicationMatch = lower.match(/(?:to|for)\s+(?:my\s+)?(\w+)/i);
    const toName = dedicationMatch ? dedicationMatch[1] : 'someone special';
    let dedicationType = 'love';
    if (lower.includes('friend') || lower.includes('dost')) dedicationType = 'friendship';
    if (lower.includes('sad') || lower.includes('dard') || lower.includes('heartbreak')) dedicationType = 'heartbreak';
    if (lower.includes('party') || lower.includes('celebration')) dedicationType = 'party';
    return { tool: 'dedicate_song', params: { dedicationType, toName } };
  }
  
  // PRIORITY 2: Shayari patterns (after dedication)
  if (/shayari|poetry|poem/i.test(lower)) {
    const mood = /sad|dard/i.test(lower) ? 'sad' : 
                 /friend/i.test(lower) ? 'friendship' : 'romantic';
    return { tool: 'get_shayari', params: { mood } };
  }
  
  // PRIORITY 3: Trivia patterns
  if (/trivia|quiz|question|test me/i.test(lower)) {
    return { tool: 'get_trivia', params: {} };
  }
  
  // PRIORITY 3: This day in history
  if (/this day|today in|throwback|history|remember when/i.test(lower)) {
    return { tool: 'this_day_in_history', params: {} };
  }
  
  // PRIORITY: YouTube search - BEFORE "play on channel" patterns
  // Matches: "play X from youtube", "search youtube for X"
  if (/(?:from\s+youtube|on\s+youtube|youtube)/i.test(lower)) {
    const queryMatch = lower.match(/(?:play|search|find)\s+(.+?)\s+(?:from|on)\s+youtube/i) ||
                       lower.match(/search\s+youtube\s+(?:for\s+)?(.+)/i) ||
                       lower.match(/youtube\s+(?:search|play)\s+(.+)/i);
    if (queryMatch) {
      return { tool: 'search_youtube', params: { query: queryMatch[1].trim() } };
    }
  }
  
  // ACTION: Play specific video ON a channel (e.g., "play hookah bar on club nights")
  // EXCLUDE youtube which is handled above
  const playOnChannelPatterns = [
    /(?:play|switch to|put on)\s+["']?(.+?)["']?\s+(?:on|in|from)\s+(?:channel\s+)?["']?(.+?)["']?$/i,
    /(?:i meant|i want)\s+["']?(.+?)["']?\s+(?:on|in|from)\s+(?:channel\s+)?["']?(.+?)["']?$/i
  ];
  
  for (const pattern of playOnChannelPatterns) {
    const match = lower.match(pattern);
    if (match && !match[2].includes('youtube')) {  // Skip if channel name is "youtube"
      return { tool: 'play_video', params: { query: match[1].trim(), channelName: match[2].trim() } };
    }
  }
  
  // ACTION: Change channel (highest priority for "switch to X")
  const changePatterns = [
    /(?:switch|change|go|tune)\s*(?:to|into)?\s*(?:the\s+)?(?:channel\s+)?["']?([^"']+?)["']?\s*(?:channel)?$/i,
    /(?:put|play)\s+(?:on\s+)?(?:the\s+)?["']?([^"']+?)["']?\s*channel/i,
    /(?:take me to|open)\s+["']?([^"']+?)["']?/i
  ];
  
  for (const pattern of changePatterns) {
    const match = lower.match(pattern);
    if (match) {
      return { tool: 'change_channel', params: { channelName: match[1].trim() } };
    }
  }
  
  // PRIORITY: Genre-based play requests - BEFORE general play patterns
  // Matches: "play party songs", "play romantic music"
  const genrePlayPattern = lower.match(/play\s+(party|romantic|sad|retro|punjabi|devotional|item)\s+(?:songs?|music|tracks?)/i);
  if (genrePlayPattern) {
    return { tool: 'get_songs_by_genre', params: { genre: genrePlayPattern[1] } };
  }
  
  // ACTION: Play specific video (AFTER YouTube and genre checks)
  const playPatterns = [
    /(?:play|put on)\s+["']?(.+?)["']?(?:\s+(?:song|video))?$/i,
    /(?:i want to (?:hear|watch|see))\s+["']?(.+?)["']?/i,
    /(?:can you play)\s+["']?(.+?)["']?/i
  ];
  
  for (const pattern of playPatterns) {
    const match = lower.match(pattern);
    if (match && !match[1].includes('channel')) {
      return { tool: 'play_video', params: { query: match[1].trim() } };
    }
  }
  
  // INFO: What songs does channel have
  const channelSongsPatterns = [
    /what\s+(?:songs?|videos?|tracks?)\s+(?:does|do|are in|has|have)\s+["']?(.+?)["']?\s*(?:have|got)?/i,
    /(?:songs?|videos?|tracks?)\s+(?:in|on|of)\s+["']?(.+?)["']?/i,
    /(?:list|show)\s+(?:songs?|videos?|tracks?)\s+(?:in|on|of|from)\s+["']?(.+?)["']?/i
  ];
  
  for (const pattern of channelSongsPatterns) {
    const match = lower.match(pattern);
    if (match) {
      return { tool: 'get_channel_songs', params: { channelName: match[1].trim() } };
    }
  }
  
  // PRIORITY: Genre-based song requests (before general artist query)
  // Matches: "play party songs", "show romantic songs", "punjabi music"
  const knownGenres = ['party', 'romantic', 'sad', 'retro', 'punjabi', 'hip-hop', 'sufi', 'devotional', 'item'];
  const genreSongPattern = new RegExp(`(?:play|show|list|give me)\\s+(${knownGenres.join('|')})\\s+(?:songs?|music|tracks?)`, 'i');
  const genreSongMatch = lower.match(genreSongPattern);
  if (genreSongMatch) {
    return { tool: 'get_songs_by_genre', params: { genre: genreSongMatch[1] } };
  }
  
  // Search patterns (info only, no action)
  // BUT exclude "search youtube" which is handled later
  if ((lower.includes('search') || lower.includes('find')) && !lower.includes('youtube')) {
    const match = lower.match(/(?:search|find)\s+(?:for\s+)?(.+)/i);
    if (match) {
      return { tool: 'search_videos', params: { query: match[1].trim() } };
    }
  }
  
  // Artist songs query - "songs by X", "arijit songs", etc
  // SKIP if it matches "similar songs" or "how many songs"
  if (!/similar|how many/i.test(lower)) {
    const artistSongsPatterns = [
      /songs?\s+(?:by|of|from)\s+(.+)/i,
      /^(.+?)(?:'s)?\s+songs?$/i  // Must be at start/end to avoid "similar songs"
    ];
    for (const pattern of artistSongsPatterns) {
      const match = lower.match(pattern);
      if (match) {
        const artistName = match[1].trim();
        // Check if it's an artist (not a genre or channel)
        if (!knownGenres.includes(artistName.toLowerCase()) && 
            !['channel', 'desi', 'club', 'similar', 'many', 'all'].some(na => artistName.includes(na))) {
          return { tool: 'get_songs_by_artist', params: { artistName } };
        }
      }
    }
  }
  
  // Channel queries (info)
  if (lower.includes('channel') || lower.includes('what\'s on') || lower.includes('whats on')) {
    return { tool: 'get_channels', params: {} };
  }
  
  // KNOWN CHANNEL NAMES - detect channel name alone
  const knownChannels = ['cartoon adda', 'hassi ke phatke', 'desi beats', 'club nights', 'late night love', 'retro gold', 'late night vibes', 'party anthems'];
  for (const channel of knownChannels) {
    if (lower === channel || lower === channel.replace(/\s+/g, '')) {
      return { tool: 'change_channel', params: { channelName: channel } };
    }
  }
  
  // Mood-based recommendations (AFTER shayari detection)
  const moods = ['party', 'chill', 'nostalgic', 'sad', 'happy', 'energetic'];
  for (const mood of moods) {
    if (lower.includes(mood) && !lower.includes('shayari')) {
      return { tool: 'get_recommendations', params: { mood } };
    }
  }
  // Special: "romantic" only if NOT asking for shayari
  if (lower.includes('romantic') && !lower.includes('shayari')) {
    return { tool: 'get_recommendations', params: { mood: 'romantic' } };
  }
  
  // Artist/song search
  const artists = ['honey singh', 'arijit', 'atif', 'sonu nigam', 'shreya', 'badshah', 'neha kakkar'];
  for (const artist of artists) {
    if (lower.includes(artist)) {
      // Check if it's a play request or search request
      if (lower.includes('play') || lower.includes('put')) {
        return { tool: 'play_video', params: { query: artist } };
      }
      return { tool: 'search_videos', params: { query: artist } };
    }
  }
  
  // Similar/related content patterns
  if (/similar|like this|more like|related|same type|aise aur|aur bhi/i.test(lower)) {
    return { tool: 'get_similar', params: {}, usesContext: true };
  }
  
  // Dedication patterns
  const dedicationPatterns = [
    /dedicate.*(?:to|for)\s+(\w+)/i,
    /dedication.*(?:to|for)\s+(\w+)/i,
    /(?:song|gaana)\s+(?:dedicate|dedication).*(?:to|for)\s+(\w+)/i
  ];
  for (const pattern of dedicationPatterns) {
    const match = lower.match(pattern);
    if (match) {
      const toName = match[1];
      let dedicationType = 'love';
      if (lower.includes('friend') || lower.includes('dost')) dedicationType = 'friendship';
      if (lower.includes('sad') || lower.includes('dard') || lower.includes('heartbreak')) dedicationType = 'heartbreak';
      if (lower.includes('party') || lower.includes('celebration')) dedicationType = 'party';
      return { tool: 'dedicate_song', params: { dedicationType, toName } };
    }
  }
  
  // Movie memory patterns
  const moviePatterns = [
    /(?:tell me about|facts about|remember)\s+(?:the movie\s+)?(.+)/i,
    /(.+)\s+(?:movie|film)\s+(?:facts|memories|trivia)/i,
    /movie\s+(?:memory|memories)/i
  ];
  if (/movie.*(?:memory|memories|facts)|(?:ddlj|dil chahta|lagaan|kuch kuch|k3g)/i.test(lower)) {
    const movieMatch = lower.match(/(?:ddlj|dil chahta hai|dil to pagal|lagaan|kuch kuch|k3g|rang de basanti)/i);
    return { tool: 'get_movie_memory', params: { movieName: movieMatch ? movieMatch[0] : null } };
  }
  
  // Check trivia answer patterns
  if (/^(answer|jawab|reveal|batao)/i.test(lower)) {
    return { tool: 'reveal_trivia', params: {}, usesContext: true };
  }
  
  // NEW: Artist-specific queries
  if (/(?:songs?\s+(?:by|of|from)|what\s+songs?\s+(?:does|do)\s+\w+\s+have|list\s+\w+\s+songs?)/i.test(lower)) {
    const artistMatch = lower.match(/(?:songs?\s+(?:by|of|from)|what\s+songs?\s+(?:does|do))\s+(.+?)(?:\s+have|\s+got|$)/i);
    if (artistMatch) {
      return { tool: 'get_songs_by_artist', params: { artistName: artistMatch[1].trim() } };
    }
  }
  
  // NEW: Show all artists
  if (/(?:show|list|what)\s*(?:all\s+)?artists?|who\s+(?:do\s+you\s+have|is\s+in)/i.test(lower)) {
    return { tool: 'get_artists', params: {} };
  }
  
  // NEW: Genre queries
  if (/(?:show|list|what)\s*(?:all\s+)?(?:genres?|categories|types)/i.test(lower)) {
    return { tool: 'get_genres', params: {} };
  }
  
  // NEW: Database stats - BEFORE other patterns that might catch "how many"
  if (/(?:how many|stats|statistics|library\s+(?:size|info)|total\s+(?:songs?|videos?))/i.test(lower)) {
    return { tool: 'get_db_stats', params: {} };
  }
  
  // NEW: Similar content patterns - catch before other patterns
  if (/similar\s+(?:songs?|videos?|content)|more\s+like\s+(?:this|it)|aise\s+aur|aur\s+bhi/i.test(lower)) {
    return { tool: 'get_similar', params: {}, usesContext: true };
  }
  
  // NEW: External YouTube search (explicit request) - BEFORE general play
  if (/(?:from\s+youtube|search\s+youtube|youtube|external\s+song|outside\s+(?:database|library))/i.test(lower)) {
    const queryMatch = lower.match(/(?:play|search|find)\s+(.+?)\s+(?:from|on)\s+youtube/i) ||
                       lower.match(/search\s+youtube\s+(?:for\s+)?(.+)/i) ||
                       lower.match(/youtube\s+(?:search|play)\s+(.+)/i) ||
                       lower.match(/(?:play|search|find)\s+(.+?)\s+(?:external|outside)/i);
    if (queryMatch) {
      return { tool: 'search_youtube', params: { query: queryMatch[1].trim() } };
    }
    // If just "from youtube" without specific query
    return { tool: 'search_youtube', params: { query: lower.replace(/from\s+youtube|youtube/i, '').trim() } };
  }
  
  // NEW: "Play this" after YouTube search
  if (/^play\s+(?:this|it)$/i.test(lower.trim())) {
    // This is handled in controller - needs context of last search
    return { tool: 'play_last_search', params: {} };
  }
  
  // If user types a short answer (possible trivia response)
  // This should be handled after checking other patterns
  // Will be detected in controller based on active trivia session
  
  return null;
}

/**
 * NEW TOOLS: Interactive Features
 */

/**
 * Get a random trivia question - returns pre-built message
 */
function getTrivia(params = {}, context = {}) {
  const { sessionId } = context;
  const triviaList = vjContent.trivia || [];
  if (triviaList.length === 0) {
    return { 
      success: false, 
      error: 'No trivia available',
      message: 'Oops! Trivia database is empty. Try asking something else! 😅'
    };
  }
  
  const trivia = triviaList[Math.floor(Math.random() * triviaList.length)];
  
  // Store trivia for answer checking
  if (sessionId) {
    storeTrivia(sessionId, trivia);
  }
  
  // Return pre-built message so AI doesn't hallucinate
  return {
    success: true,
    trivia: {
      id: trivia.id,
      question: trivia.question,
      hint: trivia.hint,
      year: trivia.year,
      difficulty: trivia.difficulty
    },
    // Pre-built message - AI won't make up questions
    message: `🎯 TRIVIA TIME! ${trivia.difficulty === 'hard' ? '🔥 HARD' : trivia.difficulty === 'medium' ? '⭐ MEDIUM' : '✨ EASY'}\n\n${trivia.question}\n\n💡 Hint: ${trivia.hint}\n\n(Type your answer!)`
  };
}

/**
 * Get a shayari based on mood - returns pre-built message
 */
function getShayari(params = {}) {
  const { mood = 'romantic' } = params;
  const shayariList = vjContent.shayari?.[mood] || vjContent.shayari?.romantic || [];
  
  if (shayariList.length === 0) {
    return { 
      success: false, 
      error: 'No shayari available',
      message: 'Shayari folder khali hai yaar! 😅 Try something else?'
    };
  }
  
  const shayari = shayariList[Math.floor(Math.random() * shayariList.length)];
  
  // Pre-built message
  return {
    success: true,
    shayari,
    mood,
    message: `💕 ${mood === 'sad' ? 'Dard-e-dil' : mood === 'friendship' ? 'Dosti' : 'Mohabbat'} ki shayari:\n\n"${shayari}"`
  };
}

/**
 * Get "This Day in History" content - returns pre-built message
 */
function getThisDayInHistory() {
  const today = new Date();
  const dateKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const dayData = vjContent.thisDay?.[dateKey];
  
  // If no specific data for today, return generic response
  if (!dayData) {
    const year = 2000 + Math.floor(Math.random() * 10);
    return {
      success: true,
      thisDay: {
        date: dateKey,
        year
      },
      message: `📅 This Day in Bollywood History!\n\nBack in ${year}, Indian music was vibing! 🎶\nMusic channels like MTV & Channel V were ruling our TVs!\n\nWhat era music do you want to hear? 90s? 2000s?`
    };
  }
  
  return {
    success: true,
    thisDay: {
      date: dateKey,
      events: dayData.events,
      songs: dayData.songs
    },
    message: `📅 This Day in Bollywood!\n\n${dayData.events.join('\n')}\n\n🎵 Hit songs: ${dayData.songs.join(', ')}`
  };
}

// Store last trivia for answer checking (simple in-memory)
let lastTrivia = {};

/**
 * Store trivia for later answer checking
 */
function storeTrivia(sessionId, trivia) {
  lastTrivia[sessionId] = {
    ...trivia,
    timestamp: Date.now()
  };
  // Clean up old entries (older than 10 minutes)
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const key of Object.keys(lastTrivia)) {
    if (lastTrivia[key].timestamp < cutoff) {
      delete lastTrivia[key];
    }
  }
}

/**
 * Check trivia answer
 */
function checkTriviaAnswer(params = {}) {
  const { answer, sessionId } = params;
  
  if (!answer) {
    return { success: false, message: '🤔 Kya answer hai? Batao toh!' };
  }
  
  // Get the last trivia question
  const trivia = lastTrivia[sessionId];
  
  if (!trivia) {
    return { 
      success: false, 
      message: '❓ Pehle trivia question lo! Say "give me trivia"' 
    };
  }
  
  const userAnswer = answer.toLowerCase().trim();
  const correctAnswer = trivia.answer.toLowerCase();
  const acceptedAnswers = trivia.acceptedAnswers || [correctAnswer];
  
  // Check if answer matches
  const isCorrect = acceptedAnswers.some(accepted => 
    userAnswer.includes(accepted.toLowerCase()) || 
    accepted.toLowerCase().includes(userAnswer)
  );
  
  if (isCorrect) {
    delete lastTrivia[sessionId]; // Clear for next question
    return {
      success: true,
      correct: true,
      message: `🎉 SAHI JAWAB!\n\n✅ "${trivia.answer}" bilkul correct hai!\n\n${trivia.year ? `📅 Ye ${trivia.year} ki baat hai!` : ''}\n\nEk aur trivia chahiye? Say "trivia"!`
    };
  } else {
    return {
      success: true,
      correct: false,
      message: `❌ Galat jawab! Try again?\n\n💡 Hint: ${trivia.hint}\n\n(Ya "answer batao" bolo for the answer)`
    };
  }
}

/**
 * Reveal trivia answer
 */
function revealTriviaAnswer(sessionId) {
  const trivia = lastTrivia[sessionId];
  if (!trivia) {
    return { success: false, message: '❓ Koi trivia question nahi hai!' };
  }
  
  delete lastTrivia[sessionId];
  return {
    success: true,
    message: `🔓 Answer: ${trivia.answer}\n\n${trivia.year ? `📅 Year: ${trivia.year}` : ''}\n\nEk aur trivia? Say "trivia"!`
  };
}

/**
 * Dedicate a song to someone
 */
function dedicateSong(params = {}) {
  const { dedicationType = 'love', toName, fromName } = params;
  
  const dedications = vjContent.dedications || {};
  const dedication = dedications[dedicationType] || dedications.love;
  
  if (!dedication) {
    return { success: false, message: '💝 Dedication system loading... try again!' };
  }
  
  const intro = dedication.intros[Math.floor(Math.random() * dedication.intros.length)];
  const song = dedication.songs[Math.floor(Math.random() * dedication.songs.length)];
  
  let message = `💝 SPECIAL DEDICATION\n\n${intro}\n\n`;
  
  if (toName && fromName) {
    message += `🎁 From: ${fromName}\n💕 To: ${toName}\n\n`;
  } else if (toName) {
    message += `💕 For: ${toName}\n\n`;
  }
  
  message += `🎵 "${song}"\n\n`;
  message += `Say "play ${song}" to play this dedication!`;
  
  return {
    success: true,
    dedication: { type: dedicationType, song, intro },
    message
  };
}

/**
 * Get movie memories/facts
 */
function getMovieMemory(params = {}) {
  const { movieName } = params;
  
  const memories = vjContent.movieMemories || {};
  
  if (!movieName) {
    // Return a random movie memory
    const movieKeys = Object.keys(memories);
    if (movieKeys.length === 0) {
      return { success: false, message: '🎬 Movie database is empty!' };
    }
    const randomKey = movieKeys[Math.floor(Math.random() * movieKeys.length)];
    const movie = memories[randomKey];
    
    return {
      success: true,
      movie: { name: randomKey, ...movie },
      message: `🎬 MOVIE MEMORIES: ${randomKey} (${movie.year})\n\n📌 ${movie.fact}\n\n🎵 Songs: ${movie.songs.join(', ')}\n\n💬 "${movie.quote}"`
    };
  }
  
  // Search for specific movie
  const searchTerm = movieName.toLowerCase();
  const foundKey = Object.keys(memories).find(key => 
    key.toLowerCase().includes(searchTerm) || 
    searchTerm.includes(key.toLowerCase())
  );
  
  if (!foundKey) {
    return { 
      success: false, 
      message: `🤔 "${movieName}" ki memories nahi mili. Try: DDLJ, Dil Chahta Hai, Lagaan...` 
    };
  }
  
  const movie = memories[foundKey];
  return {
    success: true,
    movie: { name: foundKey, ...movie },
    message: `🎬 MOVIE MEMORIES: ${foundKey} (${movie.year})\n\n📌 ${movie.fact}\n\n🎵 Songs: ${movie.songs.join(', ')}\n\n💬 "${movie.quote}"`
  };
}

/**
 * Get similar songs/channels based on current context
 */
async function getSimilar(params = {}, context = {}) {
  const { currentChannel, currentVideo } = context;
  
  if (!currentChannel && !currentVideo) {
    return {
      success: false,
      message: '🤔 Play something first, then I can suggest similar!'
    };
  }
  
  try {
    // Find channels with similar category
    const channels = await Channel.find({ isActive: true })
      .select('name category items')
      .lean();
    
    // Get current channel info
    const current = channels.find(c => c.name === currentChannel);
    const currentCategory = current?.category || '';
    
    // Find similar by category
    const similarChannels = channels.filter(c => 
      c.name !== currentChannel && 
      (c.category === currentCategory || 
       c.name.toLowerCase().includes(currentCategory.toLowerCase()))
    ).slice(0, 3);
    
    // Build response
    let message = `🎵 Based on "${currentVideo?.title || currentChannel}":\n\n`;
    
    if (similarChannels.length > 0) {
      message += `📺 Similar channels:\n`;
      similarChannels.forEach(c => {
        const sampleSong = c.items?.[0]?.title || 'Various songs';
        message += `• ${c.name} - "${sampleSong}"\n`;
      });
    }
    
    // Suggest from same channel
    if (current?.items?.length > 1) {
      const otherSongs = current.items
        .filter(i => i.title !== currentVideo?.title)
        .slice(0, 3);
      
      if (otherSongs.length > 0) {
        message += `\n🎶 More from ${currentChannel}:\n`;
        otherSongs.forEach(s => {
          message += `• "${s.title}"\n`;
        });
      }
    }
    
    message += `\nSay "play [song]" or "switch to [channel]"!`;
    
    return {
      success: true,
      similar: {
        channels: similarChannels.map(c => c.name),
        currentCategory
      },
      message
    };
  } catch (error) {
    console.error('[Tools] getSimilar error:', error);
    return { success: false, message: 'Could not find similar content 😅' };
  }
}

module.exports = {
  toolDefinitions,
  executeTool,
  detectIntent,
  // Info tools
  getNowPlaying,
  getUpNext,
  getChannels,
  searchVideos,
  getWhatsPlaying,
  getRecommendations,
  // Action tools
  changeChannel,
  playVideo,
  // NEW: Smart play with DB + YouTube fallback
  smartPlay,
  // NEW: YouTube search
  searchYouTubeForSong,
  playExternalVideo,
  // NEW: Knowledge base queries
  getArtists,
  getSongsByArtist,
  getGenres,
  getSongsByGenre,
  getDbStats,
  // Interactive features
  getTrivia,
  checkTriviaAnswer,
  getShayari,
  getThisDayInHistory,
  dedicateSong,
  getMovieMemory,
  getSimilar,
  storeTrivia,
  revealTriviaAnswer
};
