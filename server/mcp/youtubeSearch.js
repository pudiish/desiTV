/**
 * YouTube Search Service
 * 
 * For songs/videos NOT in our database, search YouTube directly
 * and validate it's appropriate content (music/video songs only).
 * 
 * Uses YouTube Data API v3
 */

const fetch = require('node-fetch');

// YouTube API Key - load from environment variable
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

// Content validation patterns
const MUSIC_INDICATORS = [
  'official video',
  'official music video',
  'full video',
  'lyric video',
  'lyrics',
  'audio',
  'song',
  'music',
  'ft.',
  'feat.',
  'remix',
  'unplugged',
  'cover',
  'acoustic'
];

const BLOCKED_CONTENT = [
  'porn',
  'xxx',
  'adult',
  'nude',
  '18+',
  'sex',
  'horror',
  'gore',
  'violent'
];

// Official channel indicators (higher = more official)
const OFFICIAL_CHANNELS = [
  'vevo',           // VEVO channels
  't-series',       // T-Series
  'tseries',
  'zee music',      // Zee Music
  'sony music',     // Sony Music
  'universal music',
  'warner music',
  'yrf',            // Yash Raj Films
  'tips official',  // Tips Music
  'saregama',       // Saregama
  'speed records',  // Speed Records
  'white hill',     // White Hill Music
  'desi melodies',
  'atlantic',
  'republic',
  'interscope',
  'rca'
];

/**
 * Calculate "official score" for a video result
 * Higher score = more likely to be official content
 * @param {string} channelTitle - YouTube channel name
 * @param {string} videoTitle - Video title
 * @param {object} preferences - User preferences (cover, karaoke, fanmade)
 */
function getOfficialScore(channelTitle, videoTitle, preferences = {}) {
  const channel = (channelTitle || '').toLowerCase();
  const title = (videoTitle || '').toLowerCase();
  let score = 0;

  // If user explicitly wants cover/karaoke/fanmade, prioritize those
  if (preferences.wantsCover && title.includes('cover')) {
    score += 60; // Boost covers when requested
  }
  if (preferences.wantsKaraoke && title.includes('karaoke')) {
    score += 60; // Boost karaoke when requested
  }
  if (preferences.wantsFanmade && (title.includes('fan made') || title.includes('fanmade'))) {
    score += 60; // Boost fan versions when requested
  }
  if (preferences.wantsRemix && title.includes('remix')) {
    score += 60; // Boost remixes when requested
  }

  // Check if channel name matches official patterns
  for (const official of OFFICIAL_CHANNELS) {
    if (channel.includes(official)) {
      score += 50;
      break;
    }
  }

  // Bonus for "official" in title
  if (title.includes('official music video')) score += 30;
  else if (title.includes('official video')) score += 25;
  else if (title.includes('official')) score += 15;

  // Only penalize non-official content if user didn't explicitly request it
  if (!preferences.wantsCover && title.includes('cover')) score -= 20;
  if (!preferences.wantsKaraoke && title.includes('karaoke')) score -= 30;
  if (!preferences.wantsRemix && title.includes('remix') && !channel.includes('official')) score -= 10;
  if (title.includes('lyric video') || title.includes('lyrics')) score -= 5;
  if (!preferences.wantsFanmade && (title.includes('fan made') || title.includes('fanmade'))) score -= 40;

  return score;
}

/**
 * Detect user preferences from query
 */
function detectVersionPreferences(query) {
  const q = query.toLowerCase();
  return {
    wantsCover: /\b(cover|covered|acoustic cover)\b/i.test(q),
    wantsKaraoke: /\b(karaoke|instrumental|minus one)\b/i.test(q),
    wantsFanmade: /\b(fan made|fanmade|fan version|tribute)\b/i.test(q),
    wantsRemix: /\b(remix|remixed|dj mix|club mix)\b/i.test(q)
  };
}

/**
 * Search YouTube for a video
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {object} - Search results
 */
