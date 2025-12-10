# DesiTV Restructure Summary

## Overview
Restructured the application to match retrotv-org logic where:
- **Categories** (like "Cult", "Music") are **playlists**
- **Videos** within a category are **channels** you switch between
- Channel Up/Down switches videos within the selected category

## Changes Made

### 1. ChannelManager.js ✅
**File**: `client/src/logic/channel/ChannelManager.js`

**Changes**:
- Restructured to group videos by category
- Categories become playlists (each category contains videos)
- Videos within a category become the "channels"
- Added methods:
  - `getAllCategories()` - Get all categories (playlists)
  - `getCategoryByName(name)` - Get specific category
  - `getVideosForCategory(categoryName)` - Get videos in category

**How it works**:
```javascript
// Old structure: Channels contain videos
Channel "Music" → [video1, video2, video3]

// New structure: Categories contain videos
Category "Music" (playlist) → [video1, video2, video3] (these are "channels")
```

### 2. Home.jsx ✅
**File**: `client/src/pages/Home.jsx`

**Changes**:
- `selectedChannels` → `selectedCategory` (single category selected)
- `activeChannelIndex` → `activeVideoIndex` (index of video within category)
- `filteredChannels` → `videosInCategory` (videos in selected category)
- Channel Up/Down now switches videos within the selected category
- Category selection sets the active playlist

**New Flow**:
1. User selects a category (e.g., "Cult") → This becomes the active playlist
2. Channel Up/Down → Switches between videos within "Cult"
3. Pseudolive algorithm calculates position within the category's playlist

**Key Functions**:
- `setCategory(categoryName)` - Select a category as active playlist
- `handleChannelUp()` - Switch to next video in category
- `handleChannelDown()` - Switch to previous video in category
- `switchVideo(index)` - Switch to specific video in category

### 3. BroadcastStateManager.js ✅
**Status**: Works with new structure (no changes needed)

**Why it works**:
- Still receives channel-like objects with `_id` and `items` array
- Category ID becomes the "channel ID" for state management
- Pseudolive algorithm works per category (each category has its own timeline)

### 4. useBroadcastPosition.js ✅
**Status**: Works with new structure (no changes needed)

**Why it works**:
- Receives channel-like object (category with videos)
- Calculates position within category's playlist
- Uses category ID for state tracking

### 5. Player.jsx ✅
**Status**: Works with new structure (no changes needed)

**Why it works**:
- Receives channel-like object with `items` array
- Doesn't care if it's a "channel" or "category" - just needs `_id` and `items`
- Pseudolive playback works the same way

## Data Flow

### Old Flow:
```
User selects channels → Filter channels → Channel Up/Down switches channels
```

### New Flow:
```
User selects category → Category becomes playlist → Channel Up/Down switches videos within category
```

## Example Usage

### Selecting a Category:
```javascript
// User clicks "Cult" category
handleSelectCategory("Cult")
// → Sets selectedCategory = { name: "Cult", items: [video1, video2, ...] }
// → Sets videosInCategory = [video1, video2, ...]
// → Resets activeVideoIndex = 0
```

### Switching Videos (Channels):
```javascript
// User presses Channel Up
handleChannelUp()
// → activeVideoIndex = (activeVideoIndex + 1) % videosInCategory.length
// → Switches to next video in "Cult" category
```

### Pseudolive Algorithm:
```javascript
// BroadcastStateManager calculates position within category
// Category "Cult" has videos: [v1, v2, v3]
// Based on time since epoch, determines which video should play
// Example: After 90 seconds, playing v2 at 30 seconds
```

## Session Management

**Saved State**:
- `activeCategoryId` - Currently selected category ID
- `activeCategoryName` - Currently selected category name
- `activeVideoIndex` - Current video index within category
- `volume`, `isPowerOn` - User preferences

**Restoration**:
- On load, restores selected category
- Restores video index within that category
- Pseudolive algorithm continues from saved position

## Testing Checklist

- [ ] Category selection works
- [ ] Channel Up/Down switches videos within category
- [ ] Pseudolive algorithm works per category
- [ ] Session restoration works
- [ ] Broadcast state persists correctly
- [ ] Player component works with new structure
- [ ] Video switching animations work
- [ ] Status messages display correctly

## Notes

1. **Backward Compatibility**: Player component still receives "channel" objects, but they now represent categories with videos
2. **State Management**: Each category has its own broadcast state (timeline)
3. **Global Epoch**: Still shared across all categories (single timeline reference)
4. **Per-Category Offset**: Each category can have manual seeking offset

## Future Enhancements

1. Add category switching (switch between categories, not just videos)
2. Add category favorites
3. Add category-specific settings
4. Add category browsing UI

