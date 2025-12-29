/**
 * PlayerStateMachine.js
 * 
 * THE BRAIN OF THE PLAYER 🧠
 * 
 * Before this existed, the Player component was managing state like a 
 * toddler manages a chocolate cake - enthusiastically but messily.
 * 
 * This state machine brings ORDER to the chaos:
 * - Clear states: OFF, LIVE, MANUAL, SYNCING, CORRECTING
 * - Clear transitions: Power ON, Channel Change, Category Change, etc.
 * - Clear rules: When in LIVE, poll server. When in MANUAL, leave me alone.
 * 
 * States:
 * ┌─────────────────────────────────────────────────────────────┐
 * │  OFF ──Power ON──► LIVE ◄──Category Change── MANUAL        │
 * │                     │                          ▲            │
 * │                     │ Channel Change           │            │
 * │                     ▼                          │            │
 * │                   MANUAL ─────────────────────►│            │
 * │                     │                                       │
 * │         Drift > 2s  │  0.5s < Drift < 2s                   │
 * │              ▼      ▼                                       │
 * │          SYNCING  CORRECTING                                │
 * │              │      │                                       │
 * │              ▼      ▼                                       │
 * │            ──► LIVE ◄──                                     │
 * └─────────────────────────────────────────────────────────────┘
 */

import { SYNC_THRESHOLDS, getDriftCorrectionType, getCorrectionRate, DEBUG_SYNC } from '../../config/thresholds';

const log = (...args) => DEBUG_SYNC && console.log(...args);

// State enum
export const PlayerState = {
  OFF: 'off',
  LIVE: 'live',
  MANUAL: 'manual',
  SYNCING: 'syncing',
  CORRECTING: 'correcting',
};

// Events that trigger state transitions
export const PlayerEvent = {
  POWER_ON: 'power_on',
  POWER_OFF: 'power_off',
  CHANNEL_UP: 'channel_up',
  CHANNEL_DOWN: 'channel_down',
  CHANNEL_DIRECT: 'channel_direct',
  CATEGORY_CHANGE: 'category_change',
  SYNC_COMPLETE: 'sync_complete',
  DRIFT_DETECTED: 'drift_detected',
  CORRECTION_COMPLETE: 'correction_complete',
  SYNC_FAILED: 'sync_failed',
};

/**
 * Player State Machine
 * 
 * Usage:
 * const machine = new PlayerStateMachine();
 * machine.transition(PlayerEvent.POWER_ON);
 * console.log(machine.state); // 'live'
 */
class PlayerStateMachine {
  constructor() {
    this._state = PlayerState.OFF;
    this._categoryId = null;
    this._lastSyncTime = null;
    this._lastServerPosition = null;
    this._latencySamples = [];
    this._listeners = [];
    this._pollIntervalId = null;
    this._correctionTimeoutId = null;
    this._driftHistory = []; // Track drift over time for debugging
  }

  // ===================
  // STATE GETTERS
  // ===================

  get state() {
    return this._state;
  }

  get isLive() {
    return this._state === PlayerState.LIVE;
  }

  get isManual() {
    return this._state === PlayerState.MANUAL;
  }

  get isOff() {
    return this._state === PlayerState.OFF;
  }

  get isSyncing() {
    return this._state === PlayerState.SYNCING;
  }

  get isCorrecting() {
    return this._state === PlayerState.CORRECTING;
  }

  get shouldPoll() {
    return this._state === PlayerState.LIVE || this._state === PlayerState.CORRECTING;
  }

  get categoryId() {
    return this._categoryId;
  }

  // ===================
  // STATE TRANSITIONS
  // ===================

