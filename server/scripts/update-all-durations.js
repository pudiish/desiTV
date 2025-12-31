/**
 * Update ALL Video Durations from YouTube
 * 
 * Fetches actual duration for ALL videos in the database from YouTube API.
 * 
 * Usage: 
 *   1. Set YOUTUBE_API_KEY in your .env file
 *   2. Run: node scripts/update-all-durations.js
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

if (!YOUTUBE_API_KEY) {
  console.error('❌ YOUTUBE_API_KEY not set in .env');
  console.error('   This script requires YouTube API to fetch durations');
  process.exit(1);
}

// Parse ISO 8601 duration (PT4M13S) to seconds
function parseDuration(isoDuration) {
  if (!isoDuration) return 30;
  
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 30;
  
  const hours = parseInt(match[1] || 0);
  const minutes = parseInt(match[2] || 0);
  const seconds = parseInt(match[3] || 0);
  
  return hours * 3600 + minutes * 60 + seconds;
}

// Format seconds to mm:ss
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// Fetch video details from YouTube API (batch of up to 50)
function fetchYouTubeVideoDetails(videoIds) {
  return new Promise((resolve, reject) => {
    const idsParam = videoIds.join(',');
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${idsParam}&key=${YOUTUBE_API_KEY}&part=contentDetails`;
    
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          
          if (json.error) {
            console.error('YouTube API Error:', json.error.message);
            resolve({});
            return;
          }
          
          const videoMap = {};
          if (json.items) {
            for (const item of json.items) {
              const duration = parseDuration(item.contentDetails?.duration);
              videoMap[item.id] = duration;
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

async function updateAllDurations() {
  try {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('✅ Connected to MongoDB\n');
    
    const channels = await Channel.find({});
    console.log(`📊 Found ${channels.length} channels\n`);
    
    let totalVideos = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const updatedVideos = [];
    
    for (const channel of channels) {
      console.log(`\n📺 ${channel.name} (${channel.items.length} videos)`);
      console.log('─'.repeat(50));
      
      if (channel.items.length === 0) {
        console.log('   No videos, skipping...');
        continue;
      }
      
      totalVideos += channel.items.length;
      
      // Process in batches of 50 (YouTube API limit)
      const batchSize = 50;
      for (let i = 0; i < channel.items.length; i += batchSize) {
        const batch = channel.items.slice(i, i + batchSize);
        const videoIds = batch.map(v => v.youtubeId).filter(id => id);
        
        if (videoIds.length === 0) continue;
        
        console.log(`   🔄 Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(channel.items.length/batchSize)}...`);
        
        try {
          const durations = await fetchYouTubeVideoDetails(videoIds);
          
          // Update durations
          for (const video of batch) {
            const newDuration = durations[video.youtubeId];
            if (newDuration && newDuration > 0) {
              const oldDuration = video.duration || 30;
              const idx = channel.items.findIndex(v => v.youtubeId === video.youtubeId);
              
              if (idx !== -1) {
                channel.items[idx].duration = newDuration;
                
                if (oldDuration !== newDuration) {
                  updatedVideos.push({
                    channel: channel.name,
                    title: video.title?.substring(0, 40) || video.youtubeId,
                    old: formatDuration(oldDuration),
                    new: formatDuration(newDuration)
                  });
                }
                updatedCount++;
              }
            } else {
              failedCount++;
              console.log(`      ⚠️  ${video.youtubeId}: Could not fetch duration`);
            }
          }
          
          // Rate limit: wait between batches
          await new Promise(r => setTimeout(r, 500));
          
        } catch (err) {
          console.error(`   ❌ Batch error: ${err.message}`);
          failedCount += batch.length;
        }
      }
      
      // Save the updated channel
      await channel.save();
      console.log(`   💾 Saved`);
    }
    
    // Summary
    console.log('\n' + '═'.repeat(60));
    console.log('📊 SUMMARY');
    console.log('═'.repeat(60));
    console.log(`   Total videos:  ${totalVideos}`);
    console.log(`   Updated:       ${updatedCount}`);
    console.log(`   Failed:        ${failedCount}`);
    
    if (updatedVideos.length > 0) {
      console.log(`\n📝 Duration Changes (${updatedVideos.length} videos):`);
      console.log('─'.repeat(60));
      for (const v of updatedVideos.slice(0, 50)) { // Show first 50
        console.log(`   ${v.old} → ${v.new}  ${v.title}`);
      }
      if (updatedVideos.length > 50) {
        console.log(`   ... and ${updatedVideos.length - 50} more`);
      }
    }
    
    // Regenerate JSON files
    console.log('\n📁 Regenerating JSON files...');
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
    console.log('   ✅ channels.json');
    console.log('   ✅ client/public/data/channels.json');
    
    console.log('\n✅ All durations updated!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateAllDurations();
