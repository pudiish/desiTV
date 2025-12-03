# Buffer Caching Mechanism - POC

A Proof of Concept implementation of a buffer caching system for the Retro TV MERN application.

## Overview

The buffer cache is a lightweight, in-memory caching layer that stores video metadata and playback information to improve performance and reduce server requests.

## Features

### 1. **Intelligent Cache Management**
- LRU-style eviction when cache reaches max size (default: 50 items)
- Time-to-Live (TTL) expiration (default: 1 hour)
- Automatic cleanup of expired entries
- Memory-efficient storage

### 2. **Caching Types**

#### Video Metadata
```javascript
bufferCache.cacheVideoMetadata(channelId, videoId, metadata)
// Stores: title, duration, youtubeId, tags, timestamp
```

#### Playback Position
```javascript
bufferCache.cachePlaybackPosition(channelId, videoId, position)
// Stores: current playback time for resume functionality
```

#### Playlist
```javascript
bufferCache.cachePlaylist(channelId, playlistItems)
// Stores: entire playlist for a channel
```

### 3. **Performance Metrics**
- Hit/Miss counters
- Hit rate percentage
- Eviction tracking
- Memory estimation

## Usage

### Basic Usage in Player Component

```javascript
import bufferCache from '../utils/bufferCache'

// Cache playlist when channel loads
bufferCache.cachePlaylist(channel._id, items)
bufferCache.warmUp(channel._id, items)

// Cache individual video metadata
bufferCache.cacheVideoMetadata(channel._id, video._id, {
  title: video.title,
  youtubeId: video.youtubeId,
  duration: video.duration,
  tags: video.tags
})

// Retrieve cached data
const metadata = bufferCache.getVideoMetadata(channel._id, videoId)
```

### Debug Mode

**Enable Debug Mode:** Press `Ctrl+Shift+D`

This displays a real-time cache statistics panel in the bottom-right corner showing:
- Cache size and capacity
- Hit/Miss counts
- Hit rate percentage
- Eviction count
- Estimated memory usage

## Architecture

### Cache Entry Structure
```javascript
{
  data: { /* cached content */ },
  timestamp: 1234567890,
  accessCount: 5
}
```

### Key Generation
Cache keys are generated using the format: `{channelId}:{videoId}`

## Performance Benefits

1. **Reduced Server Requests**: Video metadata is cached locally
2. **Faster Channel Switching**: Playlists are retrieved from cache
3. **Seamless Playback**: Video information is immediately available
4. **Memory Efficient**: Automatic eviction prevents unbounded growth

## Configuration

### Adjust Cache Parameters

```javascript
// In bufferCache.js
const bufferCache = new BufferCache(
  100,      // maxSize - increase for more items
  7200000   // ttl - 2 hours in milliseconds
)
```

## API Reference

### Methods

| Method | Parameters | Returns | Description |
|--------|-----------|---------|-------------|
| `set()` | channelId, videoId, data | void | Store item in cache |
| `get()` | channelId, videoId | data \| null | Retrieve item if not expired |
| `cacheVideoMetadata()` | channelId, videoId, metadata | void | Cache video metadata |
| `getVideoMetadata()` | channelId, videoId | metadata \| null | Get cached video metadata |
| `cachePlaylist()` | channelId, playlist | void | Cache entire playlist |
| `getPlaylist()` | channelId | items \| null | Get cached playlist |
| `cachePlaybackPosition()` | channelId, videoId, position | void | Cache playback position |
| `getPlaybackPosition()` | channelId, videoId | position \| null | Get playback position |
| `clear()` | channelId, videoId | void | Clear specific cache entry |
| `clearAll()` | - | void | Clear entire cache |
| `getStats()` | - | stats object | Get cache statistics |
| `printStats()` | - | void | Print stats to console |
| `warmUp()` | channelId, videos | void | Pre-cache videos list |

## Example: Warm-up Strategy

Pre-load cache when fetching channels:

```javascript
const channels = await axios.get('/api/channels')
channels.forEach(channel => {
  if (channel.items) {
    bufferCache.warmUp(channel._id, channel.items)
  }
})
```

## Future Enhancements

- [ ] IndexedDB persistence (survives page refresh)
- [ ] Compression for large playlists
- [ ] Smart prefetching of next videos
- [ ] Cache size visualization
- [ ] Export/import cache snapshots
- [ ] Server-side cache coordination
- [ ] Cache versioning for stale data handling

## Monitoring

### Console Logs

All cache operations log to console:

```
[BufferCache] Cached: channelId:videoId
[BufferCache] HIT: channelId:videoId (access #2)
[BufferCache] MISS: channelId:videoId
[BufferCache] EXPIRED: channelId:videoId
```

### Statistics Example

```
[BufferCache Statistics]
  Cache Size: 23/50
  Hits: 156
  Misses: 12
  Hit Rate: 92.86%
  Evictions: 0
  Est. Memory: 11.50KB
```

## Testing the Cache

1. Open browser DevTools (F12)
2. Go to Console tab
3. Press `Ctrl+Shift+D` to enable debug mode
4. Watch the stats panel update as you navigate channels
5. Observe the hit rate improve as you revisit channels

## Notes

- Cache is **not persistent** (clears on page refresh)
- All operations are **synchronous** and fast
- Perfect for **development and testing**
- Consider adding **IndexedDB** for production persistence
