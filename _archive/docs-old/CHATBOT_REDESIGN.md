# DesiTV AI Chatbot Redesign - Engineering Analysis

## Current Issues Identified

### 1. **Context Not Reaching Backend Properly**
**Problem:** The VJ chatbot can't accurately tell what's playing because:
- Context is passed from VJChat → chatService → chatController → vjCore
- The context object often has `undefined` fields
- Player component has the actual live state but it's not synced

**Root Cause:**
```jsx
// VJChat.jsx sends context like:
const context = {
  currentChannel,        // ❌ Sometimes undefined
  currentChannelId,      // ❌ Sometimes null
  currentVideo: {...},   // ❌ May not reflect actual playing video
  ...
};
```

### 2. **Channel Switch Unreliable**
**Problem:** 
- Action `CHANGE_CHANNEL` is returned but Home.jsx doesn't always execute it
- Category/channel mapping is inconsistent (sometimes uses `_id`, sometimes `name`)
- BroadcastStateManager state updates don't propagate reliably

**Root Cause:**
```jsx
// Home.jsx channel change handler
onChangeChannel={(channel) => {
  const targetCategory = categories.find(
    c => c._id === channel._id || c.name === channel.name  // ❌ Fuzzy matching
  );
  // ❌ No confirmation if channel was actually changed
}}
```

### 3. **YouTube Video Playback Failures**
**Problem:**
- Videos sometimes don't load (API key issues, embeddability, regional)
- External videos (from search) play inconsistently
- No robust fallback when video fails

**Root Cause:**
- `onPlayExternal` handler doesn't validate video availability
- YouTube API quota limits not handled gracefully
- Missing retry logic for temporary failures

### 4. **Manual/Live Toggle Issues**
**Problem:**
- Users get stuck in manual mode after changing videos
- "Return to LIVE" doesn't always work
- State inconsistency between BroadcastStateManager and Player

---

## Proposed Architecture

### New Context Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     FRONTEND (Real-time State)                   │
├─────────────────────────────────────────────────────────────────┤
│  Player.jsx                                                     │
│    ├── playbackInfo {videoTitle, currentTime, isPlaying, etc}  │
│    └── onPlaybackProgress() → updates every second              │
│                                                                 │
│  TVState (useTVState hook)                                     │
│    ├── playbackInfo: {...}  ← Single source of truth           │
│    ├── selectedCategory                                         │
│    └── externalVideo                                           │
│                                                                 │
│  VJChat.jsx                                                    │
│    └── Builds context from TVState (NOT local props)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (Processing)                         │
├─────────────────────────────────────────────────────────────────┤
│  chatController.js                                              │
│    ├── Validates context                                        │
│    ├── Enriches with DB data (channel info, etc)               │
│    └── Calls vjCore.processMessage()                           │
│                                                                 │
│  vjCore.js                                                      │
│    ├── Intent detection                                        │
│    ├── FACTUAL queries → Pre-built responses (no AI)           │
│    ├── ACTIONS → Returns structured action objects             │
│    └── GENERAL → Passes to Gemini AI                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     ACTION EXECUTION                             │
├─────────────────────────────────────────────────────────────────┤
│  VJChat.jsx → executeAction()                                   │
│    ├── CHANGE_CHANNEL → setCategory() + confirmSwitch()        │
│    ├── PLAY_VIDEO → broadcastManager.jumpToVideo() + confirm   │
│    └── PLAY_EXTERNAL → validateVideo() → actions.playExternal()│
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Context Enhancement (HIGH PRIORITY)

1. **Create PlaybackContext Provider**
   - Single source of truth for current playback state
   - Player.jsx updates it every second
   - VJChat reads from it (not props)

2. **Enhance VJCore Context Handling**
   - Add context validation with defaults
   - Log context issues for debugging
   - Add "mode" field (live/manual/external)

### Phase 2: Channel Switch Fix

1. **Add Channel Switch Confirmation**
   - VJChat waits for confirmation before showing success
   - Add timeout for failed switches
   - Retry logic for transient failures

2. **Standardize Channel Identification**
   - Always use `_id` for matching
   - Add slug field for human-readable names
   - Update vjCore to return both id and name

### Phase 3: YouTube Reliability

1. **Pre-validate External Videos**
   - Check embeddability before playing
   - Cache validation results (5 min TTL)
   - Show fallback message if video unavailable

2. **Add Robust Error Handling**
   - Differentiate permanent vs temporary errors
   - Auto-retry for temporary failures
   - Clear error messages for users

### Phase 4: Manual/Live Toggle

1. **Explicit Mode Control**
   - Add "go live" command in VJChat
   - Add "stay on current" command
   - Visual indicator of current mode

2. **Auto-return Logic**
   - Only return to live on category change
   - Keep manual mode within same category
   - Clear messaging about mode

---

## Code Changes Required

### 1. Client: Enhanced Context Provider

```jsx
// New file: client/src/context/PlaybackContext.jsx
const PlaybackContext = createContext({
  currentVideo: null,
  currentChannel: null,
  mode: 'live', // 'live' | 'manual' | 'external'
  isPlaying: false,
  currentTime: 0,
  duration: 0
});
```

### 2. Server: Enhanced VJCore

```javascript
// vjCore.js - Enhanced context validation
function validateContext(context) {
  return {
    hasVideo: !!context?.currentVideo?.title,
    hasChannel: !!context?.currentChannel,
    video: {
      title: context?.currentVideo?.title || 'Unknown',
      youtubeId: context?.currentVideo?.youtubeId,
      artist: extractArtistFromTitle(context?.currentVideo?.title)
    },
    channel: context?.currentChannel || 'DesiTV',
    channelId: context?.currentChannelId,
    mode: context?.mode || 'live',
    videoIndex: context?.currentVideoIndex ?? 0,
    totalVideos: context?.totalVideos ?? 0,
    contentType: detectContentType(
      context?.currentVideo?.title, 
      context?.currentChannel
    )
  };
}
```

### 3. Enhanced Action Execution

```javascript
// chatController.js - Action validation
async function handleMessage(req, res) {
  // ... existing code ...
  
  if (result.action) {
    // Validate action before returning
    const validatedAction = await validateAction(result.action);
    result.action = validatedAction;
  }
  
  return res.json(result);
}

async function validateAction(action) {
  switch (action.type) {
    case 'CHANGE_CHANNEL':
      // Verify channel exists
      const channel = await Channel.findById(action.channelId);
      if (!channel) {
        return null; // Action will be skipped
      }
      return { ...action, channelName: channel.name };
    
    case 'PLAY_EXTERNAL':
      // Validate YouTube video
      // ... validation logic ...
      return action;
    
    default:
      return action;
  }
}
```

---

## Testing Checklist

- [ ] "What's playing?" returns correct current video title
- [ ] "Switch to [channel]" successfully changes channel
- [ ] "Play [song name]" finds and plays correct song
- [ ] External YouTube videos play reliably
- [ ] Manual mode persists within category
- [ ] "Go live" returns to timeline mode
- [ ] Error messages are clear and actionable
