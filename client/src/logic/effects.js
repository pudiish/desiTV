/**
 * Effects - CRT and visual effects pipeline
 * Handles static overlay, fade transitions, scanlines
 */

/**
 * Channel switching animation pipeline
 * 1. Static overlay (150-250ms)
 * 2. Black screen (50-100ms)
 * 3. Load new video
 * 4. CRT fade-in effect
 */
export class ChannelSwitchPipeline {
  constructor() {
    this.isTransitioning = false;
    this.callbacks = {
      onStaticStart: null,
      onStaticEnd: null,
      onBlackScreen: null,
      onVideoLoad: null,
      onFadeIn: null,
      onComplete: null,
    };
  }

  /**
   * Execute channel switch animation
   */
  async execute(onVideoLoad) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;

    try {
      // Step 1: Static overlay (150-250ms)
      if (this.callbacks.onStaticStart) {
        this.callbacks.onStaticStart();
      }
      await this.delay(200); // Average 200ms

      // Step 2: Black screen (50-100ms)
      if (this.callbacks.onStaticEnd) {
        this.callbacks.onStaticEnd();
      }
      if (this.callbacks.onBlackScreen) {
        this.callbacks.onBlackScreen();
      }
      await this.delay(75); // Average 75ms

      // Step 3: Load video
      if (onVideoLoad) {
        await onVideoLoad();
      }
      if (this.callbacks.onVideoLoad) {
        this.callbacks.onVideoLoad();
      }

      // Step 4: CRT fade-in (300-500ms)
      if (this.callbacks.onFadeIn) {
        this.callbacks.onFadeIn();
      }
      await this.delay(400);

      // Complete
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete();
      }
    } finally {
      this.isTransitioning = false;
    }
  }

  /**
   * Set callback for pipeline step
   */
  on(step, callback) {
    if (this.callbacks[step]) {
      this.callbacks[step] = callback;
    }
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if transitioning
   */
  getTransitioning() {
    return this.isTransitioning;
  }
}

/**
 * CRT Effects Manager
 */
export class CRTEffects {
  constructor() {
    this.scanlinesActive = true;
    this.staticActive = false;
  }

  /**
   * Enable/disable scanlines
   */
  setScanlines(enabled) {
    this.scanlinesActive = enabled;
    this.updateScanlines();
  }

  /**
   * Show static effect
   */
  showStatic(duration = 200) {
    this.staticActive = true;
    this.updateStatic();

    setTimeout(() => {
      this.staticActive = false;
      this.updateStatic();
    }, duration);
  }

  /**
   * Update scanlines in DOM
   */
  updateScanlines() {
    const tvScreen = document.querySelector('.tv-screen');
    if (tvScreen) {
      if (this.scanlinesActive) {
        tvScreen.classList.add('scanlines-active');
      } else {
        tvScreen.classList.remove('scanlines-active');
      }
    }
  }

  /**
   * Update static effect in DOM
   */
  updateStatic() {
    const staticOverlay = document.querySelector('.static-effect-tv');
    if (staticOverlay) {
      if (this.staticActive) {
        staticOverlay.style.display = 'block';
      } else {
        staticOverlay.style.display = 'none';
      }
    }
  }

  /**
   * Apply fade-in effect
   */
  fadeIn(element, duration = 400) {
    if (!element) return;

    element.style.opacity = '0';
    element.style.transition = `opacity ${duration}ms ease-in`;

    requestAnimationFrame(() => {
      element.style.opacity = '1';
    });

    setTimeout(() => {
      element.style.transition = '';
    }, duration);
  }

  /**
   * Apply fade-out effect
   */
  fadeOut(element, duration = 200) {
    if (!element) return;

    element.style.opacity = '1';
    element.style.transition = `opacity ${duration}ms ease-out`;

    requestAnimationFrame(() => {
      element.style.opacity = '0';
    });
  }
}

// Export singleton instances
export const channelSwitchPipeline = new ChannelSwitchPipeline();
export const crtEffects = new CRTEffects();







