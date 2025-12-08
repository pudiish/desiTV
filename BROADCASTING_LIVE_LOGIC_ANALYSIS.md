# Broadcasting Live Logic Analysis

## Overview
The DesiTV system implements a **pseudo-live broadcasting** system that simulates continuous TV channels. The core principle is: **"THE BROADCAST NEVER STOPS"** - each channel maintains its own independent timeline that continues even when users switch channels or close the app.

---

## Core Architecture

### 1. **Global Timeline Epoch System**
The system uses a **single global epoch** (`globalEpoch`) that is shared by ALL channels. This epoch is set once when the user first starts the TV (when channels are loaded) and **never changes**. All channels calculate their positions from this common timeline, ensuring perfect synchronization across all channels.

**Key Files:**
- `client/src/utils/LocalBroadcastStateManager.js` - Client-side state management with global epoch
- `server/models/BroadcastState.js` - Server-side model (if using MongoDB)

### 2. **State Storage**
- **Client-side**: Uses `localStorage` via `LocalBroadcastStateManager`
- **Server-side**: Optional MongoDB storage via `BroadcastState` model
- **Global Epoch**: Stored separately in `localStorage` as `desitv-global-epoch`
- **Channel Metadata**: Each channel stores only playlist metadata (durations, etc.), not timeline

---

## How Broadcasting Works for Each Channel

### Step-by-Step Process:

#### **A. Global Timeline Initialization**
When the user first starts the TV (when channels are loaded):

```javascript
// From LocalBroadcastStateManager.initializeGlobalEpoch()
globalEpoch = "2024-01-15T10:00:00Z" // Set ONCE when TV starts, shared by ALL channels

// All channels are initialized in background:
LocalBroadcastStateManager.initializeAllChannels(allChannels)

// Each channel stores only metadata:
{
  channelId: "channel-123",
  channelName: "Music Channel",
  playlistTotalDuration: 3600, // Total seconds in playlist cycle
  videoDurations: [300, 450, 600], // Duration of each video
  lastAccessTime: "2024-01-15T10:00:00Z"
  // NO playlistStartEpoch - uses globalEpoch instead
}
```

#### **B. Position Calculation Algorithm**
The system calculates the current position using the **global epoch**:

```javascript
// From LocalBroadcastStateManager.calculateCurrentPosition()

1. Calculate total elapsed time from GLOBAL epoch:
   totalElapsedSec = (now - globalEpoch) / 1000
   // All channels use the SAME elapsed time

2. Find position in current cycle (per channel):
   cyclePosition = totalElapsedSec % playlistTotalDuration
   // Each channel has different playlistTotalDuration

3. Find which video is playing (per channel):
   - Iterate through videoDurations array for this channel
   - Find where cumulative duration > cyclePosition
   - videoIndex = index of that video
   - offset = cyclePosition - cumulative duration before that video
```

**Example:**
- Global epoch: 1 hour ago (3600 seconds elapsed)
- Channel A playlist: Video 1 (10 min), Video 2 (10 min), Video 3 (10 min) = 1800 seconds total
- Channel B playlist: Video 1 (5 min), Video 2 (5 min) = 600 seconds total
- Current time: 35 minutes elapsed = 2100 seconds
- **Channel A**: Cycle position = 2100 % 1800 = 300 seconds → Video 2 at 5 minutes
- **Channel B**: Cycle position = 2100 % 600 = 300 seconds → Video 1 at 5 minutes
- Both channels use the same elapsed time but different cycle positions!

#### **C. Two Special Cases**

**Case 1: Single Video Channel**
```javascript
if (channel.items.length === 1) {
  cyclePosition = totalElapsedSec % singleVideoDuration
  // Video loops continuously
}
```

**Case 2: Multiple Videos**
```javascript
// Normal playlist cycling
cyclePosition = totalElapsedSec % totalDurationSec
// Then find video index by iterating through durations
```

---

## How Timeline is Maintained During Channel Switching

### Key Principle: **Shared Global Timeline**

All channels share the **same global timeline** that continues running even when you're not watching a particular channel. When you switch channels, each channel calculates its position from the same global elapsed time, but applies it to its own playlist cycle.

### Channel Switch Flow:

#### **1. When User Switches FROM Channel A to Channel B:**

```javascript
// From Player.jsx - useEffect on channel change
useEffect(() => {
  if (channel?._id !== channelIdRef.current) {
    // Channel changed!
    
    // 1. No need to save state - global epoch is already saved
    // Channel metadata is already initialized when TV started
    
    // 2. Reset player state for new channel
    channelIdRef.current = channel?._id
    hasInitializedRef.current = false
    videoLoadedRef.current = false
    
    // 3. Position is calculated from global epoch automatically
    // useBroadcastPosition hook uses global timeline
  }
}, [channel?._id])
```

