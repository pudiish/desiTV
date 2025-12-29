/**
 * Thresholds Index - Export all threshold configurations
 */

import PLAYBACK_THRESHOLDS from './playback.js'
import BROADCAST_THRESHOLDS from './broadcast.js'
import EFFECTS_THRESHOLDS from './effects.js'
import SYNC_THRESHOLDS, { getDriftCorrectionType, getCorrectionRate, DEBUG_SYNC } from './sync.js'

export { 
  PLAYBACK_THRESHOLDS, 
  BROADCAST_THRESHOLDS, 
  EFFECTS_THRESHOLDS,
  SYNC_THRESHOLDS,
  getDriftCorrectionType,
  getCorrectionRate,
  DEBUG_SYNC,
}
