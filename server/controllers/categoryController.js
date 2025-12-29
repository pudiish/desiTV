/**
 * Category Controller
 * 
 * Handles HTTP requests/responses for category endpoints.
 * Delegates business logic to CategoryService.
 */

const categoryService = require('../services/categoryService');

class CategoryController {
  /**
   * GET /api/categories
   * Get all categories (unique) with counts
   */
  async getAllCategories(request, response) {
    try {
      const categories = await categoryService.getAllCategories();
      response.json(categories);
    } catch (error) {
      console.error('[CategoryController] GET error:', error);
      response.status(500).json({ error: 'Failed to get categories', details: error.message });
    }
  }

  /**
   * POST /api/categories
   * Add a category (no dedicated collection; returns success)
   */
  async createCategory(request, response) {
    try {
      const { name } = request.body;
      const result = await categoryService.createCategory(name);
      response.json(result);
    } catch (error) {
      if (error.message === 'Category name is required') {
        return response.status(400).json({ message: error.message });
      }
      console.error('[CategoryController] POST error:', error);
      response.status(500).json({ error: 'Failed to create category', details: error.message });
    }
  }

  /**
   * DELETE /api/categories/:name
   * Remove a category - removes category values from any videos using it
   */
  async removeCategory(request, response) {
    try {
      const { name } = request.params;
      const result = await categoryService.removeCategory(name);
      response.json(result);
    } catch (error) {
      if (error.message === 'Category name is required') {
        return response.status(400).json({ message: error.message });
      }
      console.error('[CategoryController] DELETE error:', error);
      response.status(500).json({ error: 'Failed to remove category', details: error.message });
    }
  }
}

module.exports = new CategoryController();


