#!/usr/bin/env node

/**
 * Galaxy Tunnel - Developer Quick Reference
 * 
 * Copy & paste recipes for common tasks
 */

// ═══════════════════════════════════════════════════════════════════════
// SETUP & INTEGRATION
// ═══════════════════════════════════════════════════════════════════════

// 1. Basic usage
import GalaxyOrbitalThree from './components/backgrounds/GalaxyOrbitalThree'

function App() {
  const [isPlaying, setIsPlaying] = useState(false)
  
  return <GalaxyOrbitalThree isActive={true} isPlaying={isPlaying} />
}

// ═══════════════════════════════════════════════════════════════════════
// FEATURE FLAGS
// ═══════════════════════════════════════════════════════════════════════

// 2. Create and use feature flags
import { createFeatureFlagsManager } from './services/galaxyFeatureFlags'

const flags = createFeatureFlagsManager()

// Use device preset
flags.setFlags(flags.getPreset('mobile'))

// Toggle features
flags.setFeature('particles', false)
flags.setFeature('blooms', true)

// Adjust quality
flags.setQuality('particleCount', 1.5)

// Audio reactivity
flags.setAudioReactivity('bass', 1.2)
flags.setAudioReactivity('treble', 0.8)

// Debug
flags.debug.showPerformanceMetrics = true

// Subscribe to changes
flags.subscribe((newFlags) => {
  console.log('Updated:', newFlags)
})

// ═══════════════════════════════════════════════════════════════════════
// PERFORMANCE PROFILING
// ═══════════════════════════════════════════════════════════════════════

// 3. Profile your component
import { createPerformanceProfiler } from './utils/performanceProfiler'

const profiler = createPerformanceProfiler()

// In animation loop
profiler.mark('audioUpdate')
audioAnalyser.update(dt, timestamp)
const audioTime = profiler.measure('audioUpdate')

profiler.mark('particleUpdate')
updateParticles(dt)
profiler.measure('particleUpdate')

profiler.recordFrame(dt * 1000)

// Log metrics
profiler.logMetrics()
// Output:
// FPS: 58 (avg 17.36ms, max 22.15ms)
// Audio: 2.34ms | Particles: 5.67ms | Rings: 1.23ms | Render: 8.91ms
// Bottleneck: ✅ OK | GPU: ✅ OK | Slowest: render

// Get performance report
const report = profiler.getReport()
if (!report.healthy) {
  console.warn('Issues:', report.issues)
  console.log('Recommendations:', report.recommendations)
  // Output: 
  // Issues: ["GPU bottleneck detected"]
  // Recommendations: ["Reduce particle count or bloom quality"]
}

// ═══════════════════════════════════════════════════════════════════════
// AUDIO ANALYSIS
// ═══════════════════════════════════════════════════════════════════════

// 4. Use audio analyser hook
import { useAudioAnalyser } from './hooks/useAudioAnalyser'

function MyComponent({ isPlaying }) {
  const audioAnalyser = useAudioAnalyser(isPlaying)
  
  useEffect(() => {
    const animationId = requestAnimationFrame((timestamp) => {
      // Update audio analysis
      const audioState = audioAnalyser.update(0.016, timestamp)
      
      if (audioState) {
        console.log('Bass level:', audioState.bands.bass.smoothed)
        console.log('Mood intensity:', audioState.mood.intensity)
        console.log('Beat detected:', audioState.beat.onBeat)
      }
    })
    
    return () => cancelAnimationFrame(animationId)
  }, [audioAnalyser])
}

// 5. Direct audio engine usage
import createAudioAnalysisEngine from './services/audioAnalysisEngine'

const engine = createAudioAnalysisEngine()
const frequencyData = new Uint8Array(256)  // From Web Audio API

engine.update(frequencyData, dt, timestamp, isPlaying)

const { bands, mood, triggers, energy, beat } = engine.state

console.log('Sub-bass:', bands.subBass.smoothed)  // 0-1
console.log('Energy:', energy.rmsSmoothed)         // 0-1
console.log('Is downbeat:', beat.onBeat)          // bool
console.log('Bass boom:', triggers.boom.intensity) // 0-1
console.log('High shimmer:', triggers.shimmer.intensity) // 0-1

// ═══════════════════════════════════════════════════════════════════════
// TUNING FOR SPECIFIC DEVICES
// ═══════════════════════════════════════════════════════════════════════

