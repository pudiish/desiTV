# Broadcast State System - Test & Verification Guide

## ✅ What Has Been Fixed

### Single vs Multi-Video Handling
- **Single Video Channels**: Loop the same video continuously based on timeline
  - Position = `totalElapsed % videoDuration`
  - Always stays on video 0, offset cycles through video
  - Example: 5-minute video looped - after 7 min elapsed, resumes at 2:00

- **Multi-Video Channels**: Cycle through playlist based on video durations
  - Position = `totalElapsed % totalPlaylistDuration`
  - Calculates which video and offset within that video
  - Example: [5min, 3min, 4min] playlist (12min total) - after 14 min elapsed, resumes at video 1, offset 2:00

### State Persistence Across Reloads
- State saved to MongoDB every 5 seconds during playback
- State saved via sendBeacon on page unload
- State pre-loaded before player initializes
- Position calculated from elapsed time + saved state

## 🧪 Testing Procedures

### Test 1: Single Video Channel - Reload During Playback
```
Steps:
1. Select a single-video channel (only 1 item)
2. Let it play for 30+ seconds
3. Note the current playback time
4. Refresh the page (F5 or Cmd+R)
5. Wait for page to load
6. Check browser console for logs

Expected:
✓ Same video plays
✓ Video resumes at position advanced by time spent offline
✓ Console shows: "[BSM] SINGLE VIDEO MODE:"
✓ Console shows calculated offset

Example:
- Before reload: Playing at 1:23
- Refresh at 1:23
- Wait 10 seconds offline
- After reload: Should resume at ~1:33
```

### Test 2: Multi-Video Channel - Full Playlist Cycle
```
Steps:
1. Select a multi-video channel (2+ items)
2. Note total playlist duration (sum of all videos)
3. Let playlist play through 1+ full cycles
4. Refresh page
5. Check browser console

Expected:
✓ Correct video plays after cycle
✓ Correct offset within that video
✓ Console shows: "[BSM] MULTI-VIDEO MODE:"
✓ cycleCount incremented

Example:
- Playlist: [5min, 3min, 4min] = 12min total
- Before reload: at video 2, 2:00 (14min elapsed)
- After reload: at video 2, 2:00 (cycle advanced by offline time)
```

### Test 3: Long Offline Gap - App Closed for Extended Time
```
Steps:
1. Play a channel (single or multi)
2. Close the browser completely
3. Wait 2+ minutes
4. Reopen browser
5. Navigate back to app
6. Observe where it resumes

Expected:
✓ Timeline has progressed during offline time
✓ If single video: plays further into that loop
✓ If multi-video: may have cycled to different video
✓ Position accurately calculated from elapsed time

Console will show:
- "Pre-loaded state from DB"
- Total elapsed time (in hours/minutes)
- Calculated position matching offline gap
```

### Test 4: State Saved to MongoDB
```
Steps:
1. Play any channel for 10+ seconds
2. Open browser DevTools → Network tab
3. Filter for "broadcast-state"
4. Watch for POST requests to /api/channels/:id/broadcast-state
5. Every 5 seconds, you should see a POST request

Expected:
✓ POST request appears every 5 seconds
✓ Status: 200 OK
✓ Request body contains currentVideoIndex, currentTime, etc.

Or via terminal:
```bash
curl http://localhost:5002/api/broadcast-state/all | jq
```
Should show all channels with recent lastUpdate timestamps
```

### Test 5: Page Unload Save
```
Steps:
1. Start playing a channel
2. Open DevTools → Network tab (filter: XHR/Fetch)
3. Close the tab or navigate away
4. Check network tab for last request

Expected:
✓ Final POST to broadcast-state before unload
✓ Data includes current video index and timestamp
```

## 📊 Console Logging Examples

### Successful Single Video Channel Load
```
[BSM] Pre-loading state for channel: 507...
[BSM] Pre-loaded state from DB:
  videoIndex: 0
  currentTime: 123.5
  cyclePosition: 123.5

[BSM] Calculating position for 1 video(s):
  now: 2024-12-04T15:30:45.123Z
  epoch: 2024-01-01T00:00:00.000Z

[BSM] Total elapsed: 43200.1s (12.0h)

[BSM] SINGLE VIDEO MODE:
  videoDuration: 300.0
  offset: 0.1
  loopCount: 144

[BSM] Final position:
  videoIndex: 0
  offset: 0.1
  totalElapsed: 43200.1
```

### Successful Multi-Video Channel Load
```
[BSM] Pre-loading state for channel: 60c...
[BSM] Pre-loaded state from DB:
  videoIndex: 2
  currentTime: 150.0
  cyclePosition: 450.0

[BSM] Calculating position for 3 video(s):

[BSM] MULTI-VIDEO MODE:
  totalPlaylistDuration: 720.0
  cyclePosition: 510.0
  videoIndex: 2
  offsetInVideo: 150.0
  cycleCount: 5

[BSM] Final position:
  videoIndex: 2
  offset: 150.0
  totalElapsed: 4110.0
```

