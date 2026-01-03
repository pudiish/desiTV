/**
 * 📱 Mobile Performance Optimizer
 * 
 * Reduces CPU/battery drain on mobile devices by:
 * - Detecting mobile/low-power mode
 * - Reducing animation frame rates
 * - Throttling background tasks
 * - Disabling heavy visual effects
 * 
 * iPhone heating is typically caused by:
 * - Continuous requestAnimationFrame loops
 * - Frequent setInterval/setTimeout calls
 * - Canvas rendering at 60fps
 * - WebSocket/polling activity
 */

class MobilePerformanceOptimizer {
  constructor() {
    this.isMobile = this._detectMobile();
    this.isLowPowerMode = false;
    this.reducedMotion = this._detectReducedMotion();
    this.isBackgrounded = false;
    this.performanceMode = 'normal'; // 'normal', 'balanced', 'powersaver'
    this.listeners = new Set();
    
    // Thresholds
    this.config = {
      normal: {
        animationFPS: 60,
        particleCount: 200,
        enableGalaxy: true,
        enableColorExtraction: true,
        pollIntervalMultiplier: 1,
        enableAnalytics: true,
      },
      balanced: {
        animationFPS: 30,
        particleCount: 100,
        enableGalaxy: true,
        enableColorExtraction: false,
        pollIntervalMultiplier: 2,
        enableAnalytics: true,
      },
      powersaver: {
        animationFPS: 15,
        particleCount: 50,
        enableGalaxy: false,
        enableColorExtraction: false,
        pollIntervalMultiplier: 4,
        enableAnalytics: false,
      },
    };
    
    this._init();
  }

  _detectMobile() {
    if (typeof navigator === 'undefined') return false;
    
    const ua = navigator.userAgent.toLowerCase();
    const isMobileUA = /iphone|ipad|ipod|android|blackberry|windows phone|opera mini|silk/i.test(ua);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 768;
    
    return isMobileUA || (isTouchDevice && isSmallScreen);
  }

