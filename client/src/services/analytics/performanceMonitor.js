/**
 * Performance Monitor - Tracks performance metrics for low-end device testing
 * Non-intrusive, runs in background
 * 📱 Mobile-aware: Reduces monitoring on mobile to save battery
 */

import mobilePerformanceOptimizer from '../mobilePerformanceOptimizer'

class PerformanceMonitor {
	constructor() {
		this.metrics = {
			loadTime: null,
			firstPaint: null,
			firstContentfulPaint: null,
			timeToInteractive: null,
			memoryUsage: [],
			frameRate: [],
			channelSwitchTimes: [],
			menuOpenTimes: [],
			errors: []
		}
		
		this.startTime = performance.now()
		this.frameCount = 0
		this.lastFrameTime = performance.now()
		this.monitoringInterval = null
		this.fpsAnimationId = null
		
		// Check if analytics should be enabled
		const settings = mobilePerformanceOptimizer.getSettings()
		this.analyticsEnabled = settings.enableAnalytics
		
		// Track load performance
		this.trackLoadPerformance()
		
		// Monitor frame rate (skip on mobile power saver)
		if (this.analyticsEnabled) {
			this.startFrameRateMonitoring()
		}
		
		// Monitor memory (if available and analytics enabled)
		if (performance.memory && this.analyticsEnabled) {
			this.startMemoryMonitoring()
		}
		
		// Track errors (always enabled - low overhead)
		window.addEventListener('error', (e) => {
			this.trackError('javascript_error', e.message, {
				filename: e.filename,
				lineno: e.lineno,
				colno: e.colno
			})
		})
		
		// Track unhandled promise rejections
		window.addEventListener('unhandledrejection', (e) => {
			this.trackError('unhandled_promise_rejection', e.reason?.message || 'Unknown error')
		})
		
		// Listen for performance mode changes
		mobilePerformanceOptimizer.subscribe((newSettings) => {
			if (newSettings.enableAnalytics !== this.analyticsEnabled) {
				this.analyticsEnabled = newSettings.enableAnalytics
				if (!this.analyticsEnabled) {
					this.stopMonitoring()
				}
			}
		})
	}
	
	/**
	 * Track page load performance
	 */
	trackLoadPerformance() {
		if (document.readyState === 'complete') {
			this.captureLoadMetrics()
		} else {
			window.addEventListener('load', () => {
				this.captureLoadMetrics()
			})
		}
	}
	
	captureLoadMetrics() {
		const navigation = performance.getEntriesByType('navigation')[0]
		if (navigation) {
			this.metrics.loadTime = navigation.loadEventEnd - navigation.fetchStart
			this.metrics.firstPaint = navigation.domContentLoadedEventEnd - navigation.fetchStart
		}
		
		// First Contentful Paint
		const paintEntries = performance.getEntriesByType('paint')
		paintEntries.forEach(entry => {
			if (entry.name === 'first-contentful-paint') {
				this.metrics.firstContentfulPaint = entry.startTime
			}
		})
		
		// Time to Interactive (simplified)
		if (document.readyState === 'complete') {
			this.metrics.timeToInteractive = performance.now() - this.startTime
		}
	}
	
	/**
	 * Monitor frame rate
	 */
	startFrameRateMonitoring() {
		let lastTime = performance.now()
		let frames = 0
		
		const measureFPS = () => {
			frames++
			const currentTime = performance.now()
			
			if (currentTime >= lastTime + 1000) {
				const fps = Math.round((frames * 1000) / (currentTime - lastTime))
				this.metrics.frameRate.push({
					fps,
					timestamp: currentTime
				})
				
				// Keep only last 60 measurements (1 minute at 1 measurement/second)
				if (this.metrics.frameRate.length > 60) {
					this.metrics.frameRate.shift()
				}
				
				frames = 0
				lastTime = currentTime
			}
			
			this.fpsAnimationId = requestAnimationFrame(measureFPS)
		}
		
		this.fpsAnimationId = requestAnimationFrame(measureFPS)
	}
	
	/**
	 * Monitor memory usage (Chrome/Edge only)
	 */
	startMemoryMonitoring() {
		if (!performance.memory) return
		
		// Use longer interval on mobile to reduce CPU usage
		const interval = mobilePerformanceOptimizer.isMobile ? 5000 : 1000
		
		this.monitoringInterval = setInterval(() => {
			const memory = {
				used: performance.memory.usedJSHeapSize,
				total: performance.memory.totalJSHeapSize,
				limit: performance.memory.jsHeapSizeLimit,
				timestamp: Date.now()
			}
			
			this.metrics.memoryUsage.push(memory)
			
			// Keep only last 120 measurements (2 minutes at 1 measurement/second)
			if (this.metrics.memoryUsage.length > 120) {
				this.metrics.memoryUsage.shift()
			}
		}, interval)
	}
	
