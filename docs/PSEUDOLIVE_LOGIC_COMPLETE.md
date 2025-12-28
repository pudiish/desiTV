# Pseudolive Logic - Complete Documentation

## Overview

The pseudolive system simulates a continuous TV broadcast where time keeps moving regardless of viewer presence. It ensures all users see the same content at the same time, just like traditional TV channels.

**Core Concept**: Instead of tracking "which video is playing", the system calculates "which video SHOULD be playing right now" based on an immutable timeline epoch.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PSEUDOLIVE SYSTEM                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐        │
│  │  Global Epoch    │         │  Channel States  │        │
│  │  (Immutable)     │─────────▶│  (Per Channel)   │        │
│  │                  │         │                  │        │
│  │  Set once on     │         │  - playlistStart  │        │
│  │  first load      │         │  - videoDurations│        │
│  │  Never changes   │         │  - channelOffset │        │
│  └──────────────────┘         └──────────────────┘        │
│           │                            │                    │
│           │                            │                    │
│           ▼                            ▼                    │
│  ┌──────────────────────────────────────────────────┐      │
│  │     PseudoLiveCalculator                         │      │
│  │  - getPseudoLiveItem()                           │      │
│  │  - getNextVideoInSequence()                     │      │
│  └──────────────────────────────────────────────────┘      │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────────────────────────────────────┐      │
│  │     BroadcastStateManager                         │      │
│  │  - calculateCurrentPosition()                    │      │
│  │  - initializeChannel()                           │      │
│  │  - jumpToVideo()                                  │      │
│  └──────────────────────────────────────────────────┘      │
│           │                                                 │
│           ▼                                                 │
│  ┌──────────────────────────────────────────────────┐      │
│  │     Player Component                              │      │
│  │  - Uses broadcastPosition hook                    │      │
│  │  - Switches videos based on timeline              │      │
│  └──────────────────────────────────────────────────┘      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Core Components

### 1.1 PseudoLiveCalculator.js

**Location**: `client/src/logic/broadcast/PseudoLiveCalculator.js`

**Purpose**: Pure calculation functions for determining timeline position.

#### `getPseudoLiveItem(playlist, startEpoch)`

Calculates which video should be playing at the current moment.

**Algorithm**:
```javascript
1. Calculate total elapsed time: (now - startEpoch) / 1000
2. Calculate cycle position: totalElapsed % totalPlaylistDuration
3. Walk through videos, accumulating durations until we find the current video
4. Return: { item, offset, videoIndex, totalElapsed, cyclePosition }
```

**Key Logic**:
- Uses modulo (`%`) to handle playlist looping
- `cyclePosition` = position within current playlist cycle (0 to totalDuration)
- `offset` = seconds into the current video
- Handles edge cases (empty playlist, zero duration, etc.)

**Example**:
```
Playlist: [Video1: 10min, Video2: 15min, Video3: 5min]
Total: 30 minutes
Start Epoch: 2024-01-01 00:00:00
Current Time: 2024-01-01 00:17:00

Calculation:
- totalElapsed = 17 * 60 = 1020 seconds
- cyclePosition = 1020 % 1800 = 1020 seconds
- Video1: 0-600s (0-10min) ❌
- Video2: 600-1500s (10-25min) ✅ (1020 is in this range)
- Result: Video2 at 420 seconds (7 minutes in)
```

#### `getNextVideoInSequence(playlist, currentIndex, cyclePosition)`

Calculates when the next video should start.

**Returns**:
- `nextIndex`: Index of next video
- `nextOffset`: Always 0 (next video starts at beginning)
- `switchTime`: Seconds until next video should start

---

### 1.2 BroadcastStateManager.js

**Location**: `client/src/logic/broadcast/BroadcastStateManager.js`

**Purpose**: Manages broadcast timeline state with localStorage persistence.

#### Key Concepts

**Global Epoch (Immutable)**:
- Set once when user first loads the app
- Never changes during the session
- Stored in localStorage as `desitv-global-epoch`
- All channels calculate from this single reference point

