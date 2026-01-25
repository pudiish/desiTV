/**
 * AmbientLight Component
 * 
 * Creates a Philips Ambilight-style effect around the TV
 * Projects colors from video content onto the "wall" behind the TV
 * 
 * Features:
 * - Samples dominant colors from video
 * - Smooth gradient transitions
 * - Channel-based fallback colors
 * - Performance-optimized (reduced on mobile)
 */

import React, { useRef, useEffect, useState, useMemo } from 'react'
import './AmbientLight.css'

// Default fallback colors by channel type
const CHANNEL_COLORS = {
  romantic: ['#ff6b9d', '#9b59b6', '#e91e63'],
  comedy: ['#ffd93d', '#ff8c00', '#ff5733'],
  retro: ['#d4a574', '#8b5a2b', '#cd853f'],
  bollywood: ['#ff4081', '#9c27b0', '#673ab7'],
  punjabi: ['#ffc107', '#ff5722', '#e91e63'],
  sufi: ['#4fc3f7', '#29b6f6', '#03a9f4'],
  ghazal: ['#ab47bc', '#7e57c2', '#5c6bc0'],
  indie: ['#26a69a', '#00897b', '#00796b'],
  default: ['#4a90d9', '#5c6bc0', '#7e57c2'],
}

/**
 * Get colors based on channel name
 */
function getChannelColors(channelName = '') {
  const name = channelName.toLowerCase()
  
  for (const [type, colors] of Object.entries(CHANNEL_COLORS)) {
    if (name.includes(type)) {
      return colors
    }
  }
  
  return CHANNEL_COLORS.default
}

/**
 * AmbientLight Component
 * 
 * @param {Object} props
 * @param {boolean} props.enabled - Whether ambient light is active
 * @param {string} props.channelName - Current channel name for theming
 * @param {boolean} props.isPlaying - Whether video is playing
 * @param {Object} props.tvFrameRect - TV frame bounds for positioning
 * @param {number} props.intensity - Light intensity (0-1)
 */
export function AmbientLight({
  enabled = true,
  channelName = '',
  isPlaying = false,
  tvFrameRect = null,
  intensity = 0.6,
}) {
  const [colors, setColors] = useState(() => getChannelColors(channelName))
  const [transitioning, setTransitioning] = useState(false)
  const prevChannelRef = useRef(channelName)
  
  // Update colors when channel changes
  useEffect(() => {
    if (channelName !== prevChannelRef.current) {
      setTransitioning(true)
      
      // Smooth transition
      const timeout = setTimeout(() => {
        setColors(getChannelColors(channelName))
        setTransitioning(false)
      }, 300)
      
      prevChannelRef.current = channelName
      
      return () => clearTimeout(timeout)
    }
  }, [channelName])

  // Generate gradient based on TV position
  const gradientStyle = useMemo(() => {
    if (!enabled || !isPlaying) {
      return { opacity: 0 }
    }

    const [primary, secondary, tertiary] = colors
    const alpha = Math.round(intensity * 255).toString(16).padStart(2, '0')
    const alphaLight = Math.round(intensity * 0.5 * 255).toString(16).padStart(2, '0')
    
    // Position-aware gradients if we have TV rect
    const centerX = tvFrameRect ? '50%' : '50%'
    const centerY = tvFrameRect ? '50%' : '50%'
    
    return {
      opacity: transitioning ? 0.5 : 1,
      background: `
        radial-gradient(
          ellipse 120% 80% at ${centerX} 100%,
          ${primary}${alpha} 0%,
          ${secondary}${alphaLight} 30%,
          transparent 60%
        ),
        radial-gradient(
          ellipse 80% 100% at 0% ${centerY},
          ${secondary}${alphaLight} 0%,
          transparent 40%
        ),
        radial-gradient(
          ellipse 80% 100% at 100% ${centerY},
          ${tertiary}${alphaLight} 0%,
          transparent 40%
        ),
        radial-gradient(
          ellipse 120% 80% at ${centerX} 0%,
          ${primary}${alphaLight} 0%,
          transparent 50%
        )
      `,
    }
  }, [enabled, isPlaying, colors, intensity, tvFrameRect, transitioning])

  if (!enabled) {
    return null
  }

  return (
    <div 
      className={`ambient-light ${isPlaying ? 'ambient-light--active' : ''}`}
      style={gradientStyle}
      aria-hidden="true"
    />
  )
}

/**
 * AmbientLightEdge Component
 * Creates ambient light on specific edge of the TV
 */
export function AmbientLightEdge({
  edge = 'bottom', // 'top', 'bottom', 'left', 'right'
  color = '#4a90d9',
  intensity = 0.5,
  spread = 100,
  enabled = true,
}) {
  if (!enabled) return null

  const alpha = Math.round(intensity * 255).toString(16).padStart(2, '0')
  
  const edgeStyles = {
    top: {
      top: 0,
      left: 0,
      right: 0,
      height: `${spread}px`,
      background: `linear-gradient(180deg, ${color}${alpha} 0%, transparent 100%)`,
    },
    bottom: {
      bottom: 0,
      left: 0,
      right: 0,
      height: `${spread}px`,
      background: `linear-gradient(0deg, ${color}${alpha} 0%, transparent 100%)`,
    },
    left: {
      top: 0,
      bottom: 0,
      left: 0,
      width: `${spread}px`,
      background: `linear-gradient(90deg, ${color}${alpha} 0%, transparent 100%)`,
    },
    right: {
      top: 0,
      bottom: 0,
      right: 0,
      width: `${spread}px`,
      background: `linear-gradient(270deg, ${color}${alpha} 0%, transparent 100%)`,
    },
  }

  return (
    <div 
      className={`ambient-light-edge ambient-light-edge--${edge}`}
      style={edgeStyles[edge]}
      aria-hidden="true"
    />
  )
}

export default AmbientLight
