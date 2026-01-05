/**
 * Galaxy Tunnel Effect - Feature Flags Configuration
 * 
 * Control which visual elements are rendered and how aggressively
 * Useful for:
 * - Performance tuning on different devices
 * - A/B testing different visual styles
 * - Graceful degradation on slow devices
 * - Debug visualization of individual layers
 */

export const defaultFeatureFlags = {
  // RENDER TOGGLES - Which visual elements to show
  features: {
    rings: {
      enabled: true,
      description: 'Animated tunnel rings - creates the depth sensation',
    },
    particles: {
      enabled: true,
      description: '3D particles inside and outside tunnel',
    },
    blooms: {
      enabled: true,
      description: 'Ambient bloom effects at corners and edges',
    },
    coloring: {
      enabled: true,
      description: 'Audio-reactive color shifts',
    },
    waveRings: {
      enabled: true,
      description: 'Propagating bass wave rings on boom triggers',
    },
    shimmer: {
      enabled: true,
      description: 'High-frequency sparkle effect',
    },
  },

  // AUDIO REACTIVITY - How strongly audio influences the effect
  audioReactivity: {
    bass: 1.0,        // How much bass expands rings (0-2)
    treble: 1.0,      // How much treble creates shimmer (0-2)
    energy: 1.0,      // Overall energy multiplier (0-2)
    beatSync: 1.0,    // Beat detection strength (0-2)
  },

  // QUALITY SETTINGS
  quality: {
    particleCount: 1.0,    // Multiplier for particle count (0.5-2.0)
    ringCount: 1.0,        // Multiplier for ring count (0.5-2.0)
    bloomQuality: 1.0,     // Bloom blur quality (0.5-2.0)
    shadowMaps: true,      // Use shadow maps for depth (memory cost)
  },

  // PERFORMANCE SETTINGS
  performance: {
    targetFPS: 60,         // Max frames per second
    enableVsync: true,     // Sync to monitor refresh rate
    enableLOD: true,       // Level of detail based on distance
    throttleOnInactive: true, // Reduce FPS when tab is hidden
  },

  // DEBUG SETTINGS
  debug: {
    showBounds: false,     // Draw particle/ring bounds
    showAudioMeters: false, // Overlay frequency/energy graphs
    showPerformanceMetrics: false, // FPS, memory, draw calls
    isolateFeature: null,  // Show only one feature (null = all)
  },
}

/**
 * Create a feature flags manager
 * Allows runtime adjustment of flags and validation
 */
export const createFeatureFlagsManager = (initialFlags = defaultFeatureFlags) => {
  let flags = JSON.parse(JSON.stringify(initialFlags))
  const listeners = new Set()

  const validate = (newFlags) => {
    // Ensure all required fields exist
    if (!newFlags.features) throw new Error('Missing features object')
    if (!newFlags.audioReactivity) throw new Error('Missing audioReactivity object')
    if (!newFlags.quality) throw new Error('Missing quality object')
    if (!newFlags.performance) throw new Error('Missing performance object')
    if (!newFlags.debug) throw new Error('Missing debug object')

    // Validate ranges
    Object.entries(newFlags.audioReactivity).forEach(([key, val]) => {
      if (typeof val !== 'number' || val < 0 || val > 2) {
        console.warn(`Invalid audioReactivity.${key}: ${val}, clamping to 0-2`)
        newFlags.audioReactivity[key] = Math.max(0, Math.min(2, val))
      }
    })

    Object.entries(newFlags.quality).forEach(([key, val]) => {
      if (typeof val === 'number') {
        if (val < 0.5 || val > 2.0) {
          console.warn(`Invalid quality.${key}: ${val}, clamping to 0.5-2.0`)
          newFlags.quality[key] = Math.max(0.5, Math.min(2.0, val))
        }
      }
    })

    return newFlags
  }

  return {
    /**
     * Get current flags (read-only, use setFlags to modify)
     */
    getFlags: () => JSON.parse(JSON.stringify(flags)),

    /**
     * Update flags and notify listeners
     */
    setFlags: (newFlags) => {
      const validated = validate(newFlags)
      flags = validated
      listeners.forEach(cb => cb(flags))
      console.log('[GalaxyFeatureFlags] Updated:', flags)
    },

    /**
     * Update a specific feature flag
     */
    setFeature: (feature, enabled) => {
      if (!(feature in flags.features)) {
        console.warn(`Unknown feature: ${feature}`)
        return
      }
      flags.features[feature].enabled = enabled
      listeners.forEach(cb => cb(flags))
    },

    /**
     * Update a quality multiplier
     */
    setQuality: (key, value) => {
      if (!(key in flags.quality)) {
        console.warn(`Unknown quality setting: ${key}`)
        return
      }
      const clamped = Math.max(0.5, Math.min(2.0, value))
      flags.quality[key] = clamped
      listeners.forEach(cb => cb(flags))
    },

    /**
     * Update audio reactivity strength
     */
    setAudioReactivity: (band, strength) => {
      if (!(band in flags.audioReactivity)) {
        console.warn(`Unknown audio band: ${band}`)
        return
      }
      const clamped = Math.max(0, Math.min(2, strength))
      flags.audioReactivity[band] = clamped
      listeners.forEach(cb => cb(flags))
    },

    /**
     * Subscribe to flag changes
     */
    subscribe: (callback) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },

    /**
     * Get presets for different device profiles
     */
    getPreset: (profile) => {
      const presets = {
        'high-end': {
          quality: { particleCount: 2.0, ringCount: 1.5, bloomQuality: 2.0 },
          performance: { targetFPS: 60, enableVsync: true, enableLOD: false },
        },
        'desktop': {
          quality: { particleCount: 1.0, ringCount: 1.0, bloomQuality: 1.0 },
          performance: { targetFPS: 60, enableVsync: true, enableLOD: true },
        },
        'mobile': {
          quality: { particleCount: 0.5, ringCount: 0.7, bloomQuality: 0.5 },
          performance: { targetFPS: 30, enableVsync: false, enableLOD: true },
        },
        'low-power': {
          features: {
            rings: { enabled: true },
            particles: { enabled: false },
            blooms: { enabled: false },
            coloring: { enabled: true },
            waveRings: { enabled: false },
            shimmer: { enabled: false },
          },
          quality: { particleCount: 0.2, ringCount: 0.5, bloomQuality: 0.3 },
          performance: { targetFPS: 24, enableVsync: false, enableLOD: true },
        },
      }

      if (!presets[profile]) {
        console.warn(`Unknown preset: ${profile}, using 'desktop'`)
        return presets.desktop
      }

      return presets[profile]
    },

    /**
     * Reset to defaults
     */
    reset: () => {
      flags = JSON.parse(JSON.stringify(defaultFeatureFlags))
      listeners.forEach(cb => cb(flags))
    },
  }
}

export default createFeatureFlagsManager
