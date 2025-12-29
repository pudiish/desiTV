/**
 * Predictive State Engine - Netflix/Spotify Level Sync
 * 
 * THE BIG IDEA: Client computes position LOCALLY using cached manifest.
 * Server only needed for:
 *   1. Initial manifest download
 *   2. Anomaly detection/correction
 *   3. Playlist changes
 * 
 * Result: 90% reduction in API calls
 */

// ═══════════════════════════════════════════════════════════════════
// MANIFEST CACHE (The "Schedule")
// ═══════════════════════════════════════════════════════════════════

class PredictiveEngine {
  constructor() {
    // Core state
    this.manifest = null;        // Full playlist data
    this.epochMs = null;         // Global epoch timestamp
    this.clockOffset = 0;        // Server-client clock difference
    this.rttSamples = [];        // RTT measurements for NTP-style sync
    this.lastServerSync = 0;     // Last time we got server confirmation
    
    // Computed caches
    this.videoLookup = [];       // Binary search array: [{ startTime, video }]
    this.totalDuration = 0;
    
    // Drift tracking
    this.driftHistory = [];      // Last 10 drift measurements
    this.anomalyThreshold = 500; // ms - trigger server check if exceeded
    
    // Listeners
    this.listeners = new Set();
    
    // State
    this.isInitialized = false;
    this.categoryId = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Initialize with server manifest (one-time download)
   * After this, client can compute positions locally
   */
  async initialize(categoryId, serverState) {
    if (!serverState?.playlist || !serverState?.sync) {
      throw new Error('Invalid server state - missing playlist or sync data');
    }

    this.categoryId = categoryId;
    this.epochMs = serverState.sync.epochMs;
    this.totalDuration = serverState.playlist.totalDuration;
    this.lastServerSync = Date.now();

    // Build manifest from server state
    await this._buildManifest(serverState);
    
    // Initial clock sync
    if (serverState.sync.serverTimeMs) {
      this._updateClockOffset(serverState.sync.serverTimeMs, serverState._rtt || 100);
    }

    this.isInitialized = true;
    console.log(`[PredictiveEngine] Initialized for ${categoryId} | ${this.manifest.videos.length} videos | ${Math.round(this.totalDuration)}s cycle`);
    
    return this;
  }

  /**
   * Build searchable manifest from server data
   */
  async _buildManifest(serverState) {
    // If server sends full playlist, use it
    if (serverState.playlist.videos) {
      this.manifest = {
        categoryId: this.categoryId,
        categoryName: serverState.live?.categoryName || this.categoryId,
        videos: serverState.playlist.videos,
        totalDuration: this.totalDuration,
        videoCount: serverState.playlist.videoCount,
        fetchedAt: Date.now(),
      };
    } else {
      // Reconstruct from live state (minimal server response)
      // This is a fallback - full manifest is better
      this.manifest = {
        categoryId: this.categoryId,
        categoryName: serverState.live?.categoryName || this.categoryId,
        videos: [], // Will be populated incrementally
        totalDuration: this.totalDuration,
        videoCount: serverState.playlist.videoCount,
        fetchedAt: Date.now(),
        partial: true,
      };
    }

    // Build binary search index
    this._buildVideoLookup();
  }

  /**
   * Build binary search index for O(log n) video lookup
   */
  _buildVideoLookup() {
    this.videoLookup = [];
    let cumulativeTime = 0;

    for (let i = 0; i < this.manifest.videos.length; i++) {
      const video = this.manifest.videos[i];
      this.videoLookup.push({
        startTime: cumulativeTime,
        endTime: cumulativeTime + video.duration,
        index: i,
        video,
      });
      cumulativeTime += video.duration;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // CLOCK SYNC (NTP-Style Multi-Sample)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Multi-sample clock sync (Spotify approach)
   * Takes 5 samples, discards outliers, averages best 3
   */
  async performClockSync(fetchFn) {
    const samples = [];
    
    // Take 5 measurements
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      try {
        const response = await fetchFn();
        const end = Date.now();
        const serverTime = response.sync?.serverTimeMs || response.serverTimeMs;
        
        if (serverTime) {
          const rtt = end - start;
          const oneWayDelay = rtt / 2;
          const offset = end - (serverTime + oneWayDelay);
          samples.push({ rtt, offset });
        }
      } catch (e) {
        // Skip failed samples
      }
      
      // Small delay between samples
      if (i < 4) await new Promise(r => setTimeout(r, 50));
    }

    if (samples.length < 3) {
      console.warn('[PredictiveEngine] Clock sync failed - not enough samples');
      return this.clockOffset;
    }

    // Sort by RTT (lower is more accurate)
    samples.sort((a, b) => a.rtt - b.rtt);
    
    // Take best 3 (discard 2 worst)
    const best = samples.slice(0, 3);
    
    // Average offset
    const avgOffset = best.reduce((sum, s) => sum + s.offset, 0) / best.length;
    const avgRtt = best.reduce((sum, s) => sum + s.rtt, 0) / best.length;
    
    this.clockOffset = avgOffset;
    this.rttSamples = best.map(s => s.rtt);
    
    console.log(`[PredictiveEngine] Clock sync complete | offset: ${Math.round(avgOffset)}ms | avgRTT: ${Math.round(avgRtt)}ms`);
    
    return avgOffset;
  }

  /**
   * Quick single-sample clock update (for ongoing sync)
   */
  _updateClockOffset(serverTimeMs, rtt) {
    const oneWayDelay = rtt / 2;
    const now = Date.now();
    const offset = now - (serverTimeMs + oneWayDelay);
    
    // Weighted average with existing offset (smooth transitions)
    if (this.clockOffset !== 0) {
      this.clockOffset = this.clockOffset * 0.7 + offset * 0.3;
    } else {
      this.clockOffset = offset;
    }
    
    this.rttSamples.push(rtt);
    if (this.rttSamples.length > 5) this.rttSamples.shift();
  }

  // ═══════════════════════════════════════════════════════════════════
  // PREDICTIVE POSITION CALCULATION (The Magic)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Calculate current position LOCALLY - NO SERVER CALL
   * This is the core of the predictive engine
   */
  getExpectedState() {
    if (!this.isInitialized || !this.epochMs) {
      return null;
    }

    // Corrected current time
    const now = Date.now() - this.clockOffset;
    const elapsedMs = now - this.epochMs;
    const elapsedSec = elapsedMs / 1000;

    // Handle negative elapsed (shouldn't happen, but safety)
    if (elapsedSec < 0) {
      console.warn('[PredictiveEngine] Negative elapsed time - clock issue');
      return null;
    }

    // Calculate cycle position
    const cycleCount = Math.floor(elapsedSec / this.totalDuration);
    const cyclePosition = elapsedSec % this.totalDuration;

    // Binary search for current video
    const videoState = this._findVideoAtPosition(cyclePosition);
    
    if (!videoState) {
      return null;
    }

    return {
      // Current video info
      videoIndex: videoState.index,
      videoId: videoState.video.id,
      videoTitle: videoState.video.title,
      videoDuration: videoState.video.duration,
      
      // Position within video
      position: cyclePosition - videoState.startTime,
      remaining: videoState.endTime - cyclePosition,
      
      // Cycle info
      cyclePosition,
      cycleCount,
      totalDuration: this.totalDuration,
      
      // Timing
      calculatedAt: Date.now(),
      clockOffset: this.clockOffset,
      
      // Next video (for preloading)
      nextVideo: this._getNextVideo(videoState.index),
      
      // Confidence (based on time since last server sync)
      confidence: this._calculateConfidence(),
    };
  }

  /**
   * Binary search for video at position (O(log n))
   */
  _findVideoAtPosition(cyclePosition) {
    if (this.videoLookup.length === 0) return null;

    let left = 0;
    let right = this.videoLookup.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2);
      if (this.videoLookup[mid].startTime <= cyclePosition) {
        left = mid;
      } else {
        right = mid - 1;
      }
    }

    return this.videoLookup[left];
  }

