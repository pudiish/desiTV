/**
 * Analytics Stub - No-op implementation
 * All methods exist but do nothing (no server calls, no resource usage)
 */

class Analytics {
	constructor() {
		this.isEnabled = false
	}
	
	// All tracking methods are no-ops
	trackEvent() {}
	trackPowerOn() {}
	trackPowerOff() {}
	trackChannelChange() {}
	trackCategoryChange() {}
	trackVolumeChange() {}
	trackMenuOpen() {}
	trackMenuClose() {}
	trackMenuSelect() {}
	trackFullscreenEnter() {}
	trackFullscreenExit() {}
	trackPlaybackStart() {}
	trackPlaybackEnd() {}
	trackBuffering() {}
	trackError() {}
	trackPerformance() {}
	trackAgeGroup() {}
	sendEvents() {}
	startPeriodicSend() {}
	stopPeriodicSend() {}
	disable() {}
	enable() {}
}

const analytics = new Analytics()
export default analytics
