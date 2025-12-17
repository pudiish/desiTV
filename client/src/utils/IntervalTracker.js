/**
 * IntervalTracker - Utility to track and manage intervals/timeouts
 * Helps prevent memory leaks by ensuring all intervals are cleaned up
 * 
 * Usage:
 *   import intervalTracker from './utils/IntervalTracker'
 *   const id = intervalTracker.setInterval(fn, delay, 'Player')
 *   intervalTracker.clearInterval(id)
 */

class IntervalTracker {
  constructor() {
    this.intervals = new Map(); // id -> { fn, delay, component, createdAt }
    this.timeouts = new Map(); // id -> { fn, delay, component, createdAt }
    this.nextId = 1;
    // Use import.meta.env for Vite (browser) instead of process.env (Node.js)
    this.isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
  }

  /**
   * Tracked setInterval - automatically tracks for cleanup
   */
  setInterval(fn, delay, component = 'unknown') {
    const id = setInterval(fn, delay);
    const trackedId = `interval_${this.nextId++}`;
    
    this.intervals.set(trackedId, {
      nativeId: id,
      fn: fn.toString().substring(0, 100), // Store function preview
      delay,
      component,
      createdAt: Date.now()
    });

    if (this.isDevelopment) {
      console.log(`[IntervalTracker] Created interval in ${component} (${this.intervals.size} active)`);
    }

    return trackedId;
  }

  /**
   * Tracked setTimeout - automatically tracks for cleanup
   */
  setTimeout(fn, delay, component = 'unknown') {
    const id = setTimeout(() => {
      this.timeouts.delete(trackedId);
      fn();
    }, delay);
    
    const trackedId = `timeout_${this.nextId++}`;
    this.timeouts.set(trackedId, {
      nativeId: id,
      fn: fn.toString().substring(0, 100),
      delay,
      component,
      createdAt: Date.now()
    });

    if (this.isDevelopment) {
      console.log(`[IntervalTracker] Created timeout in ${component} (${this.timeouts.size} active)`);
    }

    return trackedId;
  }

  /**
   * Clear tracked interval
   */
  clearInterval(trackedId) {
    const tracked = this.intervals.get(trackedId);
    if (tracked) {
      clearInterval(tracked.nativeId);
      this.intervals.delete(trackedId);
      if (this.isDevelopment) {
        console.log(`[IntervalTracker] Cleared interval from ${tracked.component} (${this.intervals.size} remaining)`);
      }
      return true;
    }
    return false;
  }

  /**
   * Clear tracked timeout
   */
  clearTimeout(trackedId) {
    const tracked = this.timeouts.get(trackedId);
    if (tracked) {
      clearTimeout(tracked.nativeId);
      this.timeouts.delete(trackedId);
      if (this.isDevelopment) {
        console.log(`[IntervalTracker] Cleared timeout from ${tracked.component} (${this.timeouts.size} remaining)`);
      }
      return true;
    }
    return false;
  }

  /**
   * Clear all intervals for a component
   */
  clearAllForComponent(component) {
    let cleared = 0;
    
    for (const [id, tracked] of this.intervals.entries()) {
      if (tracked.component === component) {
        clearInterval(tracked.nativeId);
        this.intervals.delete(id);
        cleared++;
      }
    }

    for (const [id, tracked] of this.timeouts.entries()) {
      if (tracked.component === component) {
        clearTimeout(tracked.nativeId);
        this.timeouts.delete(id);
        cleared++;
      }
    }

    if (cleared > 0 && this.isDevelopment) {
      console.warn(`[IntervalTracker] Cleared ${cleared} intervals/timeouts for ${component}`);
    }

    return cleared;
  }

  /**
   * Get all active intervals
   */
  getActiveIntervals() {
    return Array.from(this.intervals.entries()).map(([id, tracked]) => ({
      id,
      component: tracked.component,
      delay: tracked.delay,
      age: Date.now() - tracked.createdAt,
      fn: tracked.fn
    }));
  }

  /**
   * Get all active timeouts
   */
  getActiveTimeouts() {
    return Array.from(this.timeouts.entries()).map(([id, tracked]) => ({
      id,
      component: tracked.component,
      delay: tracked.delay,
      age: Date.now() - tracked.createdAt,
      fn: tracked.fn
    }));
  }

  /**
   * Get summary statistics
   */
  getStats() {
    const intervals = this.getActiveIntervals();
    const timeouts = this.getActiveTimeouts();
    
    const byComponent = {};
    [...intervals, ...timeouts].forEach(item => {
      if (!byComponent[item.component]) {
        byComponent[item.component] = { intervals: 0, timeouts: 0 };
      }
      if (item.id.startsWith('interval_')) {
        byComponent[item.component].intervals++;
      } else {
        byComponent[item.component].timeouts++;
      }
    });

    return {
      totalIntervals: intervals.length,
      totalTimeouts: timeouts.length,
      total: intervals.length + timeouts.length,
      byComponent
    };
  }

  /**
   * Clear all intervals and timeouts (use with caution)
   */
  clearAll() {
    for (const tracked of this.intervals.values()) {
      clearInterval(tracked.nativeId);
    }
    for (const tracked of this.timeouts.values()) {
      clearTimeout(tracked.nativeId);
    }
    
    const total = this.intervals.size + this.timeouts.size;
    this.intervals.clear();
    this.timeouts.clear();

    if (this.isDevelopment) {
      console.warn(`[IntervalTracker] Cleared all ${total} intervals/timeouts`);
    }

    return total;
  }

  /**
   * Log current state (for debugging)
   */
  logState() {
    const stats = this.getStats();
    console.log('[IntervalTracker] Current State:', stats);
    
    if (stats.total > 0) {
      console.table([...this.getActiveIntervals(), ...this.getActiveTimeouts()]);
    }
  }
}

// Export singleton instance
const intervalTracker = new IntervalTracker();

// In development, log stats periodically
if (import.meta.env.DEV || import.meta.env.MODE === 'development') {
  // Log stats every 30 seconds in development
  setInterval(() => {
    const stats = intervalTracker.getStats();
    if (stats.total > 0) {
      console.log('[IntervalTracker] Active:', stats);
    }
  }, 30000);
}

export default intervalTracker;