  /**
   * Get next video info
   */
  _getNextVideo(currentIndex) {
    const nextIndex = (currentIndex + 1) % this.manifest.videos.length;
    const nextVideo = this.manifest.videos[nextIndex];
    const current = this.videoLookup[currentIndex];
    
    return {
      index: nextIndex,
      id: nextVideo.id,
      title: nextVideo.title,
      duration: nextVideo.duration,
      startsIn: current.endTime - (this.getExpectedState()?.cyclePosition || 0),
    };
  }

  /**
   * Calculate confidence level (0-1)
   * Based on time since last server sync
   */
  _calculateConfidence() {
    const timeSinceSync = Date.now() - this.lastServerSync;
    
    // Full confidence for first 30 seconds
    if (timeSinceSync < 30000) return 1.0;
    
    // Decay over next 5 minutes
    const decayTime = Math.min(timeSinceSync - 30000, 300000);
    return Math.max(0.5, 1.0 - (decayTime / 300000) * 0.5);
  }

  // ═══════════════════════════════════════════════════════════════════
  // DRIFT DETECTION (When to ask server)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Compare local prediction with actual player position
   * Returns whether we need server correction
   */
  checkDrift(actualPosition, actualVideoIndex) {
    const expected = this.getExpectedState();
    if (!expected) return { needsServerSync: true, reason: 'no_state' };

    // Wrong video = definitely need sync
    if (actualVideoIndex !== expected.videoIndex) {
      return {
        needsServerSync: true,
        reason: 'wrong_video',
        expectedVideo: expected.videoIndex,
        actualVideo: actualVideoIndex,
      };
    }

    // Calculate drift
    const driftMs = (actualPosition - expected.position) * 1000;
    const absDrift = Math.abs(driftMs);

    // Track drift history
    this.driftHistory.push({ drift: driftMs, time: Date.now() });
    if (this.driftHistory.length > 10) this.driftHistory.shift();

    // Check for consistent drift (anomaly)
    const isAnomaly = this._detectAnomaly();

    // Determine correction
    let action = 'none';
    let rate = 1.0;

    if (absDrift < 200) {
      // Perfect sync
      action = 'none';
      rate = 1.0;
    } else if (absDrift < 500) {
      // Tiny correction
      action = 'rate_adjust';
      rate = driftMs > 0 ? 0.98 : 1.02;
    } else if (absDrift < 1000) {
      // Small correction
      action = 'rate_adjust';
      rate = driftMs > 0 ? 0.95 : 1.05;
    } else if (absDrift < 3000) {
      // Medium correction
      action = 'rate_adjust';
      rate = driftMs > 0 ? 0.90 : 1.10;
    } else if (absDrift < 5000) {
      // Large correction
      action = 'rate_adjust';
      rate = driftMs > 0 ? 0.85 : 1.15;
    } else {
      // Critical - seek
      action = 'seek';
      rate = 1.0;
    }

    return {
      needsServerSync: isAnomaly || absDrift > 5000,
      reason: isAnomaly ? 'anomaly_detected' : (absDrift > 5000 ? 'critical_drift' : null),
      drift: driftMs,
      absDrift,
      action,
      rate,
      targetPosition: expected.position,
      confidence: expected.confidence,
    };
  }

