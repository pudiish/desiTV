// Background effects registry

import Galaxy from '../Galaxy'
import GalaxyOrbitalThree from '../GalaxyOrbitalThreeRefactored'
import Liquid from '../Liquid'
import Aurora from '../Aurora'

export const BACKGROUND_EFFECTS = {
  galaxy: {
    id: 'galaxy',
    name: 'Dhara',
    icon: '〰️',
    description: 'Flowing particles synced to video colors',
    Component: Galaxy,
    order: 1,
    defaultProps: { baseSpeed: 0.3, density: 400 },
  },
  orbital: {
    id: 'orbital',
    name: 'Sitaare',
    icon: '✦',
    description: 'Starfield journey through the cosmos',
    Component: GalaxyOrbitalThree,
    order: 2,
    defaultProps: { baseSpeed: 0.3, density: 200 },
  },
  liquid: {
    id: 'liquid',
    name: 'Jazbaat',
    icon: '💫',
    description: 'Mood-aware colors that feel the music',
    Component: Liquid,
    order: 3,
    defaultProps: { baseSpeed: 0.3, density: 400, variant: 'classic' },
  },
  aurora: {
    id: 'aurora',
    name: 'Dhamaka',
    icon: '💥',
    description: 'Bass-reactive lights that shake and pulse',
    Component: Aurora,
    order: 4,
    defaultProps: { baseSpeed: 0.3, density: 200 },
  },
}

export const getEffectOrder = () => {
  return Object.values(BACKGROUND_EFFECTS)
    .sort((a, b) => a.order - b.order)
    .map(effect => effect.id)
}

export const getNextEffect = (currentId) => {
  const order = getEffectOrder()
  const currentIndex = order.indexOf(currentId)
  return order[(currentIndex + 1) % order.length]
}

export const getPrevEffect = (currentId) => {
  const order = getEffectOrder()
  const currentIndex = order.indexOf(currentId)
  return order[(currentIndex - 1 + order.length) % order.length]
}

export const getEffect = (id) => BACKGROUND_EFFECTS[id] || BACKGROUND_EFFECTS.galaxy

export const getEffectComponent = (id) => getEffect(id).Component

export const getAllEffects = () => Object.values(BACKGROUND_EFFECTS).sort((a, b) => a.order - b.order)

export const isValidEffect = (id) => id in BACKGROUND_EFFECTS

export default BACKGROUND_EFFECTS
