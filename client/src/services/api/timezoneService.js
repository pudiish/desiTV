/**
 * timezoneService.js
 * 
 * Client-side timezone detection and management
 * Stores user's timezone preference
 */

const TIMEZONE_STORAGE_KEY = 'desitv-user-timezone'

/**
 * Detect user's timezone from browser
 * @returns {string} IANA timezone string (e.g., 'America/New_York')
 */
export function detectTimezone() {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone
	} catch (err) {
		console.warn('[Timezone] Failed to detect timezone:', err)
		return 'Asia/Kolkata' // Fallback to IST
	}
}

/**
 * Get stored timezone preference or detect
 * @returns {string} IANA timezone string
 */
export function getUserTimezone() {
	try {
		const stored = localStorage.getItem(TIMEZONE_STORAGE_KEY)
		if (stored) {
			return stored
		}
	} catch (err) {
		console.warn('[Timezone] Failed to read from localStorage:', err)
	}
	
	// Detect and store
	const detected = detectTimezone()
	setUserTimezone(detected)
	return detected
}

/**
 * Set user's timezone preference
 * @param {string} timezone - IANA timezone string
 */
export function setUserTimezone(timezone) {
	try {
		localStorage.setItem(TIMEZONE_STORAGE_KEY, timezone)
	} catch (err) {
		console.warn('[Timezone] Failed to save to localStorage:', err)
	}
}

/**
 * Get timezone-friendly name
 * @param {string} timezone - IANA timezone string
 * @returns {string} Friendly name
 */
export function getTimezoneName(timezone) {
	const offset = getTimezoneOffset(timezone)
	const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`
	
	const names = {
		'Asia/Kolkata': 'IST',
		'America/New_York': 'EST',
		'America/Los_Angeles': 'PST',
		'Europe/London': 'GMT',
		'Asia/Dubai': 'GST',
		'Asia/Singapore': 'SGT',
		'Australia/Sydney': 'AEST',
	}
	
	return names[timezone] || `UTC${offsetStr}`
}

/**
 * Get timezone offset from UTC in hours
 * @param {string} timezone - IANA timezone string
 * @returns {number} Offset in hours
 */
function getTimezoneOffset(timezone) {
	const now = new Date()
	const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
	const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
	return (localTime - utcTime) / (1000 * 60 * 60)
}

/**
 * Format time for display in timezone
 * @param {Date} date - Date to format
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted time
 */
export function formatTimeForTimezone(date, timezone) {
	return new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	}).format(date)
}

