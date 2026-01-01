/**
 * VJ Core - Netflix-Grade Architecture
 * 
 * PRINCIPLES:
 * 1. Content-Aware: Distinguish songs from comedy/videos
 * 2. Fuzzy Search: Handle typos, partial matches
 * 3. YouTube Fallback: If not in library, search YouTube
 * 4. Pre-built Facts: No AI hallucination for factual queries
 * 5. Clear Intent Detection: Understand user requests accurately
 */

const Channel = require('../models/Channel');
const { searchYouTube } = require('./youtubeSearch');
const path = require('path');
const fs = require('fs');

// Load VJ content
let vjContent = {};
try {
  vjContent = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/vjContent.json'), 'utf8'));
} catch (err) {
  console.warn('[VJCore] Could not load vjContent.json');
}

// Load knowledge base for channel search terms
let knowledgeBase = null;
try {
  knowledgeBase = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/knowledgeBase.json'), 'utf8'));
} catch (err) {
  console.warn('[VJCore] Could not load knowledgeBase.json');
}

// ============================================================================
// CONTENT TYPE DETECTION
// ============================================================================
const CONTENT_PATTERNS = {
  music: [
    /song/i, /gaana/i, /music/i, /video\s*song/i, /audio/i,
    /full\s*video/i, /lyric/i, /official/i, /remix/i,
    /ft\./i, /feat/i, /singer/i
  ],
  comedy: [
    /comedy/i, /funny/i, /scenes?/i, /hassi/i, /mazaak/i,
    /joke/i, /laugh/i, /best\s*of/i, /compilation/i
  ],
  movie: [
    /movie/i, /film/i, /full\s*movie/i, /cinema/i
  ]
};

function detectContentType(title, channel) {
  const text = `${title} ${channel}`.toLowerCase();
  
  if (CONTENT_PATTERNS.comedy.some(p => p.test(text))) return 'comedy';
  if (CONTENT_PATTERNS.movie.some(p => p.test(text))) return 'movie';
  if (CONTENT_PATTERNS.music.some(p => p.test(text))) return 'song';
  
  // Default based on channel name
  const ch = (channel || '').toLowerCase();
  if (ch.includes('hassi') || ch.includes('comedy')) return 'comedy';
  if (ch.includes('cartoon')) return 'cartoon';
  
  return 'video'; // Generic
}

function getContentLabel(type) {
  const labels = {
    song: '🎵 Song',
    comedy: '😂 Comedy',
    movie: '🎬 Movie',
    cartoon: '📺 Cartoon',
    video: '📺 Video'
  };
  return labels[type] || '📺 Video';
}

// ============================================================================
// ARTIST EXTRACTION
// ============================================================================
function extractArtistFromTitle(title) {
  if (!title) return null;
  
  // Clean common suffixes
  const cleaned = title
    .replace(/\|\s*(Full\s*)?(HD|Video|Audio|Official|Lyric|4K|1080p|Scenes?)/gi, '')
    .replace(/[-–]\s*(Full\s*)?(HD|Video|Audio|Official|Lyric|4K|1080p)/gi, '')
    .trim();
  
  const patterns = [
    /\|\s*([^|]+?)\s*$/i,
    /[-–]\s*([^-–|]+?)\s*$/i,
    /ft\.?\s*(.+?)(?:\s*\||$)/i,
    /feat\.?\s*(.+?)(?:\s*\||$)/i,
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      const artist = match[1].trim();
      if (!/(official|video|full|lyric|audio|hd|4k|1080p|scenes?|comedy|movie)/i.test(artist) 
          && artist.length < 50 && artist.length > 2) {
        return artist;
      }
    }
  }
  
  return null;
}

