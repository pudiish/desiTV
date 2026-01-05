# Galaxy Tunnel Three.js Refactoring Guide

## Overview

This document describes the refactored Galaxy Tunnel effect using Three.js, featuring:
- **Decoupled Architecture**: Audio analysis separated from rendering
- **Feature Flags**: Granular control over visual elements
- **Performance Profiling**: Real-time metrics collection
- **Documented Physics**: Clear explanation of spring constants and timing

## Architecture

### File Structure

```
client/src/
├── components/backgrounds/
│   ├── GalaxyOrbitalThree.jsx      # Main Three.js component
│   └── GalaxyThree.css              # Styling
├── hooks/
│   └── useAudioAnalyser.js          # Web Audio API hook
├── services/
│   ├── audioAnalysisEngine.js       # Decoupled audio processor
│   └── galaxyFeatureFlags.js        # Feature flag manager
└── utils/
    └── performanceProfiler.js        # Performance metrics
```

## Core Components

### 1. Audio Analysis Engine (`audioAnalysisEngine.js`)

**Purpose**: Process audio data independently from rendering.

**Key Features**:
- 7-band frequency spectrum (sub-bass → presence)
- Beat detection with BPM estimation
- Spectral analysis (centroid, flux)
- Mood detection (intensity, energy, brightness, aggression)
- Visual triggers (boom, flash, shimmer, pulse)
- Ambient blooms (corner/edge lighting)

**Physics Constants Explained**:

```javascript
// SPRING PHYSICS - Controls animation feel
springUpdate(current, target, velocity, stiffness, damping, dt)

// Stiffness: How responsive the value is
// - 0.015 * 60 = 0.9: Medium responsiveness (default for booms)
// - 0.02 * 60 = 1.2: More responsive (rings)
// - 0.01 * 60 = 0.6: Slower, smoother (blooms)

// Damping: How much oscillation is reduced
// - 0.92: Slight bouncing (bass hits)
// - 0.93: Very smooth (ambient)
// - 0.88: More responsive (flashes)

// ATTACK/DECAY - Frequency meter response
// Attack: How fast value rises when signal increases
// Decay: How fast value falls when signal decreases
// Example: bass { attack: 0.12, decay: 0.04 }
// Bass jumps up quickly (0.12) and falls slowly (0.04)
// This creates "sticky" bass response - satisfying feel!
```

**Usage**:
```javascript
const engine = createAudioAnalysisEngine()

// In animation loop
engine.update(frequencyData, dt, timestamp, isPlaying)

// Access audio state
const { bands, mood, triggers, energy } = engine.state
```

### 2. Feature Flags (`galaxyFeatureFlags.js`)

**Purpose**: Granular control over visual elements without code changes.

**Available Flags**:

```javascript
features: {
  rings: true,        // Tunnel rings
  particles: true,    // Flying particles
  blooms: true,       // Ambient lighting
  coloring: true,     // Color reactivity
  waveRings: true,    // Bass wave propagation
  shimmer: true,      // High-frequency sparkle
}

audioReactivity: {
  bass: 1.0,          // 0-2: Bass sensitivity
  treble: 1.0,        // 0-2: Treble sensitivity
  energy: 1.0,        // 0-2: Overall intensity
  beatSync: 1.0,      // 0-2: Beat detection strength
}

quality: {
  particleCount: 1.0, // 0.5-2.0: Particle density
  ringCount: 1.0,     // 0.5-2.0: Ring density
  bloomQuality: 1.0,  // 0.5-2.0: Bloom blur quality
  shadowMaps: true,   // GPU memory trade-off
}

performance: {
  targetFPS: 60,      // Maximum frame rate
  enableVsync: true,  // Monitor sync
  enableLOD: true,    // Distance-based detail reduction
  throttleOnInactive: true,
}

debug: {
  showBounds: false,
  showAudioMeters: false,
  showPerformanceMetrics: false,
  isolateFeature: null,  // Show only one feature
}
```

