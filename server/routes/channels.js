const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel');
const cache = require('../utils/cache');

// Cache TTL constants (in seconds)
const CACHE_TTL = {
  CHANNELS_LIST: 30,     // Channel list cached for 30 seconds
  CHANNEL_DETAIL: 60,    // Single channel cached for 1 minute
  CURRENT_VIDEO: 5,      // Current video position cached for 5 seconds
};

function computePseudoLive(items, startEpoch) {
  if (!items || items.length === 0) return { item: null, offset: 0, index: -1 };
  const durations = items.map(i => i.duration || 30);
  const total = durations.reduce((a, b) => a + b, 0) || 1;
  const start = new Date(startEpoch).getTime();
  const now = Date.now();
  const elapsedTotal = Math.floor((now - start) / 1000);
  const elapsed = elapsedTotal % total;
  let cum = 0;
  for (let i = 0; i < items.length; i++) {
    const d = items[i].duration || 30;
    if (cum + d > elapsed) return { item: items[i], offset: elapsed - cum, index: i };
    cum += d;
  }
  return { item: items[0], offset: 0, index: 0 };
}

// List all channels (cached)
router.get('/', async (req, res) => {
  try {
    // Check cache first
    const cacheKey = 'channels:all';
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const channels = await Channel.find().select('name playlistStartEpoch items').lean();
    
    // Cache the result
    cache.set(cacheKey, channels, CACHE_TTL.CHANNELS_LIST);
    
    res.json(channels);
  } catch (err) {
    console.error('GET /api/channels error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get single channel (cached)
router.get('/:id', async (req, res) => {
  try {
    const cacheKey = `channel:${req.params.id}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const ch = await Channel.findById(req.params.id).lean();
    if (!ch) return res.status(404).json({ message: 'Channel not found' });
    
    cache.set(cacheKey, ch, CACHE_TTL.CHANNEL_DETAIL);
    res.json(ch);
  } catch (err) {
    console.error('GET /api/channels/:id error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current pseudo-live item + offset for a channel
router.get('/:id/current', async (req, res) => {
  try {
    // Short cache for current position
    const cacheKey = `channel:${req.params.id}:current`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const ch = await Channel.findById(req.params.id).lean();
    if (!ch) return res.status(404).json({ message: 'Channel not found' });
    const pl = computePseudoLive(ch.items || [], ch.playlistStartEpoch);
    
    cache.set(cacheKey, pl, CACHE_TTL.CURRENT_VIDEO);
    res.json(pl);
  } catch (err) {
    console.error('GET /api/channels/:id/current error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create channel (admin - no auth for simplified version)
router.post('/', async (req, res) => {
  try {
    const { name, playlistStartEpoch } = req.body;
    if (!name) return res.status(400).json({ message: 'Missing name' });
    const exists = await Channel.findOne({ name });
    if (exists) return res.status(400).json({ message: 'Channel already exists' });
    const ch = await Channel.create({ name, playlistStartEpoch });
    
    // Invalidate channels list cache
    cache.delete('channels:all');
    
    res.json(ch);
  } catch (err) {
    console.error('POST /api/channels error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add video to channel
router.post('/:channelId/videos', async (req, res) => {
  try {
    const { channelId } = req.params;
    const { title, youtubeId, duration, year, tags, category } = req.body;
    if (!youtubeId || !title) return res.status(400).json({ message: 'Missing youtubeId or title' });
    const ch = await Channel.findById(channelId);
    if (!ch) return res.status(404).json({ message: 'Channel not found' });
    ch.items.push({ title, youtubeId, duration: Number(duration) || 30, year, tags: tags || [], category });
    await ch.save();
    
    // Invalidate caches for this channel
    cache.delete('channels:all');
    cache.deletePattern(`channel:${channelId}`);
    
    res.json(ch);
  } catch (err) {
    console.error('POST /api/channels/:id/videos error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete video
router.delete('/:channelId/videos/:videoId', async (req, res) => {
  try {
    const { channelId, videoId } = req.params;
    console.log('Deleting video:', videoId, 'from channel:', channelId);
    
    if (!videoId) {
      return res.status(400).json({ message: 'Video ID is required' });
    }
    
    const ch = await Channel.findById(channelId);
    if (!ch) {
      console.warn('Channel not found:', channelId);
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Try to delete by _id first, then by youtubeId if _id fails
    let updatedChannel = await Channel.findByIdAndUpdate(
      channelId,
      { $pull: { items: { _id: videoId } } },
      { new: true }
    );
    
    // If no items were removed, try by youtubeId
    if (!updatedChannel || updatedChannel.items.length === ch.items.length) {
      console.log('Video not found by _id, trying by youtubeId:', videoId);
      updatedChannel = await Channel.findByIdAndUpdate(
        channelId,
        { $pull: { items: { youtubeId: videoId } } },
        { new: true }
      );
    }
    
    if (!updatedChannel) {
      console.warn('Failed to update channel:', channelId);
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Invalidate caches
    cache.delete('channels:all');
    cache.deletePattern(`channel:${channelId}`);
    
    console.log('Video deleted successfully:', videoId);
    res.json(updatedChannel);
  } catch (err) {
    console.error('DELETE /api/channels/:channelId/videos/:videoId error:', err.message, err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Delete channel
router.delete('/:channelId', async (req, res) => {
  try {
    const { channelId } = req.params;
    console.log('Attempting to delete channel:', channelId);
    const ch = await Channel.findByIdAndDelete(channelId);
    if (!ch) {
      console.warn('Channel not found:', channelId);
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Invalidate all caches
    cache.delete('channels:all');
    cache.deletePattern(`channel:${channelId}`);
    
    console.log('Channel deleted successfully:', channelId);
    res.json({ message: 'Channel deleted successfully', channel: ch });
  } catch (err) {
    console.error('DELETE /api/channels/:channelId error:', err.message, err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Get cache stats (admin)
router.get('/admin/cache-stats', async (req, res) => {
  res.json(cache.getStats());
});

module.exports = router;
