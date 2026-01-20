/**
 * DesiTV Knowledge Base Service
 * 
 * Senior Developer Note: This is the SINGLE SOURCE OF TRUTH for all content queries.
 * Every question about what's available should go through this service.
 * 
 * Capabilities:
 * 1. Search songs by title, artist, movie, genre
 * 2. Get all content for a channel
 * 3. Find similar content
 * 4. Check if something exists in our DB
 * 5. Fuzzy matching for typos
 * 6. Artist-specific queries
 * 7. Genre-based recommendations
 */

const fs = require('fs');
const path = require('path');

// Load knowledge base
let knowledgeBase = null;
const KB_PATH = path.join(__dirname, '../data/knowledgeBase.json');

function loadKnowledgeBase() {
  try {
    if (fs.existsSync(KB_PATH)) {
      knowledgeBase = JSON.parse(fs.readFileSync(KB_PATH, 'utf8'));
      console.log(`[KnowledgeBase] Loaded: ${knowledgeBase.allVideos?.length || 0} videos, ${knowledgeBase.artists?.length || 0} artists`);
    } else {
      console.warn('[KnowledgeBase] KB file not found, using empty base');
      knowledgeBase = { channels: [], artists: [], genres: [], allVideos: [] };
    }
  } catch (err) {
    console.error('[KnowledgeBase] Error loading KB:', err.message);
    knowledgeBase = { channels: [], artists: [], genres: [], allVideos: [] };
  }
  return knowledgeBase;
}

// Initialize on load
loadKnowledgeBase();

/**
 * Fuzzy string matching - handles typos and partial matches
 */
function fuzzyMatch(str1, str2, threshold = 0.6) {
  str1 = str1.toLowerCase().trim();
  str2 = str2.toLowerCase().trim();
  
  // Exact match
  if (str1 === str2) return 1.0;
  
  // Contains match
  if (str1.includes(str2) || str2.includes(str1)) return 0.9;
  
  // Levenshtein distance for fuzzy matching
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = [];
  
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i-1] === str2[j-1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i-1][j] + 1,
        matrix[i][j-1] + 1,
        matrix[i-1][j-1] + cost
      );
    }
  }
  
  const maxLen = Math.max(len1, len2);
  const similarity = 1 - (matrix[len1][len2] / maxLen);
  return similarity;
}

/**
 * Search videos by query (title, artist, movie, genre)
 * Returns: { found: boolean, videos: [], bestMatch: {}, searchedIn: 'database' | 'none' }
 */
function searchVideos(query, options = {}) {
  if (!knowledgeBase) loadKnowledgeBase();
  
  const { limit = 10, channel = null, artist = null, genre = null } = options;
  const queryLower = query.toLowerCase().trim();
  
  let results = [];
  let searchType = 'general';
  
  // 1. First check if it's an artist search
  const artistMatch = knowledgeBase.artists?.find(a => 
    a.searchTerms?.some(t => 
      queryLower.includes(t.toLowerCase()) || fuzzyMatch(queryLower, t) > 0.7
    )
  );
  
  if (artistMatch) {
    searchType = 'artist';
    results = artistMatch.songs.map(s => ({
      ...s,
      matchType: 'artist',
      artist: artistMatch.name
    }));
  }
  
  // 2. Check genre search
  if (results.length === 0) {
    const genreMatch = knowledgeBase.genres?.find(g => 
      g.keywords?.some(k => queryLower.includes(k)) || 
      queryLower.includes(g.genre)
    );
    
    if (genreMatch) {
      searchType = 'genre';
      results = genreMatch.songs.map(s => ({
        ...s,
        matchType: 'genre',
        genre: genreMatch.genre
      }));
    }
  }
  
  // 3. General title search with scoring
  if (results.length === 0) {
    searchType = 'title';
    const scored = [];
    
    knowledgeBase.allVideos?.forEach(video => {
      let score = 0;
      const titleLower = video.title.toLowerCase();
      const searchTerms = video.searchTerms || [];
      
      // Exact title match
      if (titleLower.includes(queryLower)) {
        score += 10;
      }
      
      // Search terms match
      const queryWords = queryLower.split(/\s+/);
      queryWords.forEach(word => {
        if (searchTerms.includes(word)) score += 2;
        if (titleLower.includes(word)) score += 1;
      });
      
      // Fuzzy match
      const fuzzyScore = fuzzyMatch(queryLower, titleLower);
      score += fuzzyScore * 5;
      
      if (score > 1) {
        scored.push({ ...video, score, matchType: 'title' });
      }
    });
    
    results = scored.sort((a, b) => b.score - a.score);
  }
  
  // 4. Filter by channel if specified
  if (channel) {
    results = results.filter(v => 
      v.channel?.toLowerCase().includes(channel.toLowerCase())
    );
  }
  
  // 5. Limit results
  results = results.slice(0, limit);
  
  return {
    found: results.length > 0,
    count: results.length,
    searchType,
    query,
    videos: results,
    bestMatch: results[0] || null,
    searchedIn: 'database'
  };
}

