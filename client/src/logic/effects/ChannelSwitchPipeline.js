/**
 * ChannelSwitchPipeline.js
 * 
 * Channel switching animation pipeline
 * Moved from logic/effects.js for better organization
 */

import EFFECTS_THRESHOLDS from '../../config/thresholds/effects.js'

export class ChannelSwitchPipeline {
	constructor() {
		this.isTransitioning = false
		this.callbacks = {
			onStaticStart: null,
			onStaticEnd: null,
			onBlackScreen: null,
			onVideoLoad: null,
			onFadeIn: null,
			onComplete: null,
		}
	}

	/**
	 * Execute channel switch animation
	 */
	async execute(onVideoLoad) {
		if (this.isTransitioning) return
		this.isTransitioning = true

		try {
			// Step 1: Static overlay
			if (this.callbacks.onStaticStart) {
				this.callbacks.onStaticStart()
			}
			await this.delay(EFFECTS_THRESHOLDS.STATIC_DURATION)

			// Step 2: Black screen
			if (this.callbacks.onStaticEnd) {
				this.callbacks.onStaticEnd()
			}
			if (this.callbacks.onBlackScreen) {
				this.callbacks.onBlackScreen()
			}
			await this.delay(EFFECTS_THRESHOLDS.BLACK_SCREEN_DURATION)

			// Step 3: Load video
			if (onVideoLoad) {
				await onVideoLoad()
			}
			if (this.callbacks.onVideoLoad) {
				this.callbacks.onVideoLoad()
			}

			// Step 4: CRT fade-in
			if (this.callbacks.onFadeIn) {
				this.callbacks.onFadeIn()
			}
			await this.delay(EFFECTS_THRESHOLDS.FADE_IN_DURATION)

			// Complete
			if (this.callbacks.onComplete) {
				this.callbacks.onComplete()
			}
		} finally {
			this.isTransitioning = false
		}
	}

	/**
	 * Set callback for pipeline step
	 */
	on(step, callback) {
		if (this.callbacks[step]) {
			this.callbacks[step] = callback
		}
	}

	/**
	 * Delay helper
	 */
	delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms))
	}

	/**
	 * Check if transitioning
	 */
	getTransitioning() {
		return this.isTransitioning
	}
}

// Export singleton instance
export const channelSwitchPipeline = new ChannelSwitchPipeline()

