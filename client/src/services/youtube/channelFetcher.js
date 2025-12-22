/**
 * Channel Fetcher Utility
 * Fetches channels from API with automatic fallback to channels.json
 * Use this in admin components and other places that need to fetch channels directly
 */

/**
 * Fetch channels from API, fallback to channels.json if server is not responding
 * @returns {Promise<Array>} Array of channels
 */
export async function fetchChannelsWithFallback() {
	try {
		// Try API first with timeout (5 seconds)
		const timeoutPromise = new Promise((_, reject) => 
			setTimeout(() => reject(new Error('API request timeout')), 5000)
		)
		
		const apiResponse = await Promise.race([
			fetch(`/api/channels?t=${Date.now()}`),
			timeoutPromise
		])
		
		if (apiResponse.ok) {
			const channels = await apiResponse.json()
			console.log('[channelFetcher] Loaded channels from API:', channels.length, 'channels')
			return channels
		} else {
			throw new Error(`API returned status ${apiResponse.status}`)
		}
	} catch (apiError) {
		// Server not responding - fallback to static file
		console.warn('[channelFetcher] Server not responding, falling back to channels.json:', apiError.message)
		
		try {
			const staticResponse = await fetch(`/data/channels.json?t=${Date.now()}`)
			
			if (!staticResponse.ok) {
				throw new Error(`Failed to load channels.json: ${staticResponse.status}`)
			}
			
			const staticData = await staticResponse.json()
			const channels = staticData.channels || staticData || []
			
			// If the JSON is directly an array, use it
			if (Array.isArray(staticData) && !staticData.channels) {
				console.log('[channelFetcher] ✓ Loaded channels from static file (fallback):', staticData.length, 'channels')
				return staticData
			}
			
			console.log('[channelFetcher] ✓ Loaded channels from static file (fallback):', channels.length, 'channels')
			return channels
		} catch (fallbackError) {
			console.error('[channelFetcher] ✗ Both API and static file failed:', fallbackError)
			throw new Error(`Failed to load channels: ${apiError.message} (fallback also failed: ${fallbackError.message})`)
		}
	}
}

export default fetchChannelsWithFallback

