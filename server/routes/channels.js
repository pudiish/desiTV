const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel');
const cache = require('../utils/cache');
const { requireAuth } = require('../middleware/auth');
const { regenerateChannelsJSON } = require('../utils/generateJSON');

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

// Create channel (admin - protected)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, playlistStartEpoch } = req.body;
    if (!name) return res.status(400).json({ message: 'Missing name' });
    const exists = await Channel.findOne({ name });
    if (exists) return res.status(400).json({ message: 'Channel already exists' });
    const ch = await Channel.create({ name, playlistStartEpoch });
    
    // Invalidate channels list cache
    cache.delete('channels:all');
    
    // Regenerate channels.json
    try {
      await regenerateChannelsJSON();
    } catch (jsonErr) {
      console.error('[Channels] Failed to regenerate JSON:', jsonErr);
    }
    
    res.json(ch);
  } catch (err) {
    console.error('POST /api/channels error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add video to channel (admin - protected)
router.post('/:channelId/videos', requireAuth, async (req, res) => {
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
    
    // Regenerate channels.json
    try {
      await regenerateChannelsJSON();
    } catch (jsonErr) {
      console.error('[Channels] Failed to regenerate JSON:', jsonErr);
    }
    
    res.json(ch);
  } catch (err) {
    console.error('POST /api/channels/:id/videos error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete video (admin - protected)
router.delete('/:channelId/videos/:videoId', requireAuth, async (req, res) => {
  try {
    const { channelId, videoId } = req.params;
    console.log(`[Channels] Admin "${req.admin.username}" deleting video: ${videoId} from channel: ${channelId}`);
    
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
    
    // Regenerate channels.json
    try {
      await regenerateChannelsJSON();
    } catch (jsonErr) {
      console.error('[Channels] Failed to regenerate JSON:', jsonErr);
    }
    
    res.json(updatedChannel);
  } catch (err) {
    console.error('DELETE /api/channels/:channelId/videos/:videoId error:', err.message, err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Delete channel (admin - protected)
router.delete('/:channelId', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params;
    console.log(`[Channels] Admin "${req.admin.username}" attempting to delete channel: ${channelId}`);
    const ch = await Channel.findByIdAndDelete(channelId);
    if (!ch) {
      console.warn('Channel not found:', channelId);
      return res.status(404).json({ message: 'Channel not found' });
    }
    
    // Invalidate all caches
    cache.delete('channels:all');
    cache.deletePattern(`channel:${channelId}`);
    
    // Regenerate channels.json
    try {
      await regenerateChannelsJSON();
    } catch (jsonErr) {
      console.error('[Channels] Failed to regenerate JSON:', jsonErr);
    }
    
    res.json({ message: 'Channel deleted successfully', channel: ch });
  } catch (err) {
    console.error('DELETE /api/channels/:channelId error:', err.message, err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

// Get cache stats (admin - protected)
router.get('/admin/cache-stats', requireAuth, async (req, res) => {
  res.json(cache.getStats());
});

/**
 * POST /api/channels/:id/add-video
 * Add a single video to a channel (admin - protected)
 */
router.post('/:id/add-video', requireAuth, async (req, res) => {
  try {
    const { title, youtubeId } = req.body;
    const channelId = req.params.id;

    if (!youtubeId || !title) {
      return res.status(400).json({ 
        message: 'Missing required fields: youtubeId, title' 
      });
    }

    // Find the channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Check if video already exists
    const exists = channel.items.some(item => item.youtubeId === youtubeId);
    if (exists) {
      return res.status(400).json({ message: 'Video already exists in this channel' });
    }

    // Add video to channel's items array
    const newVideo = {
      title,
      youtubeId,
      duration: 30
    };

    channel.items.push(newVideo);
    await channel.save();

    // Invalidate caches
    cache.delete('channels:all');
    cache.deletePattern(`channel:${channelId}`);

    // Regenerate channels.json
    try {
      await regenerateChannelsJSON();
    } catch (jsonErr) {
      console.error('[Channels] Failed to regenerate JSON:', jsonErr);
    }
    
    res.json({ 
      message: 'Video added successfully', 
      video: newVideo,
      channel 
    });
  } catch (err) {
    console.error('POST /api/channels/:id/add-video error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to add video' });
  }
});

/**
 * POST /api/channels/bulk-add-videos
 * Bulk import multiple videos (admin - protected)
 * Accepts array of videos with format:
 * { channelId, videoId, title, description?, thumbnail? }
 */
router.post('/bulk-add-videos', requireAuth, async (req, res) => {
  try {
    const { videos } = req.body;

    if (!Array.isArray(videos) || videos.length === 0) {
      return res.status(400).json({ 
        message: 'Please provide an array of videos' 
      });
    }

    let addedCount = 0;
    let errors = [];

    for (const video of videos) {
      try {
        const { channelId, videoId, title, description, thumbnail } = video;

        // Validate required fields
        if (!channelId || !videoId || !title) {
          errors.push(`Skipped: Missing required fields in video "${videoId}"`);
          continue;
        }

        // Find the channel
        const channel = await Channel.findById(channelId);
        if (!channel) {
          errors.push(`Skipped: Channel not found for video "${title}"`);
          continue;
        }

        // Check if video already exists
        const videoExists = channel.items.some(item => item._id === videoId);
        if (videoExists) {
          errors.push(`Skipped: Video "${title}" already exists in channel`);
          continue;
        }

        // Add video
        const newVideo = {
          _id: videoId,
          title,
          description: description || '',
          duration: 30, // Default duration
          thumbnail: thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
        };

        channel.items.push(newVideo);
        await channel.save();

        // Invalidate cache
        cache.deletePattern(`channel:${channelId}`);
        addedCount++;

      } catch (videoErr) {
        errors.push(`Error processing video: ${videoErr.message}`);
      }
    }

    // Invalidate main channel list cache
    cache.delete('channels:all');

    // Regenerate channels.json
    try {
      await regenerateChannelsJSON();
    } catch (jsonErr) {
      console.error('[Channels] Failed to regenerate JSON:', jsonErr);
    }

    res.json({ 
      message: `Successfully added ${addedCount} video(s)`,
      count: addedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('POST /api/channels/bulk-add-videos error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to bulk import videos' });
  }
});

module.exports = router;