#### **2. Timeline Preservation Mechanism:**

**Global Timeline:**
- Global epoch: `2024-01-15T10:00:00Z` (set when TV started)
- All channels use this same epoch

**Channel A:**
- Playlist: 1800 seconds total
- When you switch away at `10:30:00`: 30 min elapsed = 1800 sec → Cycle position = 0
- When you switch back at `11:00:00`: 60 min elapsed = 3600 sec → Cycle position = 0
- **Result**: Channel A shows Video 1 at start (cycle reset)

**Channel B:**
- Playlist: 600 seconds total
- When you switch to it at `10:30:00`: 30 min elapsed = 1800 sec → Cycle position = 0
- **Result**: Channel B shows Video 1 at start (cycle reset)

**Key Point**: Both channels use the same elapsed time (1800 seconds), but their cycle positions differ based on their playlist durations!

### Visual Example:

```
Global Timeline View:
====================

Global Epoch: 10:00:00 (shared by ALL channels)

Elapsed Time: 30 minutes (1800 seconds)

Channel A (Music) - Playlist: 1800 sec total:
10:00 ──────────[Video 1]──────────[Video 2]──────────[Video 3]─────
       ↑epoch    ↑you watched      ↑you switch away    ↑you switch back
                 10:00-10:30       at 10:30            at 11:00
                 
                 Cycle position: 1800 % 1800 = 0
                 Shows: Video 1 at start

Channel B (Movies) - Playlist: 600 sec total:
10:00 ──────────[Movie 1]──────────[Movie 2]──────────[Movie 3]─────
       ↑epoch    ↑you switch here   ↑you're watching
                 10:30              at 10:30
                 
                 Cycle position: 1800 % 600 = 0
                 Shows: Movie 1 at start

Key: Both use same elapsed time (1800 sec), but different cycle positions!
```

---

## Key Components

### 1. **LocalBroadcastStateManager** (`client/src/utils/LocalBroadcastStateManager.js`)
- **Purpose**: Manages broadcast state in localStorage with global timeline
- **Key Methods**:
  - `initializeGlobalEpoch()` - Sets the global timeline epoch (called when TV starts)
  - `initializeAllChannels(channels)` - Initializes all channels in background
  - `initializeChannel(channel)` - Sets up channel metadata (uses global epoch)
  - `calculateCurrentPosition(channel)` - Core algorithm using global epoch
  - `updateChannelState(channelId, updateData)` - Updates channel metadata
  - `jumpToVideo(channelId, videoIndex, offset)` - Manual jump (adjusts global epoch - affects all channels)

### 2. **useBroadcastPosition Hook** (`client/src/hooks/useBroadcastPosition.js`)
- **Purpose**: React hook that provides current broadcast position
- **Usage**: All components use this as single source of truth
- **Returns**:
  ```javascript
  {
    videoIndex: 2,
    video: currentVideoObject,
    offset: 125.5, // seconds into current video
    timeRemaining: 174.5, // seconds until next video
    nextVideoIndex: 3,
    nextVideo: nextVideoObject,
    cyclePosition: 1825.5,
    totalPlaylistDuration: 3600,
    isValid: true
  }
  ```

### 3. **Player Component** (`client/src/components/Player.jsx`)
- **Purpose**: YouTube player that uses broadcast position
- **Key Behavior**:
  - Uses `useBroadcastPosition(channel)` to get current video
  - Seeks to calculated `offset` when video loads
  - Switches to next video when current ends
  - Maintains timeline continuity

### 4. **pseudoLive.js** (`client/src/utils/pseudoLive.js`)
- **Purpose**: Utility functions for pseudo-live calculations
- **Key Functions**:
  - `getPseudoLiveItem(playlist, startEpoch)` - Calculate current item
  - `getNextVideoInSequence(playlist, currentIndex, cyclePosition)` - Calculate next video

---

## Timeline Continuity Examples

### Example 1: User Closes App and Returns

**Scenario:**
- User starts TV at 10:00 AM (global epoch set to 10:00)
- User watches Channel A
- User closes app at 10:30 AM (30 min elapsed)
- User returns at 2:00 PM (4 hours later)

**What Happens:**
```javascript
globalEpoch = 10:00 AM (unchanged)
totalElapsedSec = (2:00 PM - 10:00 AM) = 4 hours = 14400 seconds

// All channels calculate from same elapsed time:
Channel A: cyclePosition = 14400 % channelA_playlistDuration
Channel B: cyclePosition = 14400 % channelB_playlistDuration
Channel C: cyclePosition = 14400 % channelC_playlistDuration

// Each channel shows content from its calculated cycle position
```

### Example 2: Switching Between Multiple Channels

**Scenario:**
- 10:00 AM: TV starts (global epoch set to 10:00 for ALL channels)
- 10:15 AM: Switch to Channel B
- 10:30 AM: Switch back to Channel A
- 10:45 AM: Switch to Channel C

