/**
 * Channel Fetcher Utility
 * Fetches channels from API with automatic fallback to channels.json
 * Now uses unified apiClientV2 with smart caching
 */

import { apiClientV2 } from '../apiClientV2';

/**
 * Fetch channels from API, fallback to channels.json if server is not responding
 * @returns {Promise<Array>} Array of channels
 */
export async function fetchChannelsWithFallback() {
	try {
		// Try unified API client first (with caching and timeout)
		const result = await apiClientV2.getChannels();
		
		if (result.success) {
			console.log('[channelFetcher] Loaded channels from API:', result.data.length, 'channels', result.fromCache ? '(cached)' : '');
			return result.data;
		}
		
		// API failed - throw to trigger fallback
		throw new Error(result.error?.userMessage || 'API request failed');
	} catch (apiError) {
		// Server not responding - fallback to static file
		console.warn('[channelFetcher] Server not responding, falling back to channels.json:', apiError.message);
		
		try {
			const staticResponse = await fetch(`/data/channels.json?t=${Date.now()}`);
			
			if (!staticResponse.ok) {
				throw new Error(`Failed to load channels.json: ${staticResponse.status}`);
			}
			
			const staticData = await staticResponse.json();
			const channels = staticData.channels || staticData || [];
			
			// If the JSON is directly an array, use it
			if (Array.isArray(staticData) && !staticData.channels) {
				console.log('[channelFetcher] ✓ Loaded channels from static file (fallback):', staticData.length, 'channels');
				return staticData;
			}
			
			console.log('[channelFetcher] ✓ Loaded channels from static file (fallback):', channels.length, 'channels');
			return channels;
		} catch (fallbackError) {
			console.error('[channelFetcher] ✗ Both API and static file failed:', fallbackError);
			throw new Error(`Failed to load channels: ${apiError.message} (fallback also failed: ${fallbackError.message})`);
		}
	}
}

export default fetchChannelsWithFallback

