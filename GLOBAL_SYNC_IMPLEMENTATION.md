# Global Sync Implementation (00s.myretrotvs.com Style)

## Overview
Implemented globally synchronized pseudo-live broadcast experience, similar to [00s.myretrotvs.com](https://00s.myretrotvs.com/). All users watching the same channel will see the same video at the same position, creating a true "live TV" experience.

## How It Works

### Global Sync Detection
The system automatically detects if a channel uses global sync by checking the `playlistStartEpoch`:

- **Global Sync**: If `playlistStartEpoch` is a fixed date (older than 24 hours, typically `2020-01-01T00:00:00Z`)
- **Local Sync**: If `playlistStartEpoch` is recent (within 24 hours) - uses per-session epoch

### Position Calculation
```javascript
// Global Sync Mode
const epoch = channel.playlistStartEpoch; // Fixed date (e.g., 2020-01-01)
const elapsed = (Date.now() - epoch) / 1000;
const cyclePosition = elapsed % totalPlaylistDuration;

// All users calculate from the same epoch → synchronized playback
```

### Key Features

1. **Automatic Detection**: No configuration needed - channels with fixed `playlistStartEpoch` automatically use global sync
2. **No Seeking in Global Mode**: Global sync channels disable manual seeking to maintain synchronization
3. **Backward Compatible**: Existing local sync behavior still works for channels without fixed epochs
4. **Seamless Switching**: Users can switch between global and local sync channels seamlessly

## Implementation Details

### Modified Files

1. **`client/src/logic/broadcast/BroadcastStateManager.js`**
   - Added `isGlobalSyncChannel()` method to detect global sync
   - Added `getChannelEpoch()` method to get appropriate epoch
   - Modified `calculateCurrentPosition()` to use channel epoch for global sync
   - Updated `jumpToVideo()` to disable seeking for global sync channels

2. **`client/src/components/Player.jsx`**
   - Updated `jumpToVideo()` calls to pass channel parameter

3. **`client/src/pages/Home.jsx`**
   - Updated `jumpToVideo()` calls to pass channel parameter

## Usage

### Enabling Global Sync for a Channel

Simply set the channel's `playlistStartEpoch` to a fixed date:

```javascript
{
  "_id": "...",
  "name": "Music",
  "playlistStartEpoch": "2020-01-01T00:00:00.000Z", // Fixed date = global sync
  "items": [...]
}
```

### Current Channels

All existing channels in `channels.json` already have:
```json
"playlistStartEpoch": "2020-01-01T00:00:00.000Z"
```

This means **all channels are now using global sync** by default! All users will see the same content at the same time.

## Behavior Differences

| Feature | Global Sync | Local Sync |
|---------|-------------|------------|
| **Synchronization** | All users see same content | Per-session timeline |
| **Epoch** | Channel's fixed `playlistStartEpoch` | User's first visit time |
| **Seeking** | Disabled (maintains sync) | Enabled (user control) |
| **Use Case** | True live TV experience | Flexible viewing |

## Testing

1. **Open the app in two different browsers/devices**
2. **Navigate to the same channel** (e.g., "Music")
3. **Verify both show the same video at the same position**
4. **Try seeking** - it should be disabled for global sync channels
5. **Switch channels** - synchronization should work across all channels

## Console Logs

When a channel uses global sync, you'll see:
```
[BroadcastState] Using GLOBAL SYNC epoch for channel Music: 2020-01-01T00:00:00.000Z
```

When seeking is attempted on a global sync channel:
```
[BroadcastState] Cannot jump - channel Music uses global sync (no seeking allowed)
```

## Future Enhancements

1. **Visual Indicator**: Show "LIVE" badge for global sync channels
2. **Channel Guide**: Display what's currently playing on each channel
3. **Server-Side Sync**: Add WebSocket support for real-time synchronization
4. **Hybrid Mode**: Allow channels to be configured as global or local via admin panel

## Notes

- Global sync maintains perfect synchronization across all users
- No server-side changes required - works entirely client-side
- Backward compatible with existing local sync behavior
- Channels can be switched between modes by changing `playlistStartEpoch`

