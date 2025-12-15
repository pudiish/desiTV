# iOS Fullscreen Fix

## Problem
iOS Safari doesn't support the Fullscreen API for iframes or arbitrary HTML elements. It only supports fullscreen for native `<video>` elements, and even then, only when triggered by user interaction.

## Solution
Implemented CSS-based fullscreen for iOS devices as a workaround:

1. **iOS Detection**: Added specific iOS detection (iPhone, iPad, iPod)
2. **CSS Fullscreen**: When iOS is detected, use CSS classes to make the iframe fill the viewport
3. **Fallback**: Try to access YouTube iframe's video element for native fullscreen (may fail due to cross-origin restrictions)

## Implementation Details

### JavaScript Changes (`TVFrame.jsx`)

1. **iOS Detection**:
   ```javascript
   const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
   ```

2. **CSS-Based Fullscreen**:
   - Adds `ios-fullscreen-active` class to `body` and `.tv-frame-container`
   - Uses CSS to make elements fill viewport
   - Single tap exits fullscreen (easier than double-tap on iOS)

3. **Orientation Change Handler**:
   - Auto-enters fullscreen on landscape rotation (iOS)
   - Auto-exits on portrait rotation

### CSS Changes (`styles.css`)

1. **iOS Fullscreen Classes**:
   - `.ios-fullscreen-active` on body: Fixes body to viewport
   - `.tv-frame-container.ios-fullscreen-active`: Makes TV frame fill screen
   - Hides other UI elements when in fullscreen

2. **Exit Hint**:
   - Shows "Tap to Exit Fullscreen" message when entering iOS fullscreen
   - Fades out after 3 seconds

## How It Works

### Entering Fullscreen (iOS):
1. User double-taps TV frame (or rotates to landscape)
2. JavaScript detects iOS
3. Adds `ios-fullscreen-active` class to body and container
4. CSS makes iframe fill viewport
5. Other UI elements are hidden

### Exiting Fullscreen (iOS):
1. User single-taps anywhere on screen
2. JavaScript removes `ios-fullscreen-active` classes
3. CSS restores normal layout
4. UI elements become visible again

## Limitations

1. **Not True Fullscreen**: iOS CSS fullscreen doesn't hide browser UI (address bar, etc.)
2. **Cross-Origin Restrictions**: Cannot access YouTube iframe's video element directly
3. **Browser UI Visible**: Safari's address bar and controls remain visible

## Testing

Test on:
- ✅ iPhone (Safari)
- ✅ iPad (Safari)
- ✅ Android Chrome (uses standard Fullscreen API)
- ✅ Desktop browsers (uses standard Fullscreen API)

## User Experience

- **iOS**: Double-tap to enter, single-tap to exit
- **Android**: Double-tap to enter/exit (standard Fullscreen API)
- **Desktop**: Double-click to enter/exit (standard Fullscreen API)

## Future Improvements

1. Consider using Picture-in-Picture API for iOS
2. Add swipe gestures for iOS fullscreen control
3. Better visual feedback for fullscreen state

