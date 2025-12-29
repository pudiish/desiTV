/**
 * Global Epoch Service
 * 
 * Business logic for global epoch operations.
 * Handles epoch retrieval, caching, and reset operations.
 */

const GlobalEpoch = require('../models/GlobalEpoch');
const cache = require('../utils/cache');
const { addChecksum } = require('../utils/checksum');

// Cache TTL for global epoch (2 hours - optimized for free tier)
// Epoch never changes, so long cache is safe and reduces DB queries
const EPOCH_CACHE_TTL = 7200; // 2 hours in seconds
const CACHE_KEY = 'ge'; // Shortened from 'global-epoch' (saves 11 bytes per key)

class GlobalEpochService {
  /**
   * Get the current global epoch with caching
   * @returns {Promise<Object>} Global epoch with checksum and metadata
   */
  async getGlobalEpoch() {
    // Try cache first
    const cached = await cache.get(CACHE_KEY);
    if (cached) {
      const epochDate = new Date(cached.epoch || cached.e);
      const checksumData = addChecksum(epochDate.toISOString(), 'epoch');
      
      return {
        epoch: epochDate,
        timezone: cached.timezone || cached.tz || 'Asia/Kolkata',
        createdAt: cached.createdAt || epochDate,
        cached: true,
        ...checksumData, // Include checksum
      };
    }

    // Get or create global epoch from database
    const globalEpoch = await GlobalEpoch.getOrCreate();
    
    // Prepare minimal cached data for free tier optimization
    // Use single-letter keys to save memory
    const cacheData = {
      e: globalEpoch.epoch.toISOString(), // 'e' = epoch (saves 4 bytes)
      tz: globalEpoch.timezone || 'Asia/Kolkata', // 'tz' = timezone (saves 6 bytes)
      // Backward compatibility
      epoch: globalEpoch.epoch.toISOString(),
      timezone: globalEpoch.timezone || 'Asia/Kolkata',
    };
    
    // Cache for 2 hours
    await cache.set(CACHE_KEY, cacheData, EPOCH_CACHE_TTL);
    
    // Add checksum for silent background sync
    const checksumData = addChecksum(globalEpoch.epoch.toISOString(), 'epoch');
    
    return {
      epoch: globalEpoch.epoch,
      timezone: globalEpoch.timezone || 'Asia/Kolkata',
      createdAt: globalEpoch.createdAt,
      cached: false,
      ...checksumData, // Include checksum
    };
  }

  /**
   * Reset the global epoch (admin only - use with extreme caution!)
   * This will affect ALL users - only use if absolutely necessary
   * @returns {Promise<Object>} New epoch with warning message
   */
  async resetGlobalEpoch() {
    // Delete existing global epoch
    await GlobalEpoch.deleteOne({ _id: 'global' });
    
    // Clear cache
    await cache.delete(CACHE_KEY);
    
    // Create new epoch
    const newEpoch = await GlobalEpoch.getOrCreate();
    
    return {
      success: true,
      message: 'Global epoch reset successfully',
      epoch: newEpoch.epoch,
      warning: 'All users will now sync to new timeline',
    };
  }
}

module.exports = new GlobalEpochService();


