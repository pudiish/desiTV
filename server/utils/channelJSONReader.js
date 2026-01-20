/**
 * Channel JSON Reader - Read channels from JSON file (replaces MongoDB queries)
 * This provides MongoDB-like query methods but reads from channels.json
 */

const { readChannelsJSON } = require('./updateChannelsJSON');

/**
 * Get all channels (replaces Channel.find())
 * @param {Object} query - MongoDB-style query (simplified support)
 * @param {Object} projection - Fields to select (simplified support)
 * @returns {Promise<Array>} Array of channels
 */
async function findChannels(query = {}, projection = null) {
  try {
    const jsonData = readChannelsJSON();
    let channels = jsonData.channels || [];

    // Simple query support
    if (query.items) {
      // Support $exists and $ne operators
      if (query.items.$exists !== undefined && query.items.$ne !== undefined) {
        if (query.items.$exists === true && query.items.$ne === []) {
          // Find channels with non-empty items array
          channels = channels.filter(ch => ch.items && Array.isArray(ch.items) && ch.items.length > 0);
        }
      }
    }

    if (query.isActive !== undefined) {
      // Filter by isActive (if field exists, otherwise include all)
      channels = channels.filter(ch => query.isActive === undefined || ch.isActive === query.isActive || ch.isActive === undefined);
    }

    // Simple projection support (select specific fields)
    if (projection) {
      if (typeof projection === 'string') {
        // Handle string projections like "name description _id"
        const fields = projection.split(' ').filter(f => f);
        channels = channels.map(ch => {
          const result = {};
          fields.forEach(field => {
            if (field === '_id' || field === 'name' || field === 'description') {
              result[field] = ch[field];
            }
          });
          return result;
        });
      } else if (typeof projection === 'object') {
        // Handle object projections like { name: 1, description: 1 }
        channels = channels.map(ch => {
          const result = {};
          Object.keys(projection).forEach(field => {
            if (projection[field] === 1 && ch[field] !== undefined) {
              result[field] = ch[field];
            }
          });
          return result;
        });
      }
    }

    return channels;
  } catch (error) {
    console.error('[channelJSONReader] Error reading channels:', error);
    return [];
  }
}

/**
 * Find one channel (replaces Channel.findOne())
 * @param {Object} query - MongoDB-style query
 * @returns {Promise<Object|null>} Channel or null
 */
async function findOneChannel(query = {}) {
  try {
    const jsonData = readChannelsJSON();
    let channels = jsonData.channels || [];

    // Find by _id
    if (query._id) {
      const channel = channels.find(ch => ch._id === query._id || ch._id?.toString() === query._id?.toString());
      return channel || null;
    }

    // Find by name
    if (query.name) {
      const channel = channels.find(ch => ch.name === query.name || ch.name?.toLowerCase() === query.name?.toLowerCase());
      return channel || null;
    }

    // Find by other fields
    for (const channel of channels) {
      let matches = true;
      for (const key in query) {
        if (query[key] !== undefined && channel[key] !== query[key]) {
          matches = false;
          break;
        }
      }
      if (matches) return channel;
    }

    return null;
  } catch (error) {
    console.error('[channelJSONReader] Error finding channel:', error);
    return null;
  }
}

/**
 * Find channel by ID (replaces Channel.findById())
 * @param {string} id - Channel ID
 * @returns {Promise<Object|null>} Channel or null
 */
async function findChannelById(id) {
  try {
    const jsonData = readChannelsJSON();
    const channels = jsonData.channels || [];
    return channels.find(ch => ch._id === id || ch._id?.toString() === id?.toString()) || null;
  } catch (error) {
    console.error('[channelJSONReader] Error finding channel by ID:', error);
    return null;
  }
}

/**
 * Get all channels with items flattened (for semantic search)
 * @returns {Promise<Array>} Array of all videos from all channels
 */
async function getAllSongs() {
  try {
    const jsonData = readChannelsJSON();
    const channels = jsonData.channels || [];
    const allSongs = [];

    channels.forEach(channel => {
      if (channel.items && Array.isArray(channel.items)) {
        channel.items.forEach(item => {
          allSongs.push({
            ...item,
            channelId: channel._id,
            channelName: channel.name
          });
        });
      }
    });

    return allSongs;
  } catch (error) {
    console.error('[channelJSONReader] Error getting all songs:', error);
    return [];
  }
}

module.exports = {
  findChannels,
  findOneChannel,
  findChannelById,
  getAllSongs,
  // Alias for compatibility
  find: findChannels,
  findOne: findOneChannel,
  findById: findChannelById,
};