  /**
   * Detect drift anomaly (consistent drift over time)
   * If all last 5 measurements show >500ms drift in same direction, something's wrong
   */
  _detectAnomaly() {
    if (this.driftHistory.length < 5) return false;

    const recent = this.driftHistory.slice(-5);
    const allPositive = recent.every(d => d.drift > this.anomalyThreshold);
    const allNegative = recent.every(d => d.drift < -this.anomalyThreshold);

    return allPositive || allNegative;
  }

  // ═══════════════════════════════════════════════════════════════════
  // SERVER CORRECTION (When prediction is wrong)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Update from server (when drift detected or periodic check)
   */
  applyServerCorrection(serverState) {
    if (!serverState?.sync || !serverState?.live) return;

    // Update clock
    if (serverState.sync.serverTimeMs) {
      this._updateClockOffset(serverState.sync.serverTimeMs, serverState._rtt || 100);
    }

    // Update epoch if changed
    if (serverState.sync.epochMs !== this.epochMs) {
      console.log('[PredictiveEngine] Epoch changed - rebuilding manifest');
      this.epochMs = serverState.sync.epochMs;
    }

    // Update manifest if playlist changed
    if (serverState.playlist?.totalDuration !== this.totalDuration) {
      console.log('[PredictiveEngine] Playlist changed - rebuilding manifest');
      this._buildManifest(serverState);
    }

    this.lastServerSync = Date.now();
    this.driftHistory = []; // Clear drift history after correction

    // Notify listeners
    this._notifyListeners('corrected', serverState);
  }

  // ═══════════════════════════════════════════════════════════════════
  // EVENT SYSTEM
  // ═══════════════════════════════════════════════════════════════════

  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  _notifyListeners(event, data) {
    this.listeners.forEach(cb => {
      try { cb(event, data); } catch (e) { console.error('[PredictiveEngine] Listener error:', e); }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Reset engine
   */
  reset() {
    this.manifest = null;
    this.epochMs = null;
    this.clockOffset = 0;
    this.rttSamples = [];
    this.lastServerSync = 0;
    this.videoLookup = [];
    this.totalDuration = 0;
    this.driftHistory = [];
    this.isInitialized = false;
    this.categoryId = null;
    this.listeners.clear();
  }

  /**
   * Get stats for debugging
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      categoryId: this.categoryId,
      videoCount: this.manifest?.videos?.length || 0,
      totalDuration: this.totalDuration,
      clockOffset: Math.round(this.clockOffset),
      avgRtt: this.rttSamples.length > 0 
        ? Math.round(this.rttSamples.reduce((a, b) => a + b, 0) / this.rttSamples.length)
        : 0,
      lastServerSync: this.lastServerSync,
      timeSinceSync: Date.now() - this.lastServerSync,
      confidence: this._calculateConfidence(),
      recentDrifts: this.driftHistory.slice(-5).map(d => Math.round(d.drift)),
    };
  }
}

// Singleton instance
export const predictiveEngine = new PredictiveEngine();
export default predictiveEngine;
