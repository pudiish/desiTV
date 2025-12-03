# Retro TV Debugging Guide

## Recent Changes Summary

### Channel Switching Video Loading Fix
The following changes were made to improve channel switching and video loading:

#### 1. Player Component Enhancements (`client/src/components/Player.jsx`)

**Channel Change Detection & Logging:**
- Added logging when channel changes: `"Channel changed from X to Y with Z items"`
- Logs item count to help diagnose empty playlist issues
- Added warning if channel or items array is missing

**Player Key Generation:**
- Uses `channelChangeCounterRef` to force YouTube iframe remount on channel switch
- Ensures clean slate when changing channels
- Key format: `${channel._id}-${youtubeId}-${currIndex}-${counterRef.current}`

**Offset Management:**
- Sets offset to 0 when channel changes (start from beginning)
- Uses pseudo-live offset only when continuing in same channel
- Validates offset as a number before passing to YouTube player

**Enhanced Video Ready Handler (onReady):**
- Logs: `"Playing video: [youtubeId] at index: [currIndex]"`
- Logs: `"Setting offset: [offset]ms"`
- Logs: `"Player options: autoplay=[true/false], start=[offset], volume=[vol]"`
- Improved error handling with console logging

**Enhanced State Change Handler (onStateChange):**
- Maps YouTube state codes to human-readable names
- Logs all state transitions:
  - -1: UNSTARTED
  - 0: ENDED
  - 1: PLAYING
  - 2: PAUSED
  - 3: BUFFERING
  - 5: CUED
- 8 separate console messages showing state transitions and indices

**Defensive Null Checks:**
- Validates items array exists before accessing
- Warns if current video is null
- Prevents crashes on empty playlists

## Testing Guide

### 1. **Console Logging Setup**
Open browser DevTools (F12) and go to Console tab before testing.

### 2. **Test Cases**

#### Test 1: Basic Channel Switch
1. Start app and select a channel (e.g., "1970s")
2. Watch console for logs
3. Switch to a different channel (e.g., "1980s")
4. **Expected Output:**
   ```
   Channel changed from [channel1] to [channel2] with [n] items
   Playing video: [youtubeId] at index: 0
   Setting offset: 0ms
   Player options: autoplay=true, start=0, volume=[vol]
   onStateChange: UNSTARTED → BUFFERING → PLAYING
   ```

#### Test 2: Same Channel Continuation
1. Play video in a channel
2. Switch to different channel, play a video
3. Switch back to original channel
4. **Expected Output:**
   - Should resume from same video or advance to next
   - Logs should show channel switching with counter increments

#### Test 3: Ad Playback Flow
1. Watch a video to completion
2. **Expected Output:**
   ```
   onStateChange: PLAYING → ENDED (for video)
   [handleVideoEnd] Playing ad...
   Channel changed from [channel] to Ads with [n] items
   [Ad plays]
   [handleVideoEnd] Resuming original channel...
   Channel changed from Ads to [channel]
   Advancing to next video after ad...
   ```

#### Test 4: Empty Playlist Handling
1. If a channel loads with no items
2. **Expected Output:**
   ```
   [Player] Current video is null at index 0 out of 0
   Console warnings about null channel/items
   ```

### 3. **Console Log Reference**

Look for these debug messages in console:

**Channel Changes:**
- `Channel changed from [old] to [new] with [count] items`

**Video Playback:**
- `Playing video: [youtubeId] at index: [idx]`
- `Setting offset: [ms]ms`
- `Player options: autoplay=true, start=[offset], volume=[vol]`

**State Transitions:**
- `onStateChange: [old_state] → [new_state]`
- `Video advancing to next index: [idx]`

**Errors/Warnings:**
- `[Player] Channel is null`
- `[Player] Items array is null/undefined`
- `[Player] Current video is null at index [idx]`
- `[Player] onReady error: [error]`

### 4. **Debug Mode (Cache Stats)**
Press `Ctrl+Shift+D` to toggle debug mode which shows:
- Cache hits: N
- Cache misses: M
- Hit rate: X%
- Items in cache: N

## Known Behaviors

### Channel Change Counter
- Increments every time channel changes
- Forces YouTube iframe component to completely remount
- Ensures clean state (no stale video data)

### Offset Handling
- First time in channel: offset = 0 (start from beginning)
- Continuing in channel: uses pseudo-live offset
- Channel change: always resets to 0

### Ad Injection
- Detects when regular video ends
- Loads random ad from "Ads" channel
- Returns to original channel and advances to next video
- shouldAdvanceVideo flag signals when to advance

## Troubleshooting

### Issue: Video doesn't load on channel switch
**Check:**
1. Browser console for error messages
2. Verify channel has items in playlist
3. Look for "Channel changed" log with item count
4. Check if items array is null in logs

### Issue: Video keeps playing same video on channel return
**Check:**
1. Verify currentIndex is incrementing in logs
2. Check if manualIndex is being set
3. Look for "Advancing to next video" log
4. Verify shouldAdvanceVideo is being passed correctly

### Issue: Ad doesn't play
**Check:**
1. Verify "Ads" channel exists in channels list
2. Check if "Ads" channel has videos
3. Look for handleVideoEnd logs
4. Verify channel switching logs show "Ads" channel

### Issue: Console shows state transitions but video doesn't play
**Check:**
1. Verify BUFFERING and PLAYING states appear
2. Check if onReady was called with offset
3. Verify YouTube iframe is visible in Elements tab
4. Check browser network tab for YouTube API calls

## Quick Debug Checklist

- [ ] Open DevTools Console (F12)
- [ ] Switch channels and observe logs
- [ ] Watch for "Channel changed" message
- [ ] Verify state transitions appear (BUFFERING → PLAYING)
- [ ] Check if "Playing video" logs show correct youtubeId
- [ ] Look for any error messages in red
- [ ] Note the offset being used (should be 0 on channel change)
- [ ] Toggle debug mode (Ctrl+Shift+D) to see cache stats
- [ ] Play video to completion and observe ad flow

## Performance Monitoring

The buffer cache tracks:
- **Hits**: Data retrieved from cache
- **Misses**: Data fetched from server
- **Hit Rate %**: Success rate of cache lookups

Debug mode shows these stats to monitor caching efficiency.

## Next Steps if Issue Persists

1. **Collect console output** when issue occurs
2. **Check specific logs:**
   - Does "Channel changed" message appear?
   - What is the items count?
   - Are state transitions showing?
3. **Note reproducibility:**
   - Does it happen on every channel switch?
   - Does it happen with specific channels only?
   - Does it happen after playing ad?
4. **Share relevant logs** showing the exact point where video loading fails
