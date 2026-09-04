/**
 * Channel Routes - MongoDB + Cache + WebSocket Push
 * 
 * Architecture:
 * - GET requests: Read from cache (fast) → MongoDB (cache miss)
 * - POST/PUT/DELETE: Write to MongoDB → Invalidate cache → Push to clients
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ChannelDataService = require('../services/ChannelDataService');

// ============================================
// READ ENDPOINTS (Cached)
// ============================================

/**
 * GET /api/channels - Get all channels
 * Served from cache, falls back to MongoDB
 */
router.get('/', async (req, res) => {
  try {
    const result = await ChannelDataService.getAllChannels();
    res.json(result);
  } catch (err) {
    console.error('GET /api/channels error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

/**
 * GET /api/channels/:id - Get single channel
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await ChannelDataService.getChannelById(req.params.id);
    res.json(result);
  } catch (err) {
    if (err.message === 'Channel not found') {
      return res.status(404).json({ message: 'Channel not found' });
    }
    console.error('GET /api/channels/:id error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * GET /api/channels/:id/current - what is playing on this channel right now
 * GET /api/channels/:id/position - alias
 *
 * Computed with the same shared function the player uses, so the answer here
 * always matches what a viewer is watching.
 */
async function respondWithPosition(req, res) {
  try {
    const result = await ChannelDataService.getChannelById(req.params.id);
    const channel = result.data || result;

    const { positionAt } = await import('../../shared/broadcastPosition.js');
    const items = channel.items || [];
    const live = positionAt(Date.now(), new Date(channel.playlistStartEpoch).getTime(), items);

    if (!live.isValid) {
      return res.status(409).json({ message: 'Channel has no playable videos' });
    }

    const item = items[live.videoIndex];

    res.json({
      channelId: channel._id,
      channelName: channel.name,
      videoIndex: live.videoIndex,
      offset: live.offset,
      cyclePosition: live.cyclePosition,
      totalDuration: live.totalDuration,
      item,
      timeRemaining: Math.max(0, (item?.duration || 0) - live.offset),
      serverTimeMs: Date.now(),
    });
  } catch (err) {
    if (err.message === 'Channel not found') {
      return res.status(404).json({ message: 'Channel not found' });
    }
    console.error(`GET ${req.originalUrl} error:`, err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
}

router.get('/:id/current', respondWithPosition);
router.get('/:id/position', respondWithPosition);

/**
 * GET /api/channels/admin/cache-stats - Get cache statistics
 */
router.get('/admin/cache-stats', requireAuth, async (req, res) => {
  try {
    const stats = await ChannelDataService.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ============================================
// WRITE ENDPOINTS (MongoDB + Push)
// ============================================

/**
 * POST /api/channels - Create new channel
 */
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, playlistStartEpoch } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Missing name' });
    }
    
    const channel = await ChannelDataService.createChannel(name, playlistStartEpoch);
    res.json(channel);
  } catch (err) {
    if (err.message === 'Channel already exists') {
      return res.status(400).json({ message: 'Channel already exists' });
    }
    console.error('POST /api/channels error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/**
 * POST /api/channels/:channelId/videos - Add video to channel
 */
router.post('/:channelId/videos', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params;
    const { title, youtubeId, duration, year, tags, category } = req.body;
    
    if (!youtubeId || !title) {
      return res.status(400).json({ message: 'Missing youtubeId or title' });
    }
    
    const channel = await ChannelDataService.addVideo(channelId, {
      title,
      youtubeId,
      duration,
      year,
      tags,
      category
    });
    
    res.json(channel);
  } catch (err) {
    if (err.message === 'Channel not found') {
      return res.status(404).json({ message: 'Channel not found' });
    }
    if (err.message === 'Video already exists in this channel') {
      return res.status(400).json({ message: err.message });
    }
    console.error('POST /api/channels/:id/videos error:', err);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/**
 * POST /api/channels/:id/add-video - Alias for adding video
 */
router.post('/:id/add-video', requireAuth, async (req, res) => {
  try {
    const { title, youtubeId, duration } = req.body;
    const channelId = req.params.id;

    if (!youtubeId || !title) {
      return res.status(400).json({ 
        message: 'Missing required fields: youtubeId, title' 
      });
    }

    const channel = await ChannelDataService.addVideo(channelId, {
      title,
      youtubeId,
      duration: duration || 30
    });

    const newVideo = channel.items[channel.items.length - 1];

    res.json({ 
      message: 'Video added successfully', 
      video: newVideo,
      channel 
    });
  } catch (err) {
    if (err.message === 'Channel not found') {
      return res.status(404).json({ message: 'Channel not found' });
    }
    if (err.message === 'Video already exists in this channel') {
      return res.status(400).json({ message: err.message });
    }
    console.error('POST /api/channels/:id/add-video error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to add video' });
  }
});

/**
 * DELETE /api/channels/:channelId/videos/:videoId - Delete video
 */
router.delete('/:channelId/videos/:videoId', requireAuth, async (req, res) => {
  try {
    const { channelId, videoId } = req.params;
    console.log(`[Channels] Admin "${req.admin.username}" deleting video: ${videoId} from channel: ${channelId}`);
    
    if (!videoId) {
      return res.status(400).json({ message: 'Video ID is required' });
    }
    
    const channel = await ChannelDataService.deleteVideo(channelId, videoId);
    res.json(channel);
  } catch (err) {
    if (err.message === 'Channel not found') {
      return res.status(404).json({ message: 'Channel not found' });
    }
    if (err.message === 'Video not found') {
      return res.status(404).json({ message: 'Video not found' });
    }
    console.error('DELETE /api/channels/:channelId/videos/:videoId error:', err.message);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/**
 * DELETE /api/channels/:channelId - Delete channel
 */
router.delete('/:channelId', requireAuth, async (req, res) => {
  try {
    const { channelId } = req.params;
    console.log(`[Channels] Admin "${req.admin.username}" attempting to delete channel: ${channelId}`);
    
    const channel = await ChannelDataService.deleteChannel(channelId);
    res.json({ message: 'Channel deleted successfully', channel });
  } catch (err) {
    if (err.message === 'Channel not found') {
      return res.status(404).json({ message: 'Channel not found' });
    }
    console.error('DELETE /api/channels/:channelId error:', err.message);
    res.status(500).json({ message: err.message || 'Server error' });
  }
});

/**
 * POST /api/channels/:channelId/bulk-upload - Bulk upload videos
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

    // Parse file content
    const videos = parseVideoFileContent(fileContent);

    if (videos.length === 0) {
      return res.status(400).json({ 
        message: 'No valid YouTube links found in file' 
      });
    }

    // Fetch metadata for videos with "Untitled" title
    for (const video of videos) {
      if (video.title === 'Untitled') {
        const metadata = await fetchYouTubeMetadata(video.youtubeId);
        if (metadata) {
          video.title = metadata.title;
          if (metadata.duration) video.duration = metadata.duration;
        }
      }
    }

    const result = await ChannelDataService.bulkAddVideos(channelId, videos);

    res.json({ 
      message: `Successfully added ${result.addedCount} video(s)${result.skippedCount > 0 ? `, skipped ${result.skippedCount} duplicate(s)` : ''}`,
      count: result.addedCount,
      skipped: result.skippedCount,
      total: result.total
    });
  } catch (err) {
    if (err.message === 'Channel not found') {
      return res.status(404).json({ message: 'Channel not found' });
    }
    console.error('POST /api/channels/:channelId/bulk-upload error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to bulk upload videos' });
  }
});

/**
 * POST /api/channels/bulk-add-videos - Bulk import multiple videos to different channels
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

    // Group videos by channel
    const videosByChannel = {};
    for (const video of videos) {
      const { channelId, videoId, title } = video;
      if (!channelId || !videoId || !title) {
        errors.push(`Skipped: Missing required fields in video "${videoId}"`);
        continue;
      }
      if (!videosByChannel[channelId]) {
        videosByChannel[channelId] = [];
      }
      videosByChannel[channelId].push({
        youtubeId: videoId,
        title,
        duration: 30
      });
    }

    // Bulk add to each channel
    for (const [channelId, channelVideos] of Object.entries(videosByChannel)) {
      try {
        const result = await ChannelDataService.bulkAddVideos(channelId, channelVideos);
        addedCount += result.addedCount;
      } catch (err) {
        errors.push(`Error adding to channel ${channelId}: ${err.message}`);
      }
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

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse video file content (JSON, CSV, or TXT)
 */
function parseVideoFileContent(fileContent) {
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
      return videos;
    } catch (jsonErr) {
      // Not JSON, continue to other formats
    }
  }

  // Parse line by line (CSV or TXT)
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const foundIds = extractAllVideoIds(trimmed);
    
    if (foundIds.length > 0) {
      for (const videoId of foundIds) {
        videos.push({ youtubeId: videoId, title: 'Untitled', duration: 30 });
      }
    } else if (trimmed.includes(',')) {
      const parts = trimmed.split(',').map(p => p.trim());
      const videoId = extractVideoId(parts[0]);
      if (videoId) {
        videos.push({
          youtubeId: videoId,
          title: parts[1] || 'Untitled',
          duration: 30
        });
      }
    } else {
      const videoId = extractVideoId(trimmed);
      if (videoId) {
        videos.push({ youtubeId: videoId, title: 'Untitled', duration: 30 });
      }
    }
  }

  return videos;
}

/**
 * Extract YouTube video ID from text
 */
function extractVideoId(text) {
  if (!text) return null;
  text = text.trim();
  
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return text;
  
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1];
  }
  return null;
}

/**
 * Extract all YouTube IDs from a line
 */
function extractAllVideoIds(text) {
  if (!text) return [];
  const ids = [];
  
  const globalPattern = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/g;
  let match;
  while ((match = globalPattern.exec(text)) !== null) {
    if (match[1] && !ids.includes(match[1])) ids.push(match[1]);
  }
  
  return ids;
}

/**
 * Fetch YouTube metadata using oEmbed (no API key required)
 */
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
    
    if (!response.ok) return null;
    
    const data = await response.json();
    return { title: data.title || 'Untitled', author: data.author_name };
  } catch (err) {
    return null;
  }
}

module.exports = router;
