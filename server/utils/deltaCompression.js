/**
 * Delta Compression Protocol - Netflix-Style Bandwidth Optimization
 * 
 * THE IDEA: Only send what changed
 * 
 * Full state: ~500 bytes per sync
 * Delta state: ~20-50 bytes per sync
 * 
 * Bandwidth reduction: 90%+
 */

// ═══════════════════════════════════════════════════════════════════
// SERVER SIDE - Delta Encoder
// ═══════════════════════════════════════════════════════════════════

/**
 * Encode state as delta (for server)
 * Compares with previous state and sends only changes
 */
function encodeStateDelta(currentState, previousState) {
  // No previous state = send full
  if (!previousState) {
    return {
      type: 'full',
      data: currentState,
    };
  }

  const delta = {
    type: 'delta',
    t: currentState.sync?.serverTimeMs || Date.now(), // Timestamp
  };

  // Video changed = critical delta
  if (currentState.live?.videoIndex !== previousState.live?.videoIndex) {
    return {
      type: 'video_change',
      t: delta.t,
      v: currentState.live.videoIndex,      // Video index
      id: currentState.live.videoId,        // YouTube ID
      p: Math.round(currentState.live.position * 10) / 10, // Position (1 decimal)
      d: currentState.live.duration,        // Duration
      n: currentState.next?.videoId,        // Next video (preload)
    };
  }

  // Same video = position delta only
  delta.p = Math.round(currentState.live.position * 10) / 10; // Position
  delta.r = Math.round(currentState.live.remaining);          // Remaining (rounded)

  // Only include if significantly changed
  const posDiff = Math.abs(
    (currentState.live?.position || 0) - (previousState.live?.position || 0)
  );

  // If position changed by more than expected (5s interval + 1s tolerance)
  if (posDiff > 6) {
    delta.drift = true; // Signal potential drift
  }

  return delta;
}

/**
 * Decode delta on client
 */
function decodeStateDelta(delta, currentState) {
  // Full state - just use it
  if (delta.type === 'full') {
    return delta.data;
  }

  // Video change - merge with full video info
  if (delta.type === 'video_change') {
    return {
      live: {
        ...currentState?.live,
        videoIndex: delta.v,
        videoId: delta.id,
        position: delta.p,
        duration: delta.d,
      },
      next: delta.n ? { videoId: delta.n } : currentState?.next,
      sync: {
        ...currentState?.sync,
        serverTimeMs: delta.t,
      },
      _isDelta: true,
      _isVideoChange: true,
    };
  }

  // Position delta - update position only
  return {
    ...currentState,
    live: {
      ...currentState?.live,
      position: delta.p,
      remaining: delta.r,
    },
    sync: {
      ...currentState?.sync,
      serverTimeMs: delta.t,
    },
    _isDelta: true,
    _hasDrift: delta.drift,
  };
}

// ═══════════════════════════════════════════════════════════════════
// ULTRA-COMPACT BINARY PROTOCOL (Future Enhancement)
// ═══════════════════════════════════════════════════════════════════

/**
 * Binary encoding for absolute minimum bandwidth
 * 
 * Format (8 bytes total):
 * - Byte 0: Type (1=delta, 2=video_change, 3=full)
 * - Byte 1: Video index
 * - Bytes 2-5: Position (float32)
 * - Bytes 6-7: Remaining (uint16)
 */
function encodeBinary(state) {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  
  view.setUint8(0, 1); // Type: delta
  view.setUint8(1, state.live?.videoIndex || 0);
  view.setFloat32(2, state.live?.position || 0, true); // Little-endian
  view.setUint16(6, Math.min(state.live?.remaining || 0, 65535), true);
  
  return buffer;
}

function decodeBinary(buffer) {
  const view = new DataView(buffer);
  
  return {
    type: view.getUint8(0),
    videoIndex: view.getUint8(1),
    position: view.getFloat32(2, true),
    remaining: view.getUint16(6, true),
  };
}

// ═══════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  encodeStateDelta,
  decodeStateDelta,
  encodeBinary,
  decodeBinary,
};
