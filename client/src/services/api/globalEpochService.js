/**
 * globalEpochService.js - Client-Side Epoch (Simple, No Server Dependency)
 * 
 * Uses fixed epoch from channels.json or default fixed value
 * Simple, straightforward, no race conditions, no server calls
 */

import logger from '../../utils/logger.js'

const EPOCH_CACHE_KEY = 'desitv-global-epoch-cached'
const DEFAULT_EPOCH = new Date('2020-01-01T00:00:00.000Z') // Fixed epoch matching channels

let cachedEpoch = null

/**
 * Get global epoch - Client-side only (no server dependency)
 * Tries to get from channels.json first, falls back to fixed default
 * @param {boolean} forceRefresh - Ignored (kept for compatibility)
 * @returns {Promise<Date>} Global epoch date
 */
export async function fetchGlobalEpoch(forceRefresh = false) {
	// Return cached if available (simple, no TTL needed - epoch is fixed)
	if (cachedEpoch) {
		return cachedEpoch
	}
	
	try {
		// Try to get epoch from channels.json (if it has one)
		const response = await fetch('/data/channels.json?t=' + Date.now(), {
			cache: 'no-cache'
		})
		
		if (response.ok) {
			const data = await response.json()
			// Try to get epoch from first channel's playlistStartEpoch
			if (data.channels && data.channels.length > 0 && data.channels[0].playlistStartEpoch) {
				const epoch = new Date(data.channels[0].playlistStartEpoch)
				if (!isNaN(epoch.getTime())) {
					cachedEpoch = epoch
					logger.info('[GlobalEpoch] ✅ Using epoch from channels.json:', epoch.toISOString())
					return epoch
				}
			}
		}
	} catch (err) {
		logger.warn('[GlobalEpoch] Could not load from channels.json, using default:', err.message)
	}
	
	// Use fixed default epoch (matches channel playlistStartEpoch)
	cachedEpoch = DEFAULT_EPOCH
	logger.info('[GlobalEpoch] ✅ Using fixed default epoch:', cachedEpoch.toISOString())
	return cachedEpoch
}

/**
 * Clear cached epoch (force refresh on next fetch)
 */
export function clearEpochCache() {
	cachedEpoch = null
	try {
		localStorage.removeItem(EPOCH_CACHE_KEY)
	} catch (err) {
		logger.warn('[GlobalEpoch] Failed to clear localStorage cache:', err)
	}
}

/**
 * Get cached epoch (if available)
 * @returns {Date|null} Cached epoch or null
 */
export function getCachedEpoch() {
	return cachedEpoch
}

// Clock correction lives in services/time.js - import now() from there.

