/**
 * DesiTV Channel Reorganization Script
 * 
 * Merges all videos into organized channels by content type.
 * Removes region-wise separation and organizes by content type.
 * 
 * Usage: node reorganize-channels.js
 * 
 * Or with env vars:
 * MONGO_URI="..." node reorganize-channels.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables from multiple locations
const rootEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
dotenv.config();

const Channel = require('./models/Channel');

const MONGO = process.env.MONGO_URI;
if (!MONGO) {
  console.error('❌ MONGO_URI not set in .env or environment');
  console.error('   Run with: MONGO_URI="your_uri" node reorganize-channels.js');
  process.exit(1);
}

// ============================================
// VIDEO CATEGORIZATION RULES
// ============================================

// Keywords to detect category from title
const categoryRules = {
  'Party Anthems': [
    'chittiyaan', 'kala chashma', 'badtameez', 'kar gayi chull', 'fevicol',
    'chikni chameli', 'kamli', 'lat lag', 'breakup song', 'nachde ne saare',
    'besharmi', 'pappu can\'t dance', 'humma', 'hookah', 'manali trance',
    'party', 'dance', 'dil chori', 'patola', 'naah'
  ],
  'Romantic Melodies': [
    'khuda jaane', 'tera hone laga', 'pehli nazar', 'pee loon', 'saibo',
    'bheegi si', 'haan tu hain', 'tumhi ho bandhu', 'teri ore', 'jaane kyun',
    'yemaaya', 'vintunnavaa', 'romantic', 'love', 'pyaar', 'ishq',
    'teri baaton mein', 'nashe si chadh'
  ],
  'Punjabi & Indie': [
    'yo yo honey singh', 'guru randhawa', 'harrdy sandhu', 'badshah',
    'suit', 'na ja', 'pav dharia', 'punjabi', 'desi kalakaar', 'love dose',
    'main tera boyfriend', 'high rated gabru'
  ],
  'Bollywood Classics': [
    'masakali', 'kajra re', 'senorita', 'gallan goodiyaan', 'balam pichkari',
    'matargashti', 'aa re pritam', 'delhi 6', 'bunty aur babli',
    'yeh jawaani hai deewani', 'dil dhadakne do', 'tamasha', 'znmd',
    'zindagi na milegi dobara', 'cocktail', 'dostana'
  ],
  'Toons': [
    'shinchan', 'cartoon', 'anime', 'kids', 'doraemon', 'tom and jerry'
  ]
};

// Categorize video based on title
function categorizeVideo(title) {
  const lowerTitle = title.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categoryRules)) {
    for (const keyword of keywords) {
      if (lowerTitle.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  
  // Default category based on certain patterns
  if (lowerTitle.includes('full video') || lowerTitle.includes('song')) {
    return 'Bollywood Classics';
  }
  
  return 'Uncategorized';
}

// Determine category for Shinchan and South videos (all currently "Untitled")
function categorizeByChannel(channelName) {
  const channelLower = channelName.toLowerCase();
  if (channelLower === 'shinchan') return 'Toons';
  if (channelLower === 'south') return 'Regional Hits'; // Will be merged into main
  return null;
}

// ============================================
// MAIN REORGANIZATION FUNCTION
// ============================================

async function reorganizeChannels() {
  try {
    await mongoose.connect(MONGO);
    console.log('✅ Connected to MongoDB');
    
    // Fetch all existing channels
    const existingChannels = await Channel.find({});
    console.log(`📊 Found ${existingChannels.length} existing channels\n`);
    
    // Collect all videos with categories
    const allVideos = [];
    const seenYoutubeIds = new Set();
    
    for (const channel of existingChannels) {
      const videoCount = channel.items?.length || 0;
      if (videoCount > 0) {
        console.log(`   📺 ${channel.name}: ${videoCount} videos`);
      }
      
      for (const video of channel.items || []) {
        // Skip duplicates
        if (seenYoutubeIds.has(video.youtubeId)) {
          continue;
        }
        seenYoutubeIds.add(video.youtubeId);
        
        // Determine the base channel name (remove regional suffix)
        const baseChannel = channel.name.replace(/\s*\([^)]+\)\s*$/, '').trim();
        
        // Determine category based on channel name and video title
        let category;
        const lowerBase = baseChannel.toLowerCase();
        const lowerTitle = (video.title || '').toLowerCase();
        
        if (lowerBase.includes('shinchan') || lowerTitle.includes('shinchan') || lowerTitle.includes('shin chan')) {
          category = 'Toons';
        } else if (lowerBase === 'comedy' || lowerTitle.includes('comedy')) {
          category = 'Comedy';
        } else if (lowerBase === 'yoyo' || lowerTitle.includes('honey singh') || lowerTitle.includes('yo yo')) {
          category = 'Punjabi & Indie';
        } else {
          category = categorizeVideo(video.title || 'Untitled');
        }
        
        allVideos.push({
          title: video.title || 'Untitled',
          youtubeId: video.youtubeId,
          duration: video.duration || 30,
          year: video.year,
          tags: video.tags || [],
          category: category,
          originalChannel: channel.name
        });
      }
    }
    
    console.log(`\n📊 Total unique videos: ${allVideos.length}`);
    
    // Group videos by their determined channel
    const channelMapping = {
      'Toons': [],
      'Comedy': [],
      'Punjabi & Indie': [],
      'Party Anthems': [],
      'Romantic Melodies': [],
      'Bollywood Classics': [],
      'Uncategorized': []
    };
    
    for (const video of allVideos) {
      const cat = video.category;
      if (channelMapping[cat]) {
        channelMapping[cat].push(video);
      } else {
        channelMapping['Uncategorized'].push(video);
      }
    }
    
    // Create new channel structure (content-based, not region-based)
    const newChannels = [];
    
    console.log('\n📋 New channel structure:');
    for (const [channelName, videos] of Object.entries(channelMapping)) {
      if (videos.length > 0) {
        console.log(`   📺 ${channelName}: ${videos.length} videos`);
        newChannels.push({
          name: channelName,
          playlistStartEpoch: new Date('2020-01-01T00:00:00Z'),
          items: videos.map(v => ({
            title: v.title,
            youtubeId: v.youtubeId,
            duration: v.duration,
            year: v.year,
            tags: v.tags,
            category: v.category
          }))
        });
      }
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`   - Old: ${existingChannels.length} channels (with regional duplicates)`);
    console.log(`   - New: ${newChannels.length} channels (content-based)`);
    console.log(`   - Total videos: ${allVideos.length}`);
    
    // Auto-confirm for script usage
    const autoConfirm = process.argv.includes('--yes') || process.argv.includes('-y');
    
    if (autoConfirm) {
      await performReorganization(newChannels);
    } else {
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      rl.question('\n⚠️  This will replace all existing channels. Continue? (yes/no): ', async (answer) => {
        if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
          await performReorganization(newChannels);
        } else {
          console.log('❌ Operation cancelled');
        }
        rl.close();
        process.exit(0);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function performReorganization(newChannels) {
  // Delete all existing channels
  await Channel.deleteMany({});
  console.log('\n🗑️  Deleted existing channels');
  
  // Insert the new channels
  await Channel.insertMany(newChannels);
  console.log(`✅ Created ${newChannels.length} new channels`);
  
  // Regenerate the JSON files
  const jsonData = {
    version: Date.now(),
    generatedAt: new Date().toISOString(),
    channels: newChannels
  };
  
  // Save to channels.json
  const projectRoot = path.resolve(__dirname, '..');
  fs.writeFileSync(
    path.join(projectRoot, 'channels.json'),
    JSON.stringify(jsonData, null, 2)
  );
  console.log('📁 Updated channels.json');
  
  // Save to client public folder
  fs.writeFileSync(
    path.join(projectRoot, 'client/public/data/channels.json'),
    JSON.stringify(jsonData, null, 2)
  );
  console.log('📁 Updated client/public/data/channels.json');
  
  console.log('\n✅ Reorganization complete!');
  console.log('\n📊 New Structure:');
  for (const ch of newChannels) {
    console.log(`   📺 ${ch.name}: ${ch.items.length} videos`);
  }
  
  process.exit(0);
}

// Run the script
reorganizeChannels();

