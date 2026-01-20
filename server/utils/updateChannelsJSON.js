/**
 * Update channels.json directly (JSON is the source of truth)
 * This allows modifying the JSON file on-the-fly without regenerating from MongoDB
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Generate a unique ID (similar to MongoDB ObjectId format)
 * Returns a 24-character hex string
 */
function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

const JSON_OUTPUT_PATH = path.resolve(__dirname, '../../client/public/data/channels.json');
const ROOT_JSON_PATH = path.resolve(__dirname, '../../channels.json');

/**
 * Ensure data directory exists
 */
function ensureDataDirectory() {
  const dir = path.dirname(JSON_OUTPUT_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Read current channels.json
 * @returns {Promise<Object>} Current channels data
 */
function readChannelsJSON() {
  try {
    ensureDataDirectory();
    
    if (!fs.existsSync(JSON_OUTPUT_PATH)) {
      // Return empty structure if file doesn't exist
      return {
        version: Date.now(),
        generatedAt: new Date().toISOString(),
        channels: []
      };
    }

    const fileContent = fs.readFileSync(JSON_OUTPUT_PATH, 'utf8');
    if (!fileContent || fileContent.trim().length === 0) {
      return {
        version: Date.now(),
        generatedAt: new Date().toISOString(),
        channels: []
      };
    }

    return JSON.parse(fileContent);
  } catch (error) {
    console.error('[updateChannelsJSON] Error reading channels.json:', error);
    throw error;
  }
}

/**
 * Write channels.json to both locations
 * @param {Object} jsonData - Channels data to write
 */
function writeChannelsJSON(jsonData) {
  try {
    ensureDataDirectory();

    // Update version and timestamp
    jsonData.version = Date.now();
    jsonData.generatedAt = new Date().toISOString();

    const jsonString = JSON.stringify(jsonData, null, 2);

    // Write to client/public/data/channels.json
    fs.writeFileSync(JSON_OUTPUT_PATH, jsonString, 'utf8');
    
    // Also write to root channels.json
    fs.writeFileSync(ROOT_JSON_PATH, jsonString, 'utf8');

    console.log(`[updateChannelsJSON] Updated channels.json with ${jsonData.channels.length} channels`);
    return jsonData;
  } catch (error) {
    console.error('[updateChannelsJSON] Error writing channels.json:', error);
    throw error;
  }
}

/**
 * Add a new channel to channels.json
 * @param {string} name - Channel name
 * @param {Date|string} playlistStartEpoch - Optional start epoch
 * @returns {Promise<Object>} Created channel
 */
function addChannelToJSON(name, playlistStartEpoch = null) {
  try {
    const jsonData = readChannelsJSON();
    
    // Check if channel already exists
    const exists = jsonData.channels.some(ch => ch.name === name);
    if (exists) {
      throw new Error('Channel already exists');
    }

    // Create new channel
    const newChannel = {
      _id: generateId(),
      name,
      playlistStartEpoch: playlistStartEpoch || '2020-01-01T00:00:00.000Z',
      items: [],
      timeBasedPlaylists: {
        morning: [],
        lateMorning: [],
        afternoon: [],
        evening: [],
        primeTime: [],
        night: [],
        lateNight: []
      },
      dayBasedPlaylists: {
        weekday: {
          morning: [],
          lateMorning: [],
          afternoon: [],
          evening: [],
          primeTime: [],
          night: [],
          lateNight: []
        },
        saturday: {
          morning: [],
          lateMorning: [],
          afternoon: [],
          evening: [],
          primeTime: [],
          night: [],
          lateNight: []
        },
        sunday: {
          morning: [],
          lateMorning: [],
          afternoon: [],
          evening: [],
          primeTime: [],
          night: [],
          lateNight: []
        }
      }
    };

    jsonData.channels.push(newChannel);
    writeChannelsJSON(jsonData);

    return newChannel;
  } catch (error) {
    console.error('[updateChannelsJSON] Error adding channel:', error);
    throw error;
  }
}

/**
 * Add a video to a channel in channels.json
 * @param {string} channelId - Channel ID
 * @param {Object} videoData - Video data (title, youtubeId, duration, year, tags, category)
 * @returns {Promise<Object>} Updated channel
 */
function addVideoToChannelJSON(channelId, videoData) {
  try {
    const jsonData = readChannelsJSON();
    
    const channel = jsonData.channels.find(ch => ch._id === channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    // Check if video already exists
    const exists = channel.items.some(item => item.youtubeId === videoData.youtubeId);
    if (exists) {
      throw new Error('Video already exists in this channel');
    }

    // Create new video item
    const newVideo = {
      _id: generateId(),
      title: videoData.title,
      youtubeId: videoData.youtubeId,
      duration: Number(videoData.duration) || 30,
      year: videoData.year || null,
      tags: videoData.tags || [],
      category: videoData.category || null,
    };

    channel.items.push(newVideo);
    writeChannelsJSON(jsonData);

    return channel;
  } catch (error) {
    console.error('[updateChannelsJSON] Error adding video:', error);
    throw error;
  }
}

/**
 * Delete a video from a channel in channels.json
 * @param {string} channelId - Channel ID
 * @param {string} videoId - Video ID
 * @returns {Promise<Object>} Updated channel
 */
function deleteVideoFromChannelJSON(channelId, videoId) {
  try {
    const jsonData = readChannelsJSON();
    
    const channel = jsonData.channels.find(ch => ch._id === channelId);
    if (!channel) {
      throw new Error('Channel not found');
    }

    const videoIndex = channel.items.findIndex(item => item._id === videoId);
    if (videoIndex === -1) {
      throw new Error('Video not found');
    }

    channel.items.splice(videoIndex, 1);
    writeChannelsJSON(jsonData);

    return channel;
  } catch (error) {
    console.error('[updateChannelsJSON] Error deleting video:', error);
    throw error;
  }
}

/**
 * Delete a channel from channels.json
 * @param {string} channelId - Channel ID
 * @returns {Promise<Object>} Deleted channel
 */
function deleteChannelFromJSON(channelId) {
  try {
    const jsonData = readChannelsJSON();
    
    const channelIndex = jsonData.channels.findIndex(ch => ch._id === channelId);
    if (channelIndex === -1) {
      throw new Error('Channel not found');
    }

    const deletedChannel = jsonData.channels[channelIndex];
    jsonData.channels.splice(channelIndex, 1);
    writeChannelsJSON(jsonData);

    return deletedChannel;
  } catch (error) {
    console.error('[updateChannelsJSON] Error deleting channel:', error);
    throw error;
  }
}

/**
 * Sync channels.json to MongoDB (removed - JSON is now source of truth)
 * This function is kept for backward compatibility but does nothing
 */
async function syncJSONToMongoDB() {
  // MongoDB sync removed - JSON is the source of truth
  console.log('[updateChannelsJSON] MongoDB sync skipped - JSON is source of truth');
  return [];
}

module.exports = {
  readChannelsJSON,
  writeChannelsJSON,
  addChannelToJSON,
  addVideoToChannelJSON,
  deleteVideoFromChannelJSON,
  deleteChannelFromJSON,
  syncJSONToMongoDB,
  JSON_OUTPUT_PATH,
  ROOT_JSON_PATH,
};
