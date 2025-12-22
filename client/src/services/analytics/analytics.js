/**
 * Analytics Tracking - Non-intrusive, privacy-focused
 * Tracks user behavior without interfering with TV watching experience
 */

class Analytics {
	constructor() {
		this.sessionId = this.generateSessionId()
		this.startTime = Date.now()
		this.events = []
		this.isEnabled = true // Can be disabled via user preference
		this.endpoint = '/api/analytics' // Backend endpoint
		
		// Throttle event sending to reduce server load
		this.sendInterval = 30000 // Send every 30 seconds
		this.sendTimer = null
		
		// Track session
		this.trackEvent('session_start', {
			timestamp: this.startTime,
			userAgent: navigator.userAgent,
			screenSize: `${window.innerWidth}x${window.innerHeight}`,
			deviceType: this.detectDeviceType()
		})
		
		// Send events periodically
		this.startPeriodicSend()
		
		// Track page visibility (when user switches tabs/apps)
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) {
				this.trackEvent('session_pause', { timestamp: Date.now() })
			} else {
				this.trackEvent('session_resume', { timestamp: Date.now() })
			}
		})
		
		// Track session end
		window.addEventListener('beforeunload', () => {
			this.trackEvent('session_end', {
				timestamp: Date.now(),
				duration: Date.now() - this.startTime
			})
			this.sendEvents(true) // Force send on exit
		})
	}
	
	generateSessionId() {
		return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
	}
	
	detectDeviceType() {
		const ua = navigator.userAgent
		if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
		if (/mobile|iphone|ipod|android|blackberry|opera|mini|windows\sce|palm|smartphone|iemobile/i.test(ua)) return 'mobile'
		return 'desktop'
	}
	
	/**
	 * Track an event
	 * @param {string} eventName - Name of the event
	 * @param {object} data - Additional event data
	 */
	trackEvent(eventName, data = {}) {
		if (!this.isEnabled) return
		
		const event = {
			sessionId: this.sessionId,
			eventName,
			timestamp: Date.now(),
			...data
		}
		
		this.events.push(event)
		
		// Log in development
		if (import.meta.env.DEV) {
			console.log('[Analytics]', eventName, data)
		}
	}
	
	/**
	 * Track TV power events
	 */
	trackPowerOn() {
		this.trackEvent('tv_power_on', { timestamp: Date.now() })
	}
	
	trackPowerOff() {
		this.trackEvent('tv_power_off', { timestamp: Date.now() })
	}
	
	/**
	 * Track channel navigation
	 */
	trackChannelChange(method, fromChannel, toChannel, category) {
		this.trackEvent('channel_change', {
			method, // 'up', 'down', 'direct', 'menu'
			fromChannel,
			toChannel,
			category,
			timestamp: Date.now()
		})
	}
	
	/**
	 * Track category/category changes
	 */
	trackCategoryChange(fromCategory, toCategory) {
		this.trackEvent('category_change', {
			fromCategory,
			toCategory,
			timestamp: Date.now()
		})
	}
	
	/**
	 * Track volume changes
	 */
	trackVolumeChange(volume, action) {
		this.trackEvent('volume_change', {
			volume,
			action, // 'up', 'down', 'mute', 'unmute'
			timestamp: Date.now()
		})
	}
	
	/**
	 * Track menu interactions
	 */
	trackMenuOpen() {
		this.trackEvent('menu_open', { timestamp: Date.now() })
	}
	
	trackMenuClose() {
		this.trackEvent('menu_close', { timestamp: Date.now() })
	}
	
	trackMenuSelect(category) {
		this.trackEvent('menu_select', {
			category,
			timestamp: Date.now()
		})
	}
	
	/**
	 * Track fullscreen events
	 */
	trackFullscreenEnter() {
		this.trackEvent('fullscreen_enter', { timestamp: Date.now() })
	}
	
	trackFullscreenExit() {
		this.trackEvent('fullscreen_exit', { timestamp: Date.now() })
	}
	
	/**
	 * Track playback events
	 */
	trackPlaybackStart(videoId, category) {
		this.trackEvent('playback_start', {
			videoId,
			category,
			timestamp: Date.now()
		})
	}
	
	trackPlaybackEnd(videoId, duration) {
		this.trackEvent('playback_end', {
			videoId,
			duration,
			timestamp: Date.now()
		})
	}
	
	trackBuffering(duration) {
		this.trackEvent('buffering', {
			duration,
			timestamp: Date.now()
		})
	}
	
	/**
	 * Track errors
	 */
	trackError(errorType, errorMessage, context = {}) {
		this.trackEvent('error', {
			errorType,
			errorMessage,
			context,
			timestamp: Date.now()
		})
	}
	
	/**
	 * Track performance metrics
	 */
	trackPerformance(metric, value, unit = 'ms') {
		this.trackEvent('performance', {
			metric, // 'load_time', 'channel_switch_time', 'menu_open_time'
			value,
			unit,
			timestamp: Date.now()
		})
	}
	
	/**
	 * Track user age group (if provided during testing)
	 */
	trackAgeGroup(ageGroup) {
		this.trackEvent('age_group', {
			ageGroup, // '18-30', '31-50', '51-60+'
			timestamp: Date.now()
		})
	}
	
	/**
	 * Send events to server
	 */
	async sendEvents(force = false) {
		if (!this.isEnabled || this.events.length === 0) return
		
		// Don't send if not enough time has passed (unless forced)
		if (!force && this.events.length < 5) return
		
		const eventsToSend = [...this.events]
		this.events = [] // Clear events after copying
		
		try {
			const response = await fetch(this.endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					sessionId: this.sessionId,
					events: eventsToSend
				}),
				// Don't block on send - fire and forget
				keepalive: true
			})
			
			if (!response.ok) {
				console.warn('[Analytics] Failed to send events:', response.status)
				// Re-add events if send failed (for retry)
				this.events.unshift(...eventsToSend)
			}
		} catch (error) {
			console.warn('[Analytics] Error sending events:', error)
			// Re-add events if send failed (for retry)
			this.events.unshift(...eventsToSend)
		}
	}
	
	/**
	 * Start periodic event sending
	 */
	startPeriodicSend() {
		if (this.sendTimer) return
		
		this.sendTimer = setInterval(() => {
			this.sendEvents()
		}, this.sendInterval)
	}
	
	/**
	 * Stop periodic event sending
	 */
	stopPeriodicSend() {
		if (this.sendTimer) {
			clearInterval(this.sendTimer)
			this.sendTimer = null
		}
	}
	
	/**
	 * Disable analytics
	 */
	disable() {
		this.isEnabled = false
		this.stopPeriodicSend()
	}
	
	/**
	 * Enable analytics
	 */
	enable() {
		this.isEnabled = true
		this.startPeriodicSend()
	}
}

// Create singleton instance
const analytics = new Analytics()

export default analytics

