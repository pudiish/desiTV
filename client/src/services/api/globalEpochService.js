/**
 * globalEpochService.js - the broadcast timeline's zero point
 *
 * The epoch ships inside the channel data as playlistStartEpoch, so the
 * playlist and the epoch it is measured against are always versioned together
 * and cannot drift apart. There is deliberately no separate epoch endpoint:
 * a second store is what previously let the server and the player disagree
 * about which video was live.
 */

import logger from '../../utils/logger.js'

const EPOCH_CACHE_KEY = 'desitv-global-epoch-cached'

/** Every channel currently shares this; used only if the fetch fails outright. */
const DEFAULT_EPOCH = new Date('2020-01-01T00:00:00.000Z')

let cachedEpoch = null

/**
 * Read the epoch from the channel manifest.
 * @returns {Promise<Date>} Global epoch date
 */
export async function fetchGlobalEpoch(forceRefresh = false) {
	// The epoch is immutable, so one read per session is enough.
	if (cachedEpoch && !forceRefresh) {
		return cachedEpoch
	}

	try {
		const response = await fetch('/data/channels.json?t=' + Date.now(), {
			cache: 'no-cache'
		})

		if (response.ok) {
			const payload = await response.json()
			// Static file uses `channels`; the API returns the same rows under `data`.
			const channels = payload.channels || payload.data || []
			const epoch = new Date(channels[0]?.playlistStartEpoch)

			if (!isNaN(epoch.getTime())) {
				cachedEpoch = epoch
				logger.info('[GlobalEpoch] ✅ Using epoch from channels.json:', epoch.toISOString())
				return epoch
			}
		}
	} catch (err) {
		logger.warn('[GlobalEpoch] Could not load from channels.json, using default:', err.message)
	}

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