  _detectReducedMotion() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  }

  _init() {
    if (typeof window === 'undefined') return;

    // Auto-select performance mode based on device
    if (this.reducedMotion) {
      this.performanceMode = 'powersaver';
    } else if (this.isMobile) {
      this.performanceMode = 'balanced';
    }

    // Listen for visibility changes (app backgrounded)
    document.addEventListener('visibilitychange', () => {
      this.isBackgrounded = document.hidden;
      this._notifyListeners();
      
      if (this.isBackgrounded) {
        console.log('[MobilePerf] App backgrounded - reducing activity');
      } else {
        console.log('[MobilePerf] App foregrounded - resuming');
      }
    });

    // Listen for reduced motion preference changes
    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    motionQuery?.addEventListener?.('change', (e) => {
      this.reducedMotion = e.matches;
      if (e.matches) {
        this.setPerformanceMode('powersaver');
      }
    });

    // Monitor battery if available (not on iOS Safari, but works on Chrome)
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        this._monitorBattery(battery);
      }).catch(() => {});
    }

    // Thermal throttling detection via performance observer
    this._monitorPerformance();

    console.log(`[MobilePerf] Initialized - Device: ${this.isMobile ? 'Mobile' : 'Desktop'}, Mode: ${this.performanceMode}`);
  }

  _monitorBattery(battery) {
    const checkBattery = () => {
      // Enable power saver when battery is low or charging slowly
      if (battery.level < 0.2 && !battery.charging) {
        if (this.performanceMode !== 'powersaver') {
          console.log('[MobilePerf] Low battery detected - enabling power saver');
          this.setPerformanceMode('powersaver');
        }
      }
    };

    battery.addEventListener('levelchange', checkBattery);
    battery.addEventListener('chargingchange', checkBattery);
    checkBattery();
  }

  _monitorPerformance() {
    if (typeof PerformanceObserver === 'undefined') return;

    // Monitor long tasks (indicates CPU stress)
    try {
      let longTaskCount = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 100) { // Task took > 100ms
            longTaskCount++;
            
            // If we're getting lots of long tasks, throttle
            if (longTaskCount > 5 && this.performanceMode === 'normal') {
              console.log('[MobilePerf] CPU stress detected - switching to balanced mode');
              this.setPerformanceMode('balanced');
            } else if (longTaskCount > 15 && this.performanceMode === 'balanced') {
              console.log('[MobilePerf] Heavy CPU stress - switching to power saver');
              this.setPerformanceMode('powersaver');
            }
          }
        }
      });

      observer.observe({ entryTypes: ['longtask'] });
      
      // Reset count periodically
      setInterval(() => {
        longTaskCount = Math.max(0, longTaskCount - 2);
      }, 10000);
    } catch (e) {
      // longtask not supported
    }
  }

  /**
   * Set performance mode manually
   */
  setPerformanceMode(mode) {
    if (!this.config[mode]) return;
    
    const oldMode = this.performanceMode;
    this.performanceMode = mode;
    
    if (oldMode !== mode) {
      console.log(`[MobilePerf] Mode changed: ${oldMode} → ${mode}`);
      this._notifyListeners();
    }
  }

  /**
   * Get current performance settings
   */
  getSettings() {
    const baseSettings = this.config[this.performanceMode];
    
    // Further reduce when backgrounded
    if (this.isBackgrounded) {
      return {
        ...baseSettings,
        animationFPS: 0, // Stop animations entirely
        enableGalaxy: false,
        enableColorExtraction: false,
        pollIntervalMultiplier: baseSettings.pollIntervalMultiplier * 2,
      };
    }
    
    return baseSettings;
  }

  /**
   * Subscribe to performance mode changes
   */
  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getSettings());
    return () => this.listeners.delete(callback);
  }

  _notifyListeners() {
    const settings = this.getSettings();
    this.listeners.forEach(cb => {
      try {
        cb(settings);
      } catch (e) {
        console.warn('[MobilePerf] Listener error:', e);
      }
    });
  }

  /**
   * Create a throttled animation loop
   * Automatically adjusts FPS based on performance mode
   */
  createThrottledLoop(callback) {
    let lastTime = 0;
    let animationId = null;
    let isRunning = false;

    const loop = (timestamp) => {
      if (!isRunning) return;
      
      const settings = this.getSettings();
      const targetFPS = settings.animationFPS;
      
      // Skip frame if we're in power saver and backgrounded
      if (targetFPS === 0) {
        animationId = requestAnimationFrame(loop);
        return;
      }
      
      const frameInterval = 1000 / targetFPS;
      const elapsed = timestamp - lastTime;
      
      if (elapsed >= frameInterval) {
        lastTime = timestamp - (elapsed % frameInterval);
        callback(timestamp, elapsed);
      }
      
      animationId = requestAnimationFrame(loop);
    };

    return {
      start: () => {
        if (isRunning) return;
        isRunning = true;
        animationId = requestAnimationFrame(loop);
      },
      stop: () => {
        isRunning = false;
        if (animationId) {
          cancelAnimationFrame(animationId);
          animationId = null;
        }
      },
      isRunning: () => isRunning,
    };
  }

  /**
   * Should heavy effect be enabled?
   */
  shouldEnableGalaxy() {
    return this.getSettings().enableGalaxy;
  }

  shouldEnableColorExtraction() {
    return this.getSettings().enableColorExtraction;
  }

  /**
   * Get recommended particle count
   */
  getParticleCount(baseCount = 200) {
    const settings = this.getSettings();
    return Math.min(baseCount, settings.particleCount);
  }

  /**
   * Get multiplier for poll intervals
   */
  getPollMultiplier() {
    return this.getSettings().pollIntervalMultiplier;
  }
}

// Singleton instance
const mobilePerformanceOptimizer = new MobilePerformanceOptimizer();

export default mobilePerformanceOptimizer;
export { MobilePerformanceOptimizer };