**Channel State**:
```javascript
{
  channelId: string,
  channelName: string,
  playlistTotalDuration: number,  // Sum of all video durations
  videoDurations: [number],       // Array of individual video durations
  channelOffset: number,           // Per-channel offset (for manual seeking)
  manualMode: boolean,             // Whether user manually switched
  manualModeUntil: Date | null,    // When manual mode expires (deprecated)
  lastAccessTime: Date
}
```

#### `initializeGlobalEpoch()`

**Logic**:
1. Check if epoch already exists in localStorage
2. If exists, load it (preserves continuity across sessions)
3. If not, create new epoch (first-time user)
4. Lock the epoch (prevent modification)

**Why Immutable?**
- Ensures all channels stay synchronized
- If epoch changed, users would see different content at different times
- Preserves "live TV" experience

#### `initializeChannel(channel)`

**Logic**:
1. Ensure global epoch is initialized
2. Load existing channel state from localStorage (if exists)
3. Calculate playlist total duration
4. Extract video durations array
5. Preserve `channelOffset` if exists (for manual seeking)
6. Update `lastAccessTime`

**When Called**:
- When user switches to a new channel/category
- On app initialization

#### `calculateCurrentPosition(channel)`

**Core Algorithm**:
```javascript
1. Get elapsed time: (now - globalEpoch) / 1000
2. Apply channel offset: elapsed + channelOffset
3. Calculate cycle position: adjustedElapsed % totalDuration
4. Walk through videoDurations to find current video
5. Calculate offset within current video
6. Return position object
```

**Handles**:
- Negative offsets (user seeks backward)
- Single video playlists (special case)
- Multiple video playlists (normal case)
- Edge cases (zero duration, invalid indices)

**Returns**:
```javascript
{
  videoIndex: number,        // Which video is playing
  offset: number,            // Seconds into current video
  cyclePosition: number,    // Position in playlist cycle
  totalDuration: number,    // Total playlist duration
  totalElapsedSec: number,  // Total elapsed since epoch
  adjustedElapsedSec: number, // With channel offset applied
  channelOffset: number,    // Current channel offset
  cycleCount: number,       // How many times playlist has looped
  videoDurations: [number], // Array of durations
  isSingleVideo: boolean    // Single video special case
}
```

#### `jumpToVideo(channelId, targetVideoIndex, targetOffset, items)`

**Purpose**: Allows manual seeking without breaking timeline.

