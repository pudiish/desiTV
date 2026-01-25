// Background components

export { default as Galaxy } from './Galaxy'
export { default as Liquid } from './Liquid'
export { default as Aurora } from './Aurora'

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

export {
  TAU,
  lerp,
  clamp,
  smoothstep,
  lerpColor,
  toRgba,
  setupCanvas,
  clearFade,
  createLoop,
  extractColors,
  noise,
} from './utils'