async function searchYouTube(query, options = {}) {
  const { 
    maxResults = 5, 
    musicOnly = true, 
    type = 'video'
  } = options;
  
  // Detect user preferences from query (cover, karaoke, remix, fanmade)
  const preferences = detectVersionPreferences(query);
  const hasSpecialRequest = preferences.wantsCover || preferences.wantsKaraoke || 
                            preferences.wantsFanmade || preferences.wantsRemix;
  
  // Validate API key is configured
  if (!YOUTUBE_API_KEY) {
    console.error('[YouTubeSearch] YOUTUBE_API_KEY is not configured');
    return {
      success: false,
      error: 'YouTube API key not configured',
      videos: []
    };
  }
  
  try {
    // Build search query based on user preferences
    let searchQuery = query;
    if (musicOnly && !hasSpecialRequest) {
      // Only add "official music video" if user didn't ask for cover/karaoke/etc
      if (!query.toLowerCase().includes('official')) {
        searchQuery = `${query} official music video`;
      }
    }
    
    const params = new URLSearchParams({
      part: 'snippet',
      q: searchQuery,
      type,
      maxResults: Math.min(maxResults * 2, 15).toString(), // Fetch more to filter
      key: YOUTUBE_API_KEY,
      videoCategoryId: '10', // Music category
      regionCode: 'IN' // India for Bollywood/Desi content
    });
    
    const url = `https://www.googleapis.com/youtube/v3/search?${params}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[YouTubeSearch] API Error:', response.status, errorText);
      return {
        success: false,
        error: `YouTube API error: ${response.status}`,
        videos: []
      };
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return {
        success: true,
        found: false,
        query: searchQuery,
        videos: [],
        message: 'No videos found'
      };
    }
    
    // Get video IDs to fetch duration details (to filter out Shorts)
    const videoIds = data.items.map(item => item.id.videoId).join(',');
    const videoDetailsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`
    );
    const videoDetailsData = await videoDetailsResponse.json();
    
    // Create a map of video durations
    const durationMap = {};
    if (videoDetailsData.items) {
      videoDetailsData.items.forEach(item => {
        durationMap[item.id] = parseDuration(item.contentDetails.duration);
      });
    }
    
    // Process and validate results - FILTER OUT SHORTS (< 60 seconds)
    const videos = data.items
      .map(item => ({
        youtubeId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        channel: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        duration: durationMap[item.id.videoId] || 0,
        // Score for sorting: prioritize based on user preferences
        officialScore: getOfficialScore(item.snippet.channelTitle, item.snippet.title, preferences)
      }))
      .filter(video => isAppropriateContent(video))
      .filter(video => !isYouTubeShort(video)) // Filter out Shorts
      .sort((a, b) => b.officialScore - a.officialScore) // Sort by official score
      .slice(0, maxResults); // Take only requested number
    
    if (videos.length === 0) {
      return {
        success: true,
        found: false,
        query: searchQuery,
        videos: [],
        message: 'No appropriate music content found'
      };
    }
    
    return {
      success: true,
      found: true,
      query: searchQuery,
      count: videos.length,
      videos,
      bestMatch: videos[0]
    };
    
  } catch (error) {
    console.error('[YouTubeSearch] Error:', error.message);
    return {
      success: false,
      error: error.message,
      videos: []
    };
  }
}

/**
 * Get video details by ID
 */
