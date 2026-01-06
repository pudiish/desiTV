# Background Effects - Modular Architecture

## Overview

The background effects system has been refactored into a **modular, industry-level architecture** with shared utilities that reduce code duplication, improve performance, and make maintenance easier.

## Directory Structure

```
client/src/components/backgrounds/
├── shared/                     # Shared utilities (NEW)
│   ├── index.js               # Central exports
│   ├── math.js                # Math utilities (lerp, easing, spring, noise)
│   ├── colors.js              # Color manipulation & extraction
│   ├── canvas.js              # Canvas drawing utilities
│   ├── animation.js           # Animation loop & timing
│   ├── audio.js               # Web Audio API integration
│   └── performance.js         # Device detection & adaptive quality
│
├── core/                       # Core system files
│   ├── BackgroundContext.jsx  # Context provider
│   ├── BackgroundRegistry.js  # Effect registration
│   └── useBackgroundAnimation.js
│
├── Galaxy.jsx                  # Dhara effect (flow/stream)
├── GalaxyOrbitalThree.jsx     # Sitaare effect (stars) - ORIGINAL
├── GalaxyOrbitalThreeRefactored.jsx  # Sitaare - MODULAR VERSION
├── Liquid.jsx                  # Jazbaat effect (liquid emotions)
├── Aurora.jsx                  # Dhamaka effect (northern lights)
└── GalaxyThree.css            # Shared styles
```

## Shared Modules

### 1. Math (`shared/math.js`)

**Constants:**
- `TAU` - Full circle (2π)
- `PHI` - Golden ratio

**Functions:**
- `lerp(a, b, t)` - Linear interpolation
- `clamp(value, min, max)` - Constrain value
- `smoothstep(t)` - Smooth 0-1 curve
- `smootherstep(t)` - Even smoother curve
- `springUpdate(current, target, velocity, stiffness, damping, dt)` - Spring physics
- `noise2D(x, y)` - 2D Perlin-style noise
- `distance(x1, y1, x2, y2)` - 2D distance
- `angle(x1, y1, x2, y2)` - Angle between points

### 2. Colors (`shared/colors.js`)

**Palettes:**
- `DEFAULT_COLORS` - Standard fallback palette
- `STAR_COLORS` - Milky Way star temperatures
- `NEBULA_COLORS` - Nebula and dust colors

**Functions:**
- `lerpColor(c1, c2, t)` - Interpolate RGB colors
- `getColorFromPalette(phase, colors)` - Get color by phase position
- `extractColorsFromThumbnail(videoId)` - Extract colors from YouTube thumbnail
- `createColorTransition(initialColors)` - Create transition state manager
- `toRgba(color, alpha)` - Convert to CSS rgba string

### 3. Canvas (`shared/canvas.js`)

**Functions:**
- `setupCanvas(canvas, options)` - Initialize canvas with DPR
- `clearWithFade(ctx, w, h, alpha)` - Clear with trail effect
- `createGlowGradient(ctx, x, y, radius, color, alpha)` - Create radial glow
- `drawCircle(ctx, x, y, radius)` - Draw circle
- `batchDraw(ctx, items, drawFn)` - Batch render for performance

### 4. Animation (`shared/animation.js`)

**Functions:**
- `createAnimationLoop(options)` - Managed animation loop with FPS control
- `createTimeState()` - Time tracking state
- `createParticlePool(maxCount, createFn)` - Object pooling for particles
- `createSpawnTimer(minInterval, maxInterval)` - Periodic event timer
- `createVisibilityObserver(element, onVisible, onHidden)` - Pause when hidden

### 5. Audio (`shared/audio.js`)

**Functions:**
- `createAudioState()` - Audio analysis state
- `createAudioAnalyser()` - Web Audio API setup
- `connectToMedia(analyserState)` - Connect to video/audio elements
- `analyzeFrequencies(analyserState, audioState)` - Extract frequency bands
- `generateFallbackAudio(audioState, time)` - Organic pulses when no audio
- `smoothAudioValues(audioState, dt)` - Spring-smooth audio values
- `updateAudio(analyserState, audioState, isPlaying, time, dt)` - Full update

### 6. Performance (`shared/performance.js`)

