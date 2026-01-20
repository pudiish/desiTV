/**
 * Migration Script: JSON → MongoDB
 * 
 * This script imports existing channels.json data into MongoDB.
 * It's designed to be run once during initial setup.
 * 
 * Usage:
 *   node server/scripts/migrateToMongoDB.js
 * 
 * Or via npm:
 *   npm run migrate
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Channel = require('../models/Channel');

// Paths to check for JSON data
const JSON_PATHS = [
  path.resolve(__dirname, '../../channels.json'),
  path.resolve(__dirname, '../../client/public/data/channels.json')
];

async function migrate() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║         DesiTV Migration: JSON → MongoDB                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Check for MONGO_URI
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGO_URI environment variable is not set');
    console.error('   Please set it in .env file or environment');
    process.exit(1);
  }

  // Find JSON file
  let jsonPath = null;
  let jsonData = null;

  for (const p of JSON_PATHS) {
    if (fs.existsSync(p)) {
      jsonPath = p;
      try {
        const content = fs.readFileSync(p, 'utf8');
        jsonData = JSON.parse(content);
        console.log(`✅ Found JSON data at: ${p}`);
        break;
      } catch (err) {
        console.warn(`⚠️  Could not parse JSON at ${p}: ${err.message}`);
      }
    }
  }

  if (!jsonData || !jsonData.channels) {
    console.error('❌ No valid channels.json found');
    console.error('   Checked paths:');
    JSON_PATHS.forEach(p => console.error(`   - ${p}`));
    process.exit(1);
  }

  console.log(`📊 Found ${jsonData.channels.length} channels in JSON`);
  console.log('');

  // Connect to MongoDB
  console.log('🔌 Connecting to MongoDB...');
  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 10000,
    });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  // Check existing data
  const existingCount = await Channel.countDocuments();
  console.log(`📊 Existing channels in MongoDB: ${existingCount}`);
  console.log('');

  if (existingCount > 0) {
    console.log('⚠️  MongoDB already has data!');
    console.log('');
    console.log('Options:');
    console.log('  --force    : Delete existing and reimport');
    console.log('  --merge    : Only add new channels (default)');
    console.log('');
    
    const args = process.argv.slice(2);
    if (args.includes('--force')) {
      console.log('🗑️  Force mode: Deleting all existing channels...');
      await Channel.deleteMany({});
      console.log('✅ Deleted existing channels');
    } else {
      console.log('📝 Merge mode: Will only add new channels');
    }
    console.log('');
  }

  // Import channels
  console.log('📥 Importing channels...');
  console.log('');

  let imported = 0;
  let skipped = 0;
  let errors = [];

  for (const channelData of jsonData.channels) {
    try {
      // Check if channel already exists
      const existing = await Channel.findOne({ name: channelData.name });
      if (existing) {
        console.log(`   ⏭️  Skipped: "${channelData.name}" (already exists)`);
        skipped++;
        continue;
      }

      // Create channel
      const channel = new Channel({
        name: channelData.name,
        playlistStartEpoch: channelData.playlistStartEpoch || new Date('2020-01-01T00:00:00Z'),
        items: (channelData.items || []).map(item => ({
          title: item.title,
          youtubeId: item.youtubeId,
          duration: item.duration || 30,
          year: item.year || null,
          tags: item.tags || [],
          category: item.category || null,
        })),
        timeBasedPlaylists: channelData.timeBasedPlaylists || {},
        dayBasedPlaylists: channelData.dayBasedPlaylists || {},
        description: channelData.description || '',
        thumbnail: channelData.thumbnail || '',
        isActive: true
      });

      await channel.save();
      console.log(`   ✅ Imported: "${channelData.name}" (${channel.items.length} videos)`);
      imported++;
    } catch (err) {
      console.log(`   ❌ Error: "${channelData.name}" - ${err.message}`);
      errors.push({ name: channelData.name, error: err.message });
    }
  }

  // Summary
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                        MIGRATION SUMMARY                        ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   ✅ Imported: ${imported} channels`);
  console.log(`   ⏭️  Skipped:  ${skipped} channels (already exist)`);
  console.log(`   ❌ Errors:   ${errors.length} channels`);
  console.log('');

  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(e => console.log(`   - ${e.name}: ${e.error}`));
    console.log('');
  }

  // Verify
  const finalCount = await Channel.countDocuments();
  console.log(`📊 Total channels in MongoDB: ${finalCount}`);

  // Disconnect
  await mongoose.disconnect();
  console.log('');
  console.log('✅ Migration complete!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Update .env with MONGO_URI');
  console.log('  2. Set USE_MONGODB=true in .env');
  console.log('  3. Restart the server');
  console.log('');
}

// Run migration
migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
