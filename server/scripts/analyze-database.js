/**
 * Database Analyzer Script
 * Creates comprehensive knowledge base from channels.json
 */

const fs = require('fs');
const path = require('path');

// Read channels.json
const channelsPath = path.join(__dirname, '../../channels.json');
let data;

// Check if file exists
if (!fs.existsSync(channelsPath)) {
  console.error(`❌ Error: File not found: ${channelsPath}`);
  process.exit(1);
}

// Check file readability
try {
  fs.accessSync(channelsPath, fs.constants.R_OK);
} catch (accessError) {
  console.error(`❌ Error: Cannot read file: ${channelsPath}`);
  console.error(`   Permission denied: ${accessError.message}`);
  process.exit(1);
}

// Read file content and parse JSON
try {
  const fileContent = fs.readFileSync(channelsPath, 'utf8');
  data = JSON.parse(fileContent);
} catch (error) {
  console.error(`❌ Error: Failed to read or parse file: ${channelsPath}`);
  console.error(`   ${error.message}`);
  if (error instanceof SyntaxError && (error.lineNumber !== undefined || error.columnNumber !== undefined)) {
    console.error(`   Line ${error.lineNumber !== undefined ? error.lineNumber : 'unknown'}, Column ${error.columnNumber !== undefined ? error.columnNumber : 'unknown'}`);
  }
  process.exit(1);
}

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║           DESITV DATABASE - COMPLETE ANALYSIS                ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

// Channel Analysis
const channels = [];
let totalVideos = 0;
const allSongs = [];
const artistIndex = {};
const movieIndex = {};
const yearIndex = {};
const genreIndex = {};
const youtubeIdMap = {};

/**
 * Sanitizes a regex pattern by removing regex syntax to create a plain string for simple matching
 * @param {string} pattern - The regex pattern to sanitize
 * @returns {string} - A sanitized plain string suitable for includes() matching
 */
function sanitizePatternForPlainMatch(pattern) {
  let sanitized = pattern;
  
  // Remove backslashes (e.g., \b, \w, \d, etc.)
  sanitized = sanitized.replace(/\\/g, '');
  
  // Remove regex metacharacters: ^ $ . * + ? () [] {} |
  sanitized = sanitized.replace(/[\^$.*+?()[\]{}|]/g, '');
  
  // Normalize to lowercase
  sanitized = sanitized.toLowerCase();
  
  // Trim and normalize whitespace (replace multiple spaces with single space)
  sanitized = sanitized.trim().replace(/\s+/g, ' ');
  
  return sanitized;
}

/**
 * Normalizes a regex pattern into a readable search term by removing word boundaries, unescaping dots, stripping backslashes, and trimming
 * @param {string} pattern - The regex pattern to normalize
 * @returns {string} - A normalized search term string
 */
function normalizeArtistPattern(pattern) {
  if (typeof pattern !== 'string') {
    return String(pattern || '').trim();
  }
  return pattern.replace(/\\b/g, '').replace(/\\./g, '.').replace(/\\/g, '').trim();
}

// Artist patterns to detect
const artistPatterns = [
  { name: 'Yo Yo Honey Singh', patterns: ['honey singh', 'yo yo'] },
  { name: 'Arijit Singh', patterns: ['arijit singh', 'arijit'] },
  { name: 'Badshah', patterns: ['badshah'] },
  { name: 'Neha Kakkar', patterns: ['neha kakkar', 'neha'] },
  { name: 'Guru Randhawa', patterns: ['guru randhawa', 'guru'] },
  { name: 'Atif Aslam', patterns: ['atif aslam', 'atif'] },
  { name: 'Shreya Ghoshal', patterns: ['shreya ghoshal', 'shreya'] },
  { name: 'Kumar Sanu', patterns: ['kumar sanu'] },
  { name: 'Udit Narayan', patterns: ['udit narayan'] },
  { name: 'Diljit Dosanjh', patterns: ['diljit dosanjh', 'diljit'] },
  { name: 'A.R. Rahman', patterns: ['ar rahman', 'a.r. rahman', 'rahman'] },
  { name: 'Sonu Nigam', patterns: ['sonu nigam', 'sonu'] },
  { name: 'Alka Yagnik', patterns: ['alka yagnik', 'alka'] },
  { name: 'Lata Mangeshkar', patterns: ['lata mangeshkar', 'lata'] },
  { name: 'Kishore Kumar', patterns: ['kishore kumar', 'kishore'] },
  { name: 'Mohammed Rafi', patterns: ['mohammed rafi', 'rafi'] },
  { name: 'Asha Bhosle', patterns: ['asha bhosle', 'asha'] },
  { name: 'Jagjit Singh', patterns: ['jagjit singh', 'jagjit'] },
  { name: 'Sunidhi Chauhan', patterns: ['sunidhi chauhan', 'sunidhi'] },
  { name: 'Shaan', patterns: ['shaan'] },
  { name: 'KK', patterns: ['\\bk\\.k\\.\\b', '\\bkk\\b'] },
  { name: 'Mika Singh', patterns: ['mika singh', 'mika'] },
  { name: 'Raftaar', patterns: ['raftaar'] },
  { name: 'Armaan Malik', patterns: ['armaan malik'] },
  { name: 'Darshan Raval', patterns: ['darshan raval'] },
  { name: 'Vishal Dadlani', patterns: ['vishal dadlani'] },
  { name: 'Amit Trivedi', patterns: ['amit trivedi'] },
  { name: 'Himesh Reshammiya', patterns: ['himesh'] },
  { name: 'Pritam', patterns: ['pritam'] },
  { name: 'Jubin Nautiyal', patterns: ['jubin'] },
  { name: 'B Praak', patterns: ['b praak'] },
  { name: 'Tulsi Kumar', patterns: ['tulsi kumar'] },
];

