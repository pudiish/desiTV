const express = require('express');
const router = express.Router();
const Channel = require('../models/Channel');
const cache = require('../utils/cache');
const { requireAuth } = require('../middleware/auth');
const { regenerateChannelsJSON } = require('../utils/generateJSON');
const { selectPlaylistForTime, getCurrentTimeSlot, getTimeSlotName } = require('../utils/timeBasedPlaylist');
const { getCachedPosition } = require('../utils/positionCalculator');

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
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const channels = await Channel.find().select('name playlistStartEpoch items').lean();
    
    // Cache the result
    await cache.set(cacheKey, channels, CACHE_TTL.CHANNELS_LIST);
    
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
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const ch = await Channel.findById(req.params.id).lean();
    if (!ch) return res.status(404).json({ message: 'Channel not found' });
    
    await cache.set(cacheKey, ch, CACHE_TTL.CHANNEL_DETAIL);
    res.json(ch);
  } catch (err) {
    console.error('GET /api/channels/:id error', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get current pseudo-live item + offset for a channel (enhanced with time-based playlists)
router.get('/:id/current', async (req, res) => {
  try {
    const ch = await Channel.findById(req.params.id).lean();
    if (!ch) return res.status(404).json({ message: 'Channel not found' });
    
    // Use new position calculator (supports time-based playlists, global epoch, and timezone)
    const position = await getCachedPosition(ch, null, req);
    
    res.json({
      ...position,
      channelId: ch._id,
      channelName: ch.name,
    });
  } catch (err) {
    console.error('GET /api/channels/:id/current error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get current position for a channel (alias for /current, backward compatible)
router.get('/:id/position', async (req, res) => {
  try {
    const ch = await Channel.findById(req.params.id).lean();
    if (!ch) return res.status(404).json({ message: 'Channel not found' });
    
    const position = await getCachedPosition(ch, null, req);
    
    res.json({
      ...position,
      channelId: ch._id,
      channelName: ch.name,
    });
  } catch (err) {
    console.error('GET /api/channels/:id/position error', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * POST /api/channels/:channelId/bulk-upload
 * Bulk upload videos from file content (admin - protected)
 * Accepts fileContent as string in formats:
 * - JSON array: [{"youtubeId": "...", "title": "..."}, ...]
 * - CSV: url,title (header row optional)
 * - TXT: Newline-separated YouTube URLs or video IDs
 * 
 * NOTE: This route must be defined before other /:id routes to ensure proper matching
 */
router.post('/:channelId/bulk-upload', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { fileContent } = req.body;

    if (!fileContent || typeof fileContent !== 'string') {
      return res.status(400).json({ 
        message: 'Missing or invalid fileContent' 
      });
    }

    // Find the channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Helper function to extract YouTube video ID from any text
    function extractVideoId(text) {
      if (!text) return null;
      text = text.trim();
      
      // If it's already an 11-character ID, return it
      if (/^[a-zA-Z0-9_-]{11}$/.test(text)) {
        return text;
      }
      
      // Try to extract from URL patterns anywhere in the text
      const patterns = [
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
        /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
      ];
      
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }
      return null;
    }

    // Helper function to extract ALL YouTube IDs from a line (handles multiple URLs per line)
    function extractAllVideoIds(text) {
      if (!text) return [];
      const ids = [];
      
      // Global pattern to find all YouTube URLs/IDs
      const globalPattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/g;
      let match;
      while ((match = globalPattern.exec(text)) !== null) {
        if (match[1] && !ids.includes(match[1])) {
          ids.push(match[1]);
        }
      }
      
      return ids;
    }

    // Helper function to fetch YouTube metadata using oEmbed (no API key required)
    async function fetchYouTubeMetadata(videoId) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(oembedUrl, { 
          signal: controller.signal,
          headers: { 'Accept': 'application/json' }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          return null;
        }
        
        const data = await response.json();
        return {
          title: data.title || 'Untitled',
          author: data.author_name
        };
      } catch (err) {
        // oEmbed failed, return null
        return null;
      }
    }

    // Parse file content based on format
    const videos = [];
    const lines = fileContent.trim().split('\n').filter(line => line.trim());

    // Try JSON format first
    if (fileContent.trim().startsWith('[') || fileContent.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(fileContent);
        const array = Array.isArray(parsed) ? parsed : [parsed];
        for (const item of array) {
          if (item.youtubeId || item.videoId || item.url) {
            const videoId = item.youtubeId || item.videoId || extractVideoId(item.url);
            if (videoId) {
              videos.push({
                youtubeId: videoId,
                title: item.title || 'Untitled',
                duration: item.duration || 30,
                year: item.year,
                tags: item.tags || [],
                category: item.category
              });
            }
          }
        }
      } catch (jsonErr) {
        // Not JSON, continue to other formats
      }
    }

    // If no videos parsed yet, try CSV or TXT format
    if (videos.length === 0) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue; // Skip empty lines and comments

        // Extract all YouTube IDs from this line (handles any format)
        const foundIds = extractAllVideoIds(trimmed);
        
        if (foundIds.length > 0) {
          // Found YouTube URLs in this line
          for (const videoId of foundIds) {
            videos.push({
              youtubeId: videoId,
              title: 'Untitled',
              duration: 30
            });
          }
        } else if (trimmed.includes(',')) {
          // Try CSV format: url,title or id,title
          const parts = trimmed.split(',').map(p => p.trim());
          if (parts.length >= 1) {
            const videoId = extractVideoId(parts[0]);
            if (videoId) {
              videos.push({
                youtubeId: videoId,
                title: parts[1] || 'Untitled',
                duration: 30
              });
            }
          }
        } else {
          // Try plain video ID
          const videoId = extractVideoId(trimmed);
          if (videoId) {
            videos.push({
              youtubeId: videoId,
              title: 'Untitled',
              duration: 30
            });
          }
        }
      }
    }

    if (videos.length === 0) {
      return res.status(400).json({ 
        message: 'No valid YouTube links found in file. Supported formats: JSON array, CSV (url,title), or text with YouTube URLs' 
      });
    }

    // Fetch metadata for videos - prefer oEmbed (no API key required), fallback to YouTube API
    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

    let addedCount = 0;
    let skippedCount = 0;
    let errors = [];

    for (const video of videos) {
      try {
        // Check if video already exists
        const exists = channel.items.some(item => item.youtubeId === video.youtubeId);
        if (exists) {
          skippedCount++;
          continue;
        }

        // If title is "Untitled", try to fetch metadata
        if (video.title === 'Untitled') {
          // First try oEmbed (free, no API key required)
          const oembedData = await fetchYouTubeMetadata(video.youtubeId);
          if (oembedData && oembedData.title) {
            video.title = oembedData.title;
          } else if (YOUTUBE_API_KEY) {
            // Fallback to YouTube Data API if oEmbed fails and API key is available
            try {
              const metadataUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${video.youtubeId}&key=${YOUTUBE_API_KEY}`;
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);
              
              const metadataRes = await fetch(metadataUrl, { 
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
              });
              
              clearTimeout(timeoutId);
              
              if (metadataRes.ok) {
                const data = await metadataRes.json();
                if (data.items && data.items[0]) {
                  video.title = data.items[0].snippet.title;
                // Parse duration if available
                  const durationStr = data.items[0].contentDetails?.duration;
                if (durationStr) {
                  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                  if (match) {
                    const hours = parseInt(match[1] || 0, 10);
                    const minutes = parseInt(match[2] || 0, 10);
                    const seconds = parseInt(match[3] || 0, 10);
                    video.duration = hours * 3600 + minutes * 60 + seconds;
                    }
                  }
                }
              }
            } catch (metadataErr) {
              // Continue with oEmbed title or default
              console.warn(`[Bulk Upload] YouTube API failed for ${video.youtubeId}:`, metadataErr.message);
            }
          }
        }

        // Add video to channel
        channel.items.push({
          title: video.title,
          youtubeId: video.youtubeId,
          duration: video.duration || 30,
          year: video.year,
          tags: video.tags || [],
          category: video.category
        });

        addedCount++;
      } catch (videoErr) {
        errors.push(`Error processing ${video.youtubeId}: ${videoErr.message}`);
      }
    }

    // Save channel if any videos were added
    if (addedCount > 0) {
      await channel.save();

      // Invalidate caches
      await cache.delete('channels:all');
      await cache.deletePattern(`channel:${channelId}`);

      // Regenerate channels.json
      try {
        await regenerateChannelsJSON();
      } catch (jsonErr) {
        console.error('[Channels] Failed to regenerate JSON:', jsonErr);
      }
    }

    res.json({ 
      message: `Successfully added ${addedCount} video(s)${skippedCount > 0 ? `, skipped ${skippedCount} duplicate(s)` : ''}`,
      count: addedCount,
      skipped: skippedCount,
      total: videos.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    console.error('POST /api/channels/:channelId/bulk-upload error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to bulk upload videos' });
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
  res.json(await cache.getStats());
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