**Logic**:
1. Calculate target cycle position
2. Calculate current cycle position (from global epoch)
3. Calculate offset needed: `targetPosition - currentPosition`
4. Store offset in channel state (doesn't affect global epoch)
5. Future calculations use: `elapsed + channelOffset`

**Key Point**: This adjusts the channel's position WITHOUT changing the global epoch, so other channels remain unaffected.

#### `setManualMode(channelId, isManual)`

**Purpose**: Temporarily override timeline-based playback.

**Behavior**:
- When `manualMode = true`: Player uses sequential progression (next video in array)
- When `manualMode = false`: Player uses timeline calculation
- Manual mode persists until category/channel change (no timer expiration)

#### `gradualOffsetReset(channelId)`

**Purpose**: Smoothly transition back to timeline position after manual mode.

**Logic**:
1. Gradually reduce `channelOffset` to 0 over 5 seconds
2. Update offset in 10 steps (every 500ms)
3. Once offset reaches 0, disable manual mode

---

### 1.3 useBroadcastPosition Hook

**Location**: `client/src/hooks/useBroadcastPosition.js`

**Purpose**: React hook that provides current broadcast position.

**Usage**:
```javascript
const broadcastPosition = useBroadcastPosition(channel)
// Returns: { videoIndex, video, offset, timeRemaining, nextVideo, ... }
```

**Logic**:
1. Gets position from `BroadcastStateManager.calculateCurrentPosition()`
2. Calculates time remaining in current video
3. Determines next video in sequence
4. Memoized based on channel ID and state timestamp

**Triggers Recalculation**:
- Channel changes
- State timestamp changes (when state is updated)
- Video switch timestamp (manual video changes)

---

### 1.4 Player Component Integration

**Location**: `client/src/components/player/Player.jsx`

**How It Uses Pseudolive**:

1. **Gets Position**:
   ```javascript
   const broadcastPosition = useBroadcastPosition(channel)
   const currIndex = broadcastPosition.videoIndex
   const offset = broadcastPosition.offset
   ```

2. **Loads Video**:
   ```javascript
   playerRef.current.loadVideoById({
     videoId: nextVid.youtubeId,
     startSeconds: targetOffset  // From timeline calculation
   })
   ```

3. **Switches Videos**:
   ```javascript
   if (manualMode) {
     // Sequential progression
     nextIdx = (currIndex + 1) % items.length
   } else {
     // Timeline-based
     const timelinePosition = broadcastStateManager.calculateCurrentPosition(channel)
     nextIdx = timelinePosition.videoIndex
     targetOffset = timelinePosition.offset
   }
   ```

4. **Monitors Progress**:
   - Checks time remaining every 500ms
   - Switches when `timeRemaining <= SWITCH_BEFORE_END`
   - Triggers `switchToNextVideo()` which recalculates from timeline

---

## 2. Server-Side Implementation

### 2.1 BroadcastState Model (MongoDB)

**Location**: `server/models/BroadcastState.js`

**Schema**:
```javascript
{
  channelId: String (unique, indexed),
  channelName: String,
  playlistStartEpoch: Date (immutable, indexed),
  playlistTotalDuration: Number,
  videoDurations: [Number]
}
```

**Critical Design Decision**:
- **ONLY stores timeline metadata** (epoch, durations)
- **NEVER stores current position** (videoIndex, currentTime)
- Current position is **always calculated** from epoch

**Why?**
- If we saved current position, users would resume from saved position
- Instead, we calculate from epoch, so timeline continues naturally
- Like real TV: broadcast keeps going even if you turn off your TV

### 2.2 BroadcastState Routes

**Location**: `server/routes/broadcastState.js`

#### `GET /api/broadcast-state/:channelId`

**Purpose**: Get current calculated position for a channel.

**Logic**:
1. Load state from MongoDB
2. Calculate elapsed time since `playlistStartEpoch`
3. Calculate cycle position: `elapsed % playlistTotalDuration`
4. Walk through `videoDurations` to find current video
5. Return calculated position

#### `GET /api/broadcast-state/:channelId/timeline`

**Purpose**: Get detailed timeline information.

**Returns**:
- Total elapsed time
- Cycle position
- Cycle count (how many times playlist has looped)
- Session gap (time since last access)

#### `POST /api/broadcast-state/:channelId`

**Purpose**: Save/update broadcast state.

**Note**: Currently saves some calculated fields (currentVideoIndex, currentTime) but these are **not used** for position calculation - only for diagnostics.

### 2.3 Channels Route - computePseudoLive

**Location**: `server/routes/channels.js`

**Function**: `computePseudoLive(items, startEpoch)`

**Purpose**: Server-side calculation (same algorithm as client).

**Used By**:
- `GET /api/channels/:id/current` - Returns current video for a channel

**Caching**: Result cached for 5 seconds (CURRENT_VIDEO cache TTL)

---

## 3. Data Flow

### 3.1 Initial Load Flow

```
1. User opens app
   ↓
2. BroadcastStateManager.initializeGlobalEpoch()
   - Checks localStorage
   - Creates new epoch if first time
   - Locks epoch
   ↓
3. Channels loaded from API
   ↓
4. For each channel:
   BroadcastStateManager.initializeChannel(channel)
   - Calculates playlistTotalDuration
   - Extracts videoDurations
   - Saves to localStorage
   ↓
5. User selects channel
   ↓
6. useBroadcastPosition(channel) hook
   - Calls calculateCurrentPosition()
   - Returns current video index and offset
   ↓
7. Player loads video at calculated offset
```

### 3.2 Video Switch Flow

```
1. Current video playing
   ↓
2. Progress monitor checks time remaining (every 500ms)
   ↓
3. When timeRemaining <= SWITCH_BEFORE_END:
   ↓
4. switchToNextVideo() called
   ↓
5. Check mode:
   - Manual mode: nextIdx = (currIndex + 1) % length
   - Timeline mode: calculateCurrentPosition() → get videoIndex
   ↓
6. Load next video at calculated offset
   ↓
7. Continue playback
```

### 3.3 Manual Seeking Flow

```
1. User manually switches video (e.g., channel up/down)
   ↓
2. broadcastStateManager.jumpToVideo(channelId, targetIndex, 0, items)
   ↓
3. Calculate channelOffset needed
   ↓
4. Store offset in channel state
   ↓
5. Set manualMode = true
   ↓
6. Player uses sequential progression while in manual mode
   ↓
7. When user changes category/channel:
   - Reset channelOffset to 0
   - Set manualMode = false
   - Return to timeline mode
```

---

## 4. Key Algorithms Explained

### 4.1 Timeline Position Calculation

**Formula**:
```
totalElapsed = (currentTime - globalEpoch) / 1000
adjustedElapsed = totalElapsed + channelOffset
cyclePosition = adjustedElapsed % totalDuration
```

**Finding Current Video**:
```javascript
let cumulative = 0
for (let i = 0; i < videoDurations.length; i++) {
  if (cumulative + videoDurations[i] > cyclePosition) {
    videoIndex = i
    offset = cyclePosition - cumulative
    break
  }
  cumulative += videoDurations[i]
}
```

### 4.2 Handling Negative Offsets

**Scenario**: User seeks backward, causing negative `adjustedElapsed`.

**Solution**:
```javascript
if (adjustedElapsed < 0) {
  // Normalize to positive cycle position
  const cycles = Math.ceil(Math.abs(adjustedElapsed) / totalDuration)
  effectiveElapsed = (cycles * totalDuration) + adjustedElapsed
}
cyclePosition = effectiveElapsed % totalDuration
```

### 4.3 Single Video Playlist

**Special Case**: Playlist with only one video.

**Logic**:
```javascript
if (items.length === 1) {
  cyclePosition = adjustedElapsed % singleVideoDuration
  videoIndex = 0
  offset = cyclePosition
}
```

---

## 5. Storage & Persistence

### 5.1 Client-Side (localStorage)

**Keys**:
- `desitv-global-epoch`: Global epoch timestamp (ISO string)
- `desitv-broadcast-state`: JSON object with all channel states

**Structure**:
```javascript
{
  "channelId1": {
    channelId: "channelId1",
    channelName: "Channel Name",
    playlistTotalDuration: 3600,
    videoDurations: [300, 450, 600, ...],
    channelOffset: 0,
    manualMode: false,
    lastAccessTime: "2024-01-01T00:00:00.000Z"
  },
  "channelId2": { ... }
}
```

**Auto-Save**: Every 5 seconds (BROADCAST_THRESHOLDS.AUTO_SAVE_INTERVAL)

**Cleanup**: Keeps max 10 channel states (oldest removed first)

### 5.2 Server-Side (MongoDB)

**Collection**: `broadcastStates`

**Indexes**:
- `channelId` (unique)
- `updatedAt` (for cleanup queries)
- `playlistStartEpoch` (for timeline queries)

**Sync**: Client can optionally sync state to server (not currently used for position calculation)

---

## 6. Modes of Operation

### 6.1 Timeline Mode (Default)

**Behavior**:
- Position calculated from global epoch
- All users see same content at same time
- Videos switch based on timeline, not playback completion
- Simulates real TV broadcast

**When Active**:
- Default mode
- After manual mode expires (category change)

### 6.2 Manual Mode

**Behavior**:
- User has manually switched videos
- Sequential progression (next video in array)
- Timeline calculation ignored temporarily
- Persists until category/channel change

**When Active**:
- User manually changes channel (up/down buttons)
- User manually selects video from menu

**Transition Back**:
- When user changes category/channel
- `channelOffset` gradually resets to 0 (5 seconds)
- Returns to timeline mode

---

## 7. Edge Cases & Error Handling

### 7.1 Missing Video Duration

**Default**: `BROADCAST_THRESHOLDS.DEFAULT_VIDEO_DURATION` (300 seconds = 5 minutes)

**Applied When**:
- Video has no `duration` field
- Video has `duration = 0` or negative
- Video has invalid duration type

### 7.2 Empty Playlist

**Handling**:
- Returns `videoIndex: -1`, `item: null`
- Player shows error or static

### 7.3 Zero Total Duration

**Handling**:
- Returns first video at offset 0
- Logs warning

### 7.4 Invalid Video Index

**Validation**:
```javascript
if (videoIndex < 0 || videoIndex >= items.length) {
  videoIndex = 0
  offset = 0
}
```

### 7.5 Offset Out of Bounds

**Validation**:
```javascript
if (offset >= currentVideoDuration) {
  offset = Math.max(0, currentVideoDuration - 1)
}
if (offset < 0) {
  offset = 0
}
```

---

## 8. Configuration

**Location**: `client/src/config/thresholds/broadcast.js`

**Key Settings**:
```javascript
DEFAULT_VIDEO_DURATION: 300,        // 5 minutes
DEFAULT_PLAYLIST_DURATION: 3600,    // 1 hour
AUTO_SAVE_INTERVAL: 5000,           // 5 seconds
POSITION_REFRESH_INTERVAL: 1000,    // 1 second
MAX_CHANNEL_STATES: 10,             // Max cached channels
MANUAL_MODE_GRADUAL_RESET_DURATION: 5000,  // 5 seconds
MANUAL_MODE_GRADUAL_RESET_STEPS: 10        // 10 steps
```

---

## 9. Debugging & Monitoring

### 9.1 Console Logs

**Key Log Points**:
- `[BroadcastState] Global epoch initialized`
- `[BroadcastState] Calculated position: videoIndex X, offset Y`
- `[Player] Timeline mode - video X at Ys`
- `[Player] Manual mode - continuing sequential`

### 9.2 Position Object

**Debug Info Included**:
```javascript
{
  videoIndex: 2,
  offset: 45.3,
  cyclePosition: 1245,
  totalDuration: 3600,
  totalElapsedSec: 1245,
  adjustedElapsedSec: 1245,
  channelOffset: 0,
  cycleCount: 0,
  isSingleVideo: false
}
```

### 9.3 API Endpoints

**Diagnostic Endpoints**:
- `GET /api/broadcast-state/all` - All states (admin)
- `GET /api/broadcast-state/:channelId` - Single channel state
- `GET /api/broadcast-state/:channelId/timeline` - Timeline details

---

## 10. Common Issues & Solutions

### Issue: Videos not syncing across users

**Cause**: Global epoch not initialized or changed

**Solution**: Ensure epoch is set once and never modified

### Issue: Video switches too early/late

**Cause**: Incorrect video durations

**Solution**: Verify video durations in channel data

### Issue: Manual mode not returning to timeline

**Cause**: Manual mode persists until category change

**Solution**: Change category/channel to reset

### Issue: Position jumps unexpectedly

**Cause**: Channel offset calculation error

**Solution**: Check `jumpToVideo()` logic and offset normalization

---

## 11. Future Enhancements

### Potential Improvements:

1. **Server-Side Sync**: Sync global epoch across all users for true synchronization
2. **Time Zone Handling**: Support different time zones
3. **Playlist Scheduling**: Different playlists for different times of day
4. **Ad Breaks**: Insert ads at calculated intervals
5. **Live Events**: Support for actual live streams
6. **Multi-Device Sync**: Sync position across user's devices

---

## Summary

The pseudolive system creates a continuous, time-based broadcast experience by:

1. **Immutable Global Epoch**: Single reference point for all channels
2. **Timeline Calculation**: Position calculated from elapsed time, not saved state
3. **Playlist Looping**: Modulo operation handles infinite loops
4. **Manual Override**: Temporary manual mode for user control
5. **Persistence**: State saved to localStorage and optionally MongoDB
6. **Synchronization**: All users see same content at same time (within same epoch)

This creates the illusion of a live TV broadcast while using pre-recorded content, giving users the nostalgic experience of traditional television.

