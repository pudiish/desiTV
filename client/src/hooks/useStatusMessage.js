/**
 * useStatusMessage Hook
 * 
 * Manages status message state and periodic updates.
 * Extracted from Home.jsx for better separation of concerns.
 */

import { useState, useEffect } from 'react';
import { broadcastStateManager } from '../logic/broadcast';
import { getTimeBasedGreeting } from '../utils/timeBasedProgramming';

export function useStatusMessage(initialMessage = null) {
  const defaultMessage = initialMessage || `${getTimeBasedGreeting()} POWER BUTTON DABAO AUR SHURU KARO!`;
  const [statusMessage, setStatusMessage] = useState(defaultMessage);

  /**
   * Update status message based on current playback mode
   * Only updates if status doesn't already contain mode indicators
   */
  const updateStatusFromMode = (
    power,
    selectedCategory,
    videosInCategory,
    activeVideoIndex
  ) => {
    if (!power || !selectedCategory) return;

    const mode = broadcastStateManager.getMode(selectedCategory._id);
    const currentStatus = statusMessage || '';

    // Only update if status doesn't contain manual/timeline indicators
    if (
      !currentStatus.includes('MANUAL') &&
      !currentStatus.includes('RETURNING') &&
      !currentStatus.includes('LIVE')
    ) {
      if (mode === 'manual') {
        // Manual mode - show current video info
        const currentVideo = videosInCategory[activeVideoIndex] || null;
        const videoTitle = currentVideo?.title?.substring(0, 30) || 'VIDEO';
        setStatusMessage(`MANUAL MODE - ${selectedCategory.name} - ${videoTitle}...`);
      } else if (mode === 'timeline') {
        // Timeline mode - show LIVE indicator
        const currentVideo = videosInCategory[activeVideoIndex] || null;
        const videoTitle = currentVideo?.title?.substring(0, 30) || 'VIDEO';
        setStatusMessage(`● LIVE - ${selectedCategory.name} - ${videoTitle}...`);
      }
    }
  };

  /**
   * Periodic status message update (every 2 seconds)
   */
  useEffect(() => {
    // This effect will be called from parent component with dependencies
    // Keeping hook simple - parent manages when to update
  }, []);

  return {
    statusMessage,
    setStatusMessage,
    updateStatusFromMode,
  };
}


