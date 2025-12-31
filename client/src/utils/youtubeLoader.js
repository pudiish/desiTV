/**
 * YouTube API Loader - Lazy Loading Utility
 * 
 * Dynamically loads YouTube iframe API only when needed
 * Reduces initial bundle size and improves page load time
 */

let youtubeAPILoading = false
let youtubeAPILoaded = false
let youtubeAPILoadPromise = null

/**
 * Load YouTube iframe API dynamically
 * @returns {Promise<typeof window.YT>} YouTube API object
 */
export function loadYouTubeAPI() {
	// If already loaded, return immediately
	if (youtubeAPILoaded && window.YT && window.YT.Player) {
		return Promise.resolve(window.YT)
	}

	// If already loading, return existing promise
	if (youtubeAPILoading && youtubeAPILoadPromise) {
		return youtubeAPILoadPromise
	}

	// Start loading
	youtubeAPILoading = true
	youtubeAPILoadPromise = new Promise((resolve, reject) => {
		// Check if already loaded (race condition)
		if (window.YT && window.YT.Player) {
			youtubeAPILoaded = true
			youtubeAPILoading = false
			resolve(window.YT)
			return
		}

		// Check if script already exists
		const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]')
		if (existingScript) {
			// Script exists, wait for it to load
			const checkInterval = setInterval(() => {
				if (window.YT && window.YT.Player) {
					clearInterval(checkInterval)
					youtubeAPILoaded = true
					youtubeAPILoading = false
					resolve(window.YT)
				}
			}, 100)

			// Timeout after 10 seconds
			setTimeout(() => {
				clearInterval(checkInterval)
				if (!youtubeAPILoaded) {
					youtubeAPILoading = false
					reject(new Error('YouTube API failed to load within 10 seconds'))
				}
			}, 10000)
			return
		}

		// Create script element
		const script = document.createElement('script')
		script.src = 'https://www.youtube.com/iframe_api'
		script.async = true
		script.defer = true

		// Set up callback
		const originalCallback = window.onYouTubeIframeAPIReady
		window.onYouTubeIframeAPIReady = () => {
			if (originalCallback) originalCallback()
			youtubeAPILoaded = true
			youtubeAPILoading = false
			resolve(window.YT)
		}

		// Handle errors
		script.onerror = () => {
			youtubeAPILoading = false
			reject(new Error('Failed to load YouTube iframe API'))
		}

		// Append to document
		const firstScript = document.getElementsByTagName('script')[0]
		if (firstScript && firstScript.parentNode) {
			firstScript.parentNode.insertBefore(script, firstScript)
		} else {
			document.head.appendChild(script)
		}

		// Timeout after 10 seconds
		setTimeout(() => {
			if (!youtubeAPILoaded) {
				youtubeAPILoading = false
				reject(new Error('YouTube API failed to load within 10 seconds'))
			}
		}, 10000)
	})

	return youtubeAPILoadPromise
}

/**
 * Check if YouTube API is loaded
 * @returns {boolean}
 */
export function isYouTubeAPILoaded() {
	return youtubeAPILoaded && window.YT && window.YT.Player
}

/**
 * Reset loader state (for testing)
 */
export function resetYouTubeLoader() {
	youtubeAPILoading = false
	youtubeAPILoaded = false
	youtubeAPILoadPromise = null
}

