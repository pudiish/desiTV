/**
 * globalEpochService.js
 * 
 * Service for fetching and managing the global epoch from server
 * This ensures all users are synchronized to the same timeline
 */

import { getUserTimezone } from './timezoneService'

const EPOCH_CACHE_KEY = 'desitv-global-epoch-cached'
const EPOCH_CACHE_TTL = 60 * 60 * 1000 // 1 hour (epoch rarely changes)

let cachedEpoch = null
let cacheTimestamp = null

/**
 * Fetch global epoch from server
 * @returns {Promise<Date>} Global epoch date
 */
export async function fetchGlobalEpoch() {
	// Check cache first
	if (cachedEpoch && cacheTimestamp) {
		const age = Date.now() - cacheTimestamp
		if (age < EPOCH_CACHE_TTL) {
			return cachedEpoch
		}
	}
	
	try {
		const response = await fetch('/api/global-epoch')
		if (!response.ok) {
			throw new Error(`Failed to fetch global epoch: ${response.statusText}`)
		}
		
		const data = await response.json()
		const epoch = new Date(data.epoch)
		
		// Cache it
		cachedEpoch = epoch
		cacheTimestamp = Date.now()
		
		// Also cache in localStorage as backup
		try {
			localStorage.setItem(EPOCH_CACHE_KEY, JSON.stringify({
				epoch: epoch.toISOString(),
				timestamp: cacheTimestamp,
			}))
		} catch (err) {
			console.warn('[GlobalEpoch] Failed to cache in localStorage:', err)
		}
		
		console.log('[GlobalEpoch] Fetched from server:', epoch.toISOString())
		return epoch
	} catch (err) {
		console.error('[GlobalEpoch] Error fetching from server:', err)
		
		// Fallback to localStorage cache
		try {
			const cached = localStorage.getItem(EPOCH_CACHE_KEY)
			if (cached) {
				const parsed = JSON.parse(cached)
				const epoch = new Date(parsed.epoch)
				const age = Date.now() - parsed.timestamp
				
				// Use cached if less than 2 hours old
				if (age < 2 * 60 * 60 * 1000) {
					console.log('[GlobalEpoch] Using cached epoch from localStorage:', epoch.toISOString())
					cachedEpoch = epoch
					cacheTimestamp = parsed.timestamp
					return epoch
				}
			}
		} catch (localErr) {
			console.warn('[GlobalEpoch] Failed to read from localStorage:', localErr)
		}
		
		// Last resort: return a fixed epoch (ensures app still works)
		const fallbackEpoch = new Date('2020-01-01T00:00:00.000Z')
		console.warn('[GlobalEpoch] Using fallback epoch:', fallbackEpoch.toISOString())
		return fallbackEpoch
	}
}

/**
 * Clear cached epoch (force refresh on next fetch)
 */
export function clearEpochCache() {
	cachedEpoch = null
	cacheTimestamp = null
	try {
		localStorage.removeItem(EPOCH_CACHE_KEY)
	} catch (err) {
		console.warn('[GlobalEpoch] Failed to clear localStorage cache:', err)
	}
}

/**
 * Get cached epoch (if available)
 * @returns {Date|null} Cached epoch or null
 */
export function getCachedEpoch() {
	if (cachedEpoch && cacheTimestamp) {
		const age = Date.now() - cacheTimestamp
		if (age < EPOCH_CACHE_TTL) {
			return cachedEpoch
		}
	}
	return null
}