/**
 * Get all songs by artist
 */
function getSongsByArtist(artistName) {
  if (!knowledgeBase) loadKnowledgeBase();
  
  const queryLower = artistName.toLowerCase();
  const artist = knowledgeBase.artists?.find(a => 
    a.name.toLowerCase().includes(queryLower) ||
    a.searchTerms?.some(t => queryLower.includes(t.toLowerCase()))
  );
  
  if (artist) {
    return {
      found: true,
      artist: artist.name,
      songCount: artist.songCount,
      songs: artist.songs
    };
  }
  
  return {
    found: false,
    artist: artistName,
    songCount: 0,
    songs: []
  };
}

/**
 * Get songs by genre
 */
function getSongsByGenre(genreName) {
  if (!knowledgeBase) loadKnowledgeBase();
  
  const queryLower = genreName.toLowerCase();
  const genre = knowledgeBase.genres?.find(g => 
    g.genre.toLowerCase() === queryLower ||
    g.keywords?.some(k => queryLower.includes(k))
  );
  
  if (genre) {
    return {
      found: true,
      genre: genre.genre,
      keywords: genre.keywords,
      songCount: genre.songCount,
      songs: genre.songs
    };
  }
  
  return {
    found: false,
    genre: genreName,
    songCount: 0,
    songs: []
  };
}

/**
 * Get all channel information
 */
function getChannels() {
  if (!knowledgeBase) loadKnowledgeBase();
  
  return {
    count: knowledgeBase.channels?.length || 0,
    channels: knowledgeBase.channels?.map(ch => ({
      name: ch.name,
      id: ch.id,
      videoCount: ch.videoCount
    })) || []
  };
}

/**
 * Get channel by name (fuzzy)
 */
function getChannelByName(channelName) {
  if (!knowledgeBase) loadKnowledgeBase();
  
  const queryLower = channelName.toLowerCase().trim();
  
  // Direct search terms match
  let channel = knowledgeBase.channels?.find(ch => 
    ch.searchTerms?.some(t => t === queryLower)
  );
  
  // Partial match
  if (!channel) {
    channel = knowledgeBase.channels?.find(ch => 
      ch.name.toLowerCase().includes(queryLower) ||
      queryLower.includes(ch.name.toLowerCase()) ||
      ch.searchTerms?.some(t => queryLower.includes(t) || t.includes(queryLower))
    );
  }
  
  // Fuzzy match
  if (!channel) {
    let bestMatch = null;
    let bestScore = 0;
    
    knowledgeBase.channels?.forEach(ch => {
      const score = fuzzyMatch(queryLower, ch.name);
      if (score > bestScore && score > 0.5) {
        bestScore = score;
        bestMatch = ch;
      }
    });
    
    channel = bestMatch;
  }
  
  if (channel) {
    return {
      found: true,
      name: channel.name,
      id: channel.id,
      videoCount: channel.videoCount
    };
  }
  
  return { found: false, name: channelName };
}

