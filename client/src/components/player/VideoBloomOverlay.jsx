/**
 * 🌟 Video Bloom Overlay Component
 * Creates smooth flash/bloom/glow effects that react to video brightness
 * 
 * Features:
 * - Smooth bloom glow that pulses with video intensity
 * - Flash effect on brightness spikes
 * - Blur bloom for dreamy "blown out" look
 * - Color tinting from mood service
 * - Performance optimized with CSS transforms
 */

import React, { useEffect, useState, useRef } from 'react'
import videoBloomService from '../../services/videoBloomService'
import moodColorService from '../../services/moodColorService'
import './VideoBloomOverlay.css'

export default function VideoBloomOverlay({ 
  isActive = true,
  videoElement = null,
  intensity = 1.0,  // Overall intensity multiplier
  enableFlash = true,
  enableGlow = true,
  enableBlur = true,
}) {
  const [bloomState, setBloomState] = useState({
    brightness: 0,
    bloom: 0,
    isPeak: false,
    isFlash: false,
    intensity: 0,
  })
  
  const [moodColors, setMoodColors] = useState(null)
  const overlayRef = useRef(null)
  const flashRef = useRef(null)

  // Subscribe to bloom service
  useEffect(() => {
    if (!isActive) return

    const unsubscribe = videoBloomService.subscribe((state) => {
      setBloomState(state)
    })

    return unsubscribe
  }, [isActive])

  // Subscribe to mood colors for tinting
  useEffect(() => {
    const unsubscribe = moodColorService.subscribe((preset) => {
      if (preset?.colors?.[0]) {
        setMoodColors(preset.colors[0])
      }
    })
    return unsubscribe
  }, [])

  // Start/stop bloom service when video element changes
  useEffect(() => {
    if (isActive && videoElement) {
      videoBloomService.start(videoElement)
    } else {
      videoBloomService.stop()
    }

    return () => videoBloomService.stop()
  }, [isActive, videoElement])

  // Calculate glow color from mood
  const glowColor = moodColors 
    ? `rgba(${moodColors.r}, ${moodColors.g}, ${moodColors.b}, ${bloomState.bloom * 0.4 * intensity})`
    : `rgba(255, 255, 255, ${bloomState.bloom * 0.3 * intensity})`

  // Calculate bloom values
  const bloomValue = bloomState.bloom * intensity
  const isFlashing = bloomState.isFlash && enableFlash
  const showGlow = enableGlow && bloomValue > 0.05

  // Dynamic styles based on bloom state
  const overlayStyle = {
    '--bloom-intensity': bloomValue,
    '--bloom-glow-color': glowColor,
    '--bloom-blur': enableBlur ? `${bloomValue * 20}px` : '0px',
    '--bloom-brightness': 1 + bloomValue * 0.5,
    '--flash-opacity': isFlashing ? 0.4 * intensity : 0,
  }

  if (!isActive) return null

  return (
    <div 
      ref={overlayRef}
      className={`video-bloom-overlay ${showGlow ? 'glowing' : ''} ${isFlashing ? 'flashing' : ''}`}
      style={overlayStyle}
      aria-hidden="true"
    >
      {/* Soft glow layer - always present but fades in/out */}
      {enableGlow && (
        <div className="bloom-glow-layer" />
      )}

      {/* Edge bloom - creates the "blown out" effect at edges */}
      {enableBlur && bloomValue > 0.1 && (
        <div className="bloom-edge-layer" />
      )}

      {/* Flash layer - bright white flash on peaks */}
      {enableFlash && (
        <div 
          ref={flashRef}
          className={`bloom-flash-layer ${isFlashing ? 'active' : ''}`}
        />
      )}

      {/* Center bloom - subtle center glow */}
      {showGlow && (
        <div 
          className="bloom-center-layer"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${glowColor}, transparent 70%)`
          }}
        />
      )}

      {/* Vignette bloom - glow from edges inward */}
      {showGlow && (
        <div 
          className="bloom-vignette-layer"
          style={{
            boxShadow: `inset 0 0 ${100 * bloomValue}px ${50 * bloomValue}px ${glowColor}`
          }}
        />
      )}
    </div>
  )
}
