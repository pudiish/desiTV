#!/usr/bin/env node
/**
 * Standalone script to generate channels.json from MongoDB
 * Used by GitHub Actions for scheduled regeneration
 * 
 * Usage: MONGODB_URI=<uri> node scripts/generate-channels-json.js
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Support both MONGO_URI and MONGODB_URI
const MONGODB_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const JSON_OUTPUT_PATH = path.resolve(__dirname, '../../client/public/data/channels.json');

if (!MONGODB_URI) {
  console.error('MONGO_URI or MONGODB_URI environment variable is required');
  process.exit(1);
}

// Define schema inline to avoid requiring full server setup
const VideoSchema = new mongoose.Schema({
  title: String,
  youtubeId: String,
  duration: Number,
  year: Number,
  tags: [String],
  category: String
}, { _id: true });

const ChannelSchema = new mongoose.Schema({
  name: String,
  playlistStartEpoch: Date,
  items: [VideoSchema]
});

const Channel = mongoose.model('Channel', ChannelSchema);

async function main() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected');

    const channels = await Channel.find()
      .select('name playlistStartEpoch items')
      .lean();

    const channelsData = channels.map(ch => ({
      _id: ch._id.toString(),
      name: ch.name,
      playlistStartEpoch: ch.playlistStartEpoch,
      items: ch.items.map(item => ({
        _id: item._id?.toString() || null,
        title: item.title,
        youtubeId: item.youtubeId,
        duration: item.duration || 30,
        year: item.year || null,
        tags: item.tags || [],
        category: item.category || null
      }))
    }));

    const jsonData = {
      version: Date.now(),
      generatedAt: new Date().toISOString(),
      channels: channelsData
    };

    // Ensure directory exists
    const dir = path.dirname(JSON_OUTPUT_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(JSON_OUTPUT_PATH, JSON.stringify(jsonData, null, 2), 'utf8');
    console.log(`Generated channels.json with ${channelsData.length} channels`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

