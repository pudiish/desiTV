const express = require('express');
const router = express.Router();
// MongoDB removed - using JSON instead
const { readChannelsJSON, writeChannelsJSON } = require('../utils/updateChannelsJSON');
const { requireAuth } = require('../middleware/auth');

// Simple categories collection maintained on-the-fly from channels/videos.
// For convenience, we store categories in-memory derived from existing data,
// and also support CRUD via a lightweight approach using Channel documents
// Get all categories (unique) with counts
router.get('/', async (req, res) => {
  try {
    // Collect distinct categories from all channel items with counts
    const jsonData = readChannelsJSON();
    const categoryCounts = {};
    
    jsonData.channels.forEach(channel => {
      if (channel.items && Array.isArray(channel.items)) {
        channel.items.forEach(item => {
          if (item.category) {
            categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
          }
        });
      }
    });
    
    const cats = Object.entries(categoryCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
    
    res.json(cats);
  } catch (err) {
    console.error('[Categories] Error getting categories:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a category (no dedicated collection; returns success)
router.post('/', requireAuth, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Missing name' });
  // nothing to persist globally; we return success and let admin use category when adding videos
  res.json({ name });
});

// Remove a category - this will remove category values from any videos using it
router.delete('/:name', requireAuth, async (req, res) => {
  try {
    const name = req.params.name;
    if (!name) return res.status(400).json({ message: 'Missing name' });
    
    // Remove category field from any item that matches
    const jsonData = readChannelsJSON();
    let updated = false;
    
    jsonData.channels.forEach(channel => {
      if (channel.items && Array.isArray(channel.items)) {
        channel.items.forEach(item => {
          if (item.category === name) {
            item.category = null;
            updated = true;
          }
        });
      }
    });
    
    if (updated) {
      writeChannelsJSON(jsonData);
    }
    
    res.json({ removed: name });
  } catch (err) {
    console.error('[Categories] Error removing category:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