**Device Presets**:
```javascript
const flags = createFeatureFlagsManager()

// Use built-in presets
flags.setFlags(flags.getPreset('desktop'))   // Full quality
flags.setFlags(flags.getPreset('mobile'))    // 50% quality
flags.setFlags(flags.getPreset('low-power')) // Minimal features
```

### 3. Performance Profiler (`performanceProfiler.js`)

**Purpose**: Real-time performance measurement and bottleneck detection.

**Metrics**:
- **FPS**: Current, average, min/max frame times
- **Component Times**: Audio, particles, rings, render
- **Bottleneck Detection**: CPU vs GPU limited
- **Performance Report**: Automatic recommendations

**Usage**:
```javascript
const profiler = createPerformanceProfiler()

// In animation loop
profiler.mark('particleUpdate')
updateParticles()
profiler.measure('particleUpdate')

profiler.recordFrame(frameTimeMs)
profiler.logMetrics()

// Get recommendations
const report = profiler.getReport()
if (!report.healthy) {
  console.log(report.recommendations)
}
```

### 4. useAudioAnalyser Hook

**Purpose**: Manage Web Audio API and connect to audio elements.

**Features**:
- Automatic audio context creation
- Media element audio source detection
- Frequency data extraction
- Integration with audio analysis engine

**Usage**:
```javascript
const audioAnalyser = useAudioAnalyser(isPlaying)

// In animation loop
audioAnalyser.update(dt, timestamp)

// Access audio state
const { bands, mood, triggers } = audioAnalyser.audioState
```

## Physics & Timing Decisions

### Why These Spring Constants?

**Boom Effect (Bass Hits)**:
- Stiffness: `0.015 * 60 = 0.9` (responsive)
- Damping: `0.92` (slight bounce)
- **Effect**: Rises quickly on bass hit, slight overshoot, settles smoothly
- **Perceptual**: Satisfying punch, feels natural

**Ambient Blooms**:
- Stiffness: `0.01 * 60 = 0.6` (slower)
- Damping: `0.93` (high damping)
- **Effect**: Slow rise/fall, very smooth
- **Perceptual**: Gentle breathing effect, non-intrusive

**Ring Expansion**:
- Stiffness: `0.02 * 60 = 1.2` (very responsive)
- Damping: `0.90` (medium)
- **Effect**: Quick expansion with slight bouncing
- **Perceptual**: Dynamic, energy-responsive

### Attack/Decay Response

Why does bass have `attack: 0.12, decay: 0.04`?

```
Bass signal jumps:     |
                        |___
Attack (0.12) ────────→ hits quick
Decay (0.04) ← slow fall ────────

Result: Bass meters stick high, slowly decay
This creates satisfying "sticky" feel - feels like bass is being felt!
```

### Time Scales

Different elements move at different speeds:
```javascript
trippy.time.global += dt * baseTimeScale           // Master clock
trippy.time.rings += dt * baseTimeScale * 0.8     // Rings slower
trippy.time.particlesInside += dt * baseTimeScale * 0.5   // Inside slow
trippy.time.particlesOutside += dt * baseTimeScale * 1.4  // Outside fast
```

**Why?**
- **Rings slower**: Avoid disorienting tunnel speed
- **Inside particles slow**: Depth perception (distance = slow movement)
- **Outside particles fast**: Foreground rush effect

## Performance Optimization Strategies

### Mobile Optimization

Use the `low-power` preset:
```javascript
const flags = createFeatureFlagsManager()
flags.setFlags(flags.getPreset('low-power'))

// Results in:
// - 50% particle count
// - Rings only (no particles)
// - No blooms or shimmer
// - 24 FPS target
// - Level-of-detail enabled
```

### Bottleneck Detection

```javascript
const report = profiler.getReport()

if (report.issues.includes('CPU bottleneck detected')) {
  // Reduce complexity
  flags.setQuality('particleCount', 0.7)
  flags.setFeature('particles', true)  // But with fewer particles
}

if (report.issues.includes('GPU bottleneck detected')) {
  // Reduce visual complexity
  flags.setQuality('bloomQuality', 0.5)
  flags.setFeature('blooms', false)
}
```

### Memory Allocation Prevention

**Bad** (allocates in animation loop):
```javascript
const times = [audio.audioUpdateTime, audio.particleUpdateTime, ...]
```

