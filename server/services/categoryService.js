/**
 * Category Service
 * 
 * Business logic for category operations.
 * Categories are derived from channel items (no dedicated collection).
 */

const Channel = require('../models/Channel');

class CategoryService {
  /**
   * Get all categories with video counts
   * Aggregates distinct categories from all channel items
   * @returns {Promise<Array>} Array of categories with counts
   */
  async getAllCategories() {
    const categories = await Channel.aggregate([
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
      { $match: { 'items.category': { $ne: null } } },
      { $group: { _id: '$items.category', count: { $sum: 1 } } },
      { $project: { name: '$_id', count: 1, _id: 0 } },
      { $sort: { name: 1 } }
    ]);

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

    // Remove category field from any video item that matches
    await Channel.updateMany(
      { 'items.category': categoryName },
      { $set: { 'items.$[elem].category': null } },
      { 
        arrayFilters: [{ 'elem.category': categoryName }],
        multi: true
      }
    );

    return { removed: categoryName };
  }
}

module.exports = new CategoryService();


