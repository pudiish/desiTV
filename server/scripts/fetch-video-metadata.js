/**
 * Fetch Video Metadata from YouTube
 * 
 * Updates "Untitled" videos with proper titles and durations from YouTube API.
 * 
 * Usage: 
 *   1. Set YOUTUBE_API_KEY in your .env file
 *   2. Run: node scripts/fetch-video-metadata.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
const rootEnv = path.resolve(__dirname, '../..', '.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const Channel = require('../models/Channel');

const MONGO = process.env.MONGO_URI;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!MONGO) {
  console.error('❌ MONGO_URI not set in .env');
  process.exit(1);
}

// ============================================
// YOUTUBE API FUNCTIONS
// ============================================

// Fetch video details from YouTube API
function fetchYouTubeVideoDetails(videoIds) {
  return new Promise((resolve, reject) => {
    if (!YOUTUBE_API_KEY) {
      console.log('⚠️  YOUTUBE_API_KEY not set - using fallback method');
      resolve({});
      return;
    }
    
    const idsParam = videoIds.join(',');
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${idsParam}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const videoMap = {};
          
          if (json.items) {
            for (const item of json.items) {
              const duration = parseDuration(item.contentDetails?.duration);
              videoMap[item.id] = {
                title: item.snippet?.title || 'Untitled',
                duration: duration,
                year: new Date(item.snippet?.publishedAt).getFullYear(),
                tags: item.snippet?.tags || []
              };
            }
          }
          
          resolve(videoMap);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Parse ISO 8601 duration (PT4M13S) to seconds
function parseDuration(isoDuration) {
  if (!isoDuration) return 30; // Default
  
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 30;
  
  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);
  
  return hours * 3600 + minutes * 60 + seconds;
}

// Generate title from YouTube ID using page scrape (fallback)
async function scrapeYouTubeTitle(videoId) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Extract title from HTML
        const titleMatch = data.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          let title = titleMatch[1].replace(' - YouTube', '').trim();
          resolve(title);
        } else {
          resolve(`Video ${videoId}`);
        }
      });
    }).on('error', () => {
      resolve(`Video ${videoId}`);
    });
  });
}

// ============================================
// MAIN FUNCTION
// ============================================

async function fetchMetadata() {
  try {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected to MongoDB');
    
    const channels = await Channel.find({});
    console.log(`📊 Found ${channels.length} channels`);
    
    let updatedCount = 0;
    let totalUntitled = 0;
    
    for (const channel of channels) {
      console.log(`\n📺 Processing: ${channel.name}`);
      
      // Find videos that need metadata
      const untitledVideos = channel.items.filter(v => 
        !v.title || v.title === 'Untitled' || v.title.startsWith('Video ')
      );
      
      if (untitledVideos.length === 0) {
        console.log('   ✅ All videos have titles');
        continue;
      }
      
      totalUntitled += untitledVideos.length;
      console.log(`   📝 Found ${untitledVideos.length} videos needing metadata`);
      
      // Process in batches of 50 (YouTube API limit)
      const batchSize = 50;
      for (let i = 0; i < untitledVideos.length; i += batchSize) {
        const batch = untitledVideos.slice(i, i + batchSize);
        const videoIds = batch.map(v => v.youtubeId);
        
        console.log(`   🔄 Fetching batch ${Math.floor(i/batchSize) + 1}...`);
        
        let metadata;
        if (YOUTUBE_API_KEY) {
          metadata = await fetchYouTubeVideoDetails(videoIds);
        } else {
          // Fallback: scrape titles one by one (slower)
          metadata = {};
          for (const id of videoIds) {
            const title = await scrapeYouTubeTitle(id);
            metadata[id] = { title, duration: 30, year: null, tags: [] };
            await new Promise(r => setTimeout(r, 500)); // Rate limit
          }
        }
        
        // Update videos in channel
        for (const video of batch) {
          const info = metadata[video.youtubeId];
          if (info && info.title && info.title !== 'Untitled') {
            const idx = channel.items.findIndex(v => v.youtubeId === video.youtubeId);
            if (idx !== -1) {
              channel.items[idx].title = info.title;
              channel.items[idx].duration = info.duration || 30;
              if (info.year) channel.items[idx].year = info.year;
              if (info.tags?.length) channel.items[idx].tags = info.tags.slice(0, 5);
              updatedCount++;
              console.log(`      ✅ ${video.youtubeId}: ${info.title.substring(0, 50)}...`);
            }
          }
        }
        
        // Small delay between batches
        await new Promise(r => setTimeout(r, 1000));
      }
      
      // Save the updated channel
      await channel.save();
      console.log(`   💾 Saved ${channel.name}`);
    }
    
    console.log(`\n✅ Metadata fetch complete!`);
    console.log(`   - Processed: ${totalUntitled} untitled videos`);
    console.log(`   - Updated: ${updatedCount} videos`);
    
    // Regenerate JSON files
    const allChannels = await Channel.find({});
    const jsonData = {
      version: Date.now(),
      generatedAt: new Date().toISOString(),
      channels: allChannels.map(c => c.toObject())
    };
    
    const projectRoot = path.resolve(__dirname, '../..');
    fs.writeFileSync(
      path.join(projectRoot, 'channels.json'),
      JSON.stringify(jsonData, null, 2)
    );
    fs.writeFileSync(
      path.join(projectRoot, 'client/public/data/channels.json'),
      JSON.stringify(jsonData, null, 2)
    );
    console.log('📁 Updated JSON files');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fetchMetadata();