	/**
	 * Stop all monitoring (called when entering power saver mode)
	 */
	stopMonitoring() {
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval)
			this.monitoringInterval = null
		}
		if (this.fpsAnimationId) {
			cancelAnimationFrame(this.fpsAnimationId)
			this.fpsAnimationId = null
		}
		console.log('[PerformanceMonitor] Monitoring stopped for power saving')
	}
	
	/**
	 * Track channel switch time
	 */
	trackChannelSwitch(startTime) {
		const duration = performance.now() - startTime
		this.metrics.channelSwitchTimes.push({
			duration,
			timestamp: Date.now()
		})
		
		// Keep only last 50 measurements
		if (this.metrics.channelSwitchTimes.length > 50) {
			this.metrics.channelSwitchTimes.shift()
		}
		
		return duration
	}
	
	/**
	 * Track menu open time
	 */
	trackMenuOpen(startTime) {
		const duration = performance.now() - startTime
		this.metrics.menuOpenTimes.push({
			duration,
			timestamp: Date.now()
		})
		
		// Keep only last 20 measurements
		if (this.metrics.menuOpenTimes.length > 20) {
			this.metrics.menuOpenTimes.shift()
		}
		
		return duration
	}
	
	/**
	 * Track errors
	 */
	trackError(type, message, context = {}) {
		this.metrics.errors.push({
			type,
			message,
			context,
			timestamp: Date.now()
		})
		
		// Keep only last 50 errors
		if (this.metrics.errors.length > 50) {
			this.metrics.errors.shift()
		}
	}
	
	/**
	 * Get performance summary
	 */
	getSummary() {
		const avgFrameRate = this.metrics.frameRate.length > 0
			? Math.round(this.metrics.frameRate.reduce((sum, m) => sum + m.fps, 0) / this.metrics.frameRate.length)
			: null
		
		const avgChannelSwitch = this.metrics.channelSwitchTimes.length > 0
			? Math.round(this.metrics.channelSwitchTimes.reduce((sum, m) => sum + m.duration, 0) / this.metrics.channelSwitchTimes.length)
			: null
		
		const avgMenuOpen = this.metrics.menuOpenTimes.length > 0
			? Math.round(this.metrics.menuOpenTimes.reduce((sum, m) => sum + m.duration, 0) / this.metrics.menuOpenTimes.length)
			: null
		
		const avgMemory = this.metrics.memoryUsage.length > 0
			? Math.round(this.metrics.memoryUsage.reduce((sum, m) => sum + m.used, 0) / this.metrics.memoryUsage.length)
			: null
		
		return {
			loadTime: this.metrics.loadTime ? Math.round(this.metrics.loadTime) : null,
			firstContentfulPaint: this.metrics.firstContentfulPaint ? Math.round(this.metrics.firstContentfulPaint) : null,
			timeToInteractive: this.metrics.timeToInteractive ? Math.round(this.metrics.timeToInteractive) : null,
			avgFrameRate,
			avgChannelSwitch,
			avgMenuOpen,
			avgMemory: avgMemory ? Math.round(avgMemory / 1024 / 1024) : null, // MB
			errorCount: this.metrics.errors.length,
			deviceInfo: {
				userAgent: navigator.userAgent,
				screenSize: `${window.innerWidth}x${window.innerHeight}`,
				deviceMemory: navigator.deviceMemory || 'unknown',
				hardwareConcurrency: navigator.hardwareConcurrency || 'unknown'
			}
		}
	}
	
	/**
	 * Get all metrics (for detailed analysis)
	 */
	getAllMetrics() {
		return {
			...this.metrics,
			summary: this.getSummary()
		}
	}
	
	/**
	 * Clear all metrics
	 */
	clear() {
		this.metrics = {
			loadTime: null,
			firstPaint: null,
			firstContentfulPaint: null,
			timeToInteractive: null,
			memoryUsage: [],
			frameRate: [],
			channelSwitchTimes: [],
			menuOpenTimes: [],
			errors: []
		}
	}
	
	/**
	 * Stop monitoring
	 */
	stop() {
		if (this.monitoringInterval) {
			clearInterval(this.monitoringInterval)
			this.monitoringInterval = null
		}
	}
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor()

export default performanceMonitor

