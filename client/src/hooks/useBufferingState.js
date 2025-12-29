/**
 * useBufferingState Hook
 * 
 * Manages buffering and static effect state.
 * Extracted from Home.jsx for better separation of concerns.
 */

import { useState, useCallback } from 'react';

export function useBufferingState() {
  const [isBuffering, setIsBuffering] = useState(false);
  const [bufferErrorMessage, setBufferErrorMessage] = useState('');
  const [staticActive, setStaticActive] = useState(false);

  const triggerStatic = useCallback(() => {
    setStaticActive(true);
    setTimeout(() => setStaticActive(false), 300);
  }, []);

  const handleBufferingChange = useCallback((buffering, errorMessage = '') => {
    setIsBuffering(buffering);
    setBufferErrorMessage(errorMessage);
    
    // Auto-hide after 2 seconds
    if (buffering) {
      setTimeout(() => {
        setIsBuffering(false);
        setBufferErrorMessage('');
      }, 2000);
    }
  }, []);

  return {
    isBuffering,
    bufferErrorMessage,
    staticActive,
    setIsBuffering,
    setBufferErrorMessage,
    setStaticActive,
    triggerStatic,
    handleBufferingChange,
  };
}