  /**
   * Process an event and transition to the appropriate state
   * Returns { previousState, newState, changed }
   */
  transition(event, payload = {}) {
    const previousState = this._state;
    let newState = previousState;

    // THE STATE MACHINE LOGIC
    // This is where the magic happens, baby! ✨

    switch (previousState) {
      case PlayerState.OFF:
        if (event === PlayerEvent.POWER_ON) {
          newState = PlayerState.LIVE;
          this._categoryId = payload.categoryId;
          log('[StateMachine] 🔌 Power ON → LIVE mode');
        }
        break;

      case PlayerState.LIVE:
        if (event === PlayerEvent.POWER_OFF) {
          newState = PlayerState.OFF;
          this._stopPolling();
          log('[StateMachine] 🔌 Power OFF');
        } else if (event === PlayerEvent.CHANNEL_UP || 
                   event === PlayerEvent.CHANNEL_DOWN || 
                   event === PlayerEvent.CHANNEL_DIRECT) {
          newState = PlayerState.MANUAL;
          this._stopPolling();
          log('[StateMachine] 📺 Channel change → MANUAL mode');
        } else if (event === PlayerEvent.DRIFT_DETECTED) {
          const correctionType = getDriftCorrectionType(payload.driftMs);
          if (correctionType === 'seek' || correctionType === 'critical') {
            newState = PlayerState.SYNCING;
            console.log(`[StateMachine] ⚠️ Large drift (${payload.driftMs}ms) → SYNCING`);
          } else if (correctionType === 'rate') {
            newState = PlayerState.CORRECTING;
            console.log(`[StateMachine] 🎚️ Small drift (${payload.driftMs}ms) → CORRECTING`);
          }
        }
        break;

      case PlayerState.MANUAL:
        if (event === PlayerEvent.POWER_OFF) {
          newState = PlayerState.OFF;
          log('[StateMachine] 🔌 Power OFF');
        } else if (event === PlayerEvent.CATEGORY_CHANGE) {
          newState = PlayerState.LIVE;
          this._categoryId = payload.categoryId;
          log('[StateMachine] 📁 Category change → LIVE mode (rejoining broadcast!)');
        } else if (event === PlayerEvent.CHANNEL_UP || 
                   event === PlayerEvent.CHANNEL_DOWN || 
                   event === PlayerEvent.CHANNEL_DIRECT) {
          // Stay in manual - channel changes keep you in manual
          log('[StateMachine] 📺 Channel change (staying in MANUAL)');
        }
        break;

      case PlayerState.SYNCING:
        if (event === PlayerEvent.POWER_OFF) {
          newState = PlayerState.OFF;
          this._stopPolling();
        } else if (event === PlayerEvent.SYNC_COMPLETE) {
          newState = PlayerState.LIVE;
          log('[StateMachine] ✅ Sync complete → LIVE');
        } else if (event === PlayerEvent.SYNC_FAILED) {
          // Stay in syncing, will retry
          log('[StateMachine] ❌ Sync failed, will retry');
        } else if (event === PlayerEvent.CATEGORY_CHANGE) {
          // Category change during sync - restart sync for new category
          this._categoryId = payload.categoryId;
          log('[StateMachine] 📁 Category change during sync → restart sync');
        }
        break;

      case PlayerState.CORRECTING:
        if (event === PlayerEvent.POWER_OFF) {
          newState = PlayerState.OFF;
          this._stopPolling();
          this._stopCorrectionTimeout();
        } else if (event === PlayerEvent.CORRECTION_COMPLETE) {
          newState = PlayerState.LIVE;
          log('[StateMachine] ✅ Correction complete → LIVE');
        } else if (event === PlayerEvent.CHANNEL_UP || 
                   event === PlayerEvent.CHANNEL_DOWN || 
                   event === PlayerEvent.CHANNEL_DIRECT) {
          newState = PlayerState.MANUAL;
          this._stopCorrectionTimeout();
          log('[StateMachine] 📺 Channel change during correction → MANUAL');
        } else if (event === PlayerEvent.CATEGORY_CHANGE) {
          newState = PlayerState.LIVE;
          this._categoryId = payload.categoryId;
          this._stopCorrectionTimeout();
          log('[StateMachine] 📁 Category change during correction → LIVE');
        } else if (event === PlayerEvent.DRIFT_DETECTED) {
          // Drift got worse during correction
          const correctionType = getDriftCorrectionType(payload.driftMs);
          if (correctionType === 'seek' || correctionType === 'critical') {
            newState = PlayerState.SYNCING;
            this._stopCorrectionTimeout();
            log('[StateMachine] ⚠️ Drift worsened → SYNCING');
          }
        }
        break;
    }

    // Notify listeners if state changed
    const changed = previousState !== newState;
    if (changed) {
      this._state = newState;
      this._notifyListeners({ previousState, newState, event, payload });
    }

    return { previousState, newState, changed };
  }

  // ===================
  // DRIFT TRACKING
  // ===================

  /**
   * Record a drift measurement for analysis
   */
  recordDrift(driftMs, serverTime) {
    this._driftHistory.push({
      driftMs,
      serverTime,
      localTime: Date.now(),
      state: this._state,
    });

    // Keep only last 20 samples
    if (this._driftHistory.length > 20) {
      this._driftHistory.shift();
    }
  }

