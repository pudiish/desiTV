#!/usr/bin/env node
/**
 * Search and Import Script
 * Searches YouTube for each song by name to find embeddable videos
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Channel = require('../models/Channel');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const API_DELAY_MS = 250;

// All songs organized by channel with search queries
const CHANNELS_DATA = {
  'Desi Beats': {
    description: 'Honey Singh & Punjabi Swag - The high-energy era of 2011-2018',
    songs: [
      'Brown Rang Yo Yo Honey Singh official video',
      'Blue Eyes Yo Yo Honey Singh official video',
      'Bapu Zimidar Jassi Gill official video',
      'Proper Patola Diljit Dosanjh Badshah official',
      'High Heels Jaz Dhami Honey Singh official',
      'Ik Tera Maninder Buttar official video',
      'Sakhiyaan Maninder Buttar official video',
      'Lamberghini The Doorbeen official video',
      '5 Taara Diljit Dosanjh official video',
      'Jaguar Sukh-E Bohemia official video',
      'Na Na Na Na J Star official video',
      'Yaar Bathere Honey Singh Alfaaz official',
      'Lehanga Jass Manak official video',
      'Coka Sukh-E official video',
      'Bewafa Imran Khan official video',
      'Kar Gayi Chull Badshah Kapoor and Sons'
    ]
  },
  'Club Nights': {
    description: 'Bollywood Party Anthems - School Annual Day & Wedding Sangeet classics',
    songs: [
      'Mauja Hi Mauja Jab We Met official',
      'Dhoom Machale Dhoom official video',
      'Dus Bahane Dus movie official',
      'Kajra Re Bunty Aur Babli official',
      'Dhan Te Nan Kaminey official video',
      'Singh is Kinng Title Song Akshay',
      'Sheila Ki Jawani Tees Maar Khan Katrina',
      'Munni Badnaam Hui Dabangg Salman',
      'Hookah Bar Khiladi 786 official',
      'Subha Hone Na De Desi Boyz official',
      'Twist Love Aaj Kal Saif Ali Khan',
      'Chammak Challo Ra One SRK Akon',
      'Its The Time To Disco Kal Ho Naa Ho',
      'Jhalak Dikhla Ja Himesh Aksar',
      'Lungi Dance Chennai Express SRK',
      'Baby Doll Ragini MMS 2 Sunny Leone'
    ]
  },
  'Late Night Vibes': {
    description: 'Soulful romantic songs for late nights (2000-2010)',
    songs: [
      'Tanha Dil Shaan official video',
      'Chand Sifarish Fanaa Aamir Khan',
      'Jab Se Tere Naina Saawariya Ranbir',
      'Woh Ladki Hai Kahan Dil Chahta Hai Shaan',
      'Hey Shona Ta Ra Rum Pum Saif',
      'Ab Mujhe Raat Din Sonu Nigam Deewana',
      'Tera Chehra Adnan Sami official',
      'Maula Mere Maula Anwar movie',
      'Aadat Jal Band Atif Aslam',
      'Beete Lamhe The Train KK Emraan',
      'Tu Hi Meri Shab Hai Gangster KK',
      'O Sanam Lucky Ali official video',
      'Emptiness Tune Mere Jaana Gajendra Verma'
    ]
  },
  'Retro Gold': {
    description: 'Remix Era hits from 2000s TV',
    songs: [
      'Kaanta Laga DJ Doll Shefali Jariwala',
      'Kaliyon Ka Chaman remix official',
      'Rock Tha Party Bombay Rockers official',
      'Let The Music Play Shamur official',
      'Ari Ari Bombay Rockers official',
      'Chhod Do Aanchal Bombay Vikings',
      'Kya Surat Hai Bombay Vikings',
      'Angel Eyes Raghav official video',
      'Bheegi Bheegi Raaton Mein Adnan Sami',
      'Kangna Dr Zeus official video',
      'Dance With You Nachna Jay Sean Rishi Rich',
      'Kabhi Kabhi Aditi Jaane Tu Ya Jaane Na AR Rahman'
    ]
  }
};

async function searchYouTube(query) {
  const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoEmbeddable=true&maxResults=3&key=${YOUTUBE_API_KEY}`;
  
  try {
    const response = await fetch(searchUrl);
    if (!response.ok) {
      console.error(`   Search API error: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (!data.items?.length) return null;
    
    return data.items[0].id.videoId;
  } catch (err) {
    console.error(`   Search error: ${err.message}`);
    return null;
  }
}

async function getVideoDetails(videoId) {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${videoId}&key=${YOUTUBE_API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    const item = data.items?.[0];
    if (!item || item.status?.embeddable === false) return null;
    
    const duration = parseISODuration(item.contentDetails?.duration || 'PT0S');
    if (duration < 60 || duration > 900) return null;
    
    return {
      youtubeId: videoId,
      title: item.snippet.title,
      duration,
      thumbnail: item.snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      publishedAt: item.snippet.publishedAt
    };
  } catch (err) {
    return null;
  }
}

function parseISODuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || 0) * 3600 + parseInt(match[2] || 0) * 60 + parseInt(match[3] || 0);
}

async function processChannel(channelName, channelData) {
  console.log(`\n📺 Processing: ${channelName}`);
  
  const videos = [];
  
  for (let i = 0; i < channelData.songs.length; i++) {
    const query = channelData.songs[i];
    await new Promise(r => setTimeout(r, API_DELAY_MS));
    
    const videoId = await searchYouTube(query);
    if (!videoId) {
      console.log(`   ❌ [${i+1}/${channelData.songs.length}] ${query.split(' ').slice(0, 3).join(' ')} - No results`);
      continue;
    }
    
    await new Promise(r => setTimeout(r, API_DELAY_MS));
    const details = await getVideoDetails(videoId);
    
    if (details) {
      videos.push({
        title: details.title,
        youtubeId: details.youtubeId,
        duration: details.duration,
        year: new Date(details.publishedAt).getFullYear(),
        tags: query.split(' ').slice(0, 2),
        category: channelName,
        thumbnail: details.thumbnail
      });
      console.log(`   ✅ [${i+1}/${channelData.songs.length}] ${details.title.slice(0, 45)}... (${details.duration}s)`);
    } else {
      console.log(`   ❌ [${i+1}/${channelData.songs.length}] ${query.split(' ').slice(0, 3).join(' ')} - Not embeddable`);
    }
  }
  
  return videos;
}

async function main() {
  console.log('🔍 YouTube Search & Import Script');
  console.log('='.repeat(50));
  
  if (!YOUTUBE_API_KEY) {
    console.error('❌ YOUTUBE_API_KEY not set');
    process.exit(1);
  }
  
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');
  
  let totalImported = 0;
  
  for (const [channelName, channelData] of Object.entries(CHANNELS_DATA)) {
    const videos = await processChannel(channelName, channelData);
    
    if (videos.length > 0) {
      let channel = await Channel.findOne({ name: channelName });
      
      if (channel) {
        // Replace entire items array with new videos
        channel.items = videos;
        channel.description = channelData.description;
      } else {
        channel = new Channel({
          name: channelName,
          description: channelData.description,
          thumbnail: videos[0]?.thumbnail,
          items: videos,
          isActive: true
        });
      }
      
      await channel.save();
      console.log(`   💾 Saved ${videos.length} videos to "${channelName}"`);
      totalImported += videos.length;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Total imported: ${totalImported} videos`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
