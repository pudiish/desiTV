export { default as BackgroundManager } from './BackgroundManager'
export { BackgroundProvider, useBackground } from './BackgroundContext'
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