## 🔍 Debugging Checklist

- [ ] Browser console shows `[BSM]` logs
- [ ] No errors in console (red messages)
- [ ] Network tab shows POST to broadcast-state every 5s
- [ ] MongoDB has state records (check via curl or MongoDB client)
- [ ] Single video channels show "SINGLE VIDEO MODE"
- [ ] Multi-video channels show "MULTI-VIDEO MODE"
- [ ] Offset calculation matches expected values
- [ ] Position preserved after reload

## 🐛 Common Issues & Solutions

### Issue: State not loaded after reload
**Check:**
1. Is MongoDB connection working? Check server logs
2. Does channel have a playlistStartEpoch? Check channel data
3. Are video durations set? Each video should have duration

**Solution:**
```bash
# Check database
curl http://localhost:5002/api/broadcast-state/all | jq '.states[0]'

# Should show: channelId, playlistStartEpoch, videoDurations, currentTime
```

### Issue: Video doesn't resume at correct position
**Check:**
1. Open console, search for "Final position" logs
2. Verify offset matches where you expect to resume
3. Check elapsed time calculation

**Solution:**
- Offset might be slightly delayed due to player ready time
- Allow 1-2 seconds for player to load before seeking completes

### Issue: Single video not looping correctly
**Check:**
1. Console should show "SINGLE VIDEO MODE"
2. If shows "MULTI-VIDEO MODE", channel has multiple items

**Solution:**
```javascript
// In console:
BroadcastStateManager.getDiagnostics()
// Check: videoDurations should be single item array [300]
```

### Issue: Position jumps or skips
**Check:**
1. Network requests are succeeding (status 200)
2. No MongoDB errors in server logs
3. Video durations are accurate

**Solution:**
- May occur if duration values are wrong
- Verify video duration is correctly set in YouTube API

## 📋 Manual Verification Steps

```javascript
// In browser console:

// 1. Check current state
BroadcastStateManager.getDiagnostics()

// 2. Check last calculated position
BroadcastStateManager.lastCalculatedPosition

// 3. Get specific channel state
BroadcastStateManager.getChannelState('channelId')

// 4. Manually calculate position
const channel = { items: [...] } // Get from props
const state = BroadcastStateManager.getChannelState('channelId')
const position = BroadcastStateManager.calculateCurrentPosition(channel, state)
console.log(position)

// 5. Subscribe to state changes
BroadcastStateManager.subscribe(({ event, data }) => {
  console.log('Event:', event)
  console.log('Data:', data)
})
```

## ✅ Success Criteria

All of the following should be true:

- [x] Single video channels loop based on timeline
- [x] Multi-video channels cycle through based on durations
- [x] State persists across page reloads
- [x] Position correctly calculated from elapsed time
- [x] No errors in console
- [x] Database saves occur every 5 seconds
- [x] sendBeacon saves on page unload
- [x] Long offline gaps handled correctly
- [x] Video resumes at correct offset

## 🎬 Example Scenarios

### Scenario 1: Sports Channel (Single Video - Live Feed)
```
Channel: "Live Sports"
Videos: 1 × 24-hour stream (86400s)

Timeline:
- User starts watching at 10:00 AM
- Watches for 30 minutes
- Closes app (10:30 AM)
- Reopens app at 11:00 AM (30 min later)

Expected:
- Stream has progressed 30 more minutes
- Resumes at current live position (11:00 AM equivalent)
- No video change (still same video)
- Offset = elapsed time % 86400s
```

### Scenario 2: News Channel (Multi-Video - Rotating Content)
```
Channel: "24-Hour News"
Videos: [10min, 8min, 12min, 5min] = 35min cycle

Timeline:
- User watches news at 9:00 AM
- After 40 minutes, current time is 9:40 AM
- Watched: full 35min cycle + 5min into 2nd cycle
- Current: Video 1, offset 5:00

Events:
- Closes at 9:40 AM
- Reopens at 10:00 AM (20 min later)
- 20 more minutes elapsed
- New total: 60 minutes elapsed
- New position: 60 % 35 = 25 min into cycle
- Expected: Video 3, offset 5:00 (25 = 10+8+7)
```

## 📞 Support

If issues persist:
1. Check server logs: `npm run dev` in /server
2. Check browser console: DevTools F12
3. Check network tab: Monitor broadcast-state requests
4. Check MongoDB: Verify state documents exist

All logs should show `[BSM]` prefix for BroadcastStateManager events.

