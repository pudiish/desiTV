/**
 * useLiveSync Hook - Handles LIVE sync between server and player
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  playerStateMachine, 
  PlayerState, 
  PlayerEvent 
} from '../logic/playback';
import { 
  fetchLiveState, 
  calculateDrift,
  getRecommendedPlaybackRate,
  startPolling,
  stopPolling,
  getSyncStatus 
} from '../services/api/liveStateService';
import { DEBUG_SYNC } from '../config/thresholds';

const log = (...args) => DEBUG_SYNC && console.log(...args);
import { SYNC_THRESHOLDS } from '../config/thresholds';

/**
 * Options for useLiveSync hook
 * @typedef {Object} LiveSyncOptions
 * @property {boolean} enabled - Whether sync is enabled
 * @property {Function} onCorrectionNeeded - Called when player needs correction
 * @property {Function} onVideoChange - Called when video should change
 * @property {boolean} autoStart - Start syncing immediately on mount
 */

/**
 * Result from useLiveSync hook
 * @typedef {Object} LiveSyncResult
 * @property {Object} liveState - Current live state from server
 * @property {Object} drift - Current drift analysis
 * @property {string} syncStatus - Current sync status
 * @property {number} recommendedRate - Recommended playback rate
 * @property {boolean} isSyncing - Whether actively syncing
 * @property {Function} startSync - Start syncing
 * @property {Function} stopSync - Stop syncing
 * @property {Function} checkDrift - Manually check drift
 * @property {Function} goLive - Return to live mode
 * @property {Function} goManual - Enter manual mode
 */