async function getVideoDetails(youtubeId) {
  try {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id: youtubeId,
      key: YOUTUBE_API_KEY
    });
    
    const url = `https://www.googleapis.com/youtube/v3/videos?${params}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return { success: false, error: `API error: ${response.status}` };
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return { success: false, error: 'Video not found' };
    }
    
    const video = data.items[0];
    const duration = parseDuration(video.contentDetails.duration);
    
    return {
      success: true,
      video: {
        youtubeId: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        thumbnail: video.snippet.thumbnails?.high?.url,
        channel: video.snippet.channelTitle,
        duration,
        durationFormatted: formatDuration(duration),
        viewCount: parseInt(video.statistics.viewCount || 0),
        likeCount: parseInt(video.statistics.likeCount || 0),
        publishedAt: video.snippet.publishedAt,
        categoryId: video.snippet.categoryId
      }
    };
    
  } catch (error) {
    console.error('[YouTubeSearch] getVideoDetails Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Validate that content is appropriate (music/video song)
 */
function isAppropriateContent(video) {
  const titleLower = video.title.toLowerCase();
  const descLower = (video.description || '').toLowerCase();
  
  // Block inappropriate content
  for (const blocked of BLOCKED_CONTENT) {
    if (titleLower.includes(blocked) || descLower.includes(blocked)) {
      return false;
    }
  }
  
  // Check for music indicators (bonus, not required)
  const hasMusicIndicator = MUSIC_INDICATORS.some(indicator => 
    titleLower.includes(indicator)
  );
  
  // Known music channels (boost confidence)
  const musicChannels = [
    't-series', 'tips', 'zee music', 'yrf', 'sony music',
    'saregama', 'eros', 'shemaroo', 'venus', 'ultra',
    'speed records', 'desi music factory'
  ];
  
  const fromMusicChannel = musicChannels.some(ch => 
    video.channel.toLowerCase().includes(ch)
  );
  
  // If from music channel, it's likely appropriate
  if (fromMusicChannel) return true;
  
  // If has music indicator, it's likely appropriate
  if (hasMusicIndicator) return true;
  
  // Otherwise, allow but with lower confidence
  // (The YouTube category filter should have already filtered)
  return true;
}

/**
 * Check if a video is a YouTube Short (should be filtered out)
 * Shorts are: < 60 seconds OR have #shorts in title/description
 */
function isYouTubeShort(video) {
  const titleLower = (video.title || '').toLowerCase();
  const descLower = (video.description || '').toLowerCase();
  
  // Check duration - Shorts are under 60 seconds
  if (video.duration && video.duration > 0 && video.duration < 60) {
    console.log(`[YouTubeSearch] Filtering out Short (duration: ${video.duration}s): ${video.title}`);
    return true;
  }
  
  // Check for #shorts hashtag in title or description
  if (titleLower.includes('#shorts') || titleLower.includes('#short')) {
    console.log(`[YouTubeSearch] Filtering out Short (hashtag in title): ${video.title}`);
    return true;
  }
  
  if (descLower.includes('#shorts') || descLower.includes('#short')) {
    console.log(`[YouTubeSearch] Filtering out Short (hashtag in desc): ${video.title}`);
    return true;
  }
  
  // Check for "shorts" in title pattern like "Song Name | Shorts"
  if (/\|\s*shorts?\s*$/i.test(video.title) || /shorts?\s*\|/i.test(video.title)) {
    console.log(`[YouTubeSearch] Filtering out Short (title pattern): ${video.title}`);
    return true;
  }
  
  return false;
}

/**
 * Parse ISO 8601 duration to seconds
 */
function parseDuration(isoDuration) {
  if (!isoDuration) return 0;
  
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Search specifically for a song with smart query building
 */
async function searchSong(songName, options = {}) {
  const { artist = null, movie = null } = options;
  
  // Build comprehensive query
  let query = songName;
  if (artist) query = `${songName} ${artist}`;
  if (movie) query = `${query} ${movie} movie`;
  query = `${query} official song`;
  
  const result = await searchYouTube(query, { maxResults: 3, musicOnly: true });
  
  if (result.success && result.found) {
    // Get detailed info for best match
    const details = await getVideoDetails(result.bestMatch.youtubeId);
    if (details.success) {
      result.bestMatch = { ...result.bestMatch, ...details.video };
    }
  }
  
  return result;
}

/**
 * Verify a YouTube ID is valid and appropriate
 */
async function verifyVideo(youtubeId) {
  const details = await getVideoDetails(youtubeId);
  
  if (!details.success) {
    return { valid: false, reason: details.error };
  }
  
  // Check if appropriate
  if (!isAppropriateContent(details.video)) {
    return { valid: false, reason: 'Content not appropriate for this platform' };
  }
  
  // Check duration (songs typically 2-10 minutes)
  const duration = details.video.duration;
  if (duration < 60) {
    return { valid: false, reason: 'Video too short (less than 1 minute)' };
  }
  if (duration > 1800) { // 30 minutes
    return { valid: false, reason: 'Video too long (over 30 minutes), likely not a song' };
  }
  
  return { valid: true, video: details.video };
}

module.exports = {
  searchYouTube,
  getVideoDetails,
  isAppropriateContent,
  searchSong,
  verifyVideo,
  formatDuration,
  parseDuration
};