**Functions:**
- `detectDeviceCapabilities()` - Detect device tier (high/medium/low)
- `getSettingsForTier(tier)` - Get recommended settings
- `createFPSMonitor(options)` - Monitor FPS for adaptive quality
- `createAdaptiveQuality()` - Auto-adjust quality based on FPS
- `createFrameThrottle(targetFPS)` - FPS limiting
- `setupVisibilityTracking(tracker, callback)` - Page visibility

## Usage Example

```jsx
import {
  // Math
  TAU, lerp, smootherstep, springUpdate,
  // Colors
  DEFAULT_COLORS, STAR_COLORS, extractColorsFromThumbnail, createColorTransition,
  // Animation
  createAnimationLoop, createSpawnTimer,
  // Audio
  createAudioState, createAudioAnalyser, updateAudio,
  // Performance
  createAdaptiveQuality,
} from './shared'

const MyEffect = ({ isPlaying, videoId }) => {
  const canvasRef = useRef(null)
  
  // Initialize shared state
  const colorTransition = useRef(createColorTransition(DEFAULT_COLORS))
  const audioState = useRef(createAudioState())
  const spawnTimer = useRef(createSpawnTimer(2000, 6000))
  
  // Extract colors from video
  useEffect(() => {
    if (videoId) {
      extractColorsFromThumbnail(videoId).then(colors => {
        if (colors) colorTransition.current.setTarget(colors)
      })
    }
  }, [videoId])
  
  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    const animate = (dt, timestamp) => {
      // Update colors
      colorTransition.current.update(dt)
      
      // Update audio
      updateAudio(analyserState, audioState.current, isPlaying, time, dt)
      
      // Check spawn timer
      if (spawnTimer.current.check(timestamp)) {
        // Spawn effect...
      }
      
      // Render...
    }
    
    const loop = createAnimationLoop({ onFrame: animate })
    loop.start()
    
    return () => loop.stop()
  }, [isPlaying])
  
  return <canvas ref={canvasRef} />
}
```

## Benefits

### 1. **Code Reuse**
- Common math functions used across all effects
- Color extraction shared between Dhara, Sitaare, Jazbaat, Dhamaka
- Audio analysis code not duplicated

### 2. **Performance**
- Object pooling prevents garbage collection spikes
- FPS monitoring enables adaptive quality
- Shared canvas utilities use efficient drawing patterns

### 3. **Maintainability**
- Single source of truth for utilities
- Easy to update all effects at once
- Clear separation of concerns

### 4. **Testability**
- Pure utility functions are easy to unit test
- State management is decoupled from rendering

## Migration Guide

To migrate an existing effect to use shared modules:

1. **Replace math functions:**
   ```jsx
   // Before
   const lerp = (a, b, t) => a + (b - a) * t
   
   // After
   import { lerp } from './shared'
   ```

2. **Use color transition:**
   ```jsx
   // Before
   const currentColorsRef = useRef([...DEFAULT_COLORS])
   const targetColorsRef = useRef([...DEFAULT_COLORS])
   
   // After
   import { createColorTransition } from './shared'
   const colorTransition = useRef(createColorTransition(DEFAULT_COLORS))
   ```

3. **Use audio state:**
   ```jsx
   // Before (100+ lines of audio setup)
   const audioRef = useRef({ bass: 0, bassVel: 0, ... })
   
   // After
   import { createAudioState, updateAudio } from './shared'
   const audioState = useRef(createAudioState())
   // In animation loop:
   updateAudio(analyserState, audioState.current, isPlaying, time, dt)
   ```

4. **Use spawn timers:**
   ```jsx
   // Before
   let lastShootingStarTime = 0
   if (timestamp - lastShootingStarTime > interval) { ... }
   
   // After
   import { createSpawnTimer } from './shared'
   const timer = createSpawnTimer(2000, 6000)
   if (timer.check(timestamp)) { ... }
   ```

## Performance Tiers

| Tier | Max Particles | Shooting Stars | FPS Target | Glow |
|------|---------------|----------------|------------|------|
| High | 2000 | 10 | 60 | ✓ |
| Medium | 1200 | 6 | 45 | ✓ |
| Low | 600 | 3 | 30 | ✗ |

The system automatically detects device capability and adjusts at runtime based on actual FPS.
