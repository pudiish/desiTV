/**
 * useLiveSync Hook - Ultra-Optimized Hybrid Sync
 * 
 * Features:
 * - WebSocket primary, HTTP fallback
 * - Adaptive polling (30s synced → 1s critical)
 * - Proportional rate correction
 * - Client-side interpolation
 * - Throttled corrections
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchLiveState,
  calculateDrift,
  startPolling,
  stopPolling,
  getExpectedPosition,
  getLastState,
  getCurrentDrift,
  SYNC_CONFIG,
} from '../services/api/liveStateService';
import socketService from '../services/socket';

/**
 * Hook for managing LIVE synchronization
 */
export function useLiveSync(categoryId, playerRef, options = {}) {
  const {
    enabled = true,
    onCorrectionNeeded,
    onVideoChange,
    autoStart = true,
  } = options;

  // State
  const [liveState, setLiveState] = useState(null);
  const [drift, setDrift] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [connectionType, setConnectionType] = useState('none');

  // Refs
  const categoryIdRef = useRef(categoryId);
  const playerRefRef = useRef(playerRef);
  const lastCorrectionRef = useRef(0);
  const lastRateRef = useRef(1.0);
  
  useEffect(() => {
    categoryIdRef.current = categoryId;
    playerRefRef.current = playerRef;
  }, [categoryId, playerRef]);

  // Track connection type
  useEffect(() => {
    const unsubConnect = socketService.addListener('connected', () => {
      setConnectionType('socket');
    });
    const unsubDisconnect = socketService.addListener('disconnected', () => {
      setConnectionType('polling');
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

  // Handle state from server
  const handleStateReceived = useCallback((state) => {
    setLiveState(state);
    
    const player = playerRefRef.current?.current;
    if (!player) return;

    const localPosition = player.getCurrentTime?.() || 0;
    const localVideoIndex = player.getCurrentVideoIndex?.() || 0;

    // Calculate drift with proportional correction
    const driftResult = calculateDrift(state, localPosition, localVideoIndex);
    setDrift(driftResult);

    // Throttle corrections (max once per second, except video switch)
    const now = Date.now();
    if (now - lastCorrectionRef.current < 1000 && driftResult.action !== 'switch_video') {
      return;
    }

    // Handle corrections
    switch (driftResult.action) {
      case 'switch_video':
        setSyncStatus('switching');
        lastCorrectionRef.current = now;
        if (onVideoChange) {
          onVideoChange({
            videoIndex: driftResult.targetVideo,
            videoId: state.live.videoId,
            position: driftResult.targetPosition,
            title: state.live.videoTitle,
          });
        }
        break;

      case 'seek':
        setSyncStatus('seeking');
        lastCorrectionRef.current = now;
        if (onCorrectionNeeded) {
          onCorrectionNeeded({
            type: 'seek',
            targetPosition: driftResult.targetPosition,
            drift: driftResult.drift,
          });
        }
        // Reset rate after seek
        setTimeout(() => {
          if (onCorrectionNeeded && lastRateRef.current !== 1.0) {
            onCorrectionNeeded({ type: 'rate', rate: 1.0, drift: 0 });
            lastRateRef.current = 1.0;
          }
        }, 500);
        break;

      case 'rate_adjust':
        // Only apply if rate changed significantly
        if (Math.abs(driftResult.rate - lastRateRef.current) > 0.01) {
          setSyncStatus('adjusting');
          lastCorrectionRef.current = now;
          lastRateRef.current = driftResult.rate;
          if (onCorrectionNeeded) {
            onCorrectionNeeded({
              type: 'rate',
              rate: driftResult.rate,
              drift: driftResult.drift,
              direction: driftResult.direction,
            });
          }
        }
        break;

      case 'refresh':
        // Need fresh data (video boundary)
        fetchLiveState(categoryIdRef.current, true).catch(() => {});
        break;

      default:
        setSyncStatus('synced');
        // Reset rate if we're synced and rate isn't normal
        if (lastRateRef.current !== 1.0) {
          if (onCorrectionNeeded) {
            onCorrectionNeeded({ type: 'rate', rate: 1.0, drift: 0 });
          }
          lastRateRef.current = 1.0;
        }
    }
  }, [onCorrectionNeeded, onVideoChange]);

  // Start sync
  const startSync = useCallback(() => {
    if (!categoryIdRef.current) return;
    
    startPolling(categoryIdRef.current, handleStateReceived);
    setIsSyncing(true);
    setSyncStatus('syncing');
  }, [handleStateReceived]);

  // Stop sync
  const stopSync = useCallback(() => {
    stopPolling();
    socketService.disconnect();
    setIsSyncing(false);
    setSyncStatus('stopped');
    setConnectionType('none');
    lastRateRef.current = 1.0;
  }, []);

  // Manual check
  const checkDrift = useCallback(async () => {
    if (!categoryIdRef.current) return null;
    try {
      const state = await fetchLiveState(categoryIdRef.current, true);
      handleStateReceived(state);
      return state;
    } catch (e) {
      console.error('[Sync] Check failed:', e.message);
      return null;
    }
  }, [handleStateReceived]);

  // Go live
  const goLive = useCallback(() => {
    if (socketService.isConnected()) {
      socketService.requestSync();
    } else {
      checkDrift();
    }
  }, [checkDrift]);

  // Auto-start effect
  useEffect(() => {
    if (enabled && categoryId && autoStart) {
      startSync();
    }
    return () => stopSync();
  }, [enabled, categoryId, autoStart, startSync, stopSync]);

  // Category change = restart
  useEffect(() => {
    if (isSyncing && categoryId) {
      stopSync();
      setTimeout(startSync, 100);
    }
  }, [categoryId]);

  // Client-side interpolation
  const getInterpolatedPosition = useCallback(() => {
    return getExpectedPosition(getLastState());
  }, []);

  return {
    liveState,
    drift,
    syncStatus,
    isSyncing,
    connectionType,
    startSync,
    stopSync,
    checkDrift,
    goLive,
    getInterpolatedPosition,
    currentDrift: getCurrentDrift(),
    // Backward compatibility
    machineState: syncStatus,
    recommendedRate: drift?.rate || 1.0,
    goManual: stopSync,
  };
}

export default useLiveSync;
