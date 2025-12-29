/**
 * globalEpochService.js
 * 
 * Service for fetching and managing the global epoch from server
 * This ensures all users are synchronized to the same timeline
 */

import { getUserTimezone } from './timezoneService'
import { dedupeFetch } from '../../utils/requestDeduplication'
import { validateAndRefreshEpoch } from '../../utils/checksumValidator'

const EPOCH_CACHE_KEY = 'desitv-global-epoch-cached'
const EPOCH_CACHE_TTL = 10 * 1000 // 10 seconds - increased to reduce request frequency

let cachedEpoch = null
let cacheTimestamp = null

/**
 * Fetch global epoch from server
 * CRITICAL: Always fetches fresh from server to ensure sync across devices
 * @param {boolean} forceRefresh - Force refresh even if cache is valid
 * @returns {Promise<Date>} Global epoch date
 */
export async function fetchGlobalEpoch(forceRefresh = false) {
	// Only use cache if not forcing refresh and cache is still valid
	if (!forceRefresh && cachedEpoch && cacheTimestamp) {
		const age = Date.now() - cacheTimestamp
		if (age < EPOCH_CACHE_TTL) {
			return cachedEpoch
		}
	}
	
	try {
		// Always fetch from server (no-cache to prevent browser caching)
		// PERFORMANCE: Use dedupeFetch to prevent duplicate requests
		// OPTIMIZED: Enhanced cache-busting headers for faster sync
		let response
		try {
			// Try using dedupeFetch if available
			if (typeof dedupeFetch === 'function') {
				response = await dedupeFetch('/api/global-epoch', {
					cache: 'no-store',
					headers: {
						'Cache-Control': 'no-cache, no-store, must-revalidate',
						'Pragma': 'no-cache',
						'Expires': '0',
					}
				})
			} else {
				// Fallback to regular fetch
				response = await fetch('/api/global-epoch', {
					cache: 'no-store',
					headers: {
						'Cache-Control': 'no-cache, no-store, must-revalidate',
						'Pragma': 'no-cache',
						'Expires': '0',
					}
				})
			}
		} catch (fetchErr) {
			// If dedupeFetch fails, try regular fetch
			response = await fetch('/api/global-epoch', {
				cache: 'no-store',
				headers: {
					'Cache-Control': 'no-cache, no-store, must-revalidate',
					'Pragma': 'no-cache',
					'Expires': '0',
				}
			})
		}
		
		if (!response.ok) {
			throw new Error(`Failed to fetch global epoch: ${response.statusText}`)
		}
		
		const data = await response.json()
		const epoch = new Date(data.epoch)
		
		// Validate epoch is valid
		if (isNaN(epoch.getTime())) {
			throw new Error('Invalid epoch date received from server')
		}
		
		// VALIDATION: Check checksum if provided (silent background sync)
		if (data.checksum && cachedEpoch) {
			const needsRefresh = await validateAndRefreshEpoch(
				cachedEpoch,
				data.checksum,
				async () => {
					// Silent refresh - already fetched, just update cache
					cachedEpoch = epoch
					cacheTimestamp = Date.now()
				}
			)
			if (needsRefresh) {
				console.log('[GlobalEpoch] ✅ Silently synced epoch (checksum mismatch fixed)')
			}
		}
		
		// Check if epoch changed (shouldn't happen, but log if it does)
		if (cachedEpoch && cachedEpoch.getTime() !== epoch.getTime()) {
			console.warn(`[GlobalEpoch] ⚠️ Epoch changed! Old: ${cachedEpoch.toISOString()}, New: ${epoch.toISOString()}`)
		}
		
		// Update cache
		cachedEpoch = epoch
		cacheTimestamp = Date.now()
		
		// Also cache in localStorage as backup (but server is source of truth)
		try {
			localStorage.setItem(EPOCH_CACHE_KEY, JSON.stringify({
				epoch: epoch.toISOString(),
				timestamp: cacheTimestamp,
			}))
		} catch (err) {
			console.warn('[GlobalEpoch] Failed to cache in localStorage:', err)
		}
		
		console.log('[GlobalEpoch] ✅ Fetched from server:', epoch.toISOString())
		return epoch
	} catch (err) {
		console.error('[GlobalEpoch] ❌ Error fetching from server:', err)
		
		// Only use localStorage cache if server is completely unavailable
		// This prevents desync - we'd rather wait for server than use stale data
		try {
			const cached = localStorage.getItem(EPOCH_CACHE_KEY)
			if (cached) {
				const parsed = JSON.parse(cached)
				const epoch = new Date(parsed.epoch)
				const age = Date.now() - parsed.timestamp
				
				// Only use cached if less than 10 minutes old (very short window)
				if (age < 10 * 60 * 1000 && !isNaN(epoch.getTime())) {
					console.warn('[GlobalEpoch] ⚠️ Using cached epoch (server unavailable):', epoch.toISOString())
					cachedEpoch = epoch
					cacheTimestamp = parsed.timestamp
					return epoch
				} else {
					console.warn('[GlobalEpoch] ⚠️ Cached epoch too old, waiting for server')
				}
			}
		} catch (localErr) {
			console.warn('[GlobalEpoch] Failed to read from localStorage:', localErr)
		}
		
		// Don't use fallback - throw error instead
		// This forces retry and prevents desync
		throw new Error('Failed to fetch global epoch from server and no valid cache available')
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

