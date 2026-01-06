/**
 * Background Effects Registry & Configuration
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Central registry for all background effects. Add new effects here.
 * Each effect has:
 * - Component: The React component to render
 * - id: Unique identifier
 * - name: Display name (2000s desiTV vibes)
 * - icon: Emoji icon for UI
 * - description: Short description
 * - defaultProps: Default props for the effect
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// Import all background effect components
import Galaxy from '../Galaxy'
import GalaxyOrbitalThree from '../GalaxyOrbitalThreeRefactored'
import Liquid from '../Liquid'
import Aurora from '../Aurora'

// ═══════════════════════════════════════════════════════════════════════════════
// EFFECT REGISTRY - Named by their visual behavior (2000s DesiTV vibes)
// ═══════════════════════════════════════════════════════════════════════════════
export const BACKGROUND_EFFECTS = {
  galaxy: {
    id: 'galaxy',
    name: 'Dhara',        // "Flow/Stream" - flowing particles from video colors
    icon: '〰️',
    description: 'Flowing particles synced to video colors',
    Component: Galaxy,
    order: 1,
    defaultProps: {
      baseSpeed: 0.3,
      density: 400,
    },
  },
  
  orbital: {
    id: 'orbital',
    name: 'Sitaare',      // "Stars" - Milky Way starfield flying towards you
    icon: '✦',
    description: 'Starfield journey through the cosmos',
    Component: GalaxyOrbitalThree,
    order: 2,
    defaultProps: {
      baseSpeed: 0.3,
      density: 200,
    },
  },
  
  liquid: {
    id: 'liquid',
    name: 'Jazbaat',      // "Emotions/Feelings" - mood-aware AI color detection
    icon: '💫',
    description: 'Mood-aware colors that feel the music',
    Component: Liquid,
    order: 3,
    defaultProps: {
      baseSpeed: 0.3,
      density: 400,
      variant: 'classic',
    },
  },
  
  aurora: {
    id: 'aurora',
    name: 'Dhamaka',      // "Explosion/Boom" - bass-reactive shake and pulse
    icon: '💥',
    description: 'Bass-reactive lights that shake and pulse',
    Component: Aurora,
    order: 4,
    defaultProps: {
      baseSpeed: 0.3,
      density: 200,
    },
  },
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get ordered list of effect IDs for cycling
 */
export const getEffectOrder = () => {
  return Object.values(BACKGROUND_EFFECTS)
    .sort((a, b) => a.order - b.order)
    .map(effect => effect.id)
}

/**
 * Get next effect ID in cycle
 */
export const getNextEffect = (currentId) => {
  const order = getEffectOrder()
  const currentIndex = order.indexOf(currentId)
  const nextIndex = (currentIndex + 1) % order.length
  return order[nextIndex]
}

/**
 * Get previous effect ID in cycle
 */
export const getPrevEffect = (currentId) => {
  const order = getEffectOrder()
  const currentIndex = order.indexOf(currentId)
  const prevIndex = (currentIndex - 1 + order.length) % order.length
  return order[prevIndex]
}

/**
 * Get effect config by ID
 */
export const getEffect = (id) => {
  return BACKGROUND_EFFECTS[id] || BACKGROUND_EFFECTS.galaxy
}

/**
 * Get effect component by ID
 */
export const getEffectComponent = (id) => {
  const effect = getEffect(id)
  return effect.Component
}

/**
 * Get all effects as array
 */
export const getAllEffects = () => {
  return Object.values(BACKGROUND_EFFECTS).sort((a, b) => a.order - b.order)
}

/**
 * Check if effect ID is valid
 */
export const isValidEffect = (id) => {
  return id in BACKGROUND_EFFECTS
}

export default BACKGROUND_EFFECTS