// ============================================================================
// FUZZY SEARCH - Netflix-style matching
// ============================================================================
function fuzzyMatch(query, text) {
  if (!query || !text) return 0;
  
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  
  // Exact match
  if (t.includes(q)) return 1.0;
  
  // Word-by-word match - IMPROVED: require actual word boundaries
  const queryWords = q.split(/\s+/).filter(w => w.length > 2);
  const textWords = t.split(/[\s|,.-]+/); // Split on word boundaries
  
  // If no substantial words to match
  if (queryWords.length === 0) return 0;
  
  let matchedWords = 0;
  for (const qw of queryWords) {
    let found = false;
    for (const tw of textWords) {
      // Exact match (high confidence)
      if (tw === qw) {
        matchedWords += 1.0;
        found = true;
        break;
      }
      // Word contains search term (medium confidence)
      if (tw.length > qw.length && tw.includes(qw)) {
        matchedWords += 0.8;
        found = true;
        break;
      }
      // Search contains word (low confidence)
      if (qw.length > tw.length && qw.includes(tw)) {
        matchedWords += 0.5;
        found = true;
        break;
      }
      // Levenshtein-like similarity for typos (very high bar: 0.85+)
      if (qw.length > 3 && tw.length > 3) {
        const similarity = stringSimilarity(qw, tw);
        if (similarity > 0.85) {
          matchedWords += 0.6;
          found = true;
          break;
        }
      }
    }
    
    // If word not found, penalize
    if (!found) {
      matchedWords += 0; // No partial credit if not found
    }
  }
  
  // Return percentage of matched words
  const score = matchedWords / queryWords.length;
  
  // Penalty for very long mismatch
  if (textWords.length > queryWords.length * 3) {
    return score * 0.7; // Penalize if text is much longer than query
  }
  
  return score;
}

// Simple string similarity (Dice coefficient)
function stringSimilarity(s1, s2) {
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) return 0;
  
  const bigrams1 = new Set();
  for (let i = 0; i < s1.length - 1; i++) {
    bigrams1.add(s1.substring(i, i + 2));
  }
  
  let matches = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    if (bigrams1.has(s2.substring(i, i + 2))) matches++;
  }
  
  return (2 * matches) / (s1.length + s2.length - 2);
}

// ============================================================================
// CONTEXT VALIDATION
// ============================================================================
function validateContext(context) {
  const clean = {
    hasVideo: false,
    hasChannel: false,
    video: null,
    channel: null,
    contentType: 'video',
    videoIndex: 0,
    totalVideos: 0,
    nextVideo: null
  };
  
  if (context.currentVideo && context.currentVideo.title) {
    clean.hasVideo = true;
    clean.video = {
      title: context.currentVideo.title,
      artist: extractArtistFromTitle(context.currentVideo.title),
      youtubeId: context.currentVideo.youtubeId || context.currentVideo.id,
      duration: context.currentVideo.duration
    };
    clean.contentType = detectContentType(context.currentVideo.title, context.currentChannel);
  }
  
  if (context.currentChannel) {
    clean.hasChannel = true;
    clean.channel = context.currentChannel;
  }
  
  clean.videoIndex = context.currentVideoIndex || 0;
  clean.totalVideos = context.totalVideos || 0;
  
  if (context.nextVideo && context.nextVideo.title) {
    clean.nextVideo = {
      title: context.nextVideo.title,
      artist: extractArtistFromTitle(context.nextVideo.title)
    };
  }
  
  return clean;
}

