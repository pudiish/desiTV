/**
 * Generate channels.json from MongoDB
 * This is the primary data source for the client
 * Admin updates MongoDB → this generates JSON → client consumes JSON
 */

const fs = require('fs');
const path = require('path');
const Channel = require('../models/Channel');

const JSON_OUTPUT_PATH = path.resolve(__dirname, '../../client/public/data/channels.json');
const JSON_OUTPUT_DIR = path.dirname(JSON_OUTPUT_PATH);

/**
 * Ensure data directory exists
 */
function ensureDataDirectory() {
  if (!fs.existsSync(JSON_OUTPUT_DIR)) {
    fs.mkdirSync(JSON_OUTPUT_DIR, { recursive: true });
  }
}

/**
 * Check if channels.json is empty or invalid
 * @returns {Promise<boolean>} True if JSON needs to be regenerated
 */
async function isJSONEmptyOrInvalid() {
  try {
    if (!fs.existsSync(JSON_OUTPUT_PATH)) {
      return true; // File doesn't exist
    }

    const fileContent = fs.readFileSync(JSON_OUTPUT_PATH, 'utf8');
    if (!fileContent || fileContent.trim().length === 0) {
      return true; // File is empty
    }

    const data = JSON.parse(fileContent);
    
    // Check if channels array is empty or missing
    if (!data.channels || !Array.isArray(data.channels) || data.channels.length === 0) {
      return true; // No channels in JSON
    }

    return false; // JSON is valid and has channels
  } catch (error) {
    // JSON is invalid or corrupted
    return true;
  }
}

/**
 * Ensure channels.json exists and is populated
 * Fetches from MongoDB if JSON is empty
 * @returns {Promise<Object>} Generated channels data
 */
async function ensureChannelsJSON() {
  try {
    const needsRegeneration = await isJSONEmptyOrInvalid();
    
    if (needsRegeneration) {
      console.log('[generateJSON] channels.json is empty or invalid, fetching from MongoDB...');
      return await generateChannelsJSON();
    }

    // JSON exists and is valid, return it
    const fileContent = fs.readFileSync(JSON_OUTPUT_PATH, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error('[generateJSON] Error ensuring channels.json:', error);
    // Try to generate anyway
    return await generateChannelsJSON();
  }
}

/**
 * Generate channels.json from MongoDB
 * @returns {Promise<Object>} Generated channels data
 */
async function generateChannelsJSON() {
  try {
    ensureDataDirectory();

    // Fetch all channels from MongoDB
    const channels = await Channel.find()
      .select('name playlistStartEpoch items')
      .lean();

    // Transform to client-friendly format
    const channelsData = channels.map(channel => ({
      _id: channel._id.toString(),
      name: channel.name,
      playlistStartEpoch: channel.playlistStartEpoch,
      items: channel.items.map(item => ({
        _id: item._id?.toString() || null,
        title: item.title,
        youtubeId: item.youtubeId,
        duration: item.duration || 30,
        year: item.year || null,
        tags: item.tags || [],
        category: item.category || null,
      })),
    }));

    // Create JSON structure
    const jsonData = {
      version: Date.now(), // Timestamp for cache busting
      generatedAt: new Date().toISOString(),
      channels: channelsData,
    };

    // Write to file
    fs.writeFileSync(JSON_OUTPUT_PATH, JSON.stringify(jsonData, null, 2), 'utf8');

    return jsonData;
  } catch (error) {
    console.error('[generateJSON] Error generating channels.json:', error);
    throw error;
  }
}

/**
 * Generate JSON and return result
 * Used by admin routes after channel updates
 */
async function regenerateChannelsJSON() {
  try {
    const result = await generateChannelsJSON();
    console.log(`[generateJSON] Generated channels.json with ${result.channels.length} channels`);
    return result;
  } catch (error) {
    console.error('[generateJSON] Failed to regenerate JSON:', error);
    throw error;
  }
}

module.exports = {
  generateChannelsJSON,
  regenerateChannelsJSON,
  ensureChannelsJSON,
  isJSONEmptyOrInvalid,
  JSON_OUTPUT_PATH,
};

