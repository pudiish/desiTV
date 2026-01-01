/**
 * Database Analyzer Script
 * Creates comprehensive knowledge base from channels.json
 */

const fs = require('fs');
const path = require('path');

// Read channels.json
const channelsPath = path.join(__dirname, '../../channels.json');
const data = JSON.parse(fs.readFileSync(channelsPath, 'utf8'));

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

// Artist patterns to detect
const artistPatterns = [
  { name: 'Yo Yo Honey Singh', patterns: ['honey singh', 'yo yo', 'honey', 'hone singh'] },
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
  { name: 'KK', patterns: ['k.k.', ' kk '] },
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
    
    // Store in youtube ID map
    youtubeIdMap[video.youtubeId] = videoData;
    
    // Add to all songs
    allSongs.push(videoData);
    channelData.videos.push(videoData);
    
    const titleLower = video.title.toLowerCase();
    
    // Artist detection
    artistPatterns.forEach(artist => {
      const found = artist.patterns.some(p => titleLower.includes(p.toLowerCase()));
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
  artists: sortedArtists.map(([name, songs]) => ({
    name,
    songCount: songs.length,
    searchTerms: artistPatterns.find(a => a.name === name)?.patterns || [name.toLowerCase()],
    songs: songs.map(s => ({
      title: s.title,
      youtubeId: s.youtubeId,
      channel: s.channel
    }))
  })),
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
fs.writeFileSync(kbPath, JSON.stringify(knowledgeBase, null, 2));
console.log(`\n✅ Knowledge Base saved to: ${kbPath}`);
console.log(`   - ${knowledgeBase.artists.length} artists indexed`);
console.log(`   - ${knowledgeBase.genres.length} genres indexed`);
console.log(`   - ${knowledgeBase.allVideos.length} videos searchable`);

// Export for use
module.exports = knowledgeBase;