// 6. Device-specific configurations

// High-end gaming PC
flags.setFlags(flags.getPreset('high-end'))

// Typical laptop
flags.setFlags(flags.getPreset('desktop'))

// Mobile phone
flags.setFlags(flags.getPreset('mobile'))

// Low-power (older devices, battery saving)
flags.setFlags(flags.getPreset('low-power'))

// 7. Custom fine-tuning
function setupForDevice(device) {
  const config = {
    'iphone-13': {
      quality: { particleCount: 0.8, ringCount: 0.9 },
      audioReactivity: { bass: 1.1, treble: 0.9 },
      features: { blooms: false, waveRings: false },
    },
    'pixel-6': {
      quality: { particleCount: 0.7, ringCount: 0.8 },
      audioReactivity: { bass: 1.2, treble: 0.7 },
      features: { shimmer: false },
    },
    'old-android': {
      quality: { particleCount: 0.3, ringCount: 0.5 },
      audioReactivity: { bass: 0.9, treble: 0.5 },
      features: { particles: false, blooms: false },
    },
  }
  
  const preset = config[device]
  if (preset) {
    Object.assign(flags.quality, preset.quality)
    Object.assign(flags.audioReactivity, preset.audioReactivity)
    Object.entries(preset.features).forEach(([feat, enabled]) => {
      flags.setFeature(feat, enabled)
    })
  }
}

setupForDevice('iphone-13')

// ═══════════════════════════════════════════════════════════════════════
// DEBUGGING
// ═══════════════════════════════════════════════════════════════════════

// 8. Enable debug overlays
flags.debug.showPerformanceMetrics = true  // FPS, timing
flags.debug.showAudioMeters = true         // Frequency bars
flags.debug.showBounds = true              // Particle/ring bounds

// 9. Isolate specific features
flags.debug.isolateFeature = 'particles'   // Show only particles
flags.debug.isolateFeature = 'rings'       // Show only rings
flags.debug.isolateFeature = null          // Show all

// 10. Log everything to console
window.galaxyProfiler = profiler
window.galaxyFlags = flags
window.galaxyAudio = audioAnalyser.engine

// Then in console:
// > galaxyProfiler.logMetrics()
// > galaxyFlags.getFlags()
// > galaxyAudio.state.bands.bass

// ═══════════════════════════════════════════════════════════════════════
// PHYSICS TUNING (Advanced)
// ═══════════════════════════════════════════════════════════════════════

// 11. Understand spring physics
// springUpdate(current, target, velocity, stiffness, damping, dt)
// 
// Stiffness (0.009-0.03 * 60): How responsive
// - 0.009*60 = 0.54: Very slow, very smooth
// - 0.015*60 = 0.90: Balanced (default)
// - 0.03*60  = 1.80: Very responsive, snappy
//
// Damping (0.85-0.98): How much bounce
// - 0.85: Bouncy, oscillating
// - 0.90: Slightly bouncy
// - 0.95: Very smooth, minimal bounce
//
// Example: Bass boom hit
// - Stiffness 0.9 = responds quickly
// - Damping 0.92 = slight bounce (feels natural)
// - Result: Rapid rise with smooth fall

// 12. Adjust audio response
// In audioAnalysisEngine.js, attack/decay control meter feel:
//
// Attack (0.01-0.15): Rise speed when signal increases
// Decay (0.01-0.12): Fall speed when signal decreases
//
// Bass: attack 0.12, decay 0.04
// - Rises fast (0.12), falls slow (0.04)
// - Creates "sticky" feeling - bass feels impactful
//
// Treble: attack 0.03, decay 0.12
// - Rises slow (0.03), falls fast (0.12)
// - Creates "shimmer" - bright but quick

// ═══════════════════════════════════════════════════════════════════════
// OPTIMIZATION RECIPES
// ═══════════════════════════════════════════════════════════════════════

// 13. Mobile optimization
function optimizeForMobile() {
  flags.setFlags(flags.getPreset('mobile'))
}

// 14. Battery saving mode
function batteryMode() {
  flags.setFlags(flags.getPreset('low-power'))
  flags.performance.targetFPS = 20
  flags.setFeature('particles', false)
  flags.setFeature('blooms', false)
  flags.setQuality('particleCount', 0.2)
}

