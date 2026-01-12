/**
 * Error Tracking - Console-only (no external services)
 * Logs errors to console for debugging, no server calls
 */

class ErrorTracking {
	constructor() {
		this.isInitialized = false
	}

	init() {
		if (this.isInitialized) return
		this.isInitialized = true
		
		// Basic global error handlers - console only
		if (typeof window !== 'undefined') {
			window.addEventListener('error', (e) => {
				console.error('[Error]', e.message, e.filename, e.lineno)
			})
			window.addEventListener('unhandledrejection', (e) => {
				console.error('[Unhandled Promise]', e.reason)
			})
		}
	}

	captureException(error, context = {}) {
		if (!error) return
		console.error('[Error]', error.message || error, context)
	}

	captureMessage(message, level = 'info') {
		console.log(`[${level}]`, message)
	}

	setUser() {}
	clearUser() {}
	addBreadcrumb() {}
}

const errorTracking = new ErrorTracking()
export default errorTracking
