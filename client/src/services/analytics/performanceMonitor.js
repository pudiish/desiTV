/**
 * Performance Monitor Stub - No-op implementation
 * All methods exist but do nothing (no intervals, no resource usage)
 */

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
	}
	
	trackLoadPerformance() {}
	captureLoadMetrics() {}
	startFrameRateMonitoring() {}
	startMemoryMonitoring() {}
	stopMonitoring() {}
	trackChannelSwitch() { return 0 }
	trackMenuOpen() { return 0 }
	trackError() {}
	getSummary() { return {} }
	getAllMetrics() { return this.metrics }
	clear() {}
	stop() {}
}

const performanceMonitor = new PerformanceMonitor()
export default performanceMonitor
