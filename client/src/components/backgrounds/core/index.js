/**
 * Background Core - Exports for the background effect system
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Main manager component
export { default as BackgroundManager } from './BackgroundManager'

// Context and hooks
export { BackgroundProvider, useBackground } from './BackgroundContext'

// Registry and utilities
export { 
  BACKGROUND_EFFECTS,
  getEffect,
  getEffectComponent,
  getEffectOrder,
  getNextEffect,
  getPrevEffect,
  getAllEffects,
  isValidEffect,
} from './BackgroundRegistry'