**Timeline States (all use same global epoch):**
- **Global Epoch**: 10:00 AM (unchanged)
- **Elapsed Time at 10:30**: 30 minutes = 1800 seconds
- **Channel A**: cyclePosition = 1800 % channelA_duration
- **Channel B**: cyclePosition = 1800 % channelB_duration
- **Channel C**: cyclePosition = 1800 % channelC_duration

**When switching back to Channel B at 11:00:**
- **Elapsed Time**: 60 minutes = 3600 seconds
- **Channel B**: cyclePosition = 3600 % channelB_duration
- Shows content from calculated cycle position

---

## Auto-Save Mechanism

### Frequency:
- State is auto-saved to localStorage **every 5 seconds**
- Also saved on:
  - Page unload (`beforeunload` event)
  - Channel state updates
  - Manual state changes

### What Gets Saved:
```javascript
// Global Epoch (separate storage):
globalEpoch: "2024-01-15T10:00:00Z" // NEVER changes, shared by all channels

// Per-Channel Metadata:
{
  channelId: "channel-123",
  channelName: "Music Channel",
  playlistTotalDuration: 3600,
  videoDurations: [300, 450, 600],
  lastAccessTime: "2024-01-15T11:30:00Z" // Updates on access
  // NO playlistStartEpoch - uses globalEpoch instead
}
```

### What Does NOT Get Saved:
- `currentVideoIndex` - Calculated on-the-fly from global epoch
- `currentTime` - Calculated on-the-fly from global epoch
- `playbackRate` - Not needed for timeline
- `playlistStartEpoch` - Uses global epoch instead

**Why?** Because these are calculated from the global epoch, not stored. This ensures all channels stay perfectly synchronized and the timeline always reflects "real time" position.

---

## Important Design Decisions

### 1. **Global Epoch Never Changes**
- Once set, `globalEpoch` is immutable and shared by ALL channels
- This ensures timeline continuity and perfect synchronization
- If you want to "reset" all channels, you must reset the global epoch

### 2. **Shared Global Timeline**
- All channels use the same global epoch
- Channels calculate different cycle positions from the same elapsed time
- Switching channels doesn't pause/resume - all timelines keep running in sync

### 3. **Calculation-Based, Not Storage-Based**
- Current position is **calculated**, not stored
- Formula: `(now - globalEpoch) % channelPlaylistDuration`
- This ensures accuracy even after long absences
- All channels stay synchronized because they use the same elapsed time

### 4. **Background Initialization**
- All channels are initialized when TV starts (not when first watched)
- Timeline starts for all channels simultaneously
- Menu shows "NOW" and "NEXT" for all channels, not just active one

### 5. **localStorage-First Approach**
- Primary storage is client-side localStorage
- Global epoch stored separately from channel metadata
- Server-side storage (MongoDB) is optional
- Works offline, no server dependency for timeline

---

## Flow Diagram

```
User Opens App / TV Starts
    ↓
Load Channels from JSON
    ↓
LocalBroadcastStateManager.initializeAllChannels()
    ↓
Check: Does global epoch exist?
    ├─ NO → Create global epoch (now)
    └─ YES → Use existing global epoch
    ↓
Initialize ALL channels in background:
    - Store playlist metadata (durations, etc.)
    - NO per-channel epochs (uses global epoch)
    ↓
User selects channel:
    ↓
useBroadcastPosition hook calculates:
    - totalElapsedSec = now - globalEpoch (shared by all)
    - cyclePosition = totalElapsedSec % channelPlaylistDuration
    - Find videoIndex and offset for THIS channel
    ↓
Player component:
    - Loads video at videoIndex
    - Seeks to offset position
    - Starts playback
    ↓
Every 5 seconds:
    - Auto-save global epoch and channel metadata to localStorage
    ↓
User switches channel:
    - New channel position calculated from same global epoch
    - Different cycle position (different playlist duration)
    - Player loads new video
    ↓
All channels continue from shared global timeline
Menu shows NOW/NEXT for all channels
```

---

## Summary

1. **All channels share a single global timeline** starting from when TV first starts
2. **Global timeline continues running** even when you switch channels or close the app
3. **Position is calculated** from global elapsed time, not stored playback position
4. **Global epoch is stored separately** in localStorage, auto-saved every 5 seconds
5. **All channels are initialized in background** when TV starts, not when first watched
6. **Switching channels** calculates position from same global elapsed time but different cycle positions
7. **Menu shows NOW/NEXT for all channels** using the global timeline
8. **The broadcast never stops** - it's like real TV where all channels keep playing in sync

This creates a seamless "live TV" experience where all channels are perfectly synchronized to a common timeline, and switching channels is like changing the channel on a real TV where all channels are broadcasting simultaneously.

