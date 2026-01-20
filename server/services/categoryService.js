/**
 * Category Service
 * 
 * Business logic for category operations.
 * Categories are derived from channel items (no dedicated collection).
 */

// MongoDB removed - using JSON instead
const { readChannelsJSON } = require('../utils/updateChannelsJSON');

class CategoryService {
  /**
   * Get all categories with video counts
   * Aggregates distinct categories from all channel items
   * @returns {Promise<Array>} Array of categories with counts
   */
  async getAllCategories() {
    // Read from JSON (source of truth) and aggregate categories
    const jsonData = readChannelsJSON();
    const channels = jsonData.channels || [];
    
    const categoryMap = new Map();
    
    // Aggregate categories from all channel items
    channels.forEach(channel => {
      if (channel.items && Array.isArray(channel.items)) {
        channel.items.forEach(item => {
          if (item.category) {
            const count = categoryMap.get(item.category) || 0;
            categoryMap.set(item.category, count + 1);
          }
        });
      }
    });
    
    // Convert to array format
    const categories = Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    return categories;
  }

  /**
   * Create a category (no dedicated collection; returns success)
   * Categories are used when adding videos, not stored separately
   * @param {string} categoryName - Category name
   * @returns {Promise<Object>} Category info
   */
  async createCategory(categoryName) {
    if (!categoryName) {
      throw new Error('Category name is required');
    }

    // Categories are not persisted globally - they exist when used in videos
    // Return success to allow admin to use category when adding videos
    return { name: categoryName };
  }

  /**
   * Remove a category - removes category values from all videos using it
   * @param {string} categoryName - Category name to remove
   * @returns {Promise<Object>} Removal result
   */
  async removeCategory(categoryName) {
    if (!categoryName) {
      throw new Error('Category name is required');
    }

    // Remove category field from any video item that matches (JSON-based)
    const { readChannelsJSON, writeChannelsJSON } = require('../utils/updateChannelsJSON');
    const jsonData = readChannelsJSON();
    let updated = false;
    
    jsonData.channels.forEach(channel => {
      if (channel.items && Array.isArray(channel.items)) {
        channel.items.forEach(item => {
          if (item.category === categoryName) {
            item.category = null;
            updated = true;
          }
        });
      }
    });
    
    if (updated) {
      writeChannelsJSON(jsonData);
    }

    return { removed: categoryName };
  }
}

module.exports = new CategoryService();


