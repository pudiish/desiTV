/**
 * GlobalEpoch JSON - Replaces MongoDB GlobalEpoch model
 * 
 * Single source of truth for broadcast timeline across ALL users
 * This ensures everyone sees the same content at the same time - true synchronization
 * 
 * CRITICAL: Only ONE epoch should exist (stored in JSON file)
 * This epoch is set once and NEVER changes - it's the reference point for all channels
 */

const fs = require('fs');
const path = require('path');

const EPOCH_JSON_PATH = path.resolve(__dirname, '../../globalEpoch.json');
const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/**
 * Read global epoch from JSON file
 * @returns {Object} Global epoch object
 */
function readGlobalEpoch() {
  try {
    if (!fs.existsSync(EPOCH_JSON_PATH)) {
      // First time - create the global epoch with current server time
      const serverStartEpoch = new Date();
      const globalEpoch = {
        _id: 'global',
        epoch: serverStartEpoch.toISOString(),
        timezone: DEFAULT_TIMEZONE,
        createdAt: serverStartEpoch.toISOString()
      };
      
      // Write to file
      fs.writeFileSync(EPOCH_JSON_PATH, JSON.stringify(globalEpoch, null, 2), 'utf8');
      console.log('[GlobalEpoch] Created global epoch at server start:', globalEpoch.epoch);
      
      return globalEpoch;
    }

    const fileContent = fs.readFileSync(EPOCH_JSON_PATH, 'utf8');
    if (!fileContent || fileContent.trim().length === 0) {
      // File exists but is empty - recreate
      const serverStartEpoch = new Date();
      const globalEpoch = {
        _id: 'global',
        epoch: serverStartEpoch.toISOString(),
        timezone: DEFAULT_TIMEZONE,
        createdAt: serverStartEpoch.toISOString()
      };
      
      fs.writeFileSync(EPOCH_JSON_PATH, JSON.stringify(globalEpoch, null, 2), 'utf8');
      console.log('[GlobalEpoch] Recreated global epoch:', globalEpoch.epoch);
      
      return globalEpoch;
    }

    const globalEpoch = JSON.parse(fileContent);
    
    // Ensure required fields
    if (!globalEpoch.epoch) {
      const serverStartEpoch = new Date();
      globalEpoch.epoch = serverStartEpoch.toISOString();
      globalEpoch.timezone = globalEpoch.timezone || DEFAULT_TIMEZONE;
      globalEpoch.createdAt = globalEpoch.createdAt || serverStartEpoch.toISOString();
      
      fs.writeFileSync(EPOCH_JSON_PATH, JSON.stringify(globalEpoch, null, 2), 'utf8');
    }
    
    return globalEpoch;
  } catch (error) {
    console.error('[GlobalEpoch] Error reading epoch:', error);
    // Fallback: return a default epoch
    const serverStartEpoch = new Date();
    return {
      _id: 'global',
      epoch: serverStartEpoch.toISOString(),
      timezone: DEFAULT_TIMEZONE,
      createdAt: serverStartEpoch.toISOString()
    };
  }
}

/**
 * Write global epoch to JSON file
 * @param {Object} globalEpoch - Global epoch object
 */
function writeGlobalEpoch(globalEpoch) {
  try {
    fs.writeFileSync(EPOCH_JSON_PATH, JSON.stringify(globalEpoch, null, 2), 'utf8');
  } catch (error) {
    console.error('[GlobalEpoch] Error writing epoch:', error);
    throw error;
  }
}

/**
 * Get or create global epoch (MongoDB-compatible API)
 * @returns {Promise<Object>} Global epoch object with Date objects
 */
async function getOrCreate() {
  const globalEpoch = readGlobalEpoch();
  
  // Convert ISO strings to Date objects for compatibility
  return {
    _id: globalEpoch._id,
    epoch: new Date(globalEpoch.epoch),
    timezone: globalEpoch.timezone || DEFAULT_TIMEZONE,
    createdAt: new Date(globalEpoch.createdAt || globalEpoch.epoch)
  };
}

/**
 * Reset global epoch (admin only)
 * @returns {Promise<Object>} New global epoch object
 */
async function reset() {
  const serverStartEpoch = new Date();
  const globalEpoch = {
    _id: 'global',
    epoch: serverStartEpoch.toISOString(),
    timezone: DEFAULT_TIMEZONE,
    createdAt: serverStartEpoch.toISOString()
  };
  
  writeGlobalEpoch(globalEpoch);
  console.log('[GlobalEpoch] Reset global epoch:', globalEpoch.epoch);
  
  return {
    _id: globalEpoch._id,
    epoch: new Date(globalEpoch.epoch),
    timezone: globalEpoch.timezone,
    createdAt: new Date(globalEpoch.createdAt)
  };
}

/**
 * Get current epoch (cached for performance)
 * @returns {Promise<Date>} Current epoch date
 */
async function getCurrentEpoch() {
  const globalEpoch = await getOrCreate();
  return globalEpoch.epoch;
}

module.exports = {
  getOrCreate,
  reset,
  getCurrentEpoch,
  // MongoDB-compatible static methods
  getOrCreateStatic: getOrCreate,
  resetStatic: reset,
  getCurrentEpochStatic: getCurrentEpoch
};