  /**
   * Get average drift from recent samples
   */
  getAverageDrift() {
    if (this._driftHistory.length === 0) return 0;
    const sum = this._driftHistory.reduce((acc, d) => acc + d.driftMs, 0);
    return sum / this._driftHistory.length;
  }

  /**
   * Check if drift is trending in a direction
   */
  getDriftTrend() {
    if (this._driftHistory.length < 3) return 'stable';
    
    const recent = this._driftHistory.slice(-3);
    const drifts = recent.map(d => d.driftMs);
    
    const allIncreasing = drifts[0] < drifts[1] && drifts[1] < drifts[2];
    const allDecreasing = drifts[0] > drifts[1] && drifts[1] > drifts[2];
    
    if (allIncreasing) return 'increasing';
    if (allDecreasing) return 'decreasing';
    return 'stable';
  }

  // ===================
  // LATENCY TRACKING
  // ===================

  /**
   * Record a network round-trip time sample
   */
  recordLatency(rttMs) {
    this._latencySamples.push(rttMs);
    
    // Keep only last N samples
    if (this._latencySamples.length > SYNC_THRESHOLDS.LATENCY_SAMPLE_COUNT) {
      this._latencySamples.shift();
    }
  }

  /**
   * Get estimated one-way latency (RTT / 2)
   */
  getEstimatedLatency() {
    if (this._latencySamples.length === 0) {
      return SYNC_THRESHOLDS.DEFAULT_LATENCY_MS;
    }
    
    const avgRtt = this._latencySamples.reduce((a, b) => a + b, 0) / this._latencySamples.length;
    return avgRtt / 2;
  }

  // ===================
  // SYNC POSITION
  // ===================

  /**
   * Update last known server position
   */
  updateServerPosition(position, serverTime) {
    this._lastServerPosition = position;
    this._lastSyncTime = serverTime;
  }

  /**
   * Calculate what the server position should be NOW
   * (extrapolate from last known position)
   */
  getExpectedServerPosition() {
    if (!this._lastServerPosition || !this._lastSyncTime) {
      return null;
    }

    const elapsedSinceSync = (Date.now() - new Date(this._lastSyncTime).getTime()) / 1000;
    const estimatedLatency = this.getEstimatedLatency() / 1000;
    
    // Server position + elapsed time + latency compensation
    return this._lastServerPosition + elapsedSinceSync + estimatedLatency;
  }

  // ===================
  // EVENT LISTENERS
  // ===================

  /**
   * Subscribe to state changes
   * Callback receives { previousState, newState, event, payload }
   */
  subscribe(callback) {
    this._listeners.push(callback);
    return () => {
      this._listeners = this._listeners.filter(cb => cb !== callback);
    };
  }

  _notifyListeners(data) {
    this._listeners.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error('[StateMachine] Listener error:', err);
      }
    });
  }

  // ===================
  // INTERNAL HELPERS
  // ===================

  _stopPolling() {
    if (this._pollIntervalId) {
      clearInterval(this._pollIntervalId);
      this._pollIntervalId = null;
    }
  }

  _stopCorrectionTimeout() {
    if (this._correctionTimeoutId) {
      clearTimeout(this._correctionTimeoutId);
      this._correctionTimeoutId = null;
    }
  }

  /**
   * Reset state machine to initial state
   */
  reset() {
    this._stopPolling();
    this._stopCorrectionTimeout();
    this._state = PlayerState.OFF;
    this._categoryId = null;
    this._lastSyncTime = null;
    this._lastServerPosition = null;
    this._latencySamples = [];
    this._driftHistory = [];
    log('[StateMachine] 🔄 Reset to initial state');
  }

  /**
   * Get debug info for logging
   */
  getDebugInfo() {
    return {
      state: this._state,
      categoryId: this._categoryId,
      lastSyncTime: this._lastSyncTime,
      lastServerPosition: this._lastServerPosition,
      avgLatency: this.getEstimatedLatency(),
      avgDrift: this.getAverageDrift(),
      driftTrend: this.getDriftTrend(),
      driftSamples: this._driftHistory.length,
    };
  }
}

// Export singleton instance for app-wide use
export const playerStateMachine = new PlayerStateMachine();

// Also export class for testing
export default PlayerStateMachine;
