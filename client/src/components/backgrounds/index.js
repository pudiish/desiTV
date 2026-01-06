/**
 * Background Components - Unified Export
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Individual Effects:
 * - Galaxy: Original video-color-reactive particle effect (Dhara)
 * - Liquid: Refined mood-aware AI color detection with liquid flow (Jazbaat)
 * - Aurora: Northern Lights effect with bass-reactive boom (Dhamaka)
 * - Sitaare: Milky Way starfield (refactored with modular architecture)
 * 
 * Core System:
 * - BackgroundManager: Unified manager component (recommended)
 * - BackgroundProvider: Context provider for shared state
 * - useBackground: Hook to access shared background state
 * 
 * Utilities:
 * - BACKGROUND_EFFECTS: Registry of all effects
 * - getNextEffect, getPrevEffect: Cycle through effects
 * - useBackgroundAnimation: Shared animation utilities
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Individual effect components (for direct use)
export { default as Galaxy } from './Galaxy'
export { default as Liquid } from './Liquid'
export { default as Aurora } from './Aurora'

// Core system (recommended for new implementations)
export { 
  BackgroundManager,
  BackgroundProvider,
  useBackground,
  BACKGROUND_EFFECTS,
  getEffect,
  getEffectComponent,
  getEffectOrder,
  getNextEffect,
  getPrevEffect,
  getAllEffects,
  isValidEffect,
} from './core'

// Shared hooks and utilities
export {
  useBackgroundAnimation,
  PHI,
  TAU,
  lerp,
  clamp,
  smoothstep,
  smootherstep,
  lerpColor,
  lerpHsl,
  rgbToString,
  hslToString,
  rgbToHsl,
  snapSmooth,
  expSmooth,
  springSmooth,
  noise,
} from './hooks'
