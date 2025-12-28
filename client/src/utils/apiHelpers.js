/**
 * apiHelpers.js
 * 
 * Helper functions for API calls with timezone support
 */

import { getUserTimezone } from '../services/api/timezoneService'

/**
 * Add timezone to fetch request
 * @param {string} url - API URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export async function fetchWithTimezone(url, options = {}) {
	const timezone = getUserTimezone()
	
	// Add timezone to URL if not already present
	const urlObj = new URL(url, window.location.origin)
	if (!urlObj.searchParams.has('timezone')) {
		urlObj.searchParams.set('timezone', timezone)
	}
	
	// Add timezone to headers as well
	const headers = {
		'x-timezone': timezone,
		...options.headers,
	}
	
	return fetch(urlObj.toString(), {
		...options,
		headers,
	})
}

/**
 * Get timezone-aware API URL
 * @param {string} baseUrl - Base API URL
 * @returns {string} URL with timezone parameter
 */
export function getTimezoneAwareUrl(baseUrl) {
	const timezone = getUserTimezone()
	const url = new URL(baseUrl, window.location.origin)
	url.searchParams.set('timezone', timezone)
	return url.toString()
}

