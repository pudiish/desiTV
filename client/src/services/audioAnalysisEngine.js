/**
 * Audio Analysis Engine - Decoupled from rendering
 * 
 * Handles all audio processing:
 * - Frequency analysis (7-band spectrum)
 * - Beat detection and BPM estimation
 * - Spectral features (centroid, flux)
 * - Mood/emotion detection
 * - Visual triggers (boom, flash, shimmer)
 * 
 * Returns normalized values (0-1) suitable for any visualization backend
 */

const FREQ_BANDS = {
  SUB_BASS: 0,    // 20-60 Hz    
  BASS: 1,        // 60-250 Hz   
  LOW_MID: 2,     // 250-500 Hz  
  MID: 3,         // 500-2k Hz   
  HIGH_MID: 4,    // 2k-4k Hz    
  HIGH: 5,        // 4k-8k Hz    
  PRESENCE: 6,    // 8k-20k Hz   
}

// Physics Constants Documentation:
// ═══════════════════════════════════════════════════════════════════
// SPRING PHYSICS CONSTANTS (stiffness, damping) explain motion feel:
// 
// Stiffness (0.01-0.05 * 60):
// - Controls how quickly the value responds to changes
// - Higher = snappier, responds immediately
// - Lower = slower, more "lag" but smoother
// - Perceptual: 0.015*60 (0.9) = slightly laggy smooth motion
// 
// Damping (0.88-0.95):
// - Controls oscillation reduction
// - Higher = less bouncy, dead-stick
// - Lower = more bouncy, springy
// - Perceptual: 0.92 = slight dampening, feels "natural"
// 
// Recommended usage by element:
// - Boom (bass trigger): stiff (0.015*60) + high damping (0.92) = responsive bass hit
// - Blooms (ambient): medium (0.01*60) + high damping (0.93) = smooth fade
// - Ring expansion: medium (0.02*60) + medium damping (0.90) = pulsing feel
// ═══════════════════════════════════════════════════════════════════

