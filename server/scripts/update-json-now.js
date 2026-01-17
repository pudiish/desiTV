#!/usr/bin/env node
/**
 * Quick script to update channels.json from MongoDB
 * Reads MONGO_URI from server/.env or environment
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { generateChannelsJSON } = require('../utils/generateJSON');
const dbConnectionManager = require('../utils/dbConnection');

async function main() {
  try {
    const MONGO_URI = process.env.MONGO_URI;
    if (!MONGO_URI) {
      console.error('❌ MONGO_URI not found in environment');
      process.exit(1);
    }

    console.log('🔄 Connecting to MongoDB...');
    await dbConnectionManager.connect(MONGO_URI, {
      maxPoolSize: 3,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
    });

    console.log('✅ Connected. Fetching channels from MongoDB...');
    const result = await generateChannelsJSON();
    
    console.log(`✅ Success! Generated channels.json with ${result.channels.length} channels`);
    console.log(`📁 File: client/public/data/channels.json`);
    console.log(`🕐 Generated at: ${result.generatedAt}`);
    console.log(`🔢 Version: ${result.version}`);

    await dbConnectionManager.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
