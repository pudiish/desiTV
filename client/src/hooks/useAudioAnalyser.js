/**
 * useAudioAnalyser Hook
 * 
 * Manages Web Audio API connection and frequency analysis
 * Integrates with the decoupled audio analysis engine
 */

import { useEffect, useRef, useCallback } from 'react'
import createAudioAnalysisEngine from '../services/audioAnalysisEngine'

export const useAudioAnalyser = (isPlaying = false) => {
  const contextRef = useRef(null)
  const analyserRef = useRef(null)
  const engineRef = useRef(null)
  const dataArrayRef = useRef(null)
  const lastUpdateRef = useRef(0)

  // Initialize audio context and analyser
  useEffect(() => {
    // Try to get audio context from any playing audio element
    try {
      if (!contextRef.current) {
        contextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }

      if (!analyserRef.current) {
        analyserRef.current = contextRef.current.createAnalyser()
        analyserRef.current.fftSize = 2048
        analyserRef.current.smoothingTimeConstant = 0.8
      }

      // Try to connect to existing audio elements
      const audioElements = document.querySelectorAll('audio')
      audioElements.forEach(audio => {
        try {
          const source = contextRef.current.createMediaElementAudioSource(audio)
          source.connect(analyserRef.current)
          analyserRef.current.connect(contextRef.current.destination)
        } catch (e) {
          // Already connected or not available
        }
      })

      if (!engineRef.current) {
        engineRef.current = createAudioAnalysisEngine()
        dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount)
      }

      // Resume audio context if suspended
      if (contextRef.current.state === 'suspended') {
        contextRef.current.resume()
      }
    } catch (err) {
      console.error('[useAudioAnalyser] Setup failed:', err)
    }

    return () => {
      // Don't close context on unmount - other components might be using it
    }
  }, [])

  // Update audio analysis
  const update = useCallback((dt, timestamp) => {
    if (!analyserRef.current || !engineRef.current) return

    analyserRef.current.getByteFrequencyData(dataArrayRef.current)
    engineRef.current.update(dataArrayRef.current, dt, timestamp, isPlaying)

    return engineRef.current.state
  }, [isPlaying])

  return {
    audioState: engineRef.current?.state || null,
    analyser: analyserRef.current,
    context: contextRef.current,
    update,
    engine: engineRef.current,
  }
}

export default useAudioAnalyser
