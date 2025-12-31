const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Channel = require('../models/Channel');

// Simple categories collection maintained on-the-fly from channels/videos.
// For convenience, we store categories in-memory derived from existing data,
// and also support CRUD via a lightweight approach using Channel documents
// Get all categories (unique) with counts
router.get('/', async (req, res) => {
  // collect distinct categories from all channel items with counts
  const cats = await Channel.aggregate([
    { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
    { $match: { 'items.category': { $ne: null } } },
    { $group: { _id: '$items.category', count: { $sum: 1 } } },
    { $project: { name: '$_id', count: 1, _id: 0 } },
    { $sort: { name: 1 } }
  ]);
  res.json(cats);
});

// Add a category (no dedicated collection; returns success)
router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ message: 'Missing name' });
  // nothing to persist globally; we return success and let admin use category when adding videos
  res.json({ name });
});

// Remove a category - this will remove category values from any videos using it
router.delete('/:name', async (req, res) => {
  const name = req.params.name;
  if (!name) return res.status(400).json({ message: 'Missing name' });
  // Remove category field from any item that matches
  await Channel.updateMany({ 'items.category': name }, { $set: { 'items.$[elem].category': null } }, { arrayFilters: [{ 'elem.category': name }], multi: true });
  res.json({ removed: name });
});

module.exports = router;
