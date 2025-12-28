/**
 * Request Deduplication Utility
 * 
 * Prevents duplicate API requests by caching in-flight requests
 * Reduces network load and improves performance
 */

const requestCache = new Map()
const CACHE_DURATION = 1000 // 1 second

/**
 * Deduplicated fetch - prevents duplicate requests
 * @param {string} url - Request URL
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function dedupeFetch(url, options = {}) {
	// Create cache key from URL and options
	const cacheKey = `${url}:${JSON.stringify(options)}`
	
	// Check if request is already in flight
	if (requestCache.has(cacheKey)) {
		const cachedPromise = requestCache.get(cacheKey)
		// Return existing promise (deduplication)
		return cachedPromise.then(response => response.clone())
	}

	// Create new request
	const requestPromise = fetch(url, options)
		.then(response => {
			// Cache successful responses briefly
			if (response.ok) {
				setTimeout(() => {
					requestCache.delete(cacheKey)
				}, CACHE_DURATION)
			} else {
				// Remove immediately on error
				requestCache.delete(cacheKey)
			}
			return response
		})
		.catch(error => {
			// Remove on error
			requestCache.delete(cacheKey)
			throw error
		})

	// Store in cache
	requestCache.set(cacheKey, requestPromise)

	return requestPromise
}

/**
 * Clear request cache (for testing or manual cleanup)
 */
export function clearRequestCache() {
	requestCache.clear()
}

/**
 * Get cache size (for monitoring)
 * @returns {number}
 */
export function getRequestCacheSize() {
	return requestCache.size
}

