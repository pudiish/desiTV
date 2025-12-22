/**
 * YouTubeUIRemover.js
 * Aggressive and comprehensive YouTube UI removal utility
 * Handles logo, title, tooltips, and all YouTube branding elements
 */

class YouTubeUIRemover {
	constructor() {
		this.iframeDoc = null
		this.observer = null
		this.mutationObserver = null
		this.styleElement = null
		this.isRemovingUI = false
		this.checkInterval = null
	}

	/**
	 * Initialize YouTube UI removal for the embedded iframe
	 */
	init() {
		this.isRemovingUI = true
		this.startUIRemoval()
	}

	/**
	 * Get the iframe document safely
	 */
	getIframeDoc() {
		try {
			const iframe = document.querySelector('.youtube-iframe iframe') ||
						   document.querySelector('iframe[src*="youtube"]')
			
			if (!iframe) return null

			// Try to access iframe document
			const doc = iframe.contentDocument || iframe.contentWindow?.document
			return doc || null
		} catch (err) {
			console.warn('[YouTubeUIRemover] Cannot access iframe document:', err.message)
			return null
		}
	}

	/**
	 * Inject CSS styles into iframe to permanently hide YouTube UI
	 */
	injectStyles() {
		try {
			this.iframeDoc = this.getIframeDoc()
			if (!this.iframeDoc) return false

			// Check if styles already injected
			if (this.iframeDoc.querySelector('#yt-ui-remover-styles')) {
				return true
			}

			// Create comprehensive style element
			this.styleElement = this.iframeDoc.createElement('style')
			this.styleElement.id = 'yt-ui-remover-styles'
			this.styleElement.textContent = `
				/* Hide all YouTube UI elements */
				.ytp-chrome,
				.ytp-chrome-bottom,
				.ytp-chrome-top,
				.ytp-chrome-controls,
				.ytp-chrome-controls-button-container,
				.ytp-logo,
				.ytp-logo-button,
				.ytp-logo-icon,
				.ytp-title,
				.ytp-title-expanded,
				.ytp-watermark,
				.ytp-pause-overlay,
				.ytp-pause-overlay-container,
				.ytp-large-play-button,
				.ytp-large-play-button-bg,
				.html5-endscreen-ui,
				.html5-endscreen-container,
				.html5-video-info-panel-container,
				.ytp-endscreen-container,
				.ytp-gradient-bottom,
				.ytp-gradient-top,
				.ytp-tooltip,
				.ytp-tooltip-bg,
				.ytp-tooltip-text,
				.ytp-info-icon,
				.ytp-info-icon-button,
				.ytp-settings,
				.ytp-settings-button,
				.ytp-fullscreen-button,
				.ytp-share-button,
				.ytp-add-to-watch-later-button,
				[data-tooltip],
				[data-tooltip-alignment],
				.yt-simple-endpoint,
				.yt-formatted-string {
					display: none !important;
					visibility: hidden !important;
					opacity: 0 !important;
					pointer-events: none !important;
					height: 0 !important;
					width: 0 !important;
					margin: 0 !important;
					padding: 0 !important;
					border: none !important;
				}

				/* Prevent hover-triggered UI elements from appearing */
				.ytp-player:hover .ytp-chrome,
				.ytp-player:hover .ytp-chrome-bottom,
				.ytp-player:hover .ytp-chrome-top,
				.ytp-player:hover .ytp-watermark,
				.ytp-player:hover .ytp-title,
				.ytp-player:hover .ytp-tooltip,
				.ytp-player-content:hover .ytp-chrome,
				.ytp-player-content:hover .ytp-watermark,
				.ytp-show-cards-title:hover,
				.ytp-cards-teaser:hover,
				.ytp-ce-element:hover,
				.ytp-player:hover .ytp-show-cards-title,
				.ytp-player:hover .ytp-cards-teaser,
				.ytp-player:hover .ytp-ce-element {
					display: none !important;
					visibility: hidden !important;
					opacity: 0 !important;
					pointer-events: none !important;
				}

				/* Disable pointer events on UI containers to prevent hover interactions */
				.ytp-chrome,
				.ytp-chrome-bottom,
				.ytp-chrome-top,
				.ytp-watermark,
				.ytp-title,
				.ytp-tooltip,
				.ytp-show-cards-title,
				.ytp-cards-teaser,
				.ytp-ce-element {
					pointer-events: none !important;
				}

				/* Ensure video playback works - allow pointer events on video elements */
				.html5-video-container,
				.video-stream {
					pointer-events: auto !important;
					width: 100% !important;
					height: 100% !important;
				}

				/* Ensure video fills container */
				.html5-video-player,
				.ytp-player {
					width: 100% !important;
					height: 100% !important;
				}

				/* Remove any backgrounds that might show branding */
				.ytp-background {
					background: transparent !important;
				}
			`

			this.iframeDoc.head.appendChild(this.styleElement)
			return true
		} catch (err) {
			console.warn('[YouTubeUIRemover] Failed to inject styles:', err.message)
			return false
		}
	}

