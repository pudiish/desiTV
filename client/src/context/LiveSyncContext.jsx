/**
 * Live Sync Context - Coalesced State Sharing
 * 
 * Provides a single source of truth for LIVE sync state.
 * Multiple components can subscribe without duplicate fetches.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchLiveState,
  startPolling,
  stopPolling,
  getLastState,
  calculateDrift,
  SYNC_CONFIG,
} from '../services/api/liveStateService';
import socketService from '../services/socket';

// Context
const LiveSyncContext = createContext(null);

/**
 * Provider component
 */
export function LiveSyncProvider({ children, categoryId, enabled = true }) {
  const [liveState, setLiveState] = useState(null);
  const [drift, setDrift] = useState(null);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [connectionType, setConnectionType] = useState('none');
  const [error, setError] = useState(null);
  
  const categoryIdRef = useRef(categoryId);
  const enabledRef = useRef(enabled);
  
  // Track subscribers
  const subscriberCount = useRef(0);

  // Update refs
  useEffect(() => {
    categoryIdRef.current = categoryId;
    enabledRef.current = enabled;
  }, [categoryId, enabled]);

  // Handle state updates
  const handleStateReceived = useCallback((state) => {
    setLiveState(state);
    setError(null);
    
    // Calculate drift (will be used by subscribers)
    const lastDrift = state._lastDrift;
    if (lastDrift !== undefined) {
      setDrift({ drift: lastDrift, absDrift: Math.abs(lastDrift) });
    }
  }, []);

  // Track connection type
  useEffect(() => {
    const unsubConnect = socketService.addListener('connected', () => {
      setConnectionType('socket');
      setSyncStatus('synced');
    });
    const unsubDisconnect = socketService.addListener('disconnected', () => {
      setConnectionType('polling');
      setSyncStatus('reconnecting');
    });
    const unsubFallback = socketService.addListener('fallback', () => {
      setConnectionType('polling');
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
      unsubFallback();
    };
  }, []);

  // Start/stop sync based on enabled and categoryId
  useEffect(() => {
    if (!enabled || !categoryId) {
      stopPolling();
      setSyncStatus('stopped');
      return;
    }

    setSyncStatus('connecting');
    startPolling(categoryId, handleStateReceived);
    
    return () => {
      stopPolling();
    };
  }, [enabled, categoryId, handleStateReceived]);

  // Manual refresh
  const refresh = useCallback(async () => {
    if (!categoryIdRef.current) return null;
    
    try {
      setSyncStatus('syncing');
      const state = await fetchLiveState(categoryIdRef.current, true);
      handleStateReceived(state);
      setSyncStatus('synced');
      return state;
    } catch (e) {
      setError(e.message);
      setSyncStatus('error');
      return null;
    }
  }, [handleStateReceived]);

  // Go live (force sync)
  const goLive = useCallback(() => {
    if (socketService.isConnected()) {
      socketService.requestSync();
    } else {
      refresh();
    }
  }, [refresh]);

  const value = {
    // State
    liveState,
    drift,
    syncStatus,
    connectionType,
    error,
    categoryId,
    
    // Actions
    refresh,
    goLive,
    
    // Config
    config: SYNC_CONFIG,
  };

  return (
    <LiveSyncContext.Provider value={value}>
      {children}
    </LiveSyncContext.Provider>
  );
}

/**
 * Hook to consume sync context
 */
export function useLiveSyncContext() {
  const context = useContext(LiveSyncContext);
  if (!context) {
    throw new Error('useLiveSyncContext must be used within LiveSyncProvider');
  }
  return context;
}

/**
 * Hook for components that need drift correction callbacks
 */
export function useLiveSyncWithCorrection(playerRef, options = {}) {
  const { onCorrectionNeeded, onVideoChange } = options;
  const context = useLiveSyncContext();
  const lastCorrectionRef = useRef(0);

  // Calculate drift and trigger corrections
  useEffect(() => {
    if (!context.liveState || !playerRef?.current) return;

    const player = playerRef.current;
    const localPosition = player.getCurrentTime?.() || 0;
    const localVideoIndex = player.getCurrentVideoIndex?.() || 0;

    const driftResult = calculateDrift(context.liveState, localPosition, localVideoIndex);
    
    // Throttle corrections
    const now = Date.now();
    if (now - lastCorrectionRef.current < 1000 && driftResult.action !== 'switch_video') {
      return;
    }

    switch (driftResult.action) {
      case 'switch_video':
        lastCorrectionRef.current = now;
        if (onVideoChange) {
          onVideoChange({
            videoIndex: driftResult.targetVideo,
            videoId: context.liveState.live.videoId,
            position: driftResult.targetPosition,
            title: context.liveState.live.videoTitle,
          });
        }
        break;

      case 'seek':
        lastCorrectionRef.current = now;
        if (onCorrectionNeeded) {
          onCorrectionNeeded({
            type: 'seek',
            targetPosition: driftResult.targetPosition,
            drift: driftResult.drift,
          });
        }
        break;

      case 'rate_adjust':
        lastCorrectionRef.current = now;
        if (onCorrectionNeeded) {
          onCorrectionNeeded({
            type: 'rate',
            rate: driftResult.rate,
            drift: driftResult.drift,
            direction: driftResult.direction,
          });
        }
        break;

      default:
        // Synced - reset rate if needed
        if (onCorrectionNeeded && player.getPlaybackRate?.() !== 1.0) {
          onCorrectionNeeded({ type: 'rate', rate: 1.0, drift: 0 });
        }
    }
  }, [context.liveState, playerRef, onCorrectionNeeded, onVideoChange]);

  return {
    ...context,
    drift: context.drift,
  };
}

export default LiveSyncContext;