/**
 * Check if video exists in database by YouTube ID or title
 */
function videoExists(identifier) {
  if (!knowledgeBase) loadKnowledgeBase();
  
  // Check by YouTube ID
  const byId = knowledgeBase.allVideos?.find(v => 
    v.youtubeId === identifier
  );
  
  if (byId) {
    return { exists: true, video: byId, matchedBy: 'youtubeId' };
  }
  
  // Check by title (exact)
  const byTitle = knowledgeBase.allVideos?.find(v => 
    v.title.toLowerCase() === identifier.toLowerCase()
  );
  
  if (byTitle) {
    return { exists: true, video: byTitle, matchedBy: 'title' };
  }
  
  return { exists: false };
}

/**
 * Get random song from channel or genre
 */
function getRandomSong(options = {}) {
  if (!knowledgeBase) loadKnowledgeBase();
  
  const { channel, genre, artist } = options;
  let pool = knowledgeBase.allVideos || [];
  
  if (channel) {
    pool = pool.filter(v => v.channel.toLowerCase().includes(channel.toLowerCase()));
  }
  
  if (genre) {
    const genreData = getSongsByGenre(genre);
    if (genreData.found) {
      const youtubeIds = new Set(genreData.songs.map(s => s.youtubeId));
      pool = pool.filter(v => youtubeIds.has(v.youtubeId));
    }
  }
  
  if (artist) {
    const artistData = getSongsByArtist(artist);
    if (artistData.found) {
      const youtubeIds = new Set(artistData.songs.map(s => s.youtubeId));
      pool = pool.filter(v => youtubeIds.has(v.youtubeId));
    }
  }
  
  if (pool.length === 0) {
    return { found: false };
  }
  
  const random = pool[Math.floor(Math.random() * pool.length)];
  return { found: true, video: random };
}

/**
 * Get similar songs based on a video
 */
function getSimilarSongs(youtubeId, limit = 5) {
  if (!knowledgeBase) loadKnowledgeBase();
  
  const source = knowledgeBase.allVideos?.find(v => v.youtubeId === youtubeId);
  if (!source) return { found: false, songs: [] };
  
  // Find similar by same channel
  const sameChannel = knowledgeBase.allVideos?.filter(v => 
    v.channel === source.channel && v.youtubeId !== youtubeId
  ) || [];
  
  // Find similar by search terms overlap
  const sourceTerms = new Set(source.searchTerms || []);
  const byTerms = knowledgeBase.allVideos?.filter(v => {
    if (v.youtubeId === youtubeId) return false;
    const overlap = (v.searchTerms || []).filter(t => sourceTerms.has(t)).length;
    return overlap >= 2;
  }) || [];
  
  // Combine and dedupe
  const combined = [...sameChannel, ...byTerms];
  const seen = new Set();
  const unique = combined.filter(v => {
    if (seen.has(v.youtubeId)) return false;
    seen.add(v.youtubeId);
    return true;
  });
  
  return {
    found: unique.length > 0,
    sourceVideo: source,
    songs: unique.slice(0, limit)
  };
}

/**
 * Get all available artists
 */
function getAllArtists() {
  if (!knowledgeBase) loadKnowledgeBase();
  
  return {
    count: knowledgeBase.artists?.length || 0,
    artists: knowledgeBase.artists?.map(a => ({
      name: a.name,
      songCount: a.songCount
    })) || []
  };
}

/**
 * Get all available genres
 */
function getAllGenres() {
  if (!knowledgeBase) loadKnowledgeBase();
  
  return {
    count: knowledgeBase.genres?.length || 0,
    genres: knowledgeBase.genres?.map(g => ({
      genre: g.genre,
      keywords: g.keywords,
      songCount: g.songCount
    })) || []
  };
}