	/**
	 * Forcefully remove YouTube UI elements from DOM
	 */
	removeElements() {
		try {
			this.iframeDoc = this.getIframeDoc()
			if (!this.iframeDoc) return

			// List of selectors to remove
			const selectorsToHide = [
				'.ytp-chrome', '.ytp-chrome-bottom', '.ytp-chrome-top',
				'.ytp-chrome-controls', '.ytp-chrome-controls-button-container',
				'.ytp-logo', '.ytp-logo-button', '.ytp-logo-icon',
				'.ytp-title', '.ytp-title-expanded',
				'.ytp-watermark', '.ytp-pause-overlay', '.ytp-pause-overlay-container',
				'.ytp-large-play-button', '.ytp-large-play-button-bg',
				'.html5-endscreen-ui', '.html5-endscreen-container',
				'.html5-video-info-panel-container', '.ytp-endscreen-container',
				'.ytp-gradient-bottom', '.ytp-gradient-top',
				'.ytp-tooltip', '.ytp-tooltip-bg', '.ytp-tooltip-text',
				'.ytp-info-icon', '.ytp-info-icon-button',
				'.ytp-settings', '.ytp-settings-button',
				'.ytp-fullscreen-button', '.ytp-share-button',
				'.ytp-add-to-watch-later-button',
				'[data-tooltip]', '[data-tooltip-alignment]',
				'.ytp-show-cards-title', '.ytp-cards-teaser', '.ytp-ce-element',
				'.ytp-player-content', '.ytp-player-content-container'
			]

			selectorsToHide.forEach(selector => {
				try {
					const elements = this.iframeDoc.querySelectorAll(selector)
					elements.forEach(el => {
						if (el) {
							el.style.cssText = 
								'display: none !important; ' +
								'visibility: hidden !important; ' +
								'opacity: 0 !important; ' +
								'pointer-events: none !important; ' +
								'height: 0 !important; ' +
								'width: 0 !important; ' +
								'margin: 0 !important; ' +
								'padding: 0 !important;'
						}
					})
				} catch (err) {
					// Element not found or error accessing, continue
				}
			})
		} catch (err) {
			console.warn('[YouTubeUIRemover] Error removing elements:', err.message)
		}
	}

	/**
	 * Start continuous UI removal monitoring
	 */
	startUIRemoval() {
		// Inject styles once
		this.injectStyles()

		// Initial element removal
		this.removeElements()

		// Create MutationObserver to watch for new elements
		if (!this.mutationObserver) {
			try {
				this.iframeDoc = this.getIframeDoc()
				if (this.iframeDoc) {
					this.mutationObserver = new MutationObserver(() => {
						this.removeElements()
					})

					// Start observing for changes
					this.mutationObserver.observe(this.iframeDoc.body, {
						childList: true,
						subtree: true,
						attributes: true,
						attributeFilter: ['style', 'class']
					})
				}
			} catch (err) {
				console.warn('[YouTubeUIRemover] Failed to create MutationObserver:', err.message)
			}
		}

		// Periodic checks (every 200ms for 10 seconds)
		if (!this.checkInterval) {
			let checkCount = 0
			const maxChecks = 50 // 50 * 200ms = 10 seconds

			this.checkInterval = setInterval(() => {
				this.removeElements()
				checkCount++

				if (checkCount >= maxChecks) {
					clearInterval(this.checkInterval)
					this.checkInterval = null
				}
			}, 200)
		}
	}

	/**
	 * Stop UI removal monitoring
	 */
	stop() {
		this.isRemovingUI = false

		if (this.checkInterval) {
			clearInterval(this.checkInterval)
			this.checkInterval = null
		}

		if (this.mutationObserver) {
			this.mutationObserver.disconnect()
			this.mutationObserver = null
		}

		if (this.observer) {
			this.observer.disconnect()
			this.observer = null
		}
	}

	/**
	 * Restart UI removal
	 */
	restart() {
		this.stop()
		this.init()
	}

	/**
	 * Check if UI removal is active
	 */
	isActive() {
		return this.isRemovingUI
	}

	/**
	 * Force immediate cleanup
	 */
	cleanup() {
		this.stop()
		this.iframeDoc = null
		this.styleElement = null
	}
}

// Export as singleton
export default new YouTubeUIRemover()
