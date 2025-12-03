const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load root .env if present
const rootEnv = path.resolve(__dirname, '..', '..', '.env');
if (fs.existsSync(rootEnv)) dotenv.config({ path: rootEnv });
dotenv.config();

const Channel = require('../models/Channel');

function extractYoutubeId(u){
  try{ const urlObj = new URL(u); return urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop() } catch(e){ return u }
}

async function run(){
  const MONGO = process.env.MONGO_URI;
  if (!MONGO) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to Mongo');

  // Use provided URL or default
  const url = process.argv[2] || 'https://www.youtube.com/watch?v=D16DlpMCZTs&list=RDD16DlpMCZTs&start_radio=1';
  const youtubeId = extractYoutubeId(url);

  const channelName = process.argv[3] || 'Test Imports';
  const category = process.argv[4] || 'Trailers';
  const title = process.argv[6] || `Imported video ${youtubeId}`;
  const duration = Number(process.argv[7] || 240);
  let ch = await Channel.findOne({ name: channelName });
  if (!ch) {
    ch = await Channel.create({ name: channelName, playlistStartEpoch: new Date() });
    console.log('Created channel', ch._id);
  }

  ch.items.push({ title, youtubeId, duration, year: new Date().getFullYear(), tags: ['imported'], category });
  await ch.save();
  console.log('Inserted video into channel', ch._id);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch(err=>{console.error(err); process.exit(1)})
