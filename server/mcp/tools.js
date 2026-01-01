/**
 * MCP Tools for DesiTV Chatbot
 * 
 * ARCHITECTURE:
 * - INFO tools: Use real-time context passed from frontend
 * - SEARCH tools: Query MongoDB database
 * - ACTION tools: Return actions for frontend to execute
 * 
 * The context object contains:
 * - currentChannel: Channel name
 * - currentChannelId: Channel ID
 * - currentVideo: {title, artist, duration, youtubeId}
 * - currentVideoIndex: Position in playlist
 * - totalVideos: Total videos in channel
 * - availableChannels: [{id, name}]
 */

const Channel = require('../models/Channel');
const path = require('path');
const fs = require('fs');

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
  // NEW: Interactive features
  get_trivia: {
    name: 'get_trivia',
    description: 'Get a music trivia question',
    execute: getTrivia
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
      suggestion: 'Try switching to a channel first!'
    };
  }
  
  return {
    success: true,
    nowPlaying: {
      title: currentVideo.title,
      artist: currentVideo.artist || 'Unknown Artist',
      channel: currentChannel,
      position: `Video ${(currentVideoIndex || 0) + 1} of ${totalVideos || '?'}`,
      duration: currentVideo.duration
    }
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
      suggestion: 'The playlist might be at the end or still loading'
    };
  }
  
  return {
    success: true,
    upNext: {
      title: nextVideo.title,
      artist: nextVideo.artist || 'Unknown Artist',
      channel: currentChannel,
      position: `Will be video ${(currentVideoIndex || 0) + 2} of ${totalVideos || '?'}`
    }
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

    return {
      success: true,
      channels: channels.map(ch => ({
        name: ch.name,
        category: ch.category,
        description: ch.description,
        videoCount: ch.items?.length || 0
      }))
    };
  } catch (error) {
    console.error('[Tools] getChannels error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Search videos by query
 */
async function searchVideos(params = {}) {
  try {
    const { query, limit = 5 } = params;
    
    if (!query) {
      return { success: false, error: 'Query required' };
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

    return {
      success: true,
      query,
      results,
      total: results.length
    };
  } catch (error) {
    console.error('[Tools] searchVideos error:', error);
    return { success: false, error: error.message };
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
      nostalgic: ['Retro Gold', '2000s Hits', '9XM Classics']
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
        }))
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
      }))
    };
  } catch (error) {
    console.error('[Tools] getRecommendations error:', error);
    return { success: false, error: error.message };
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
      return { 
        success: false, 
        error: `Channel "${channelName}" not found`,
        availableChannels: available.map(c => c.name)
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
    return { success: false, error: error.message };
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
      suggestion: 'Try searching for an artist name like "Honey Singh" or a song title'
    };
  } catch (error) {
    console.error('[Tools] playVideo error:', error);
    return { success: false, error: error.message };
  }
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
  
  // ACTION: Change channel (highest priority)
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
  
  // ACTION: Play specific video
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
  
  // Search patterns (info only, no action)
  if (lower.includes('search') || lower.includes('find')) {
    const match = lower.match(/(?:search|find)\s+(?:for\s+)?(.+)/i);
    if (match) {
      return { tool: 'search_videos', params: { query: match[1].trim() } };
    }
  }
  
  // Channel queries (info)
  if (lower.includes('channel') || lower.includes('what\'s on') || lower.includes('whats on')) {
    return { tool: 'get_channels', params: {} };
  }
  
  // Mood-based recommendations
  const moods = ['party', 'chill', 'romantic', 'nostalgic', 'sad', 'happy', 'energetic'];
  for (const mood of moods) {
    if (lower.includes(mood)) {
      return { tool: 'get_recommendations', params: { mood } };
    }
  }
  
  // NEW: Trivia patterns
  if (/trivia|quiz|question|test me/i.test(lower)) {
    return { tool: 'get_trivia', params: {} };
  }
  
  // NEW: Shayari patterns
  if (/shayari|poetry|poem|dedicate|dedication/i.test(lower)) {
    const mood = /sad|dard/i.test(lower) ? 'sad' : 
                 /friend/i.test(lower) ? 'friendship' : 'romantic';
    return { tool: 'get_shayari', params: { mood } };
  }
  
  // NEW: This day in history
  if (/this day|today in|throwback|history|remember when/i.test(lower)) {
    return { tool: 'this_day_in_history', params: {} };
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
  
  return null;
}

/**
 * NEW TOOLS: Interactive Features
 */

/**
 * Get a random trivia question
 */
function getTrivia() {
  const triviaList = vjContent.trivia || [];
  if (triviaList.length === 0) {
    return { success: false, error: 'No trivia available' };
  }
  
  const trivia = triviaList[Math.floor(Math.random() * triviaList.length)];
  return {
    success: true,
    trivia: {
      question: trivia.question,
      hint: trivia.hint,
      year: trivia.year,
      // Don't send answer - let VJ reveal it later!
      _answer: trivia.answer
    }
  };
}

/**
 * Get a shayari based on mood
 */
function getShayari(params = {}) {
  const { mood = 'romantic' } = params;
  const shayariList = vjContent.shayari?.[mood] || vjContent.shayari?.romantic || [];
  
  if (shayariList.length === 0) {
    return { success: false, error: 'No shayari available' };
  }
  
  const shayari = shayariList[Math.floor(Math.random() * shayariList.length)];
  return {
    success: true,
    shayari,
    mood
  };
}

/**
 * Get "This Day in History" content
 */
function getThisDayInHistory() {
  const today = new Date();
  const dateKey = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const dayData = vjContent.thisDay?.[dateKey];
  
  // If no specific data for today, return generic response
  if (!dayData) {
    const year = 2000 + Math.floor(Math.random() * 10); // Random year 2000-2009
    return {
      success: true,
      thisDay: {
        date: dateKey,
        year,
        message: `Aaj ke din ${year} mein Bollywood mein kya chal raha tha? Let me think... 🤔`,
        events: ['Music channels were ruling!', 'Remixes were the craze!'],
        songs: ['2000s hits were everywhere!']
      }
    };
  }
  
  return {
    success: true,
    thisDay: {
      date: dateKey,
      events: dayData.events,
      songs: dayData.songs
    }
  };
}

module.exports = {
  toolDefinitions,
  executeTool,
  detectIntent,
  getNowPlaying,
  getUpNext,
  getChannels,
  searchVideos,
  getWhatsPlaying,
  getRecommendations,
  changeChannel,
  playVideo,
  getTrivia,
  getShayari,
  getThisDayInHistory
};