/**
 * Hook for managing LIVE synchronization
 * 
 * @param {string} categoryId - Current category ID
 * @param {Object} playerRef - Reference to player instance
 * @param {LiveSyncOptions} options - Options
 * @returns {LiveSyncResult}
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
  const [machineState, setMachineState] = useState(playerStateMachine.state);
  const [recommendedRate, setRecommendedRate] = useState(1.0);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Refs for latest values without re-render
  const categoryIdRef = useRef(categoryId);
  const enabledRef = useRef(enabled);
  const playerRefRef = useRef(playerRef);
  
  // Keep refs updated
  useEffect(() => {
    categoryIdRef.current = categoryId;
    enabledRef.current = enabled;
    playerRefRef.current = playerRef;
  }, [categoryId, enabled, playerRef]);

  // Subscribe to state machine changes
  useEffect(() => {
    const unsubscribe = playerStateMachine.subscribe((state) => {
      setMachineState(state);
      
      // Update syncing status
      setIsSyncing(state === PlayerState.SYNCING || state === PlayerState.CORRECTING);
    });

    return unsubscribe;
  }, []);

  // Handle state received from server
  const handleStateReceived = useCallback((state) => {
    setLiveState(state);
    
    // Get current player position
    const player = playerRefRef.current?.current;
    if (!player) {
      log('[useLiveSync] No player reference, skipping drift check');
      return;
    }

    // Get local playback info
    const localPosition = player.getCurrentTime?.() || 0;
    const localVideoIndex = player.getCurrentVideoIndex?.() || 0;

    // Calculate drift
    const driftAnalysis = calculateDrift(state, localPosition, localVideoIndex);
    setDrift(driftAnalysis);

    // Log significant drift
    if (driftAnalysis.needsCorrection) {
      console.log(`[useLiveSync] 🚨 Drift detected: ${driftAnalysis.driftMs.toFixed(0)}ms (${driftAnalysis.correctionType})`);
    }

    // Handle based on correction type
    if (driftAnalysis.correctionType === 'video_mismatch') {
      // Wrong video! Need to change NOW
      console.log(`[useLiveSync] 📺 Video mismatch! Local: ${localVideoIndex}, Server: ${state.live.videoIndex}`);
      
      playerStateMachine.transition(PlayerEvent.DRIFT_DETECTED);
      
      if (onVideoChange) {
        onVideoChange({
          videoIndex: state.live.videoIndex,
          videoId: state.live.videoId,
          position: state.live.position,
          title: state.live.title,
        });
      }
      
    } else if (driftAnalysis.correctionType === 'seek') {
      // Too far off - need to seek
      console.log(`[useLiveSync] ⏭️ Seek correction needed: ${driftAnalysis.driftSec.toFixed(2)}s`);
      
      playerStateMachine.transition(PlayerEvent.DRIFT_DETECTED);
      
      if (onCorrectionNeeded) {
        onCorrectionNeeded({
          type: 'seek',
          targetPosition: state.live.position,
          currentPosition: localPosition,
          drift: driftAnalysis,
        });
      }
      
      // After seeking, we're synced
      setTimeout(() => {
        playerStateMachine.transition(PlayerEvent.CORRECTION_COMPLETE);
      }, 500);
      
    } else if (driftAnalysis.correctionType === 'rate') {
      // Small drift - adjust playback rate
      const rate = getRecommendedPlaybackRate(driftAnalysis.driftMs);
      setRecommendedRate(rate);
      
      if (rate !== 1.0) {
        console.log(`[useLiveSync] 🎚️ Rate adjustment: ${rate}x (drift: ${driftAnalysis.driftMs.toFixed(0)}ms)`);
        
        if (onCorrectionNeeded) {
          onCorrectionNeeded({
            type: 'rate',
            rate,
            drift: driftAnalysis,
          });
        }
      }
      
    } else {
      // Within tolerance - perfect!
      setRecommendedRate(1.0);
      
      // Make sure we're not in correcting state
      if (machineState === PlayerState.CORRECTING) {
        playerStateMachine.transition(PlayerEvent.CORRECTION_COMPLETE);
      }
    }

  }, [onCorrectionNeeded, onVideoChange, machineState]);

  // Start syncing
  const startSync = useCallback(() => {
    if (!categoryIdRef.current) {
      log('[useLiveSync] WARN: Cannot start sync without categoryId');
      return;
    }

    console.log(`[useLiveSync] 🚀 Starting sync for category: ${categoryIdRef.current}`);
    
    // Power on the state machine
    playerStateMachine.transition(PlayerEvent.POWER_ON);
    
    // Start polling
    startPolling(
      categoryIdRef.current,
      handleStateReceived,
      (drift) => {
        log('[useLiveSync] Drift callback:', drift);
      }
    );
    
    setIsSyncing(true);
  }, [handleStateReceived]);

  // Stop syncing
  const stopSync = useCallback(() => {
    log('[useLiveSync] ⏹️ Stopping sync');
    stopPolling();
    playerStateMachine.transition(PlayerEvent.POWER_OFF);
    setIsSyncing(false);
    setRecommendedRate(1.0);
  }, []);

  // Manual drift check
  const checkDrift = useCallback(async () => {
    if (!categoryIdRef.current) return null;

    try {
      const state = await fetchLiveState(categoryIdRef.current, true);
      handleStateReceived(state);
      return state;
    } catch (error) {
      console.error('[useLiveSync] Manual drift check failed:', error);
      return null;
    }
  }, [handleStateReceived]);

  // Go live (return to live mode from manual)
  const goLive = useCallback(() => {
    log('[useLiveSync] 📡 Returning to LIVE mode');
    
    // Clear manual state
    playerStateMachine.transition(PlayerEvent.CATEGORY_CHANGE);
    
    // Immediately sync
    checkDrift();
    
  }, [checkDrift]);

  // Go manual (exit live mode)
  const goManual = useCallback(() => {
    log('[useLiveSync] 🎮 Entering MANUAL mode');
    playerStateMachine.transition(PlayerEvent.CHANNEL_UP);
  }, []);

  // Effect: Start/stop based on enabled and categoryId
  useEffect(() => {
    if (enabled && categoryId && autoStart) {
      startSync();
    } else if (!enabled) {
      stopSync();
    }

    return () => {
      stopSync();
    };
  }, [enabled, categoryId, autoStart]); // Don't include startSync/stopSync to avoid loops

  // Effect: Category changed while syncing
  useEffect(() => {
    if (isSyncing && categoryId) {
      log('[useLiveSync] 📂 Category changed, restarting sync');
      
      // Signal category change to state machine
      playerStateMachine.transition(PlayerEvent.CATEGORY_CHANGE);
      
      // Restart polling with new category
      stopPolling();
      startPolling(categoryId, handleStateReceived, null);
    }
  }, [categoryId]); // Only categoryId, not isSyncing or handleStateReceived

  // Expose debug info
  const getDebugInfo = useCallback(() => ({
    ...getSyncStatus(),
    hookState: {
      liveState,
      drift,
      machineState,
      recommendedRate,
      isSyncing,
      categoryId,
    }
  }), [liveState, drift, machineState, recommendedRate, isSyncing, categoryId]);

  return {
    // State
    liveState,
    drift,
    syncStatus: machineState,
    recommendedRate,
    isSyncing,
    isLive: machineState === PlayerState.LIVE,
    isManual: machineState === PlayerState.MANUAL,
    
    // Actions
    startSync,
    stopSync,
    checkDrift,
    goLive,
    goManual,
    
    // Debug
    getDebugInfo,
  };
}

export default useLiveSync;
