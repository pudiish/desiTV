import React, { useMemo } from 'react'
import { BackgroundProvider } from './BackgroundContext'
import { getEffect, isValidEffect } from './BackgroundRegistry'

const BackgroundManager = ({
  variant = 'galaxy',
  enabled = true,
  isActive = true,
  isPlaying = false,
  isBuffering = false,
  volume = 0.5,
  videoId = null,
  videoTitle = null,
  channelName = null,
  tvFrameRect = null,
  baseSpeed,
  density,
  ...additionalProps
}) => {
  if (!enabled) return null

  const effectConfig = useMemo(() => {
    if (!isValidEffect(variant)) {
      console.warn(`[BackgroundManager] Invalid variant: ${variant}, falling back to galaxy`)
      return getEffect('galaxy')
    }
    return getEffect(variant)
  }, [variant])

  const { Component, defaultProps } = effectConfig

  const effectProps = useMemo(() => ({
    isActive,
    isPlaying,
    isBuffering,
    volume,
    videoId,
    videoTitle,
    channelName,
    tvFrameRect,
    baseSpeed: baseSpeed ?? defaultProps.baseSpeed,
    density: density ?? defaultProps.density,
    ...defaultProps,
    ...additionalProps,
  }), [isActive, isPlaying, isBuffering, volume, videoId, videoTitle, channelName, tvFrameRect, baseSpeed, density, defaultProps, additionalProps])

  return (
    <BackgroundProvider isPlaying={isPlaying} volume={volume} videoId={videoId} videoTitle={videoTitle} channelName={channelName}>
      <Component {...effectProps} />
    </BackgroundProvider>
  )
}

export default BackgroundManager
