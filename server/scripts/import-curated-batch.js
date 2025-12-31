#!/usr/bin/env node
/**
 * Import Curated Batch Script
 * 
 * Uses pre-defined song data with proper metadata
 * Validates with YouTube API and updates database
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Channel = require('../models/Channel');

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const API_DELAY_MS = 150;

// Curated song data with proper metadata
const CHANNELS_DATA = {
  'Desi Beats': {
    description: 'Honey Singh & Punjabi Swag - The high-energy era of 2011-2018',
    thumbnail: 'https://img.youtube.com/vi/uuCFRaFWjwY/hqdefault.jpg',
    songs: [
      { title: 'Brown Rang', artist: 'Yo Yo Honey Singh', youtubeId: 'iX4qQlm-0NY', tags: ['Honey Singh', 'Urban', 'Party'] },
      { title: 'Blue Eyes', artist: 'Yo Yo Honey Singh', youtubeId: 'NbyHNASFi6U', tags: ['Honey Singh', 'Blockbuster', '2013'] },
      { title: 'Bapu Zimidar', artist: 'Jassi Gill', youtubeId: 'gyLJaqQKfFA', tags: ['Punjabi', 'Jassi Gill', 'Nostalgia'] },
      { title: 'Proper Patola', artist: 'Diljit Dosanjh ft. Badshah', youtubeId: 'EqkSZLuvqi0', tags: ['Diljit', 'Badshah', 'Swag'] },
      { title: 'Amplifier', artist: 'Imran Khan', youtubeId: 'uuCFRaFWjwY', tags: ['Imran Khan', 'Cars', 'Woofer'] },
      { title: 'High Heels', artist: 'Jaz Dhami ft. Honey Singh', youtubeId: 'Kq4MjKSVtPc', tags: ['Party', 'Dance', 'Honey Singh'] },
      { title: 'Dope Shope', artist: 'Honey Singh & Deep Money', youtubeId: 'IyYC3Ayr1f0', tags: ['International Villager', 'Punjabi'] },
      { title: 'Ik Tera', artist: 'Maninder Buttar', youtubeId: 'KRVG3VZ-w2I', tags: ['Maninder Buttar', 'Romantic', 'Pop'] },
      { title: 'Sakhiyaan', artist: 'Maninder Buttar', youtubeId: 'Cy4rN6F8pnE', tags: ['Heartbreak', 'Punjabi', 'Viral'] },
      { title: 'Lamberghini', artist: 'The Doorbeen', youtubeId: 'HpFYBOj6_ss', tags: ['Viral', 'Wedding', 'Dance'] },
      { title: '5 Taara', artist: 'Diljit Dosanjh', youtubeId: 'q9sDd_Z6LZs', tags: ['Diljit', 'Bhangra', 'Breakup'] },
      { title: 'Jaguar', artist: 'Sukh-E & Bohemia', youtubeId: 'DAXU7F8IVno', tags: ['Bohemia', 'Rap', 'Party'] },
      { title: 'Na Na Na Na', artist: 'J Star', youtubeId: 'FmEi_5JqRE8', tags: ['Catchy', 'Repetitive', '2015'] },
      { title: 'Yaar Bathere', artist: 'Honey Singh & Alfaaz', youtubeId: 'sZnMmgdJZuk', tags: ['Friendship', 'Emo', 'Punjabi'] },
      { title: 'Satisfya', artist: 'Imran Khan', youtubeId: 'pfVODjDBFxU', tags: ['Attitude', 'Car Music', 'Rap'] },
      { title: 'Laung Laachi', artist: 'Mannat Noor', youtubeId: 'YpkJO_GrCo0', tags: ['Hit', 'Female', 'Wedding'] },
      { title: 'Tera Woh Pyar (Coke Studio)', artist: 'Momina Mustehsan', youtubeId: '8367ETnagHo', tags: ['Coke Studio', 'Soulful', 'Viral'] },
      { title: 'Lehanga', artist: 'Jass Manak', youtubeId: 'ZrjPSoQ9bN8', tags: ['Wedding', '2019', 'Dance'] },
      { title: 'Coka', artist: 'Sukh-E', youtubeId: 'UKx-JdF8nmc', tags: ['Upbeat', 'Party', 'Punjabi'] },
      { title: 'Bewafa', artist: 'Imran Khan', youtubeId: '7gNS4C7i4Xc', tags: ['Sad', '2000s', 'Nostalgia'] },
    ]
  },

  'Club Nights': {
    description: 'Bollywood Party Anthems - School Annual Day & Wedding Sangeet classics (2004-2013)',
    thumbnail: 'https://img.youtube.com/vi/II2EO3Nw4m0/hqdefault.jpg',
    songs: [
      { title: 'Mauja Hi Mauja', artist: 'Jab We Met', youtubeId: 'TNHsw8TLf6Y', tags: ['Shahid', 'Kareena', 'Mika Singh'] },
      { title: 'Dhoom Machale', artist: 'Dhoom', youtubeId: 'c0HEaIl_wKk', tags: ['Esha Deol', 'Sunidhi', 'Bike'] },
      { title: 'Dus Bahane', artist: 'Dus', youtubeId: 'Qp1kRNdLz2I', tags: ['KK', 'Shaan', 'Cool'] },
      { title: 'Kajra Re', artist: 'Bunty Aur Babli', youtubeId: 'wqq-oBSn6gc', tags: ['Item Song', 'Aishwarya', 'Dance'] },
      { title: 'Desi Boyz Title Track', artist: 'Desi Boyz', youtubeId: 'Y7G-tYRzwYY', tags: ['Akshay', 'John', 'Club'] },
      { title: 'Dhan Te Nan', artist: 'Kaminey', youtubeId: '6HCw1wDWVzU', tags: ['Shahid', 'Rock', 'Energy'] },
      { title: 'Singh is Kinng', artist: 'Singh is Kinng', youtubeId: 'bIFL5-QqPOA', tags: ['Snoop Dogg', 'Akshay', 'Turban'] },
      { title: 'Sheila Ki Jawani', artist: 'Tees Maar Khan', youtubeId: 'LBt6hlqqJWQ', tags: ['Katrina', 'Sunidhi', 'Vishal'] },
      { title: 'Munni Badnaam', artist: 'Dabangg', youtubeId: 'wCgPMYpkOis', tags: ['Malaika', 'Salman', 'Mamta'] },
      { title: 'Hookah Bar', artist: 'Khiladi 786', youtubeId: 'uKJT9VRjmXA', tags: ['Himesh', 'Asin', 'Akshay'] },
      { title: 'Subha Hone Na De', artist: 'Desi Boyz', youtubeId: 'Y5IKmRV6D_g', tags: ['Mika', 'Shefali', 'Party'] },
      { title: 'Twist', artist: 'Love Aaj Kal', youtubeId: 'E4qy6M6P8BI', tags: ['Saif', 'Neeraj Shridhar', 'Dance'] },
      { title: 'Ainvayi Ainvayi', artist: 'Band Baaja Baaraat', youtubeId: 'pElk1ShPrcE', tags: ['Ranveer', 'Anushka', 'Wedding'] },
      { title: 'Chammak Challo', artist: 'Ra.One', youtubeId: 'M0ao7W3gqKo', tags: ['Akon', 'SRK', 'Kareena'] },
      { title: 'Masakali', artist: 'Delhi-6', youtubeId: 'SS3lIQdKP-A', tags: ['Sonam', 'Mohit Chauhan', 'AR Rahman'] },
      { title: 'Its The Time To Disco', artist: 'Kal Ho Naa Ho', youtubeId: 'tNrygABFb-w', tags: ['SRK', 'Preity', 'Saif'] },
      { title: 'Jhalak Dikhla Ja', artist: 'Aksar', youtubeId: 'Rrr7-QU_Rqc', tags: ['Himesh', 'Emraan Hashmi', 'Cap'] },
      { title: 'Lungi Dance', artist: 'Chennai Express', youtubeId: 'M5FKBiFLjuQ', tags: ['Honey Singh', 'SRK', 'Deepika'] },
      { title: 'Baby Doll', artist: 'Ragini MMS 2', youtubeId: '0e8-BNFk-4o', tags: ['Sunny Leone', 'Kanika Kapoor', 'Hit'] },
      { title: 'Badtameez Dil', artist: 'YJHD', youtubeId: 'II2EO3Nw4m0', tags: ['Ranbir', 'Deepika', 'Party'] },
    ]
  },

  'Late Night Vibes': {
    description: 'Soulful Shaan/KK - Songs for staring out of the window (2000-2010)',
    thumbnail: 'https://img.youtube.com/vi/L0zKs8i7Nc8/hqdefault.jpg',
    songs: [
      { title: 'Tanha Dil', artist: 'Shaan', youtubeId: 'hxsY2SHJZ-8', tags: ['Shaan', 'Travel', 'Nostalgia'] },
      { title: 'Chand Sifarish', artist: 'Fanaa', youtubeId: 'CiHB1RP7pz4', tags: ['Shaan', 'Kailash Kher', 'Aamir'] },
      { title: 'Jab Se Tere Naina', artist: 'Saawariya', youtubeId: 'HfzuqAp80pc', tags: ['Shaan', 'Ranbir', 'Romantic'] },
      { title: 'Agar Tum Saath Ho', artist: 'Tamasha', youtubeId: 'sK7riqg2mr4', tags: ['Arijit', 'Ranbir', 'Deepika'] },
      { title: 'Woh Ladki Hai Kahan', artist: 'Dil Chahta Hai', youtubeId: 'vhLiGCwLSu0', tags: ['Shaan', 'Saif', 'Goa'] },
      { title: 'Hey Shona', artist: 'Ta Ra Rum Pum', youtubeId: 'daTqCqXzkJ0', tags: ['Shaan', 'Sunidhi', 'Saif'] },
      { title: 'Ab Mujhe Raat Din', artist: 'Deewana', youtubeId: 'MZL5_gHLbWE', tags: ['Sonu Nigam', 'Album', '90s'] },
      { title: 'Suraj Hua Maddham', artist: 'K3G', youtubeId: 'L0zKs8i7Nc8', tags: ['Sonu Nigam', 'SRK', 'Kajol'] },
      { title: 'Tera Chehra', artist: 'Adnan Sami', youtubeId: 'zf14yYvfHTI', tags: ['Rani Mukerji', 'Piano', 'Melody'] },
      { title: 'Maula Mere Maula', artist: 'Anwar', youtubeId: 'Waf4LM2jM-4', tags: ['Roop Kumar Rathod', 'Sad', 'Eyes'] },
      { title: 'Pehli Nazar Mein', artist: 'Race', youtubeId: 'BadBAMnPX0I', tags: ['Atif Aslam', 'Guitar', 'Saif'] },
      { title: 'Aadat', artist: 'Jal / Atif Aslam', youtubeId: 'sGh4TRhwcsM', tags: ['Rock', 'Emo', 'Breakup'] },
      { title: 'Beete Lamhe', artist: 'The Train', youtubeId: 'rFzSVD9TdQE', tags: ['KK', 'Emraan Hashmi', 'Pain'] },
      { title: 'Zara Sa', artist: 'Jannat', youtubeId: '5IY4BNj0-10', tags: ['KK', 'Proposal', 'Emraan'] },
      { title: 'Tu Hi Meri Shab Hai', artist: 'Gangster', youtubeId: '4bZ5cHlG3ME', tags: ['KK', 'Kangana', 'Emraan'] },
      { title: 'O Sanam', artist: 'Lucky Ali', youtubeId: 'qrZHEoEIVJg', tags: ['Lucky Ali', 'Travel', 'Classic'] },
      { title: 'Kun Faya Kun', artist: 'Rockstar', youtubeId: 'T94PHkuydcw', tags: ['Mohit Chauhan', 'ARR', 'Sufi'] },
      { title: 'Emptiness (Tune Mere Jaana)', artist: 'Gajendra Verma', youtubeId: 'dCxECq2u0mk', tags: ['Viral', 'Sad', 'Internet'] },
    ]
  },

  'Retro Gold': {
    description: 'Remix & Hidden Gems - The music videos that defined the Remix Era on TV',
    thumbnail: 'https://img.youtube.com/vi/DJztXj2GPfk/hqdefault.jpg',
    songs: [
      { title: 'Kaanta Laga', artist: 'DJ Doll', youtubeId: 'fDykW3lF8uY', tags: ['Shefali Jariwala', 'Remix', 'Cult'] },
      { title: 'Kaliyon Ka Chaman', artist: 'Remix', youtubeId: 'B8t4BqHNsEM', tags: ['Item Song', 'Remix', 'Dance'] },
      { title: 'Saiyaan Dil Mein Aana Re', artist: 'Remix', youtubeId: 'EBVyXWEKJLI', tags: ['Old Remix', 'Cute', '2003'] },
      { title: 'Ankhiyan Milao', artist: 'Hard Kaur', youtubeId: 'Sv3S4SCBl-8', tags: ['Hard Kaur', 'Punjabi', 'Rap'] },
      { title: 'Rock Tha Party', artist: 'Bombay Rockers', youtubeId: 'kp5cDMFA9aE', tags: ['Rockers', 'English', 'Party'] },
      { title: 'Let The Music Play', artist: 'Shamur', youtubeId: 'VU3bRVVKOEc', tags: ['Mystery', 'Italian', 'Pop'] },
      { title: 'Ari Ari', artist: 'Bombay Rockers', youtubeId: 'AO6-Lv-1Xyo', tags: ['Dance', 'Punjabi', 'Rock'] },
      { title: 'Mundian To Bach Ke', artist: 'Panjabi MC', youtubeId: 'DJztXj2GPfk', tags: ['Global Hit', 'Bhangra', 'Classic'] },
      { title: 'Chhod Do Aanchal', artist: 'Bombay Vikings', youtubeId: 'TuMlW0pTOEo', tags: ['Remix', 'Retro', 'Fun'] },
      { title: 'Kya Surat Hai', artist: 'Bombay Vikings', youtubeId: 'JfAR_gRLLZU', tags: ['Neeraj Shridhar', '90s', 'Pop'] },
      { title: 'Angel Eyes', artist: 'Raghav', youtubeId: 'KJAcRdL_E7E', tags: ['Raghav', 'English-Hindi', 'Soft'] },
      { title: 'Bheegi Bheegi Raaton Mein', artist: 'Adnan Sami', youtubeId: 'kCQ6eDVLaak', tags: ['Adnan Sami', 'Rock', 'Rain'] },
      { title: 'Kangna', artist: 'Dr Zeus', youtubeId: 'gpAIwUCEcug', tags: ['Dr Zeus', 'Master Rakesh', 'UK'] },
      { title: 'Dance With You (Nachna Tere Naal)', artist: 'Jay Sean', youtubeId: '204R02eO8eM', tags: ['Jay Sean', 'Rishi Rich', 'Cool'] },
      { title: 'Kabhi Kabhi Aditi', artist: 'Jaane Tu Ya Jaane Na', youtubeId: 'HIuxLHCkNxY', tags: ['Rashid Ali', 'ARR', 'Youth'] },
    ]
  }
};

async function fetchVideoMetadata(youtubeId) {
  if (!YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY not configured');

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${encodeURIComponent(youtubeId)}&key=${YOUTUBE_API_KEY}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const item = data.items?.[0];
    
    if (!item) return null;
    if (item.status?.embeddable === false) return null;

    const duration = parseISODuration(item.contentDetails?.duration || 'PT0S');
    if (duration < 60 || duration > 900) return null;

    return {
      title: item.snippet.title,
      duration: duration,
      thumbnail: item.snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
      publishedAt: item.snippet.publishedAt
    };
  } catch (err) {
    console.error(`  ❌ Error fetching ${youtubeId}:`, err.message);
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
  console.log(`   ${channelData.songs.length} songs to validate`);
  
  const validVideos = [];
  const failed = [];
  
  for (let i = 0; i < channelData.songs.length; i++) {
    const song = channelData.songs[i];
    await new Promise(resolve => setTimeout(resolve, API_DELAY_MS));
    
    const metadata = await fetchVideoMetadata(song.youtubeId);
    
    if (metadata) {
      const yearMatch = metadata.title.match(/\b(19[89]\d|20[0-2]\d)\b/);
      const year = yearMatch ? parseInt(yearMatch[1]) : new Date(metadata.publishedAt).getFullYear();
      
      validVideos.push({
        title: song.title + (song.artist ? ` - ${song.artist}` : ''),
        youtubeId: song.youtubeId,
        duration: metadata.duration,
        year: year,
        tags: song.tags || [],
        category: channelName,
        thumbnail: metadata.thumbnail
      });
      
      console.log(`   ✅ [${i+1}/${channelData.songs.length}] ${song.title} (${metadata.duration}s)`);
    } else {
      failed.push(song);
      console.log(`   ❌ [${i+1}/${channelData.songs.length}] ${song.title} - FAILED`);
    }
  }
  
  return { validVideos, failed };
}

async function updateChannel(channelName, videos, channelData) {
  let channel = await Channel.findOne({ name: channelName });
  
  if (!channel) {
    console.log(`   Creating new channel: ${channelName}`);
    channel = new Channel({
      name: channelName,
      description: channelData.description,
      thumbnail: channelData.thumbnail,
      items: [],
      isActive: true
    });
  }

  channel.items = videos;
  channel.description = channelData.description;
  channel.thumbnail = channelData.thumbnail;
  
  await channel.save();
  console.log(`   ✅ Saved ${videos.length} videos to "${channelName}"`);
}

async function main() {
  console.log('🎬 DesiTV Curated Import Script');
  console.log('='.repeat(50));
  
  if (!YOUTUBE_API_KEY) {
    console.error('❌ YOUTUBE_API_KEY not set');
    process.exit(1);
  }
  
  console.log('📡 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected');
  
  const results = { total: 0, success: 0, failed: 0 };
  
  for (const [channelName, channelData] of Object.entries(CHANNELS_DATA)) {
    results.total += channelData.songs.length;
    
    const { validVideos, failed } = await processChannel(channelName, channelData);
    results.success += validVideos.length;
    results.failed += failed.length;
    
    if (validVideos.length > 0) {
      await updateChannel(channelName, validVideos, channelData);
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 IMPORT SUMMARY');
  console.log('='.repeat(50));
  console.log(`Total songs: ${results.total}`);
  console.log(`✅ Imported: ${results.success}`);
  console.log(`❌ Failed: ${results.failed}`);
  
  await mongoose.disconnect();
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
