# Broadcast State Persistence System

## Overview

The Broadcast State System enables **true pseudo-live broadcast** functionality where:
- Videos continue playing virtually even when the app is closed
- Upon reopening, the app automatically resumes at the correct position in the timeline
- No actual playback needed offline; just timestamp advancement
- Perfect TV broadcast simulation experience

## Architecture

### Core Components

#### 1. BroadcastStateManager (Client-Side)
**Location:** `client/src/utils/BroadcastStateManager.js`

Manages virtual broadcast state with:
- **Virtual Timeline Calculation**: Determines current video and offset based on elapsed time
- **Database Synchronization**: Periodic 5-second sync to backend
- **State Persistence**: Maintains state across sessions
- **Listener Pattern**: Notifies components of state changes

#### 2. Broadcast State Routes (Server-Side)
**Location:** `server/routes/broadcastState.js`

API endpoints for state management:
- `GET /api/channels/:channelId/broadcast-state` - Retrieve state
- `POST /api/channels/:channelId/broadcast-state` - Save state
- `GET /api/channels/:channelId/broadcast-state/timeline` - Calculate timeline
- `DELETE /api/channels/:channelId/broadcast-state` - Clear state
- `GET /api/broadcast-state/all` - Admin diagnostics

#### 3. Player Integration
**Location:** `client/src/components/Player.jsx`

Integrated with Player component:
- Initializes BroadcastStateManager on player ready
- Starts auto-sync on playback
- Stops sync on component unmount

## How It Works

### 1. Virtual Timeline Calculation

```javascript
// Calculate where we should be in broadcast timeline
const elapsedTime = now - playlistStartEpoch
const cyclePosition = elapsedTime % totalPlaylistDuration

// Find which video + offset in that video
videoIndex = findVideoByPosition(cyclePosition)
offset = getOffsetInVideo(cyclePosition)
```

**Key Insight:** The timeline never stops. It keeps advancing regardless of whether the app is open or closed.

### 2. State Initialization (App Start)

```javascript
// On app start, calculate where timeline should be
const position = BroadcastStateManager.calculateCurrentPosition(channel, uiLoadTime)

// Seek to calculated position automatically
player.seekTo(position.offset)

// Begin playback from correct position
player.playVideo()
```

### 3. State Persistence (During Playback)

```javascript
// Every 5 seconds, sync current state to database
BroadcastStateManager.startAutoSync((channelId, state) => {
  fetch(`/api/channels/${channelId}/broadcast-state`, {
    method: 'POST',
    body: JSON.stringify(state)
  })
})
```

### 4. State Restoration (App Restart)

```javascript
// When app reopens, load last saved state
const savedState = await BroadcastStateManager.loadFromDB(channelId)

// Calculate where timeline SHOULD be now based on elapsed time
const currentPosition = BroadcastStateManager.calculateCurrentPosition(channel, now)

// If user tuned in for more than 5 seconds since last app close,
// timeline has advanced - resume from calculated position
player.seekTo(currentPosition.offset)
```

## API Reference

### BroadcastStateManager Methods

#### `calculateCurrentPosition(channel, uiLoadTime)`
Calculates current video and playback offset based on elapsed time.

```javascript
const position = BroadcastStateManager.calculateCurrentPosition(channel, new Date())
// Returns: { videoIndex, offset, cyclePosition, totalDuration, elapsedMs }
```

#### `updateChannelState(channelId, updateData)`
Updates in-memory state for a channel.

```javascript
BroadcastStateManager.updateChannelState(channelId, {
  channelName: channel.name,
  currentVideoIndex: 0,
  currentTime: 0,
  playlistStartEpoch: new Date()
})
```

#### `startAutoSync(onSync)`
Starts periodic sync to database (every 5 seconds).

```javascript
BroadcastStateManager.startAutoSync((channelId, state) => {
  console.log('Syncing state:', state)
})
```

#### `stopAutoSync()`
Stops auto-sync on component unmount.

```javascript
BroadcastStateManager.stopAutoSync()
```

#### `saveToDB(channelId, stateData)`
Manual save to database (not needed if auto-sync is running).

```javascript
await BroadcastStateManager.saveToDB(channelId, stateData)
```

#### `loadFromDB(channelId)`
Loads state from database (called on app restart).

```javascript
const state = await BroadcastStateManager.loadFromDB(channelId)
```

#### `getDiagnostics()`
Get diagnostic information about broadcast state.

```javascript
const diagnostics = BroadcastStateManager.getDiagnostics()
// Returns: { channelCount, channels, lastSync, isSyncing }
```

### Backend API

#### GET /api/channels/:channelId/broadcast-state
Retrieve current broadcast state for a channel.

```bash
curl http://localhost:5002/api/channels/abc123/broadcast-state
```

Response:
```json
{
  "channelId": "abc123",
  "channelName": "CNN",
  "currentVideoIndex": 3,
  "currentTime": 125.5,
  "playlistStartEpoch": "2024-01-01T00:00:00Z",
  "lastUpdate": "2024-01-08T14:30:00Z",
  "timeSinceLastUpdate": 3.2,
  "calculatedAt": "2024-01-08T14:30:03.2Z"
}
```

#### POST /api/channels/:channelId/broadcast-state
Save or update broadcast state.

