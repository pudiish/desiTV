#!/usr/bin/env node
/**
 * Import New Batch Script
 * 
 * Reads video URLs from text files, validates with YouTube API,
 * checks for duplicates, and updates channels in MongoDB
 * 
 * Features:
 * - YouTube API validation (title, duration, embeddable)
 * - Duplicate detection across all channels
 * - Mood/filter tagging based on channel type
 * - Sequence preservation
 * - Safe rollback on errors
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Channel model
const Channel = require('../models/Channel');

// Configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const BATCH_SIZE = 10; // Process videos in batches to avoid rate limits
const API_DELAY_MS = 100; // Delay between API calls

// Channel mapping with metadata
const CHANNEL_CONFIG = {
  'retrogold': {
    channelName: 'Retro Gold',
    description: 'Classic Bollywood hits from the golden era',
    tags: ['retro', 'classic', 'golden-era', 'nostalgia', 'evergreen'],
    mood: ['nostalgic', 'relaxed', 'soulful'],
    tripType: ['long-drive', 'family-trip', 'evening-chill'],
    era: '80s-90s',
    timeSlot: 'morning' // Best for morning/afternoon
  },
  'latenight': {
    channelName: 'Late Night Vibes',
    description: 'Romantic and soulful tracks for late nights',
    tags: ['romantic', 'soulful', 'late-night', 'love', 'melody'],
    mood: ['romantic', 'peaceful', 'dreamy'],
    tripType: ['night-drive', 'solo-trip', 'couple-trip'],
    era: 'mixed',
    timeSlot: 'lateNight'
  },
  'club_nights': {
    channelName: 'Club Nights',
    description: 'High energy party anthems and club bangers',
    tags: ['party', 'dance', 'club', 'edm', 'remix'],
    mood: ['energetic', 'party', 'upbeat'],
    tripType: ['road-trip', 'group-trip', 'weekend-getaway'],
    era: '2010s-2020s',
    timeSlot: 'night'
  },
  'desi_beats': {
    channelName: 'Desi Beats',
    description: 'Latest Bollywood and Punjabi hits',
    tags: ['bollywood', 'punjabi', 'trending', 'latest', 'desi'],
    mood: ['energetic', 'happy', 'festive'],
    tripType: ['road-trip', 'friend-trip', 'celebration'],
    era: '2020s',
    timeSlot: 'primeTime'
  }
};

// YouTube API helper
async function fetchVideoMetadata(youtubeId) {
  if (!YOUTUBE_API_KEY) {
    throw new Error('YOUTUBE_API_KEY not configured');
  }

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${encodeURIComponent(youtubeId)}&key=${YOUTUBE_API_KEY}`;
  
  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`  ❌ API error for ${youtubeId}:`, error.error?.message || response.statusText);
      return null;
    }

    const data = await response.json();
    const item = data.items?.[0];
    
    if (!item) {
      console.error(`  ❌ Video not found: ${youtubeId}`);
      return null;
    }

    // Check embeddable
    if (item.status?.embeddable === false) {
      console.warn(`  ⚠️ Video not embeddable: ${youtubeId} - "${item.snippet.title}"`);
      return null;
    }

    // Parse duration (ISO 8601)
    const duration = parseISODuration(item.contentDetails?.duration || 'PT0S');
    
    // Skip very short videos (likely intros/outros)
    if (duration < 60) {
      console.warn(`  ⚠️ Video too short (${duration}s): ${youtubeId} - "${item.snippet.title}"`);
      return null;
    }

    // Skip very long videos (likely compilations)
    if (duration > 900) { // 15 minutes
      console.warn(`  ⚠️ Video too long (${duration}s): ${youtubeId} - "${item.snippet.title}"`);
      return null;
    }

    return {
      title: item.snippet.title,
      duration: duration,
      embeddable: true,
      publishedAt: item.snippet.publishedAt,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
    };
  } catch (err) {
    console.error(`  ❌ Fetch error for ${youtubeId}:`, err.message);
    return null;
  }
}

function parseISODuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);
  return hours * 3600 + minutes * 60 + seconds;
}

function extractVideoId(url) {
  // Handle various YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
  ];
  
  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function readBatchFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const videoIds = [];
  for (const line of lines) {
    const videoId = extractVideoId(line);
    if (videoId) {
      videoIds.push(videoId);
    } else {
      console.warn(`  ⚠️ Invalid URL: ${line}`);
    }
  }
  
  return videoIds;
}

async function checkDuplicates(videoIds, existingChannels) {
  const duplicates = new Map();
  const existingIds = new Set();
  
  // Collect all existing video IDs from all channels
  for (const channel of existingChannels) {
    for (const video of channel.items || []) {
      if (existingIds.has(video.youtubeId)) {
        duplicates.set(video.youtubeId, channel.name);
      }
      existingIds.add(video.youtubeId);
    }
  }
  
  // Check for duplicates in new batch
  const newDuplicates = [];
  const seenInBatch = new Set();
  
  for (const id of videoIds) {
    if (existingIds.has(id)) {
      newDuplicates.push({ id, existsIn: 'database' });
    } else if (seenInBatch.has(id)) {
      newDuplicates.push({ id, existsIn: 'batch' });
    }
    seenInBatch.add(id);
  }
  
  return { newDuplicates, existingIds };
}

async function processChannel(channelKey, videoIds, config) {
  console.log(`\n📺 Processing channel: ${config.channelName}`);
  console.log(`   ${videoIds.length} videos to process`);
  
  const validVideos = [];
  const failedVideos = [];
  
  // Process in batches
  for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
    const batch = videoIds.slice(i, i + BATCH_SIZE);
    console.log(`   Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(videoIds.length/BATCH_SIZE)}...`);
    
    for (const videoId of batch) {
      await new Promise(resolve => setTimeout(resolve, API_DELAY_MS));
      
      const metadata = await fetchVideoMetadata(videoId);
      
      if (metadata) {
        // Determine year from title or published date
        const yearMatch = metadata.title.match(/\b(19[89]\d|20[0-2]\d)\b/);
        const year = yearMatch ? parseInt(yearMatch[1]) : new Date(metadata.publishedAt).getFullYear();
        
        validVideos.push({
          title: metadata.title,
          youtubeId: videoId,
          duration: metadata.duration,
          year: year,
          tags: [...config.tags],
          category: config.channelName,
          thumbnail: metadata.thumbnail
        });
        
        console.log(`   ✅ ${videoId}: "${metadata.title.substring(0, 50)}..." (${metadata.duration}s)`);
      } else {
        failedVideos.push(videoId);
      }
    }
  }
  
  console.log(`   ✅ Valid: ${validVideos.length}, ❌ Failed: ${failedVideos.length}`);
  
  return { validVideos, failedVideos };
}

async function updateChannel(channelName, videos, config) {
  // Find or create channel
  let channel = await Channel.findOne({ name: channelName });
  
  if (!channel) {
    console.log(`   Creating new channel: ${channelName}`);
    channel = new Channel({
      name: channelName,
      description: config.description,
      items: [],
      isActive: true
    });
  }
  
  // Backup current items
  const backup = [...(channel.items || [])];
  
  try {
    // Replace items with new videos (preserving sequence)
    channel.items = videos;
    channel.description = config.description;
    
    // Also update time-based playlists if applicable
    if (config.timeSlot && channel.timeBasedPlaylists) {
      channel.timeBasedPlaylists[config.timeSlot] = videos;
    }
    
    await channel.save();
    console.log(`   ✅ Channel "${channelName}" updated with ${videos.length} videos`);
    
    return { success: true, backup };
  } catch (err) {
    console.error(`   ❌ Failed to update channel: ${err.message}`);
    
    // Rollback
    channel.items = backup;
    await channel.save();
    
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('🎬 DesiTV New Batch Import Script');
  console.log('=' .repeat(50));
  
  // Check API key
  if (!YOUTUBE_API_KEY) {
    console.error('❌ YOUTUBE_API_KEY not set in environment');
    process.exit(1);
  }
  
  // Connect to MongoDB
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI not set in environment');
    process.exit(1);
  }
  
  console.log('📡 Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');
  
  // Get existing channels for duplicate check
  const existingChannels = await Channel.find({});
  console.log(`📊 Found ${existingChannels.length} existing channels`);
  
  const batchDir = path.join(__dirname, '../../new batch');
  const results = {
    total: 0,
    successful: 0,
    failed: 0,
    duplicates: 0,
    channels: {}
  };
  
  // Process each batch file
  for (const [key, config] of Object.entries(CHANNEL_CONFIG)) {
    const filePath = path.join(batchDir, key.includes('.') ? key : key + '.txt');
    const altPath = path.join(batchDir, key); // For files without extension
    
    let actualPath = fs.existsSync(filePath) ? filePath : 
                     fs.existsSync(altPath) ? altPath : null;
    
    if (!actualPath) {
      console.warn(`\n⚠️ File not found for ${key}, skipping...`);
      continue;
    }
    
    console.log(`\n📂 Reading: ${path.basename(actualPath)}`);
    
    // Read video IDs
    const videoIds = await readBatchFile(actualPath);
    results.total += videoIds.length;
    
    // Check duplicates
    const { newDuplicates } = await checkDuplicates(videoIds, existingChannels);
    
    if (newDuplicates.length > 0) {
      console.log(`   ⚠️ Found ${newDuplicates.length} duplicates (will skip):`);
      newDuplicates.forEach(d => console.log(`      - ${d.id} (${d.existsIn})`));
      results.duplicates += newDuplicates.length;
    }
    
    // Filter out duplicates
    const duplicateIds = new Set(newDuplicates.map(d => d.id));
    const uniqueVideoIds = videoIds.filter(id => !duplicateIds.has(id));
    
    // Process videos
    const { validVideos, failedVideos } = await processChannel(key, uniqueVideoIds, config);
    
    results.successful += validVideos.length;
    results.failed += failedVideos.length;
    
    // Update channel in database
    if (validVideos.length > 0) {
      const updateResult = await updateChannel(config.channelName, validVideos, config);
      results.channels[config.channelName] = {
        videos: validVideos.length,
        success: updateResult.success
      };
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total URLs processed: ${results.total}`);
  console.log(`✅ Successfully imported: ${results.successful}`);
  console.log(`❌ Failed/Skipped: ${results.failed}`);
  console.log(`🔄 Duplicates skipped: ${results.duplicates}`);
  console.log('\nChannels updated:');
  for (const [name, data] of Object.entries(results.channels)) {
    console.log(`  - ${name}: ${data.videos} videos (${data.success ? '✅' : '❌'})`);
  }
  
  await mongoose.disconnect();
  console.log('\n✅ Done! Database connection closed.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