// Genre keywords
const genreKeywords = {
  'party': ['party', 'dance', 'club', 'dj', 'remix'],
  'romantic': ['love', 'pyar', 'dil', 'ishq', 'romantic', 'tere', 'tera'],
  'sad': ['sad', 'dard', 'broken', 'aashiqui', 'bewafa'],
  'retro': ['retro', 'old', 'classic', '90s', '80s', '70s'],
  'punjabi': ['punjabi', 'bhangra', 'nachle'],
  'hip-hop': ['rap', 'hip hop', 'desi hip hop'],
  'sufi': ['sufi', 'qawwali', 'khusro'],
  'ghazal': ['ghazal'],
  'devotional': ['bhajan', 'aarti', 'devotional'],
  'item': ['item', 'munni', 'sheila', 'chikni']
};

// Process each channel
data.channels.forEach(channel => {
  const items = channel.items || [];
  totalVideos += items.length;
  
  const channelData = {
    name: channel.name,
    id: channel._id || channel.id,
    videoCount: items.length,
    videos: []
  };
  
  items.forEach((video, index) => {
    const videoData = {
      title: video.title,
      youtubeId: video.youtubeId,
      duration: video.duration,
      year: video.year,
      tags: video.tags || [],
      category: video.category,
      channel: channel.name,
      channelId: channel._id || channel.id,
      indexInChannel: index
    };
    
    // Store in youtube ID map - validate youtubeId first
    if (video.youtubeId && typeof video.youtubeId === 'string' && video.youtubeId.trim().length > 0) {
      youtubeIdMap[video.youtubeId] = videoData;
    } else {
      // Log warning for missing or invalid youtubeId
      const channelId = channel._id || channel.id;
      console.warn(`⚠️  Warning: Missing or invalid youtubeId for video at index ${index} in channel "${channel.name}" (${channelId}): "${video.title || 'Untitled'}"`);
    }
    
    // Add to all songs
    allSongs.push(videoData);
    channelData.videos.push(videoData);
    
    const titleLower = video.title.toLowerCase();
    
    // Artist detection
    artistPatterns.forEach(artist => {
      const found = artist.patterns.some(p => {
        // Check if pattern is a regex string (contains \b or other regex special chars)
        if (p.includes('\\b') || p.includes('\\')) {
          try {
            // Use regex with case-insensitive flag
            const regex = new RegExp(p, 'i');
            return regex.test(video.title);
          } catch (e) {
            // Fallback to simple includes if regex is invalid
            // Sanitize the pattern to remove regex syntax before matching
            const sanitizedPattern = sanitizePatternForPlainMatch(p);
            return titleLower.includes(sanitizedPattern);
          }
        } else {
          // Plain string pattern - use simple includes
          return titleLower.includes(p.toLowerCase());
        }
      });
      if (found) {
        if (!artistIndex[artist.name]) {
          artistIndex[artist.name] = [];
        }
        artistIndex[artist.name].push(videoData);
      }
    });
    
    // Year indexing
    if (video.year) {
      if (!yearIndex[video.year]) {
        yearIndex[video.year] = [];
      }
      yearIndex[video.year].push(videoData);
    }
    
    // Genre detection
    Object.entries(genreKeywords).forEach(([genre, keywords]) => {
      const found = keywords.some(k => titleLower.includes(k));
      if (found) {
        if (!genreIndex[genre]) {
          genreIndex[genre] = [];
        }
        genreIndex[genre].push(videoData);
      }
    });
    
    // Movie detection (common pattern: "Song Name - Movie Name")
    const movieMatch = video.title.match(/[-|](.+?)(?:$|full|lyric|video|audio)/i);
    if (movieMatch) {
      const movieName = movieMatch[1].trim();
      if (!movieIndex[movieName]) {
        movieIndex[movieName] = [];
      }
      movieIndex[movieName].push(videoData);
    }
  });
  
  channels.push(channelData);
});

