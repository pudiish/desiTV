const express = require('express');
const router = express.Router();
const axios = require('axios');

function parseISODuration(duration) {
  // Simple ISO 8601 duration parser to seconds (PT#H#M#S)
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);
  return hours * 3600 + minutes * 60 + seconds;
}

// POST /api/youtube/metadata { youtubeId }
router.post('/metadata', async (req, res) => {
  const { youtubeId } = req.body;
  if (!youtubeId) return res.status(400).json({ message: 'Missing youtubeId' });
  const KEY = process.env.YOUTUBE_API_KEY;
  if (!KEY) return res.status(500).json({ message: 'YOUTUBE_API_KEY not configured on server' });
  try {
    // request status to check embeddable flag as well
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${encodeURIComponent(youtubeId)}&key=${KEY}`;
    const r = await axios.get(url);
    const item = r.data.items && r.data.items[0];
    if (!item) return res.status(404).json({ message: 'Video not found' });
    const title = item.snippet.title;
    const duration = parseISODuration(item.contentDetails.duration || 'PT0S');
    const embeddable = item.status && typeof item.status.embeddable !== 'undefined' ? item.status.embeddable : true;
    res.json({ title, duration, embeddable });
  } catch (err) {
    console.error('YouTube API error', err?.response?.data || err.message);
    res.status(500).json({ message: 'YouTube API error', error: err?.response?.data || err.message });
  }
});

module.exports = router;
