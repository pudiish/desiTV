/**
 * timezone.js
 * 
 * Timezone utilities for regional support
 * Converts IST-based playlists to user's local timezone
 */

/**
 * Get user's timezone from request headers or default to IST
 * @param {Object} req - Express request object
 * @returns {string} IANA timezone string (e.g., 'America/New_York', 'Asia/Kolkata')
 */
function getUserTimezone(req) {
	// Check for timezone in query params (user preference)
	if (req.query?.timezone) {
		return req.query.timezone
	}
	
	// Check for timezone in headers (from client)
	if (req.headers['x-timezone']) {
		return req.headers['x-timezone']
	}
	
	// Check for Accept-Language timezone hint (if available)
	// This is a fallback - most browsers don't send this
	
	// Default to IST (Asia/Kolkata)
	return 'Asia/Kolkata'
}

/**
 * Convert IST time to user's timezone
 * @param {Date} istTime - Time in IST
 * @param {string} targetTimezone - Target timezone (IANA string)
 * @returns {Date} Time in target timezone
 */
function convertToTimezone(istTime, targetTimezone) {
	if (targetTimezone === 'Asia/Kolkata') {
		return istTime // No conversion needed
	}
	
	// Create a date formatter for the target timezone
	const formatter = new Intl.DateTimeFormat('en-US', {
		timeZone: targetTimezone,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	})
	
	// Format IST time to target timezone
	const parts = formatter.formatToParts(istTime)
	const year = parseInt(parts.find(p => p.type === 'year').value)
	const month = parseInt(parts.find(p => p.type === 'month').value) - 1 // 0-indexed
	const day = parseInt(parts.find(p => p.type === 'day').value)
	const hour = parseInt(parts.find(p => p.type === 'hour').value)
	const minute = parseInt(parts.find(p => p.type === 'minute').value)
	const second = parseInt(parts.find(p => p.type === 'second').value)
	
	// Create new date in target timezone
	return new Date(year, month, day, hour, minute, second)
}

/**
 * Get current time in a specific timezone
 * @param {string} timezone - IANA timezone string
 * @returns {Date} Current time in that timezone
 */
function getCurrentTimeInTimezone(timezone) {
	const now = new Date()
	return convertToTimezone(now, timezone)
}

/**
 * Get hour in a specific timezone
 * @param {string} timezone - IANA timezone string
 * @returns {number} Hour (0-23)
 */
function getHourInTimezone(timezone) {
	const time = getCurrentTimeInTimezone(timezone)
	return time.getHours()
}

/**
 * Get timezone offset from UTC in hours
 * @param {string} timezone - IANA timezone string
 * @returns {number} Offset in hours (e.g., 5.5 for IST, -5 for EST)
 */
function getTimezoneOffset(timezone) {
	const now = new Date()
	const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
	const localTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
	return (localTime - utcTime) / (1000 * 60 * 60)
}

/**
 * Format time for display in user's timezone
 * @param {Date} date - Date to format
 * @param {string} timezone - IANA timezone string
 * @returns {string} Formatted time string
 */
function formatTimeForTimezone(date, timezone) {
	return new Intl.DateTimeFormat('en-US', {
		timeZone: timezone,
		hour: 'numeric',
		minute: '2-digit',
		hour12: true,
	}).format(date)
}

/**
 * Get timezone-friendly name
 * @param {string} timezone - IANA timezone string
 * @returns {string} Friendly name (e.g., "IST", "EST", "PST")
 */
function getTimezoneName(timezone) {
	const offset = getTimezoneOffset(timezone)
	const offsetStr = offset >= 0 ? `+${offset}` : `${offset}`
	
	// Common timezone names
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

module.exports = {
	getUserTimezone,
	convertToTimezone,
	getCurrentTimeInTimezone,
	getHourInTimezone,
	getTimezoneOffset,
	formatTimeForTimezone,
	getTimezoneName,
}

