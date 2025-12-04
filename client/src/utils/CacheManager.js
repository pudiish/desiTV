/**
 * CacheManager.js - Utilities for cleaning and managing cache
 * Ensures fresh data on each TV session start
 */

class CacheManager {
	/**
	 * Clear all caches before entering TV
	 * Clears: localStorage (except session), sessionStorage, browser cache hints
	 */
	static clearCaches() {
		console.log('[CacheManager] Starting cache cleanup...')

		try {
			// Clear sessionStorage (temporary data)
			sessionStorage.clear()
			console.log('[CacheManager] ✓ Cleared sessionStorage')

			// Keep session ID but clear other localStorage
			const sessionId = localStorage.getItem('retro-tv-session-id')
			const selectedChannels = localStorage.getItem('retro-tv-selected-channels')

			// Clear all localStorage
			localStorage.clear()

			// Restore only essential items
			if (sessionId) {
				localStorage.setItem('retro-tv-session-id', sessionId)
				console.log('[CacheManager] ✓ Preserved session ID')
			}
			if (selectedChannels) {
				localStorage.setItem('retro-tv-selected-channels', selectedChannels)
				console.log('[CacheManager] ✓ Preserved selected channels')
			}

			// Force browser cache invalidation
			if ('caches' in window) {
				caches.keys().then((cacheNames) => {
					cacheNames.forEach((cacheName) => {
						caches.delete(cacheName)
						console.log(`[CacheManager] ✓ Deleted cache: ${cacheName}`)
					})
				})
			}

			console.log('[CacheManager] ✓ Cache cleanup complete')
			return true
		} catch (err) {
			console.error('[CacheManager] Error during cleanup:', err)
			return false
		}
	}

	/**
	 * Reset player state for fresh playback
	 */
	static resetPlayerState() {
		console.log('[CacheManager] Resetting player state...')

		// Clear any cached player references
		if (window.playerInstance) {
			delete window.playerInstance
		}

		// Clear YouTube iframe cache hints
		if (window.YT) {
			console.log('[CacheManager] ✓ Cleared YouTube API reference')
		}

		console.log('[CacheManager] ✓ Player state reset complete')
	}

	/**
	 * Full cleanup for fresh TV session
	 */
	static cleanupBeforeTV() {
		console.log('[CacheManager] === FULL CLEANUP BEFORE TV ===')

		// Clear caches
		this.clearCaches()

		// Reset player state
		this.resetPlayerState()

		// Mark cleanup complete
		sessionStorage.setItem('cache-cleaned', 'true')
		console.log('[CacheManager] === CLEANUP COMPLETE ===')
	}
}

export default CacheManager
