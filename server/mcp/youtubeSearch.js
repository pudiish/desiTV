/**
 * YouTube Search Service
 * 
 * For songs/videos NOT in our database, search YouTube directly
 * and validate it's appropriate content (music/video songs only).
 * 
 * Uses YouTube Data API v3
 */

const fetch = require('node-fetch');

// YouTube API Key - MUST be set in environment variables
// Never hardcode API keys in source code!
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!YOUTUBE_API_KEY) {
  console.warn('[youtubeSearch] ⚠️  YOUTUBE_API_KEY not set in environment variables');
  console.warn('[youtubeSearch] Set it in your .env file: YOUTUBE_API_KEY=your_key_here');
}

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
  
  // Check if API key is configured
  if (!YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY not configured. Please set it in your .env file.');
  }
  
  try {
    // Build search query - add music/song keywords if musicOnly
    let searchQuery = query;
    if (musicOnly && !query.toLowerCase().includes('song')) {
      searchQuery = `${query} official song`;
    }
    
    const params = new URLSearchParams({
      part: 'snippet',
      q: searchQuery,
      type,
      maxResults: maxResults.toString(),
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
    
    // Process and validate results
    const videos = data.items
      .map(item => ({
        youtubeId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
        channel: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt
      }))
      .filter(video => isAppropriateContent(video));
    
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
  // Check if API key is configured
  if (!YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY not configured. Please set it in your .env file.');
  }
  
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
function isAppropriateContent(video, requireMusicIndicators = false) {
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
  
  // If strict music validation required, reject non-music content
  if (requireMusicIndicators) {
    return false;
  }
  
  // Otherwise, allow with lower confidence (category filter already applied)
  return true;
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
