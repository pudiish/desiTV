/**
 * useSessionManagement Hook
 * 
 * Manages session state persistence and restoration.
 * Extracted from Home.jsx for better separation of concerns.
 */

import { useRef, useCallback, useEffect } from 'react';
import { SessionManager } from '../services/storage';
import { broadcastStateManager } from '../logic/broadcast';

export function useSessionManagement(selectedCategory, activeVideoIndex, volume, power) {
  const sessionSaveTimeoutRef = useRef(null);
  const SAVE_DEBOUNCE_MS = 500;

  /**
   * Save session state (debounced)
   */
  const saveSessionState = useCallback(() => {
    if (sessionSaveTimeoutRef.current) {
      clearTimeout(sessionSaveTimeoutRef.current);
    }

    sessionSaveTimeoutRef.current = setTimeout(() => {
      // Get current video index from broadcast position (more accurate than state)
      let currentVideoIndex = activeVideoIndex;
      if (selectedCategory) {
        try {
          const position = broadcastStateManager.calculateCurrentPosition(selectedCategory);
          if (position && position.videoIndex >= 0) {
            currentVideoIndex = position.videoIndex;
          }
        } catch (error) {
          console.warn('[useSessionManagement] Could not calculate position for save, using state index');
        }
      }

      SessionManager.updateState({
        activeCategoryId: selectedCategory?._id,
        activeCategoryName: selectedCategory?.name,
        activeVideoIndex: currentVideoIndex,
        volume,
        isPowerOn: power,
      });

      // Also ensure broadcast state is saved
      try {
        broadcastStateManager.saveToStorage();
      } catch (error) {
        console.error('[useSessionManagement] Error saving broadcast state:', error);
      }
    }, SAVE_DEBOUNCE_MS);
  }, [selectedCategory, activeVideoIndex, volume, power]);

  /**
   * Force save session state immediately (no debounce)
   */
  const forceSaveSession = useCallback(() => {
    // Clear any pending save
    if (sessionSaveTimeoutRef.current) {
      clearTimeout(sessionSaveTimeoutRef.current);
      sessionSaveTimeoutRef.current = null;
    }

    // Save session state
    SessionManager.forceSave();

    // CRITICAL: Save broadcast state (global epoch and channel states)
    try {
      broadcastStateManager.saveToStorage();
      console.log('[useSessionManagement] Broadcast state saved');
    } catch (error) {
      console.error('[useSessionManagement] Error saving broadcast state:', error);
    }
  }, []);

  // Save session on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      forceSaveSession();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (sessionSaveTimeoutRef.current) {
        clearTimeout(sessionSaveTimeoutRef.current);
      }
    };
  }, [forceSaveSession]);

  return {
    saveSessionState,
    forceSaveSession,
  };
}


