/**
 * Shared Audio Analysis Utilities
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Web Audio API integration for frequency analysis and beat detection.
 * Provides reactive audio values for visual effects synchronization.
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { springUpdate } from './math'

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO STATE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create audio analysis state
 */
export const createAudioState = () => ({
  // Raw values from analysis
  subBass: 0,    // ~20-60Hz
  bass: 0,       // ~60-250Hz
  mid: 0,        // ~250-1kHz
  high: 0,       // ~1k-4kHz
  presence: 0,   // ~4k-20kHz
  energy: 0,     // Overall energy
  
  // Target values for smoothing
  subBassTarget: 0,
  bassTarget: 0,
  midTarget: 0,
  highTarget: 0,
  presenceTarget: 0,
  energyTarget: 0,
  
  // Velocities for spring smoothing
  subBassVel: 0,
  bassVel: 0,
  midVel: 0,
  highVel: 0,
  presenceVel: 0,
  energyVel: 0,
})

/**
 * Reset audio state to zero
 */
export const resetAudioState = (state) => {
  state.subBass = state.bass = state.mid = state.high = state.presence = state.energy = 0
  state.subBassTarget = state.bassTarget = state.midTarget = state.highTarget = state.presenceTarget = state.energyTarget = 0
  state.subBassVel = state.bassVel = state.midVel = state.highVel = state.presenceVel = state.energyVel = 0
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIO ANALYSER SETUP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create Web Audio analyser connection
 * @returns {Object} - Audio context, analyser, and data array
 */
export const createAudioAnalyser = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return null
    
    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256  // 128 frequency bins - good balance of detail vs performance
    analyser.smoothingTimeConstant = 0.7  // Smooth out rapid changes
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    
    return {
      audioContext,
      analyser,
      dataArray,
      sourceConnected: false,
    }
  } catch (err) {
    console.warn('[AudioAnalyser] Failed to create:', err.message)
    return null
  }
}

/**
 * Connect analyser to media element
 */
export const connectToMedia = (analyserState) => {
  if (!analyserState || analyserState.sourceConnected) return false
  
  try {
    const { audioContext, analyser } = analyserState
    
    // Find video/audio elements
    const mediaElements = document.querySelectorAll('video, audio')
    
    for (const media of mediaElements) {
      if (media.src || media.srcObject) {
        try {
          const source = audioContext.createMediaElementSource(media)
          source.connect(analyser)
          analyser.connect(audioContext.destination)
          analyserState.sourceConnected = true
          console.log('[AudioAnalyser] Connected to media source')
          return true
        } catch {
          // Already connected or CORS issue
        }
      }
    }
    
    // Resume context if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }
    
    return false
  } catch (err) {
    console.warn('[AudioAnalyser] Connection failed:', err.message)
    return false
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FREQUENCY ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analyze frequency data and update audio state
 */
export const analyzeFrequencies = (analyserState, audioState) => {
  if (!analyserState?.analyser || !analyserState?.dataArray) return
  
  const { analyser, dataArray } = analyserState
  analyser.getByteFrequencyData(dataArray)
  
  const binCount = dataArray.length  // 128 bins
  
  // Sub-bass: bins 0-3 (~20-60Hz)
  let subBassSum = 0
  for (let i = 0; i < 4; i++) subBassSum += dataArray[i]
  audioState.subBassTarget = (subBassSum / 4) / 255
  
  // Bass: bins 4-10 (~60-250Hz)
  let bassSum = 0
  for (let i = 4; i < 11; i++) bassSum += dataArray[i]
  audioState.bassTarget = (bassSum / 7) / 255
  
  // Mid: bins 11-30 (~250-1kHz)
  let midSum = 0
  for (let i = 11; i < 31; i++) midSum += dataArray[i]
  audioState.midTarget = (midSum / 20) / 255
  
  // High: bins 31-64 (~1k-4kHz)
  let highSum = 0
  for (let i = 31; i < 65; i++) highSum += dataArray[i]
  audioState.highTarget = (highSum / 34) / 255
  
  // Presence: bins 65-128 (~4k-20kHz)
  let presenceSum = 0
  for (let i = 65; i < binCount; i++) presenceSum += dataArray[i]
  audioState.presenceTarget = (presenceSum / (binCount - 65)) / 255
  
  // Overall energy (weighted average)
  audioState.energyTarget = 
    audioState.subBassTarget * 0.2 + 
    audioState.bassTarget * 0.3 + 
    audioState.midTarget * 0.25 + 
    audioState.highTarget * 0.15 + 
    audioState.presenceTarget * 0.1
}

/**
 * Generate organic fallback pulses when no audio is connected
 */
export const generateFallbackAudio = (audioState, time) => {
  const beatTime = time * 2.5  // ~150 BPM feel
  const beat = Math.pow(Math.abs(Math.sin(beatTime)), 8)
  
  audioState.bassTarget = 0.5 + beat * 0.5 + Math.sin(time * 1.5) * 0.2
  audioState.subBassTarget = 0.4 + beat * 0.4 + Math.sin(time * 1.0) * 0.15
  audioState.midTarget = 0.5 + Math.sin(time * 2.2) * 0.3 + beat * 0.2
  audioState.highTarget = 0.4 + Math.sin(time * 3.0) * 0.25 + beat * 0.15
  audioState.presenceTarget = 0.3 + Math.sin(time * 4.0) * 0.15
  audioState.energyTarget = 0.5 + beat * 0.3 + Math.sin(time * 1.3) * 0.2
}

/**
 * Fade out audio values when not playing
 */
export const fadeOutAudio = (audioState, factor = 0.92) => {
  audioState.bassTarget *= factor
  audioState.subBassTarget *= factor
  audioState.midTarget *= factor
  audioState.highTarget *= factor
  audioState.presenceTarget *= factor
  audioState.energyTarget *= factor
}

// ═══════════════════════════════════════════════════════════════════════════════
// SMOOTHING (Spring-based for natural motion)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Smooth all audio values with spring physics
 */
export const smoothAudioValues = (audioState, dt) => {
  // Different spring settings for different frequency bands
  const springs = [
    { key: 'subBass', stiffness: 12, damping: 0.82 },
    { key: 'bass', stiffness: 15, damping: 0.80 },
    { key: 'mid', stiffness: 18, damping: 0.78 },
    { key: 'high', stiffness: 20, damping: 0.75 },
    { key: 'presence', stiffness: 22, damping: 0.72 },
    { key: 'energy', stiffness: 10, damping: 0.85 },
  ]
  
  for (const { key, stiffness, damping } of springs) {
    const result = springUpdate(
      audioState[key],
      audioState[`${key}Target`],
      audioState[`${key}Vel`],
      stiffness,
      damping,
      dt
    )
    audioState[key] = result.value
    audioState[`${key}Vel`] = result.velocity
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMBINED UPDATE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Full audio update - call once per frame
 */
export const updateAudio = (analyserState, audioState, isPlaying, time, dt) => {
  if (isPlaying && analyserState?.sourceConnected) {
    // Real audio analysis
    analyzeFrequencies(analyserState, audioState)
  } else if (isPlaying) {
    // Fallback organic pulses
    generateFallbackAudio(audioState, time)
  } else {
    // Fade out when not playing
    fadeOutAudio(audioState)
  }
  
  // Smooth all values
  smoothAudioValues(audioState, dt)
}
