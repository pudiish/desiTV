/**
 * Channel Fetcher Utility - JSON-First (Simple, Fast, No Server Dependency)
 * 
 * Loads channels directly from /data/channels.json
 * No API calls, no race conditions, works offline
 */

/**
 * Fetch channels from JSON (primary source)
 * @returns {Promise<Array>} Array of channels
 */
export async function fetchChannelsWithFallback() {
	try {
		const response = await fetch(`/data/channels.json?t=${Date.now()}`, {
			cache: 'no-cache' // Always get fresh version
		});
		
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		
		const data = await response.json();
		const channels = data.channels || data || [];
		
		if (!Array.isArray(channels) || channels.length === 0) {
			throw new Error('Invalid channels data: expected non-empty array');
		}
		
		console.log('[channelFetcher] ✓ Loaded channels from JSON:', channels.length, 'channels');
		return channels;
	} catch (error) {
		console.error('[channelFetcher] ✗ Failed to load channels from JSON:', error.message);
		throw new Error(`Failed to load channels: ${error.message}. Ensure /data/channels.json exists.`);
	}
}

export default fetchChannelsWithFallback