// 15. Performance recovery
function recoveryMode() {
  const report = profiler.getReport()
  
  if (report.issues.includes('GPU bottleneck detected')) {
    flags.setQuality('bloomQuality', 0.5)
    flags.setFeature('blooms', false)
  }
  
  if (report.issues.includes('CPU bottleneck detected')) {
    flags.setQuality('particleCount', 0.7)
  }
  
  if (profiler.getMetrics().fps < 25) {
    flags.setFlags(flags.getPreset('low-power'))
  }
}

// ═══════════════════════════════════════════════════════════════════════
// TESTING
// ═══════════════════════════════════════════════════════════════════════

// 16. Test suite template
describe('GalaxyOrbitalThree', () => {
  let flags, profiler
  
  beforeEach(() => {
    flags = createFeatureFlagsManager()
    profiler = createPerformanceProfiler()
  })
  
  test('should initialize without errors', () => {
    expect(flags.getFlags().features.rings.enabled).toBe(true)
  })
  
  test('should toggle features', () => {
    flags.setFeature('particles', false)
    expect(flags.getFlags().features.particles.enabled).toBe(false)
  })
  
  test('mobile preset should reduce particles', () => {
    flags.setFlags(flags.getPreset('mobile'))
    expect(flags.getFlags().quality.particleCount).toBe(1.0)
  })
  
  test('low-power preset should disable some features', () => {
    flags.setFlags(flags.getPreset('low-power'))
    expect(flags.getFlags().features.particles.enabled).toBe(false)
    expect(flags.getFlags().features.blooms.enabled).toBe(false)
  })
  
  test('profiler should track FPS', () => {
    profiler.recordFrame(16.67)
    const metrics = profiler.getMetrics()
    expect(metrics.fps).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════
// MONITORING & ANALYTICS
// ═══════════════════════════════════════════════════════════════════════

// 17. Send metrics to analytics
function trackPerformance() {
  const metrics = profiler.getMetrics()
  const report = profiler.getReport()
  
  analytics.track('galaxy_performance', {
    fps: metrics.fps,
    avgFrameTime: metrics.avgFrameTime,
    particleCount: metrics.particleCount,
    healthy: report.healthy,
    issues: report.issues.length,
  })
}

// 18. Monitor in real-time
setInterval(() => {
  const metrics = profiler.getMetrics()
  
  if (metrics.fps < 30) {
    console.warn('Low FPS detected:', metrics.fps)
    recoveryMode()
  }
  
  if (metrics.maxFrameTime > 33) {
    console.warn('Frame spikes detected:', metrics.maxFrameTime, 'ms')
  }
}, 5000)  // Check every 5 seconds

// ═══════════════════════════════════════════════════════════════════════
// COMMON ISSUES & SOLUTIONS
// ═══════════════════════════════════════════════════════════════════════

// Issue 1: White/black screen
// Solution: Check container dimensions
const container = document.querySelector('.galaxy-container')
console.log('Container:', {
  width: container.clientWidth,
  height: container.clientHeight,
})

// Issue 2: No audio reaction
// Solution: Verify audio is playing
console.log('Audio state:', {
  isPlaying: isPlaying,
  analyser: audioAnalyser.analyser,
  context: audioAnalyser.context,
})

// Issue 3: Low FPS
// Solution: Check performance report
console.log(profiler.getReport())

// Issue 4: High memory
// Solution: Reduce particles
flags.setQuality('particleCount', 0.5)
flags.setFeature('particles', flags.getFlags().features.particles)

// ═══════════════════════════════════════════════════════════════════════
// USEFUL LINKS
// ═══════════════════════════════════════════════════════════════════════

/*
Physics Deep Dive:
  GALAXY_REFACTORING_GUIDE.md → "Physics & Timing Decisions" section

Feature Flags Reference:
  GALAXY_REFACTORING_GUIDE.md → "Feature Flags" section

Performance Optimization:
  GALAXY_REFACTORING_GUIDE.md → "Performance Optimization Strategies" section

Migration from Canvas:
  MIGRATION_GUIDE.md → Full step-by-step guide

Architecture Overview:
  GALAXY_REFACTORING_GUIDE.md → "Architecture" section

Troubleshooting:
  GALAXY_REFACTORING_GUIDE.md → "Troubleshooting" section
  MIGRATION_GUIDE.md → "Troubleshooting Migration" section
*/

// ═══════════════════════════════════════════════════════════════════════
// END OF QUICK REFERENCE
// ═══════════════════════════════════════════════════════════════════════
