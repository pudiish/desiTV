/**
 * LiveSyncWrapper Component - Keeps player in sync with server LIVE state
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveSync } from '../../hooks/useLiveSync';
import { PlayerState } from '../../logic/playback';
import { DEBUG_SYNC } from '../../config/thresholds';

const log = (...args) => DEBUG_SYNC && console.log(...args);

export function LiveSyncWrapper({ 
  categoryId, 
  playerRef, 
  onSyncStatusChange,
  enabled = true,
  showDebug = false,
  children 
}) {
  // Track correction state
  const [correctionState, setCorrectionState] = useState(null);
  const [lastCorrection, setLastCorrection] = useState(null);
  
  // Ref to track if we're mid-correction (to prevent overlapping corrections)
  const correctionInProgressRef = useRef(false);
  const originalPlaybackRateRef = useRef(1.0);

  // Handler for when correction is needed
  const handleCorrectionNeeded = useCallback(async (correction) => {
    // Prevent overlapping corrections
    if (correctionInProgressRef.current) {
      log('[LiveSyncWrapper] Skipping correction - one already in progress');
      return;
    }

    correctionInProgressRef.current = true;
    setCorrectionState(correction);

    try {
      const player = playerRef?.current;
      
      if (!player) {
        console.warn('[LiveSyncWrapper] No player reference for correction');
        return;
      }

      switch (correction.type) {
        case 'seek':
          log(`[LiveSyncWrapper] 🎯 Seeking to ${correction.targetPosition.toFixed(2)}s`);
          
          // Pause to prevent jitter during seek
          if (typeof player.pauseVideo === 'function') {
            player.pauseVideo();
          }
          
          // Seek to target
          if (typeof player.seekTo === 'function') {
            player.seekTo(correction.targetPosition, true);
          }
          
          // Resume playback
          setTimeout(() => {
            if (typeof player.playVideo === 'function') {
              player.playVideo();
            }
            // Reset playback rate to normal after seek
            if (typeof player.setPlaybackRate === 'function') {
              player.setPlaybackRate(1.0);
            }
          }, 100);
          
          setLastCorrection({
            type: 'seek',
            timestamp: Date.now(),
            from: correction.currentPosition,
            to: correction.targetPosition,
          });
          break;

        case 'rate':
          const newRate = correction.rate;
          log(`[LiveSyncWrapper] 🎚️ Adjusting playback rate to ${newRate}`);
          
          if (typeof player.setPlaybackRate === 'function') {
            // Store original rate if this is a new correction
            if (originalPlaybackRateRef.current === 1.0) {
              originalPlaybackRateRef.current = player.getPlaybackRate?.() || 1.0;
            }
            
            player.setPlaybackRate(newRate);
            
            // Schedule rate reset after correction period
            setTimeout(() => {
              if (typeof player.setPlaybackRate === 'function') {
                player.setPlaybackRate(1.0);
                originalPlaybackRateRef.current = 1.0;
              }
            }, 2000); // Reset after 2 seconds
          }
          
          setLastCorrection({
            type: 'rate',
            timestamp: Date.now(),
            rate: newRate,
            driftMs: correction.drift?.driftMs,
          });
          break;

        default:
          console.warn('[LiveSyncWrapper] Unknown correction type:', correction.type);
      }

    } catch (error) {
      console.error('[LiveSyncWrapper] Correction error:', error);
    } finally {
      // Clear correction state after a delay
      setTimeout(() => {
        correctionInProgressRef.current = false;
        setCorrectionState(null);
      }, 500);
    }
  }, [playerRef]);

  // Handler for video change (wrong video playing)
  const handleVideoChange = useCallback((videoInfo) => {
    log('[LiveSyncWrapper] 📺 Video change needed:', videoInfo);
    
    // This is trickier - we need to tell the Player to switch videos
    // For now, we'll emit an event and let the parent handle it
    // In a full implementation, this would trigger channel/video navigation
    
    setLastCorrection({
      type: 'video_change',
      timestamp: Date.now(),
      targetVideo: videoInfo.videoIndex,
      targetTitle: videoInfo.title,
    });
    
    // TODO: Implement video switching
    // Options:
    // 1. Call onChannelChange prop to trigger a re-render with new position
    // 2. Expose a seekToVideo method from Player and call it
    // 3. Force refresh the broadcastPosition hook
    
    // For now, log that manual intervention may be needed
    console.warn('[LiveSyncWrapper] ⚠️ Manual video change may be needed - server says different video');
  }, []);

  // Use the live sync hook
  const {
    liveState,
    drift,
    syncStatus,
    recommendedRate,
    isSyncing,
    isLive,
    isManual,
    startSync,
    stopSync,
    checkDrift,
    goLive,
    goManual,
    getDebugInfo,
  } = useLiveSync(categoryId, playerRef, {
    enabled,
    onCorrectionNeeded: handleCorrectionNeeded,
    onVideoChange: handleVideoChange,
    autoStart: true,
  });

  // Notify parent of sync status changes
  useEffect(() => {
    if (onSyncStatusChange) {
      onSyncStatusChange({
        syncStatus,
        isSyncing,
        isLive,
        isManual,
        drift: drift?.driftMs,
        recommendedRate,
      });
    }
  }, [syncStatus, isSyncing, isLive, isManual, drift, recommendedRate, onSyncStatusChange]);

  // Debug overlay component
  const DebugOverlay = showDebug && (
    <div 
      style={{
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: '#00ff00',
        fontFamily: 'monospace',
        fontSize: '10px',
        padding: '8px',
        borderRadius: '4px',
        zIndex: 9999,
        maxWidth: '300px',
        pointerEvents: 'none',
      }}
    >
      <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>
        🔄 Live Sync Debug
      </div>
      <div>State: <span style={{ color: isLive ? '#00ff00' : isManual ? '#ffff00' : '#ff6600' }}>{syncStatus}</span></div>
      <div>Syncing: {isSyncing ? '✅' : '❌'}</div>
      {drift && (
        <>
          <div>Drift: <span style={{ color: Math.abs(drift.driftMs) > 500 ? '#ff0000' : '#00ff00' }}>
            {drift.driftMs?.toFixed(0)}ms
          </span></div>
          <div>Direction: {drift.direction}</div>
          <div>Correction: {drift.correctionType}</div>
        </>
      )}
      {liveState?.live && (
        <>
          <div>Server Video: {liveState.live.videoIndex}</div>
          <div>Server Pos: {liveState.live.position?.toFixed(1)}s</div>
        </>
      )}
      {lastCorrection && (
        <div style={{ marginTop: '4px', borderTop: '1px solid #333', paddingTop: '4px' }}>
          Last: {lastCorrection.type} @ {new Date(lastCorrection.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {children}
      {DebugOverlay}
    </div>
  );
}

// Export for use
export default LiveSyncWrapper;
