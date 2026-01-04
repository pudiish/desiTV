/**
 * BackgroundManager - Unified Background Effect Renderer
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Single component that manages rendering of all background effects.
 * - Handles effect switching
 * - Provides shared context to effects
 * - Manages transitions between effects
 * - Standardizes prop passing
 * 
 * Usage:
 *   <BackgroundManager
 *     variant="galaxy"      // 'galaxy' | 'orbital' | 'liquid' | 'aurora'
 *     enabled={true}
 *     isActive={tvPower}
 *     isPlaying={isPlaying}
 *     volume={volume}
 *     videoId={videoId}
 *   />
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */
import React, { useMemo } from 'react'
import { BackgroundProvider } from './BackgroundContext'
import { getEffect, isValidEffect } from './BackgroundRegistry'

const BackgroundManager = ({
  // Effect selection
  variant = 'galaxy',
  enabled = true,
  
  // Animation state
  isActive = true,
  isPlaying = false,
  isBuffering = false,
  volume = 0.5,
  
  // Video info (for color extraction)
  videoId = null,
  videoTitle = null,
  channelName = null,
  
  // Layout info (for tunnel effect)
  tvFrameRect = null,
  
  // Override default props
  baseSpeed,
  density,
  
  // Additional props
  ...additionalProps
}) => {
  // Don't render if disabled
  if (!enabled) return null
  
  // Validate and get effect config
  const effectConfig = useMemo(() => {
    if (!isValidEffect(variant)) {
      console.warn(`[BackgroundManager] Invalid variant: ${variant}, falling back to galaxy`)
      return getEffect('galaxy')
    }
    return getEffect(variant)
  }, [variant])
  
  const { Component, defaultProps } = effectConfig
  
  // Merge props with defaults
  const effectProps = useMemo(() => ({
    // Animation state
    isActive,
    isPlaying,
    isBuffering,
    volume,
    
    // Video info
    videoId,
    videoTitle,
    channelName,
    
    // Layout
    tvFrameRect,
    
    // Merged with defaults
    baseSpeed: baseSpeed ?? defaultProps.baseSpeed,
    density: density ?? defaultProps.density,
    
    // Effect-specific defaults
    ...defaultProps,
    
    // Any additional overrides
    ...additionalProps,
  }), [
    isActive, 
    isPlaying, 
    isBuffering, 
    volume, 
    videoId, 
    videoTitle, 
    channelName, 
    tvFrameRect, 
    baseSpeed, 
    density, 
    defaultProps, 
    additionalProps
  ])
  
  return (
    <BackgroundProvider
      isPlaying={isPlaying}
      volume={volume}
      videoId={videoId}
      videoTitle={videoTitle}
      channelName={channelName}
    >
      <Component {...effectProps} />
    </BackgroundProvider>
  )
}

export default BackgroundManager
