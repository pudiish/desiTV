# Video Source Fallback System

## Overview

The Video Source Fallback System provides automatic fallback to alternative video sources when the primary YouTube video fails to load or play. This improves playback reliability and reduces interruptions.

## How It Works

### 1. Source Priority

The system tries sources in this order:
1. **Primary** - `youtubeId` (main video source)
2. **Alternative** - `altYoutubeId` (backup video)
3. **Backup** - `backupYoutubeId` (secondary backup)
4. **Mirror** - `mirrorYoutubeId` (mirror/alternative host)

### 2. Automatic Fallback

When a video error occurs:
1. The system detects the error
2. Marks the current source as failed
3. Automatically switches to the next available source
4. Reloads the video with the fallback source
5. Continues playback seamlessly

### 3. Error Handling

- **Permanent Errors** (video not found, embedding disabled): Tries all fallbacks before skipping
- **Temporary Errors** (network issues, buffering): Retries current source first, then falls back
- **All Sources Failed**: Proceeds to next video in playlist

## Usage

### Adding Fallback Sources to Videos

When creating or updating video entries, include alternative sources:

```javascript
{
  title: "My Video",
  youtubeId: "dQw4w9WgXcQ",        // Primary source
  altYoutubeId: "jNQXAC9IVRw",     // Alternative source (optional)
  backupYoutubeId: "9bZkp7q19f0",  // Backup source (optional)
  mirrorYoutubeId: "kJQP7kiw5Fk",  // Mirror source (optional)
  duration: 180
}
```

### Programmatic Usage

```javascript
import VideoSourceManager from './utils/VideoSourceManager'

// Create manager for a video
const video = {
  youtubeId: "primary-id",
  altYoutubeId: "alt-id",
  backupYoutubeId: "backup-id"
}

const manager = new VideoSourceManager(video)

// Get all sources
const sources = manager.getSources()
// Returns: [
//   { type: 'youtube', id: 'primary-id', priority: 1, label: 'primary' },
//   { type: 'youtube', id: 'alt-id', priority: 2, label: 'alternative' },
//   { type: 'youtube', id: 'backup-id', priority: 3, label: 'backup' }
// ]

// Get current source
const current = manager.getCurrentSource()
// Returns: { type: 'youtube', id: 'primary-id', priority: 1, label: 'primary' }

// Mark current source as failed and get next
manager.markCurrentSourceFailed()
const next = manager.getNextSource()
// Returns: { type: 'youtube', id: 'alt-id', priority: 2, label: 'alternative' }

// Check if more sources available
if (manager.hasMoreSources()) {
  // Try next source
}
```

## Integration

The fallback system is automatically integrated into the `Player` component:

1. **Automatic Detection**: Detects when a video has multiple sources
2. **Error Handling**: Automatically tries fallbacks on video errors
3. **Seamless Switching**: Switches sources without user intervention
4. **Logging**: Logs fallback attempts for debugging

## Configuration

### Options

```javascript
const manager = new VideoSourceManager(video, {
  maxFallbacks: 3,              // Maximum fallback attempts
  enableAlternativeIds: true   // Enable alternative ID fallback
})
```

### Disable Fallback

To disable fallback for specific videos, only provide `youtubeId`:

```javascript
{
  youtubeId: "only-source",
  // No altYoutubeId, backupYoutubeId, or mirrorYoutubeId
}
```

## Benefits

1. **Improved Reliability**: Reduces playback interruptions
2. **Better UX**: Seamless fallback without user intervention
3. **Flexibility**: Support for multiple backup strategies
4. **Automatic**: No manual configuration required

## Monitoring

The system logs fallback attempts:

```
[Player] Video error detected, trying fallback source...
[Player] Switching to fallback source: alternative (alt-video-id)
[Player] All sources failed, skipping to next video
```

## Future Enhancements

Potential improvements:
- Support for non-YouTube sources (Vimeo, Dailymotion, etc.)
- Quality-based fallback (try lower quality if high quality fails)
- Geographic fallback (different sources for different regions)
- CDN fallback (different CDN endpoints)

