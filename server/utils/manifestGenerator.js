/**
 * Manifest Generator - CDN-Ready Pre-computation
 * 
 * THE NETFLIX APPROACH:
 * Pre-compute the entire broadcast schedule for 24 hours.
 * Push to CDN edge nodes. Client downloads once, computes locally forever.
 * 
 * Result: ZERO runtime API calls for sync.
 * 
 * Use cases:
 * 1. Generate daily manifest on server startup
 * 2. Push to Vercel Edge / Cloudflare / S3
 * 3. Client fetches once, caches in localStorage
 * 4. Client computes position locally using epochMs
 */

const GlobalEpoch = require('../models/GlobalEpoch');
const Channel = require('../models/Channel');

// 24 hours in milliseconds
const MANIFEST_DURATION_MS = 24 * 60 * 60 * 1000;

/**
 * Generate full broadcast manifest for all categories
 * This is designed to be called once per day and cached
 */
async function generateFullManifest() {
  console.log('[ManifestGenerator] Generating full broadcast manifest...');
  const startTime = Date.now();

  // Get global epoch
  const globalEpoch = await GlobalEpoch.getOrCreate();
  const epochMs = new Date(globalEpoch.epoch).getTime();

  // Get all channels
  const channels = await Channel.find({}).lean();

  // Build manifest for each channel
  const categories = {};

  for (const channel of channels) {
    const videos = channel.items || [];
    if (videos.length === 0) continue;

    // Pre-compute durations and positions
    const playlist = [];
    let cumulativeTime = 0;

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const duration = (typeof video.duration === 'number' && video.duration > 0) 
        ? video.duration 
        : 300; // Default 5 min

      playlist.push({
        index: i,
        id: video.youtubeId || video.videoId,
        title: video.title,
        duration,
        startOffset: cumulativeTime, // Position in cycle where this video starts
        endOffset: cumulativeTime + duration,
      });

      cumulativeTime += duration;
    }

    const totalDuration = cumulativeTime;

    categories[channel._id.toString()] = {
      id: channel._id.toString(),
      name: channel.name,
      playlist,
      totalDuration,
      videoCount: playlist.length,
    };
  }

  const manifest = {
    // Version for cache invalidation
    version: Date.now(),
    
    // Global sync anchor
    epoch: {
      ms: epochMs,
      iso: new Date(epochMs).toISOString(),
    },
    
    // All categories
    categories,
    
    // Manifest metadata
    meta: {
      generatedAt: Date.now(),
      generatedAtIso: new Date().toISOString(),
      categoryCount: Object.keys(categories).length,
      totalVideos: Object.values(categories).reduce((sum, c) => sum + c.videoCount, 0),
      expiresAt: Date.now() + MANIFEST_DURATION_MS,
      expiresAtIso: new Date(Date.now() + MANIFEST_DURATION_MS).toISOString(),
    },
    
    // Instructions for client
    usage: {
      description: 'Download once, compute locally. Position = ((now - epoch) % totalDuration)',
      algorithm: 'EPOCH_MODULO',
      refreshInterval: MANIFEST_DURATION_MS,
    },
  };

  const duration = Date.now() - startTime;
  console.log(`[ManifestGenerator] Generated manifest in ${duration}ms | ${manifest.meta.categoryCount} categories | ${manifest.meta.totalVideos} videos`);

  return manifest;
}

/**
 * Generate lightweight manifest (for low-bandwidth scenarios)
 * Only essential data for position calculation
 */
async function generateLightManifest() {
  const globalEpoch = await GlobalEpoch.getOrCreate();
  const epochMs = new Date(globalEpoch.epoch).getTime();
  const channels = await Channel.find({}).lean();

  const categories = {};

  for (const channel of channels) {
    const videos = channel.items || [];
    if (videos.length === 0) continue;

    // Only store durations (client calculates positions)
    const durations = videos.map(v => 
      (typeof v.duration === 'number' && v.duration > 0) ? v.duration : 300
    );
    const totalDuration = durations.reduce((a, b) => a + b, 0);

    categories[channel._id.toString()] = {
      n: channel.name, // Short key
      d: durations,    // Array of durations
      t: totalDuration,
      c: videos.length,
    };
  }

  return {
    v: Date.now(),           // Version
    e: epochMs,              // Epoch
    c: categories,           // Categories
    x: Date.now() + MANIFEST_DURATION_MS, // Expires
  };
}

/**
 * Calculate position from manifest (client-side algorithm)
 * This function shows what the client should implement
 */
function calculatePositionFromManifest(manifest, categoryId, nowMs = Date.now()) {
  const category = manifest.categories?.[categoryId] || manifest.c?.[categoryId];
  if (!category) return null;

  const epochMs = manifest.epoch?.ms || manifest.e;
  const totalDuration = category.totalDuration || category.t;
  const playlist = category.playlist || null;
  const durations = category.d || null;

  // Time elapsed since epoch
  const elapsedMs = nowMs - epochMs;
  const elapsedSec = elapsedMs / 1000;

  // Position in cycle
  const cyclePosition = elapsedSec % totalDuration;

  // Find current video
  let videoIndex = 0;
  let positionInVideo = cyclePosition;

  if (playlist) {
    // Full manifest: use pre-computed offsets
    for (let i = 0; i < playlist.length; i++) {
      if (cyclePosition >= playlist[i].startOffset && cyclePosition < playlist[i].endOffset) {
        videoIndex = i;
        positionInVideo = cyclePosition - playlist[i].startOffset;
        break;
      }
    }
  } else if (durations) {
    // Light manifest: calculate on the fly
    let cumulative = 0;
    for (let i = 0; i < durations.length; i++) {
      if (cyclePosition < cumulative + durations[i]) {
        videoIndex = i;
        positionInVideo = cyclePosition - cumulative;
        break;
      }
      cumulative += durations[i];
    }
  }

  return {
    videoIndex,
    position: positionInVideo,
    cyclePosition,
    totalDuration,
  };
}

/**
 * Get manifest as JSON string (for CDN)
 */
async function getManifestJSON(light = false) {
  const manifest = light 
    ? await generateLightManifest() 
    : await generateFullManifest();
  return JSON.stringify(manifest);
}

/**
 * Get manifest with gzip compression size estimate
 */
async function getManifestWithStats() {
  const fullManifest = await generateFullManifest();
  const lightManifest = await generateLightManifest();

  const fullJson = JSON.stringify(fullManifest);
  const lightJson = JSON.stringify(lightManifest);

  return {
    full: {
      manifest: fullManifest,
      sizeBytes: Buffer.byteLength(fullJson),
      sizeKB: Math.round(Buffer.byteLength(fullJson) / 1024 * 100) / 100,
    },
    light: {
      manifest: lightManifest,
      sizeBytes: Buffer.byteLength(lightJson),
      sizeKB: Math.round(Buffer.byteLength(lightJson) / 1024 * 100) / 100,
    },
  };
}

module.exports = {
  generateFullManifest,
  generateLightManifest,
  calculatePositionFromManifest,
  getManifestJSON,
  getManifestWithStats,
};