export const createAudioAnalysisEngine = () => {
  const audioState = {
    // 7-BAND FREQUENCY SPECTRUM
    // Attack/decay control how fast the meter responds to changes
    bands: {
      subBass:  { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.15, decay: 0.03 },
      bass:     { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.12, decay: 0.04 },
      lowMid:   { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.10, decay: 0.05 },
      mid:      { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.08, decay: 0.06 },
      highMid:  { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.06, decay: 0.08 },
      high:     { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.04, decay: 0.10 },
      presence: { raw: 0, smoothed: 0, velocity: 0, peak: 0, attack: 0.03, decay: 0.12 },
    },
    
    // ENERGY & DYNAMICS
    energy: {
      rms: 0,
      rmsSmoothed: 0,
      peak: 0,
      dynamic: 0,
      history: [],
      historyMax: 32,
    },
    
    // BEAT DETECTION
    beat: {
      bpm: 120,
      phase: 0,
      confidence: 0,
      lastBeat: 0,
      interval: 500,
      onBeat: false,
      beatCount: 0,
      pattern: [1, 0.3, 0.6, 0.3],
      patternIndex: 0,
    },
    
    // SPECTRAL ANALYSIS
    spectral: {
      flux: 0,
      fluxSmoothed: 0,
      centroid: 0.5,
      spread: 0.3,
      previousBands: [],
    },
    
    // MOOD/EMOTION DETECTION
    mood: {
      intensity: 0,
      energy: 0,
      brightness: 0,
      aggression: 0,
      intensitySmooth: 0,
      energySmooth: 0,
      brightnessSmooth: 0,
    },
    
    // VISUAL TRIGGERS
    triggers: {
      boom: { active: false, intensity: 0, velocity: 0, lastTrigger: 0 },
      flash: { active: false, intensity: 0, velocity: 0, lastTrigger: 0 },
      shimmer: { intensity: 0, velocity: 0 },
      pulse: { intensity: 0, phase: 0 },
      waves: [],
    },
    
    // AMBIENT BLOOMS
    blooms: {
      corners: [
        { x: 0, y: 0, intensity: 0, velocity: 0, phase: 0 },
        { x: 1, y: 0, intensity: 0, velocity: 0, phase: 1.618 },
        { x: 1, y: 1, intensity: 0, velocity: 0, phase: 3.236 },
        { x: 0, y: 1, intensity: 0, velocity: 0, phase: 4.854 },
      ],
      edges: [
        { intensity: 0, velocity: 0, phase: 0 },
        { intensity: 0, velocity: 0, phase: Math.PI * 0.5 },
        { intensity: 0, velocity: 0, phase: Math.PI },
        { intensity: 0, velocity: 0, phase: Math.PI * 1.5 },
      ],
    },
  }

  // Utility functions
  const snapSmooth = (current, target, attack, decay, dt) => {
    const rate = target > current ? attack : decay
    return current + (target - current) * Math.min(1, rate * dt)
  }

  const springUpdate = (current, target, velocity, stiffness, damping, dt) => {
    const force = (target - current) * stiffness
    const newVel = (velocity + force * dt) * Math.pow(damping, dt * 60)
    const newVal = current + newVel * dt
    return { value: newVal, velocity: newVel }
  }

  const lerp = (a, b, t) => a + (b - a) * t
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v))

  /**
   * Update audio analysis based on frequency data
   * @param {Uint8Array} frequencyData - Raw frequency data from analyser
   * @param {number} dt - Delta time in seconds
   * @param {number} timestamp - Current timestamp in ms
   * @param {boolean} isPlaying - Whether audio is playing
   */
  const update = (frequencyData, dt, timestamp, isPlaying) => {
    const bands = audioState.bands
    const energy = audioState.energy
    const beat = audioState.beat
    const spectral = audioState.spectral
    const mood = audioState.mood
    const triggers = audioState.triggers
    const blooms = audioState.blooms

    if (isPlaying && frequencyData && frequencyData.length > 0) {
      const length = frequencyData.length
      
      // Map frequency bins to 7 bands
      const bandIndices = [
        Math.floor(length * 0.025),  // subBass (20-60 Hz)
        Math.floor(length * 0.15),   // bass
        Math.floor(length * 0.20),   // lowMid
        Math.floor(length * 0.25),   // mid
        Math.floor(length * 0.35),   // highMid
        Math.floor(length * 0.50),   // high
        Math.floor(length * 0.85),   // presence
      ]

      // Extract band values
      const bandValues = [
        frequencyData[bandIndices[0]] / 255,
        frequencyData[bandIndices[1]] / 255,
        frequencyData[bandIndices[2]] / 255,
        frequencyData[bandIndices[3]] / 255,
        frequencyData[bandIndices[4]] / 255,
        frequencyData[bandIndices[5]] / 255,
        frequencyData[bandIndices[6]] / 255,
      ]

      const bandKeys = Object.keys(bands)
      let totalEnergy = 0

      // Update each band with snap smoothing
      bandValues.forEach((raw, i) => {
        const band = bands[bandKeys[i]]
        band.raw = raw
        band.smoothed = snapSmooth(band.smoothed, raw, band.attack, band.decay, dt)
        band.velocity = band.smoothed - band.raw
        band.peak = Math.max(band.peak, band.smoothed)
        band.peak *= 0.98 // Decay peak
        totalEnergy += band.smoothed
      })

      // RMS ENERGY
      let rms = 0
      for (let i = 0; i < frequencyData.length; i++) {
        const normalized = frequencyData[i] / 255
        rms += normalized * normalized
      }
      energy.rms = Math.sqrt(rms / frequencyData.length)
      energy.rmsSmoothed = lerp(energy.rmsSmoothed, energy.rms, 0.05)

      // BEAT DETECTION
      const isDownbeat = bands.subBass.raw > 0.5 && bands.subBass.velocity > 0
      const isSnare = bands.mid.raw > 0.4 && spectral.flux > 0.3
      
      if (isDownbeat && timestamp - beat.lastBeat > beat.interval * 0.8) {
        beat.onBeat = true
        beat.lastBeat = timestamp
        beat.beatCount++
        beat.phase = 0
        beat.patternIndex = (beat.patternIndex + 1) % beat.pattern.length
      } else {
        beat.onBeat = false
      }

      // Update beat phase
      const timeSinceLastBeat = timestamp - beat.lastBeat
      beat.phase = clamp(timeSinceLastBeat / beat.interval, 0, 1)

      // SPECTRAL ANALYSIS
      const currentBands = [
        bands.subBass.smoothed, bands.bass.smoothed, bands.lowMid.smoothed,
        bands.mid.smoothed, bands.highMid.smoothed, bands.high.smoothed, bands.presence.smoothed
      ]

      if (spectral.previousBands.length === 7) {
        let flux = 0
        for (let i = 0; i < 7; i++) {
          flux += Math.abs(currentBands[i] - spectral.previousBands[i])
        }
        spectral.flux = flux
        spectral.fluxSmoothed = lerp(spectral.fluxSmoothed, flux, 0.15)
      }
      spectral.previousBands = [...currentBands]

      // Spectral centroid (brightness)
      let weightedSum = 0, totalWeight = 0
      currentBands.forEach((val, i) => {
        weightedSum += val * (i + 1)
        totalWeight += val
      })
      spectral.centroid = totalWeight > 0 ? weightedSum / (totalWeight * 7) : 0.5

      // MOOD DETECTION
      mood.intensity = energy.dynamic
      mood.energy = (bands.bass.smoothed + bands.subBass.smoothed) * 0.5 +
        (bands.high.smoothed + bands.presence.smoothed) * 0.3
      mood.brightness = spectral.centroid
      mood.aggression = bands.bass.smoothed * 0.4 + bands.highMid.smoothed * 0.3 +
        spectral.fluxSmoothed * 0.3

      mood.intensitySmooth = lerp(mood.intensitySmooth, mood.intensity, 0.08)
      mood.energySmooth = lerp(mood.energySmooth, mood.energy, 0.06)
      mood.brightnessSmooth = lerp(mood.brightnessSmooth, mood.brightness, 0.05)

      // VISUAL TRIGGERS
      const patternWeight = beat.pattern[beat.patternIndex]

      if (isDownbeat && bands.subBass.raw > 0.6 && timestamp - triggers.boom.lastTrigger > 400) {
        triggers.boom.active = true
        triggers.boom.lastTrigger = timestamp
        triggers.waves.push({
          radius: 0, maxRadius: 1.5, intensity: bands.subBass.raw, age: 0, maxAge: 1500
        })
      }

      if (spectral.flux > 0.4 && timestamp - triggers.flash.lastTrigger > 200) {
        triggers.flash.active = true
        triggers.flash.lastTrigger = timestamp
      }

      // Spring-smooth triggers
      const boomSpring = springUpdate(triggers.boom.intensity, 
        triggers.boom.active ? bands.subBass.smoothed : 0,
        triggers.boom.velocity, 0.015 * 60, 0.92, dt)
      triggers.boom.intensity = Math.max(0, boomSpring.value)
      triggers.boom.velocity = boomSpring.velocity
      triggers.boom.active = false

      const flashSpring = springUpdate(triggers.flash.intensity,
        triggers.flash.active ? spectral.flux : 0,
        triggers.flash.velocity, 0.03 * 60, 0.88, dt)
      triggers.flash.intensity = Math.max(0, flashSpring.value)
      triggers.flash.velocity = flashSpring.velocity
      triggers.flash.active = false

      triggers.shimmer.intensity = lerp(triggers.shimmer.intensity,
        bands.high.smoothed + bands.presence.smoothed, 0.1)

      triggers.pulse.intensity = lerp(triggers.pulse.intensity,
        beat.onBeat ? patternWeight : 0, beat.onBeat ? 0.5 : 0.05)
      triggers.pulse.phase = beat.phase

      // Update wave rings
      triggers.waves = triggers.waves.filter(wave => {
        wave.age += dt * 1000
        wave.intensity *= 0.997
        return wave.age < wave.maxAge && wave.intensity > 0.01
      })

      // Update blooms
      blooms.corners.forEach(corner => {
        const bandMix = bands.bass.smoothed * 0.4 + bands.mid.smoothed * 0.3 +
          Math.sin(corner.phase) * 0.15 * bands.high.smoothed
        const targetIntensity = bandMix * (isDownbeat ? 1.2 : 0.7) * mood.intensitySmooth
        const spring = springUpdate(corner.intensity, targetIntensity, corner.velocity, 0.01 * 60, 0.93, dt)
        corner.intensity = Math.max(0, spring.value)
        corner.velocity = spring.velocity
      })

      blooms.edges.forEach(edge => {
        const bandMix = bands.lowMid.smoothed * 0.35 + bands.highMid.smoothed * 0.35 +
          Math.cos(edge.phase) * 0.12 * bands.presence.smoothed
        const targetIntensity = bandMix * (isSnare ? 1.1 : 0.6) * mood.intensitySmooth
        const spring = springUpdate(edge.intensity, targetIntensity, edge.velocity, 0.008 * 60, 0.94, dt)
        edge.intensity = Math.max(0, spring.value)
        edge.velocity = spring.velocity
      })

      // Energy normalization
      energy.history.push(totalEnergy)
      if (energy.history.length > energy.historyMax) {
        energy.history.shift()
      }
      const avgEnergy = energy.history.reduce((a, b) => a + b, 0) / energy.history.length
      energy.dynamic = avgEnergy > 0.01 ? totalEnergy / avgEnergy : totalEnergy

    } else {
      // Not playing - fade everything smoothly
      const fadeRate = 0.03
      Object.values(bands).forEach(band => {
        band.smoothed *= (1 - fadeRate * dt * 60)
        band.velocity *= 0.9
        band.peak *= 0.99
      })
      energy.rmsSmoothed *= (1 - fadeRate * dt * 60)
      mood.intensitySmooth *= (1 - fadeRate * dt * 60)
      mood.energySmooth *= (1 - fadeRate * dt * 60)
      triggers.boom.intensity *= (1 - fadeRate * dt * 60)
      triggers.flash.intensity *= (1 - fadeRate * dt * 60)
      triggers.shimmer.intensity *= (1 - fadeRate * dt * 60)
      triggers.pulse.intensity *= (1 - fadeRate * dt * 60)
      blooms.corners.forEach(c => { c.intensity *= (1 - fadeRate * dt * 60); c.velocity *= 0.9 })
      blooms.edges.forEach(e => { e.intensity *= (1 - fadeRate * dt * 60); e.velocity *= 0.9 })
      triggers.waves = triggers.waves.filter(w => { w.intensity *= 0.95; return w.intensity > 0.01 })
    }
  }

  return {
    state: audioState,
    update,
    // Expose utility functions for component use
    springUpdate,
    snapSmooth,
    lerp,
    clamp,
  }
}

export default createAudioAnalysisEngine
