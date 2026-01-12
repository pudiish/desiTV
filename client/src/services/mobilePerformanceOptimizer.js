// Mobile performance optimizer - reduces CPU/battery drain on mobile devices

class MobilePerformanceOptimizer {
  constructor() {
    this.isMobile = this._detectMobile();
    this.isLowPowerMode = false;
    this.reducedMotion = this._detectReducedMotion();
    this.isBackgrounded = false;
    this.performanceMode = 'normal';
    this.listeners = new Set();
    
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

    if (this.reducedMotion) {
      this.performanceMode = 'powersaver';
    } else if (this.isMobile) {
      this.performanceMode = 'balanced';
    }

    document.addEventListener('visibilitychange', () => {
      this.isBackgrounded = document.hidden;
      this._notifyListeners();
    });

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    motionQuery?.addEventListener?.('change', (e) => {
      this.reducedMotion = e.matches;
      if (e.matches) this.setPerformanceMode('powersaver');
    });

    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => this._monitorBattery(battery)).catch(() => {});
    }

    this._monitorPerformance();
  }

  _monitorBattery(battery) {
    const checkBattery = () => {
      if (battery.level < 0.2 && !battery.charging && this.performanceMode !== 'powersaver') {
        this.setPerformanceMode('powersaver');
      }
    };
    battery.addEventListener('levelchange', checkBattery);
    battery.addEventListener('chargingchange', checkBattery);
    checkBattery();
  }

  _monitorPerformance() {
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      let longTaskCount = 0;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.duration > 100) {
            longTaskCount++;
            if (longTaskCount > 5 && this.performanceMode === 'normal') {
              this.setPerformanceMode('balanced');
            } else if (longTaskCount > 15 && this.performanceMode === 'balanced') {
              this.setPerformanceMode('powersaver');
            }
          }
        }
      });
      observer.observe({ entryTypes: ['longtask'] });
      setInterval(() => { longTaskCount = Math.max(0, longTaskCount - 2); }, 10000);
    } catch (e) {}
  }

  setPerformanceMode(mode) {
    if (!this.config[mode]) return;
    const oldMode = this.performanceMode;
    this.performanceMode = mode;
    if (oldMode !== mode) this._notifyListeners();
  }

  getSettings() {
    const baseSettings = this.config[this.performanceMode];
    if (this.isBackgrounded) {
      return {
        ...baseSettings,
        animationFPS: 0,
        enableGalaxy: false,
        enableColorExtraction: false,
        pollIntervalMultiplier: baseSettings.pollIntervalMultiplier * 2,
      };
    }
    return baseSettings;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.getSettings());
    return () => this.listeners.delete(callback);
  }

  _notifyListeners() {
    const settings = this.getSettings();
    this.listeners.forEach(cb => { try { cb(settings); } catch (e) {} });
  }

  createThrottledLoop(callback) {
    let lastTime = 0;
    let animationId = null;
    let isRunning = false;

    const loop = (timestamp) => {
      if (!isRunning) return;
      const settings = this.getSettings();
      const targetFPS = settings.animationFPS;
      if (targetFPS === 0) { animationId = requestAnimationFrame(loop); return; }
      const frameInterval = 1000 / targetFPS;
      const elapsed = timestamp - lastTime;
      if (elapsed >= frameInterval) {
        lastTime = timestamp - (elapsed % frameInterval);
        callback(timestamp, elapsed);
      }
      animationId = requestAnimationFrame(loop);
    };

    return {
      start: () => { if (isRunning) return; isRunning = true; animationId = requestAnimationFrame(loop); },
      stop: () => { isRunning = false; if (animationId) { cancelAnimationFrame(animationId); animationId = null; } },
      isRunning: () => isRunning,
    };
  }

  shouldEnableGalaxy() { return this.getSettings().enableGalaxy; }
  shouldEnableColorExtraction() { return this.getSettings().enableColorExtraction; }
  getParticleCount(baseCount = 200) { return Math.min(baseCount, this.getSettings().particleCount); }
  getPollMultiplier() { return this.getSettings().pollIntervalMultiplier; }
}

const mobilePerformanceOptimizer = new MobilePerformanceOptimizer();
export default mobilePerformanceOptimizer;
export { MobilePerformanceOptimizer };
