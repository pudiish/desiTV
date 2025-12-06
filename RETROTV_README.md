# RetroTV - iPhone Compatible Implementation

## Overview
This is a robust iPhone-compatible YouTube player implementation that addresses iOS autoplay restrictions while maintaining a retro TV aesthetic.

## Key Features

### iPhone Compatibility
- **playsinline=1**: Keeps playback inline on iPhone instead of forcing fullscreen
- **Muted start**: Starts muted to comply with iOS autoplay policy
- **User gesture unlock**: Single tap on power button creates legitimate user gesture
- **SessionStorage persistence**: Gesture permission persists across channel switches
- **WebKit compliant**: Follows Apple's autoplay policies exactly

### Retro TV Experience
- Power button overlay on first load
- CRT scanline effects
- Static/glitch transition on channel switch
- Retro controls and styling

## How It Works

### Initial Load
1. YouTube IFrame API loads once
2. Player initializes muted with `playsinline=1`
3. Power button overlay appears
4. User taps → creates gesture → unmutes and plays
5. Gesture flag saved to `sessionStorage`

### Channel Switching
1. Static overlay appears (700ms)
2. `loadVideoById()` called with new video
3. Auto-play and unmute (gesture already captured)
4. Static fades out (600ms)
5. Seamless playback continues

### Technical Details

**Player Configuration:**
```javascript
playerVars: {
  autoplay: 0,        // Manual play after gesture
  playsinline: 1,     // iOS inline playback
  controls: 0,        // Hidden controls
  mute: 1,            // Start muted
}
```

**Gesture Handling:**
```javascript
// First tap creates gesture
onUserGesture() → 
  sessionStorage.setItem("retro_tv_gesture", "1") →
  playVideo() + unMute()

// Subsequent channel switches
switchChannel() → 
  if (gesture exists) → auto playVideo() + unMute()
```

## Usage

### Access the RetroTV Player
Navigate to: `/retro`

### Testing on iPhone
1. Open in Safari on iPhone
2. Tap the POWER button
3. Video plays inline with sound
4. Use CH ▲/▼ to switch channels
5. Channels auto-play after first gesture

## Files Created
- `client/src/components/RetroTV.jsx` - Main component
- `client/src/components/RetroTV.css` - Styling
- `client/src/pages/RetroTVTest.jsx` - Integration page
- `client/src/App.jsx` - Added `/retro` route

## Browser Support
- ✅ iPhone Safari (iOS 10+)
- ✅ Chrome Mobile
- ✅ Desktop browsers
- ⚠️ Low Power Mode may still block autoplay

## Known Limitations
1. **Low Power Mode**: iOS may block autoplay even after gesture
2. **Some Safari settings**: User privacy settings can override
3. **Initial tap required**: Cannot bypass - Apple policy
4. **Unmute on some devices**: May need manual unmute button fallback

## Implementation Notes
- Pattern follows WebKit autoplay guidelines
- SessionStorage tracks gesture across session
- Static transition masks loading time
- Real device testing recommended
- Document "Tap to power on" in UI

## Route
Access at: `http://localhost:5173/retro` (development)

## Next Steps for Production
1. Test on real iPhone devices
2. Test with Low Power Mode enabled
3. Add explicit "Unmute" button for edge cases
4. Monitor analytics for autoplay success rate
5. Consider adding skip/seek controls
