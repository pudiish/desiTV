# Codebase Restructure - Complete Guide

## Overview

The codebase has been restructured to consolidate recovery systems, extract all parameters to config files, and organize logic into separate modules for easier maintenance and debugging.

## Key Changes

### 1. **Unified Playback Recovery System**

**Before:** Multiple competing recovery mechanisms causing conflicts:
- `FastRecoveryManager` (500ms checks)
- `PlaybackWatchdog` (2s checks)
- `YouTubeRetryManager` (retry logic)
- Multiple `useEffect` hooks calling `playVideo()`

**After:** Single unified system:
- `UnifiedPlaybackManager` - ONE recovery mechanism
- All thresholds in config files
- Debounced play attempts
- State validation before actions
- No conflicts or loops

**Location:** `client/src/logic/playback/UnifiedPlaybackManager.js`

### 2. **Configuration Structure**

All parameters and thresholds are now in config files for easy tweaking:

```
client/src/config/
├── thresholds/
│   ├── playback.js      # All playback timing/retry thresholds
│   ├── broadcast.js     # Broadcast timeline thresholds
│   ├── effects.js       # Visual effects timing
│   └── index.js         # Export all thresholds
└── constants/
    ├── youtube.js       # YouTube API constants
    ├── playback.js      # Playback constants
    └── index.js         # Export all constants
```

**Benefits:**
- Single source of truth for all parameters
- Easy to debug and tweak
- Environment-aware (production vs development)
- No hardcoded values scattered in code

### 3. **Logic Organization**

All logic modules are now organized by domain:

```
client/src/logic/
├── playback/
│   └── UnifiedPlaybackManager.js  # Single recovery system
├── broadcast/
│   ├── BroadcastStateManager.js   # Timeline state management
│   └── PseudoLiveCalculator.js     # Position calculations
├── channel/
│   └── ChannelManager.js          # Channel data management
└── effects/
    └── ChannelSwitchPipeline.js   # Visual effects pipeline
```

**Benefits:**
- Clear separation of concerns
- Easy to find and modify logic
- Better maintainability
- Modular architecture

### 4. **Removed Redundant Code**

**Removed/Consolidated:**
- `FastRecoveryManager` → `UnifiedPlaybackManager`
- `PlaybackWatchdog` → `UnifiedPlaybackManager`
- `YouTubeRetryManager` → Simplified (no longer needed)
- Multiple `safePlayVideo` implementations → One in unified manager
- Hardcoded constants → Config files

## Configuration Files

### Playback Thresholds (`config/thresholds/playback.js`)

All playback-related timing parameters:

```javascript
PLAYBACK_THRESHOLDS = {
  SWITCH_BEFORE_END: 2,              // seconds
  MAX_BUFFER_TIME: 8000,            // milliseconds
  MAX_RETRY_ATTEMPTS: 5,
  RECOVERY_CHECK_INTERVAL: 1000,    // milliseconds
  RECOVERY_DETECTION_DELAY: 500,    // milliseconds
  PLAY_ATTEMPT_DEBOUNCE: 500,       // milliseconds
  // ... and more
}
```

### Broadcast Thresholds (`config/thresholds/broadcast.js`)

All broadcast timeline parameters:

```javascript
BROADCAST_THRESHOLDS = {
  DEFAULT_VIDEO_DURATION: 300,     // seconds
  AUTO_SAVE_INTERVAL: 5000,         // milliseconds
  POSITION_REFRESH_INTERVAL: 1000,  // milliseconds
  // ... and more
}
```

### YouTube Constants (`config/constants/youtube.js`)

All YouTube API constants:

```javascript
YOUTUBE_STATES = {
  UNSTARTED: -1,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  // ... and more
}
```

## Usage Examples

### Using Unified Playback Manager

```javascript
import { unifiedPlaybackManager } from '../logic/playback'

// Start monitoring
unifiedPlaybackManager.start(playerRef, {
  shouldPlay: () => power && userInteracted,
  onRecovery: (type) => {
    console.log('Recovery successful:', type)
  }
})

// Stop monitoring
unifiedPlaybackManager.stop()
```

### Using Config Thresholds

```javascript
import { PLAYBACK_THRESHOLDS } from '../config/thresholds'

// Use threshold values
const maxBufferTime = PLAYBACK_THRESHOLDS.MAX_BUFFER_TIME
const checkInterval = PLAYBACK_THRESHOLDS.RECOVERY_CHECK_INTERVAL
```

### Using Broadcast State Manager

```javascript
import { broadcastStateManager } from '../logic/broadcast'

// Initialize channels
broadcastStateManager.initializeAllChannels(channels)

// Calculate position
const position = broadcastStateManager.calculateCurrentPosition(channel)
```

## Migration Guide

### Old Code:
```javascript
import fastRecoveryManager from '../utils/FastRecoveryManager'
fastRecoveryManager.start(playerRef, options)
```

### New Code:
```javascript
import { unifiedPlaybackManager } from '../logic/playback'
unifiedPlaybackManager.start(playerRef, options)
```

### Old Code:
```javascript
import LocalBroadcastStateManager from '../utils/LocalBroadcastStateManager'
LocalBroadcastStateManager.initializeChannel(channel)
```

### New Code:
```javascript
import { broadcastStateManager } from '../logic/broadcast'
broadcastStateManager.initializeChannel(channel)
```

## Debugging & Tweaking

### To Adjust Playback Recovery Timing:

1. Open `client/src/config/thresholds/playback.js`
2. Modify `RECOVERY_CHECK_INTERVAL` or `RECOVERY_DETECTION_DELAY`
3. Save and test

### To Adjust Buffering Thresholds:

1. Open `client/src/config/thresholds/playback.js`
2. Modify `MAX_BUFFER_TIME` or `BUFFERING_DETECTION_DELAY`
3. Save and test

### To Adjust Broadcast Timeline:

1. Open `client/src/config/thresholds/broadcast.js`
2. Modify `DEFAULT_VIDEO_DURATION` or `AUTO_SAVE_INTERVAL`
3. Save and test

## File Structure Summary

```
client/src/
├── config/                    # All configuration
│   ├── thresholds/           # Timing/retry parameters
│   └── constants/            # Constant values
├── logic/                     # All business logic
│   ├── playback/             # Playback recovery
│   ├── broadcast/            # Timeline management
│   ├── channel/              # Channel management
│   └── effects/              # Visual effects
├── components/               # React components
├── hooks/                    # React hooks
├── utils/                    # Utility functions (kept for compatibility)
└── pages/                    # Page components
```

## Benefits

1. **No More Conflicts:** Single recovery system eliminates pause/resume loops
2. **Easy Debugging:** All parameters in one place
3. **Easy Tweaking:** Modify config files, not code
4. **Better Organization:** Logic separated by domain
5. **Maintainability:** Clear structure, easy to find code
6. **Scalability:** Easy to add new features

## Next Steps

1. Test the unified playback manager
2. Adjust thresholds in config files as needed
3. Remove old unused files (FastRecoveryManager, PlaybackWatchdog, etc.)
4. Update any remaining imports

## Notes

- Old files in `utils/` are kept for backward compatibility but should be migrated
- All new code should use the new structure
- Config files support environment-aware values (production vs development)