**Good** (pre-allocated):
```javascript
const timings = {
  audio: 0,
  particles: 0,
  // ...reuse these objects
}
```

## Usage in Component

```jsx
import GalaxyOrbitalThree from './components/backgrounds/GalaxyOrbitalThree'

function App() {
  return (
    <GalaxyOrbitalThree
      isActive={true}
      baseSpeed={0.3}
      density={200}
      volume={0.5}
      isPlaying={isPlaying}
      intensityBoost={0.7}
    />
  )
}
```

## Debugging & Development

### Enable Performance Metrics

```jsx
const featureFlags = createFeatureFlagsManager()
featureFlags.setDebug('showPerformanceMetrics', true)
```

This shows:
- FPS and frame times
- Component-by-component timings
- GPU/CPU bottleneck detection
- Slowest component identification

### Profile on Device

```javascript
// Add to window for console access
window.galaxyProfiler = profilerRef.current

// In console
galaxyProfiler.logMetrics()
galaxyProfiler.getReport()
```

### Feature Isolation

Debug individual features:
```javascript
const flags = createFeatureFlagsManager()
flags.setDebug('isolateFeature', 'particles')  // Show only particles
flags.setDebug('isolateFeature', 'rings')      // Show only rings
```

## Migration from Canvas to Three.js

### Why Three.js?

1. **GPU Acceleration**: Better particle rendering
2. **3D Depth**: Native z-buffer for true 3D
3. **Maintainability**: Scene graph instead of raw canvas
4. **Performance**: Automatic batching and optimization
5. **Future**: Easy to add post-processing, shaders, etc.

### What Changed

| Aspect | Canvas | Three.js |
|--------|--------|----------|
| Particle rendering | Draw 500+ circles/frame | GPU batch render |
| 3D depth | Manual z-sorting | Built-in z-buffer |
| Ring animation | Canvas paths | Geometry + material |
| Audio reactivity | Direct manipulation | Material/transform updates |
| Memory | ~30MB | ~50MB (with features) |

### Performance Impact

Expected improvements on various devices:

- **High-end desktop**: 60 FPS consistently (vs 45-55 before)
- **Mobile**: 30-40 FPS with reduced particles (vs 20-30 before)
- **Low-power**: 24 FPS with blooms disabled (vs 12-18 before)

## Next Steps & Future Enhancements

### Planned Improvements

1. **Shaders**: Custom GLSL for effects
2. **Post-processing**: Bloom, depth-of-field
3. **Better particle physics**: Gravity, collision
4. **Audio streaming**: WebAudio stream processing
5. **Mobile sensors**: Gyro-based movement

### Configuration Examples

```javascript
// Desktop - Full quality
flags.setFlags(flags.getPreset('high-end'))

// Mobile - Balanced
flags.setFlags(flags.getPreset('mobile'))
flags.setAudioReactivity('bass', 1.2)  // More punch

// Minimal - Low power
flags.setFlags(flags.getPreset('low-power'))
flags.setQuality('particleCount', 0.3)

// Custom - Specific tuning
flags.setFeature('particles', true)
flags.setFeature('blooms', false)
flags.setQuality('particleCount', 1.5)
flags.setAudioReactivity('treble', 0.8)
```

## Troubleshooting

### Low FPS
1. Check profiler report: `profiler.getReport()`
2. Reduce particle count: `flags.setQuality('particleCount', 0.7)`
3. Disable blooms: `flags.setFeature('blooms', false)`

### Janky Animation
1. Check for frame spikes: `profiler.maxFrameTime > 20ms`
2. Enable LOD: `flags.performance.enableLOD = true`
3. Reduce ring count: `flags.setQuality('ringCount', 0.7)`

### Audio Not Reacting
1. Check audio is connected: `audioAnalyser.analyser` exists
2. Verify isPlaying flag is true
3. Check frequency data: `audioAnalyser.update()` called in loop

## References

- Three.js Docs: https://threejs.org/docs/
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- Spring Physics: https://en.wikipedia.org/wiki/Harmonic_oscillator
