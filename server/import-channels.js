/**
 * Import channels from JSON file to MongoDB Atlas
 * Usage: node import-channels.js
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const Channel = require('./models/Channel');

async function importChannels() {
  try {
    // Connect to MongoDB Atlas
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    // Read the JSON file
    const jsonPath = path.resolve(__dirname, '..', 'retro-tv.channels.json');
    const rawData = fs.readFileSync(jsonPath, 'utf8');
    const channels = JSON.parse(rawData);
    
    console.log('📄 Found', channels.length, 'channels to import');
    
    // Clear existing channels
    await Channel.deleteMany({});
    console.log('🗑️  Cleared existing channels');
    
    // Import each channel
    for (const ch of channels) {
      // Handle MongoDB extended JSON format
      const epochDate = ch.playlistStartEpoch.$date 
        ? new Date(ch.playlistStartEpoch.$date) 
        : new Date(ch.playlistStartEpoch);
      
      const channel = {
        name: ch.name,
        playlistStartEpoch: epochDate,
        items: ch.items.map(item => ({
          title: item.title,
          youtubeId: item.youtubeId,
          duration: item.duration,
          tags: item.tags || []
        }))
      };
      
      await Channel.create(channel);
      console.log('  ✅ Imported:', ch.name, '(' + ch.items.length + ' videos)');
    }
    
    console.log('\n🎉 Successfully imported all channels to MongoDB Atlas!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

importChannels();
