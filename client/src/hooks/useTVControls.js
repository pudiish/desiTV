/**
 * useTVControls Hook
 * 
 * Manages TV power, volume, and mute controls.
 * Extracted from Home.jsx for better separation of concerns.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { analytics } from '../services/analytics';

export function useTVControls(initialVolume = 0.5) {
  const [power, setPower] = useState(false);
  const [volume, setVolume] = useState(initialVolume);
  const [prevVolume, setPrevVolume] = useState(initialVolume);
  const [crtVolume, setCrtVolume] = useState(null);
  const [crtIsMuted, setCrtIsMuted] = useState(false);
  const shutdownSoundRef = useRef(null);

  // Initialize shutdown sound
  useEffect(() => {
    shutdownSoundRef.current = new Audio('/sounds/tv-shutdown-386167.mp3');
    shutdownSoundRef.current.volume = 0.5;
  }, []);

  const handlePowerToggle = useCallback(() => {
    setPower((previousPower) => {
      const newPower = !previousPower;
      
      // Play shutdown sound when turning off
      if (!newPower && shutdownSoundRef.current) {
        shutdownSoundRef.current.currentTime = 0;
        shutdownSoundRef.current.play().catch(() => {});
      }
      
      return newPower;
    });
  }, []);

  const handleVolumeUp = useCallback(() => {
    setVolume((previousVolume) => {
      const newVolume = Math.min(1, previousVolume + 0.1);
      setCrtVolume(newVolume);
      setCrtIsMuted(false);
      return newVolume;
    });
  }, []);

  const handleVolumeDown = useCallback(() => {
    setVolume((previousVolume) => {
      const newVolume = Math.max(0, previousVolume - 0.1);
      setCrtVolume(newVolume);
      setCrtIsMuted(false);
      analytics.trackVolumeChange(newVolume, 'down');
      return newVolume;
    });
  }, []);

  const handleMute = useCallback(() => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
      setCrtVolume(0);
      setCrtIsMuted(true);
      analytics.trackVolumeChange(0, 'mute');
    } else {
      const restoredVolume = prevVolume || 0.5;
      setVolume(restoredVolume);
      setCrtVolume(restoredVolume);
      setCrtIsMuted(false);
    }
  }, [volume, prevVolume]);

  return {
    power,
    volume,
    prevVolume,
    crtVolume,
    crtIsMuted,
    handlePowerToggle,
    handleVolumeUp,
    handleVolumeDown,
    handleMute,
    setPower,
    setVolume,
  };
}