/**
 * Smart query parser - figures out what user is asking for
 * Returns: { type: 'play' | 'search' | 'info' | 'list', target: {}, raw: query }
 */
function parseUserQuery(query) {
  const q = query.toLowerCase().trim();
  
  // Play requests
  if (/^(play|bajao|sunao|start|chala|laga)\s+/i.test(q)) {
    const target = q.replace(/^(play|bajao|sunao|start|chala|laga)\s+/i, '').trim();
    
    // Check if it's an artist
    const artistResult = getSongsByArtist(target);
    if (artistResult.found) {
      return { type: 'play_artist', target: artistResult, raw: query };
    }
    
    // Check if it's a genre
    const genreResult = getSongsByGenre(target);
    if (genreResult.found) {
      return { type: 'play_genre', target: genreResult, raw: query };
    }
    
    // Check if it's a specific song
    const searchResult = searchVideos(target, { limit: 1 });
    if (searchResult.found) {
      return { type: 'play_song', target: searchResult.bestMatch, raw: query };
    }
    
    // Not found in database
    return { type: 'play_external', target: target, raw: query };
  }
  
  // Channel requests
  if (/^(switch|change|go to|goto)\s*(to)?\s*(channel)?\s*/i.test(q)) {
    const channelName = q.replace(/^(switch|change|go to|goto)\s*(to)?\s*(channel)?\s*/i, '').trim();
    const channelResult = getChannelByName(channelName);
    return { type: 'change_channel', target: channelResult, raw: query };
  }
  
  // List requests
  if (/^(list|show|dikha|what|kya)\s*(me|all)?\s*(songs?|channels?|artists?|genres?)/i.test(q)) {
    if (/channels?/i.test(q)) return { type: 'list_channels', target: getChannels(), raw: query };
    if (/artists?/i.test(q)) return { type: 'list_artists', target: getAllArtists(), raw: query };
    if (/genres?/i.test(q)) return { type: 'list_genres', target: getAllGenres(), raw: query };
    if (/songs?/i.test(q)) {
      // Check if asking for songs by specific artist
      const artistMatch = q.match(/by\s+(.+)/i);
      if (artistMatch) {
        return { type: 'list_songs_by_artist', target: getSongsByArtist(artistMatch[1]), raw: query };
      }
    }
    return { type: 'list_general', raw: query };
  }
  
  // Info requests  
  if (/^(what|which|kya|kaun)\s+/i.test(q) || q.endsWith('?')) {
    return { type: 'info_query', target: query, raw: query };
  }
  
  // Search requests
  if (/^(search|find|khojo|dhundho)\s+/i.test(q)) {
    const searchTerm = q.replace(/^(search|find|khojo|dhundho)\s+/i, '').trim();
    return { type: 'search', target: searchVideos(searchTerm), raw: query };
  }
  
  // Default: try to understand
  return { type: 'unknown', target: query, raw: query };
}

/**
 * Get database statistics
 */
function getStats() {
  if (!knowledgeBase) loadKnowledgeBase();
  
  return {
    totalVideos: knowledgeBase.allVideos?.length || 0,
    totalChannels: knowledgeBase.channels?.length || 0,
    totalArtists: knowledgeBase.artists?.length || 0,
    totalGenres: knowledgeBase.genres?.length || 0,
    generatedAt: knowledgeBase.meta?.generatedAt || 'unknown'
  };
}

/**
 * Reload knowledge base (call after DB changes)
 */
function reload() {
  return loadKnowledgeBase();
}

module.exports = {
  searchVideos,
  getSongsByArtist,
  getSongsByGenre,
  getChannels,
  getChannelByName,
  videoExists,
  getRandomSong,
  getSimilarSongs,
  getAllArtists,
  getAllGenres,
  parseUserQuery,
  getStats,
  fuzzyMatch,
  reload
};
