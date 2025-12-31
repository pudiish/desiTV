/**
 * YouTubePeakTimestamp - Fetches peak view timestamp from YouTube platform
 * 
 * YouTube doesn't officially expose "most replayed" via API, so we:
 * 1. Try to fetch from YouTube's internal data (if available)
 * 2. Cache results to avoid repeated requests
 * 3. Fallback gracefully if unavailable
 */

class YouTubePeakTimestamp {
	constructor() {
		this.CACHE_KEY = 'desitv_youtube_peak_cache'
		this.CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days
		this.cache = this.loadCache()
	}

	/**
	 * Load cache from localStorage
	 */
	loadCache() {
		try {
			const stored = localStorage.getItem(this.CACHE_KEY)
			if (!stored) return {}
			return JSON.parse(stored)
		} catch (err) {
			console.error('[YouTubePeakTimestamp] Error loading cache:', err)
			return {}
		}
	}

	/**
	 * Save cache to localStorage
	 */
	saveCache() {
		try {
			localStorage.setItem(this.CACHE_KEY, JSON.stringify(this.cache))
		} catch (err) {
			console.error('[YouTubePeakTimestamp] Error saving cache:', err)
		}
	}

	/**
	 * Check if cached data is still valid
	 */
	isCacheValid(videoId) {
		const cached = this.cache[videoId]
		if (!cached) return false
		const age = Date.now() - cached.timestamp
		return age < this.CACHE_DURATION
	}

	/**
	 * Fetch peak timestamp from YouTube
	 * Uses YouTube's internal endpoints to get most replayed segment
	 */
	async fetchPeakTimestamp(videoId) {
		if (!videoId) return null

		// Check cache first
		if (this.isCacheValid(videoId)) {
			return this.cache[videoId].peakTimestamp
		}

		try {
			// Method 1: Try fetching from YouTube's player data
			// YouTube stores engagement data in their player config
			const peakTimestamp = await this.fetchFromYouTubePlayer(videoId)
			
			if (peakTimestamp !== null) {
				// Cache the result
				this.cache[videoId] = {
					peakTimestamp,
					timestamp: Date.now()
				}
				this.saveCache()
				return peakTimestamp
			}
		} catch (err) {
			console.warn('[YouTubePeakTimestamp] Error fetching peak timestamp:', err)
		}

		return null
	}

	/**
	 * Fetch peak timestamp from YouTube (client-side)
	 * Uses CORS proxy to bypass CORS restrictions
	 */
	async fetchFromYouTubePlayer(videoId) {
		try {
			// Use CORS proxy to fetch YouTube page
			// allorigins.win is a free CORS proxy service
			const corsProxy = 'https:// api.allorigins.win/raw?url='
			const youtubeUrl = encodeURIComponent(`https:// www.youtube.com/watch?v=${videoId}`)
			
			const response = await fetch(`${corsProxy}${youtubeUrl}`, {
				method: 'GET',
				headers: {
					'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
				}
			})

			if (!response.ok) {
				return null
			}

			const html = await response.text()

			// Extract player config from YouTube page
			// YouTube embeds player config in a script tag
			const playerConfigMatch = html.match(/var ytInitialPlayerResponse = ({.+?});/s)
			if (!playerConfigMatch) {
				return null
			}

			const playerConfig = JSON.parse(playerConfigMatch[1])

			// Look for engagement panels (most replayed data)
			const engagementPanels = playerConfig?.engagementPanels || []
			
			// Find most replayed segment
			let peakTimestamp = null
			let maxEngagement = 0

			for (const panel of engagementPanels) {
				const sectionList = panel?.engagementPanelSectionListRenderer?.content?.macroMarkersListRenderer
				if (sectionList?.contents) {
					for (const marker of sectionList.contents) {
						const markerData = marker?.macroMarkersListItemRenderer
						if (markerData) {
							// Extract timestamp from onTap command
							const onTap = markerData.onTap?.commandMetadata?.webCommandMetadata?.url
							if (onTap) {
								const timeMatch = onTap.match(/[?&]t=(\d+)/)
								if (timeMatch) {
									const timestamp = parseInt(timeMatch[1], 10)
									const engagement = markerData.engagement || markerData.viewCount || 0
									
									if (engagement > maxEngagement) {
										maxEngagement = engagement
										peakTimestamp = timestamp
									}
								}
							}
						}
					}
				}
			}

			// Alternative: Check for mostReplayed in videoDetails
			if (!peakTimestamp && playerConfig?.videoDetails) {
				const mostReplayed = playerConfig.videoDetails.mostReplayed
				if (mostReplayed?.startTimeSeconds) {
					peakTimestamp = mostReplayed.startTimeSeconds
				}
			}

			return peakTimestamp
		} catch (err) {
			console.warn('[YouTubePeakTimestamp] Error fetching from YouTube:', err)
			return null
		}
	}

	/**
	 * Get peak timestamp (cached or fetch)
	 */
	async getPeakTimestamp(videoId) {
		if (!videoId) return null

		// Check cache first
		if (this.isCacheValid(videoId)) {
			return this.cache[videoId].peakTimestamp
		}

		// Fetch from YouTube
		return await this.fetchPeakTimestamp(videoId)
	}

	/**
	 * Clear cache for a specific video
	 */
	clearCache(videoId) {
		if (this.cache[videoId]) {
			delete this.cache[videoId]
			this.saveCache()
		}
	}

	/**
	 * Clear all cache
	 */
	clearAllCache() {
		this.cache = {}
		this.saveCache()
	}
}

// Export singleton instance
export const youtubePeakTimestamp = new YouTubePeakTimestamp()
export default youtubePeakTimestamp