// Print Analysis
console.log('📺 CHANNELS OVERVIEW:');
console.log('─'.repeat(60));
channels.forEach(ch => {
  console.log(`  ├─ ${ch.name}: ${ch.videoCount} videos`);
  if (ch.videos.length > 0) {
    ch.videos.slice(0, 2).forEach(v => {
      console.log(`  │    └─ ${v.title.substring(0, 45)}...`);
    });
  }
});

console.log(`\n📊 TOTAL VIDEOS: ${totalVideos}`);

console.log('\n🎤 ARTISTS INDEX:');
console.log('─'.repeat(60));
const sortedArtists = Object.entries(artistIndex)
  .sort((a, b) => b[1].length - a[1].length);
sortedArtists.forEach(([artist, songs]) => {
  console.log(`  ${artist}: ${songs.length} songs`);
  songs.slice(0, 2).forEach(s => {
    console.log(`    └─ ${s.title.substring(0, 40)}... [${s.channel}]`);
  });
});

console.log('\n🎵 GENRES INDEX:');
console.log('─'.repeat(60));
Object.entries(genreIndex).forEach(([genre, songs]) => {
  console.log(`  ${genre}: ${songs.length} songs`);
});

console.log('\n📅 YEARS AVAILABLE:');
console.log('─'.repeat(60));
const years = Object.keys(yearIndex).sort();
console.log(`  ${years.join(', ')}`);

// Generate Knowledge Base JSON
const knowledgeBase = {
  meta: {
    totalChannels: channels.length,
    totalVideos: totalVideos,
    generatedAt: new Date().toISOString()
  },
  channels: channels.map(ch => ({
    name: ch.name,
    id: ch.id,
    videoCount: ch.videoCount,
    searchTerms: [
      ch.name.toLowerCase(),
      ch.name.toLowerCase().replace(/\s+/g, ''),
      ...ch.name.toLowerCase().split(' ')
    ]
  })),
  artists: sortedArtists.map(([name, songs]) => {
    const artistPattern = artistPatterns.find(a => a.name === name);
    // Extract readable search terms from regex patterns
    const searchTerms = artistPattern?.patterns.map(normalizeArtistPattern) || [name.toLowerCase()];
    
    return {
      name,
      songCount: songs.length,
      searchTerms,
      songs: songs.map(s => ({
        title: s.title,
        youtubeId: s.youtubeId,
        channel: s.channel
      }))
    };
  }),
  genres: Object.entries(genreIndex).map(([genre, songs]) => ({
    genre,
    keywords: genreKeywords[genre],
    songCount: songs.length,
    songs: songs.map(s => ({
      title: s.title,
      youtubeId: s.youtubeId,
      channel: s.channel
    }))
  })),
  allVideos: allSongs.map(s => ({
    title: s.title,
    youtubeId: s.youtubeId,
    channel: s.channel,
    searchTerms: s.title.toLowerCase().split(/[\s\-\|]+/).filter(t => t.length > 2)
  }))
};

// Save knowledge base
const kbPath = path.join(__dirname, '../data/knowledgeBase.json');
const kbDir = path.dirname(kbPath);

try {
  // Ensure the data directory exists
  if (!fs.existsSync(kbDir)) {
    fs.mkdirSync(kbDir, { recursive: true });
  }
  
  // Write the knowledge base file
  fs.writeFileSync(kbPath, JSON.stringify(knowledgeBase, null, 2));
  console.log(`\n✅ Knowledge Base saved to: ${kbPath}`);
  console.log(`   - ${knowledgeBase.artists.length} artists indexed`);
  console.log(`   - ${knowledgeBase.genres.length} genres indexed`);
  console.log(`   - ${knowledgeBase.allVideos.length} videos searchable`);
} catch (writeError) {
  console.error(`❌ Error: Failed to write knowledge base to: ${kbPath}`);
  console.error(`   ${writeError.message}`);
  process.exit(1);
}

// Export for use
module.exports = knowledgeBase;
