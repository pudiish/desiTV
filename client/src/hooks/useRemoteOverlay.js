/**
 * useRemoteOverlay Hook
 * 
 * Manages fullscreen remote overlay visibility and auto-hide behavior.
 * Extracted from Home.jsx for better separation of concerns.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export function useRemoteOverlay() {
  const [remoteOverlayVisible, setRemoteOverlayVisible] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const remoteHideTimeoutRef = useRef(null);

  // Auto-hide timeout duration (2.5 seconds)
  const AUTO_HIDE_DELAY = 2500;

  // Handle mouse hover at edge (shows remote)
  const handleRemoteEdgeHover = useCallback(() => {
    // Check if fullscreen (including iOS CSS fullscreen)
    const isCurrentlyFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      document.body.classList.contains('ios-fullscreen-active') ||
      document.documentElement.classList.contains('ios-fullscreen-active') ||
      document.body.classList.contains('tv-fullscreen-active') ||
      isFullscreen
    );

    if (!isCurrentlyFullscreen) {
      setRemoteOverlayVisible(false);
      return;
    }

    // Only work on desktop
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      return;
    }

    // Show remote and reset auto-hide timer
    setRemoteOverlayVisible((previous) => {
      // If already visible, just reset the timer (don't re-render)
      if (previous) {
        if (remoteHideTimeoutRef.current) {
          clearTimeout(remoteHideTimeoutRef.current);
        }
        remoteHideTimeoutRef.current = setTimeout(() => {
          setRemoteOverlayVisible(false);
          remoteHideTimeoutRef.current = null;
        }, AUTO_HIDE_DELAY);
        return previous; // Return same value to prevent re-render
      }

      // First time showing - clear existing timeout and set new one
      if (remoteHideTimeoutRef.current) {
        clearTimeout(remoteHideTimeoutRef.current);
        remoteHideTimeoutRef.current = null;
      }

      // Set new auto-hide timer
      remoteHideTimeoutRef.current = setTimeout(() => {
        setRemoteOverlayVisible(false);
        remoteHideTimeoutRef.current = null;
      }, AUTO_HIDE_DELAY);

      // Show the remote
      return true;
    });
  }, [isFullscreen]);

  // Handle mouse leave from remote overlay area
  const handleRemoteMouseLeave = useCallback(() => {
    // Clear existing timeout
    if (remoteHideTimeoutRef.current) {
      clearTimeout(remoteHideTimeoutRef.current);
      remoteHideTimeoutRef.current = null;
    }
    // Set new timeout to hide after delay
    remoteHideTimeoutRef.current = setTimeout(() => {
      setRemoteOverlayVisible(false);
      remoteHideTimeoutRef.current = null;
    }, AUTO_HIDE_DELAY);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (remoteHideTimeoutRef.current) {
        clearTimeout(remoteHideTimeoutRef.current);
        remoteHideTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    remoteOverlayVisible,
    isFullscreen,
    setIsFullscreen,
    handleRemoteEdgeHover,
    handleRemoteMouseLeave,
  };
}