```bash
curl -X POST http://localhost:5002/api/channels/abc123/broadcast-state \
  -H "Content-Type: application/json" \
  -d '{
    "channelName": "CNN",
    "currentVideoIndex": 3,
    "currentTime": 125.5,
    "playlistStartEpoch": "2024-01-01T00:00:00Z"
  }'
```

#### GET /api/channels/:channelId/broadcast-state/timeline
Get timeline calculation data.

```bash
curl http://localhost:5002/api/channels/abc123/broadcast-state/timeline
```

Response:
```json
{
  "channelId": "abc123",
  "currentTime": "2024-01-08T14:30:03Z",
  "playlistStartEpoch": "2024-01-01T00:00:00Z",
  "elapsedMs": 604803000,
  "elapsedSeconds": 604803,
  "lastStateUpdate": "2024-01-08T14:30:00Z",
  "timeSinceStateUpdate": 3.2
}
```

#### DELETE /api/channels/:channelId/broadcast-state
Clear broadcast state for a channel.

```bash
curl -X DELETE http://localhost:5002/api/channels/abc123/broadcast-state
```

## Integration Guide

### Player Component Integration (Already Done)

The Player component automatically:
1. Initializes BroadcastStateManager on mount
2. Updates state when video changes
3. Starts auto-sync on player ready
4. Stops sync on unmount

### Custom Integration Example

```javascript
import BroadcastStateManager from '../utils/BroadcastStateManager'

// In your component
useEffect(() => {
  if (channel?._id) {
    // Initialize state
    BroadcastStateManager.updateChannelState(channel._id, {
      channelName: channel.name,
      currentVideoIndex: 0,
      playlistStartEpoch: new Date()
    })
    
    // Start auto-sync
    BroadcastStateManager.startAutoSync((channelId, state) => {
      // State is automatically saved to database
    })
    
    // Listen for state changes
    const unsubscribe = BroadcastStateManager.subscribe(({ event, data }) => {
      if (event === 'synced') {
        console.log('State synced to database')
      }
    })
    
    // Cleanup
    return () => {
      BroadcastStateManager.stopAutoSync()
      unsubscribe()
    }
  }
}, [channel?._id])
```

## Features

### ✅ Virtual Timeline
- Broadcast timeline continues advancing even when app is closed
- Based on elapsed time, not absolute position
- Handles large playlists efficiently

### ✅ State Persistence
- Stores state in database every 5 seconds
- Survives app restarts
- Restored automatically on app reopen

### ✅ Offset Calculation
- Accounts for video duration
- Calculates correct offset in current video
- Handles playlist cycling

### ✅ Diagnostic Tools
- Built-in diagnostics via `getDiagnostics()`
- Admin endpoint: `/api/broadcast-state/all`
- Tracks sync status and timing

## Edge Cases Handled

1. **Long App Closure**
   - Timeline calculated from elapsed time
   - Even if app closed for hours, correct position calculated

2. **Short App Closure**
   - Minimal time advance, near same position
   - Smooth resume experience

3. **Large Playlists**
   - Efficient modulo calculation
   - No performance degradation

4. **Video Duration Variation**
   - Uses actual video duration when available
   - Falls back to reasonable estimates

5. **Multiple Channel Switching**
   - State tracked per channel
   - Each channel maintains separate timeline

## Performance Considerations

- **Sync Frequency:** 5 seconds (configurable via `syncIntervalMs`)
- **Network Impact:** Minimal payload (~500 bytes per sync)
- **Storage Impact:** One document per channel in database
- **Memory:** Lightweight in-memory state cache

## Troubleshooting

### State Not Persisting
- Check backend API is running (`curl http://localhost:5002/api/broadcast-state/all`)
- Verify database connection in server logs
- Check browser console for fetch errors

### Timeline Jumping
- Verify `playlistStartEpoch` is set correctly
- Check that video durations are accurate in channel data
- Clear database state and restart app

### App Not Resuming at Correct Position
- Ensure BroadcastStateManager is initialized before playback starts
- Verify backend is saving state (check `/api/broadcast-state/all`)
- Check that channel `_id` is consistent across sessions

## Testing

### Manual Test Procedure

1. **Open App**
   ```
   Note the channel and video playing
   ```

2. **Close App**
   ```
   Close browser tab or stop dev server
   Wait 30+ seconds
   ```

3. **Reopen App**
   ```
   Same channel should be playing
   Video should be advanced by ~30 seconds
   Timeline should have progressed
   ```

4. **Verify Database**
   ```
   curl http://localhost:5002/api/broadcast-state/all
   Should show updated state with recent lastUpdate timestamp
   ```

## Future Enhancements

- [ ] MongoDB persistence instead of in-memory cache
- [ ] User preference: "Resume where I left off" vs "Resume broadcast timeline"
- [ ] Multi-device synchronization
- [ ] Historical timeline data for analytics
- [ ] Time-zone aware scheduling

## Related Files

- `/server/routes/broadcastState.js` - Backend API implementation
- `/server/index.js` - Server configuration with route registration
- `/client/src/utils/BroadcastStateManager.js` - Core state manager
- `/client/src/components/Player.jsx` - Player integration
- `/client/src/utils/pseudoLive.js` - Pseudo-live calculation utilities