// ============================================================================
// INTENT DETECTION - Improved patterns
// ============================================================================
const INTENTS = {
  NOW_PLAYING: {
    patterns: [
      /what(?:'s| is)?\s*(?:this|playing|on|the song)/i,
      /what\s*(?:song|video|clip)(?:\s*is)?/i,
      /which\s*(?:song|video|track|clip)/i,
      /current(?:ly)?\s*(?:playing|song|video)/i,
      /kya\s*(?:chal|baj)\s*raha/i,
      /ye\s*kaun\s*(?:sa|si)/i,
      /now\s*playing/i
    ],
    handler: 'handleNowPlaying',
    needsContext: true
  },
  UP_NEXT: {
    patterns: [
      /what(?:'s| is)?\s*(?:up\s*)?next/i,
      /next\s*(?:song|video)/i,
      /aage\s*kya/i
    ],
    handler: 'handleUpNext',
    needsContext: true
  },
  CHANNELS: {
    patterns: [
      /(?:what|which|show|list)\s*channels?/i,
      /channels?\s*(?:do you have|available|hai)/i
    ],
    handler: 'handleChannels'
  },
  SWITCH_CHANNEL: {
    patterns: [
      /(?:switch|change|go)\s*(?:to|into)?\s*(?:channel\s+)?["']?([^"']+?)["']?$/i,
      /(?:tune|put)\s*(?:to|on)\s*["']?([^"']+?)["']?$/i
    ],
    handler: 'handleSwitchChannel',
    extractParam: 1
  },
  // NEW: YouTube search intent
  PLAY_YOUTUBE: {
    patterns: [
      /play\s+["']?(.+?)["']?\s*(?:from|on|via)\s*youtube/i,
      /(?:search|find)\s+["']?(.+?)["']?\s*(?:on|from)?\s*youtube/i,
      /youtube\s*(?:se|par|pe)?\s*["']?(.+?)["']?/i,
      /can\s*you\s*play\s*(?:through|from|on)\s*youtube/i
    ],
    handler: 'handleYouTubeSearch',
    extractParam: 1
  },
  PLAY_SONG: {
    patterns: [
      /play\s+["']?(.+?)["']?$/i,
      /bajao\s+["']?(.+?)["']?$/i,
      /(?:put|chala)\s+["']?(.+?)["']?$/i
    ],
    handler: 'handlePlaySong',
    extractParam: 1
  },
  TRIVIA: {
    patterns: [
      /trivia|quiz|sawaal|question/i,
      /test\s*(?:me|karo)/i
    ],
    handler: 'handleTrivia'
  },
  SHAYARI: {
    patterns: [
      /shayari|poetry|poem/i,
      /kuch\s*sunao/i
    ],
    handler: 'handleShayari'
  },
  GREETING: {
    patterns: [
      /^(?:hi|hello|hey|namaste|namaskar|kya\s*haal)[\s!?.]*$/i,
      /^(?:good\s*(?:morning|afternoon|evening|night))[\s!?.]*$/i
    ],
    handler: 'handleGreeting'
  },
  THANKS: {
    patterns: [
      /^(?:thanks?|thank\s*you|shukriya|dhanyavaad)[\s!?.]*$/i
    ],
    handler: 'handleThanks'
  }
};

function detectIntent(message) {
  const lower = message.toLowerCase().trim();
  
  // Handle very short ambiguous queries (like "live", "beats", etc.)
  // These might be channel keywords, so we'll check in handleGeneral
  const words = lower.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 1 && words[0].length >= 3 && words[0].length <= 20) {
    // Single word that's not a greeting/thanks - might be channel name
    const singleWord = words[0];
    if (!/^(hi|hey|hello|thanks|thank|namaste|ok|yes|no|hmm|yeah|yup)$/i.test(singleWord)) {
      return { 
        intent: 'GENERAL', 
        handler: 'handleGeneral',
        param: singleWord
      };
    }
  }
  
  for (const [intentName, config] of Object.entries(INTENTS)) {
    for (const pattern of config.patterns) {
      const match = lower.match(pattern);
      if (match) {
        return {
          intent: intentName,
          handler: config.handler,
          needsContext: config.needsContext || false,
          param: config.extractParam ? match[config.extractParam]?.trim() : null
        };
      }
    }
  }
  
  return { intent: 'GENERAL', handler: 'handleGeneral' };
}

// ============================================================================
// HANDLERS
// ============================================================================

function handleNowPlaying(context) {
  const ctx = validateContext(context);
  
  if (!ctx.hasVideo) {
    return {
      success: false,
      message: '🤔 Abhi kuch nahi chal raha! Pehle TV on karo ya channel switch karo.'
    };
  }
  
  const label = getContentLabel(ctx.contentType);
  const position = ctx.totalVideos > 0 ? `(${ctx.videoIndex + 1}/${ctx.totalVideos})` : '';
  
  // Build response based on content type
  let response = `${label} Now Playing:\n\n"${ctx.video.title}"\n\n📺 Channel: ${ctx.channel}`;
  
  // Only show artist for music content
  if (ctx.contentType === 'song' && ctx.video.artist) {
    response += `\n🎤 ${ctx.video.artist}`;
  }
  
  if (position) response += `\n${position}`;
  
  return { success: true, message: response };
}

function handleUpNext(context) {
  const ctx = validateContext(context);
  
  if (!ctx.nextVideo) {
    return {
      success: false,
      message: '🔮 Next video ki info nahi hai abhi.'
    };
  }
  
  return {
    success: true,
    message: `🔮 Up Next:\n\n"${ctx.nextVideo.title}"`
  };
}

async function handleChannels() {
  try {
    const channels = await Channel.find({ isActive: true })
      .select('name items')
      .lean();
    
    if (channels.length === 0) {
      return { success: false, message: '😅 Koi channel nahi mila!' };
    }
    
    const list = channels.map(ch => `📺 ${ch.name} (${ch.items?.length || 0} videos)`).join('\n');
    
    return {
      success: true,
      message: `🎬 Available Channels:\n\n${list}\n\nBolo "switch to [channel]" to tune in!`
    };
  } catch (err) {
    return { success: false, message: '😅 Channels load nahi ho paye!' };
  }
}

async function handleSwitchChannel(context, param) {
  if (!param) {
    return { success: false, message: '🤔 Kaun sa channel? Bolo "switch to Desi Beats"!' };
  }
  
  try {
    // Use the improved channel finder with fuzzy matching
    const channel = await findChannelByName(param);
    
    if (!channel) {
      const available = await Channel.find({ isActive: true }).select('name').lean();
      const names = available.slice(0, 5).map(c => c.name).join(', ');
      return { 
        success: false, 
        message: `🤔 "${param}" channel nahi mila. Try: ${names}` 
      };
    }
    
    return {
      success: true,
      action: {
        type: 'CHANGE_CHANNEL',
        channelId: channel._id.toString(),
        channelName: channel.name
      },
      message: `📺 Switching to ${channel.name}!`
    };
  } catch (err) {
    return { success: false, message: '😅 Channel switch nahi ho paya!' };
  }
}

// Helper function to find channel by name (fuzzy matching with knowledgeBase support)
async function findChannelByName(query) {
  if (!query) return null;
  
  const channels = await Channel.find({ isActive: true })
    .select('name _id')
    .lean();
  
  const normalizedQuery = query.toLowerCase().trim();
  
  // Try exact match first (case-insensitive)
  let exactMatch = channels.find(ch => 
    ch.name.toLowerCase() === normalizedQuery
  );
  if (exactMatch) return exactMatch;
  
  // Try partial match (channel name contains query or vice versa)
  let partialMatch = channels.find(ch => {
    const chName = ch.name.toLowerCase();
    return chName.includes(normalizedQuery) || normalizedQuery.includes(chName);
  });
  if (partialMatch) return partialMatch;
  
  // Try matching against knowledgeBase search terms (more flexible)
  if (knowledgeBase && knowledgeBase.channels) {
    for (const kbChannel of knowledgeBase.channels) {
      if (kbChannel.searchTerms && kbChannel.searchTerms.length > 0) {
        for (const term of kbChannel.searchTerms) {
          const termLower = term.toLowerCase();
          // Check if query matches any search term (exact or partial)
          if (termLower === normalizedQuery || 
              termLower.includes(normalizedQuery) || 
              normalizedQuery.includes(termLower)) {
            // Find the actual channel by ID (compare both as strings)
            const matchedChannel = channels.find(ch => 
              ch._id.toString() === kbChannel.id || 
              ch._id.toString() === String(kbChannel.id)
            );
            if (matchedChannel) return matchedChannel;
          }
        }
      }
    }
  }
  
  // Try fuzzy match on channel names
  let bestChannel = null;
  let bestScore = 0;
  
  for (const channel of channels) {
    const score = fuzzyMatch(normalizedQuery, channel.name.toLowerCase());
    if (score > bestScore && score >= 0.6) { // Lower threshold for channel names
      bestScore = score;
      bestChannel = channel;
    }
  }
  
  return bestChannel;
}

// Netflix-grade song search with fuzzy matching + YouTube fallback
async function handlePlaySong(context, param) {
  if (!param) {
    return { success: false, message: '🤔 Kya bajana hai? Gaane ka naam batao ya channel ka naam!' };
  }
  
  try {
    // Step 0: FIRST check if param matches a channel name
    // This handles cases like "play desi beats" or "play retro gold"
    const channelMatch = await findChannelByName(param);
    if (channelMatch) {
      return {
        success: true,
        action: {
          type: 'CHANGE_CHANNEL',
          channelId: channelMatch._id.toString(),
          channelName: channelMatch.name
        },
        message: `📺 Switching to ${channelMatch.name}!`
      };
    }
    
    // Step 1: Search in our library with fuzzy matching
    const channels = await Channel.find({ isActive: true })
      .select('name items _id')
      .lean();
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const channel of channels) {
      for (let idx = 0; idx < (channel.items?.length || 0); idx++) {
        const item = channel.items[idx];
        const score = fuzzyMatch(param, item.title || '');
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            channel,
            video: item,
            videoIndex: idx
          };
        }
      }
    }
    
    // Found in library - require higher confidence (0.65+)
    // This prevents false matches like "tum se hi" -> Shinchan cartoon
    if (bestMatch && bestScore >= 0.65) {
      return {
        success: true,
        action: {
          type: 'PLAY_VIDEO',
          channelId: bestMatch.channel._id.toString(),
          channelName: bestMatch.channel.name,
          videoIndex: bestMatch.videoIndex,
          videoTitle: bestMatch.video.title,
          videoId: bestMatch.video.youtubeId
        },
        message: `🎵 Found it! Playing "${bestMatch.video.title}" on ${bestMatch.channel.name}!`
      };
    }
    
    // Step 2: Not found in library
    // For very short queries, suggest channels first
    if (param.length < 5) {
      const available = await Channel.find({ isActive: true }).select('name').lean();
      const channelNames = available.slice(0, 4).map(c => c.name).join(', ');
      return {
        success: true,
        message: `🔍 "${param}" nahi mila.\n\n📺 Available channels: ${channelNames}\n\n💡 Bolo "play ${param} from youtube" to search YouTube!`,
        suggestYouTube: true,
        searchQuery: param
      };
    }
    
    // For longer queries, offer YouTube search
    return {
      success: true,
      message: `🔍 "${param}" nahi mila library mein.\n\n💡 Bolo "play ${param} from youtube" to search YouTube!`,
      suggestYouTube: true,
      searchQuery: param
    };
    
  } catch (err) {
    console.error('[VJCore] Play song error:', err);
    return { success: false, message: '😅 Search mein problem aa gayi!' };
  }
}

// YouTube Search Handler
async function handleYouTubeSearch(context, param) {
  // Handle case where user says "can you play through youtube" without specifying song
  if (!param || param.length < 2) {
    return {
      success: true,
      message: '🎵 Haan! YouTube se search kar sakta hoon. Bolo "play [gaane ka naam] from youtube"!'
    };
  }
  
  try {
    console.log('[VJCore] Searching YouTube for:', param);
    const results = await searchYouTube(param, { maxResults: 3, musicOnly: true });
    
    if (!results || !results.videos || results.videos.length === 0) {
      return {
        success: false,
        message: `😅 YouTube pe bhi "${param}" nahi mila. Spelling check karo!`
      };
    }
    
    const video = results.videos[0]; // Best match
    
    const action = {
      type: 'PLAY_EXTERNAL',
      videoId: video.youtubeId || video.id || video.videoId,
      videoTitle: video.title,
      thumbnail: video.thumbnail,
      channel: video.channel
    };
    
    console.log('[VJCore] YouTube action created:', action);
    
    return {
      success: true,
      action,
      message: `🎵 Found on YouTube!\n\n"${video.title}"\n📺 ${video.channel}\n\n▶️ Playing now...`
    };
    
  } catch (err) {
    console.error('[VJCore] YouTube search error:', err);
    return {
      success: false,
      message: '😅 YouTube search mein problem aa gayi. Thodi der baad try karo!'
    };
  }
}

function handleTrivia() {
  const triviaList = vjContent.trivia || [];
  if (triviaList.length === 0) {
    return { success: false, message: '😅 Trivia database empty hai!' };
  }
  
  const trivia = triviaList[Math.floor(Math.random() * triviaList.length)];
  
  return {
    success: true,
    trivia,
    message: `🎯 TRIVIA TIME!\n\n${trivia.question}\n\n💡 Hint: ${trivia.hint}`
  };
}

function handleShayari() {
  const types = ['romantic', 'sad', 'friendship'];
  const type = types[Math.floor(Math.random() * types.length)];
  const list = vjContent.shayari?.[type] || [];
  
  if (list.length === 0) {
    return { success: false, message: '😅 Shayari nahi mili!' };
  }
  
  const shayari = list[Math.floor(Math.random() * list.length)];
  
  return {
    success: true,
    message: `💕 ${type === 'sad' ? 'Dard' : type === 'friendship' ? 'Dosti' : 'Mohabbat'} ki shayari:\n\n"${shayari}"`
  };
}

function handleGreeting() {
  const hour = new Date().getHours();
  let timeGreeting = 'Hey';
  if (hour < 12) timeGreeting = 'Good morning';
  else if (hour < 17) timeGreeting = 'Good afternoon';
  else if (hour < 21) timeGreeting = 'Good evening';
  else timeGreeting = 'Hey night owl';
  
  const greetings = [
    `${timeGreeting}, yaar! 🎧 Main hoon DJ Desi. Kya dekhna/sunna hai?`,
    `${timeGreeting}! 📺 DesiTV pe welcome! Bolo kya mood hai?`,
    `${timeGreeting}! 🎵 Ready for entertainment? Channel choose karo ya gaana batao!`
  ];
  
  return {
    success: true,
    message: greetings[Math.floor(Math.random() * greetings.length)]
  };
}

function handleThanks() {
  const responses = [
    '🙏 Arey mention not, yaar! Enjoy karo!',
    '🎧 No problem! Music/comedy sunte raho!',
    '🎵 Anytime! Full volume rakhna! 🔊'
  ];
  return {
    success: true,
    message: responses[Math.floor(Math.random() * responses.length)]
  };
}

async function handleGeneral(context, param) {
  // Handle ambiguous single-word queries that might be channel names
  if (param && param.trim().length > 2 && param.trim().length < 30) {
    const trimmedParam = param.trim();
    const channelMatch = await findChannelByName(trimmedParam);
    if (channelMatch) {
      return {
        success: true,
        action: {
          type: 'CHANGE_CHANNEL',
          channelId: channelMatch._id.toString(),
          channelName: channelMatch.name
        },
        message: `📺 Switching to ${channelMatch.name}!`
      };
    }
    
    // If no channel match and query is very short, list available channels
    if (trimmedParam.length < 6) {
      try {
        const available = await Channel.find({ isActive: true }).select('name').lean();
        const channelNames = available.slice(0, 4).map(c => c.name).join(', ');
        return {
          success: true,
          message: `🤔 "${trimmedParam}" samajh nahi aaya.\n\n📺 Try these channels: ${channelNames}\n\nYa bolo "play [gaane ka naam]"!`
        };
      } catch (err) {
        // Fall through to AI
      }
    }
  }
  
  // For truly general conversation, pass to AI
  return {
    success: true,
    passToAI: true,
    message: null
  };
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

async function processMessage(message, context = {}) {
  console.log('[VJCore] Processing:', message);
  console.log('[VJCore] Context:', {
    channel: context.currentChannel,
    video: context.currentVideo?.title?.substring(0, 50)
  });
  
  const detected = detectIntent(message);
  console.log('[VJCore] Intent:', detected.intent, detected.param ? `(${detected.param})` : '');
  
  const handlers = {
    handleNowPlaying,
    handleUpNext,
    handleChannels,
    handleSwitchChannel,
    handlePlaySong,
    handleYouTubeSearch,
    handleTrivia,
    handleShayari,
    handleGreeting,
    handleThanks,
    handleGeneral
  };
  
  const handler = handlers[detected.handler];
  if (!handler) {
    return { success: false, message: '🤔 Samajh nahi aaya. Phir se bolo?' };
  }
  
  return await handler(context, detected.param);
}

module.exports = {
  processMessage,
  detectIntent,
  validateContext,
  extractArtistFromTitle,
  fuzzyMatch,
  detectContentType
};
