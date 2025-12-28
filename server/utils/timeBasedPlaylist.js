/**
 * timeBasedPlaylist.js
 * 
 * Utility for selecting playlists based on time of day (9XM style)
 * Different playlists for morning, afternoon, evening, night
 * Supports timezone-aware playlist selection
 */

const { getCurrentTimeInTimezone, getHourInTimezone } = require('./timezone')

/**
 * Get current time in a specific timezone (defaults to IST)
 * @param {string} timezone - IANA timezone string (default: 'Asia/Kolkata')
 * @returns {Date} Current time in specified timezone
 */
function getCurrentTime(timezone = 'Asia/Kolkata') {
	return getCurrentTimeInTimezone(timezone)
}

/**
 * Get current IST time (India Standard Time) - backward compatible
 * @returns {Date} Current time in IST
 */
function getISTTime() {
	return getCurrentTime('Asia/Kolkata')
}

/**
 * Get current time slot based on hour in specified timezone
 * Supports custom time slot boundaries per channel
 * @param {string} timezone - IANA timezone string (default: 'Asia/Kolkata')
 * @param {Object} customTimeSlots - Optional custom time slot boundaries from channel
 * @returns {string} Time slot key ('morning', 'afternoon', 'evening', 'night')
 */
function getCurrentTimeSlot(timezone = 'Asia/Kolkata', customTimeSlots = null) {
	const hour = getHourInTimezone(timezone)
	
	// Use custom time slots if provided
	if (customTimeSlots) {
		if (customTimeSlots.morning && hour >= customTimeSlots.morning.start && hour < customTimeSlots.morning.end) {
			return 'morning'
		}
		if (customTimeSlots.lateMorning && hour >= customTimeSlots.lateMorning.start && hour < customTimeSlots.lateMorning.end) {
			return 'lateMorning'
		}
		if (customTimeSlots.afternoon && hour >= customTimeSlots.afternoon.start && hour < customTimeSlots.afternoon.end) {
			return 'afternoon'
		}
		if (customTimeSlots.evening && hour >= customTimeSlots.evening.start && hour < customTimeSlots.evening.end) {
			return 'evening'
		}
		if (customTimeSlots.primeTime && hour >= customTimeSlots.primeTime.start && hour < customTimeSlots.primeTime.end) {
			return 'primeTime'
		}
		if (customTimeSlots.night && hour >= customTimeSlots.night.start && hour < customTimeSlots.night.end) {
			return 'night'
		}
		if (customTimeSlots.lateNight && hour >= customTimeSlots.lateNight.start && hour < customTimeSlots.lateNight.end) {
			return 'lateNight'
		}
	}
	
	// Default time slots (IST-based)
	// Morning: 6 AM - 9 AM (Subah Savera vibes)
	if (hour >= 6 && hour < 9) {
		return 'morning'
	}
	// Late Morning: 9 AM - 12 PM (Dopahar Ki Dhun)
	if (hour >= 9 && hour < 12) {
		return 'lateMorning'
	}
	// Afternoon: 12 PM - 3 PM (After school, energetic)
	if (hour >= 12 && hour < 15) {
		return 'afternoon'
	}
	// Evening: 3 PM - 6 PM (Bacchon Ka Time)
	if (hour >= 15 && hour < 18) {
		return 'evening'
	}
	// Prime Time: 6 PM - 9 PM (Family time, Bollywood)
	if (hour >= 18 && hour < 21) {
		return 'primeTime'
	}
	// Night: 9 PM - 12 AM (Club Hours, party music)
	if (hour >= 21 && hour < 24) {
		return 'night'
	}
	// Late Night: 12 AM - 6 AM (Late Night Love, romantic)
	return 'lateNight'
}

/**
 * Get friendly time slot name for display
 * @param {string} timezone - IANA timezone string (default: 'Asia/Kolkata')
 * @returns {string} Friendly name
 */
function getTimeSlotName(timezone = 'Asia/Kolkata') {
	const slot = getCurrentTimeSlot(timezone)
	const names = {
		morning: 'Subah Savera ☀️',
		lateMorning: 'Dopahar Ki Dhun 🌤️',
		afternoon: 'Afternoon Beats 🎵',
		evening: 'Bacchon Ka Time 🎈',
		primeTime: 'Prime Time 🌅',
		night: 'Club Hours 🎉',
		lateNight: 'Late Night Love 🌙',
	}
	return names[slot] || 'Prime Time'
}

/**
 * Get greeting based on time of day
 * @param {string} timezone - IANA timezone string (default: 'Asia/Kolkata')
 * @returns {string} Greeting
 */
function getTimeBasedGreeting(timezone = 'Asia/Kolkata') {
	const hour = getHourInTimezone(timezone)
	
	if (hour >= 5 && hour < 12) {
		return 'SUPRABHAT! ☀️'
	} else if (hour >= 12 && hour < 17) {
		return 'NAMASTE! 🙏'
	} else if (hour >= 17 && hour < 21) {
		return 'SHUBH SANDHYA! 🌅'
	} else {
		return 'SHUBH RATRI! 🌙'
	}
}

/**
 * Select playlist from channel based on time slot
 * Falls back to default 'items' if time-based playlists not available
 * @param {Object} channel - Channel object
 * @param {string} timezone - IANA timezone string (default: 'Asia/Kolkata')
 * @param {Object} customSchedule - Optional custom schedule override
 * @returns {Array} Selected playlist items
 */
function selectPlaylistForTime(channel, timezone = 'Asia/Kolkata', customSchedule = null) {
	if (!channel) return []
	
	// Check for custom schedule (per-channel, per-day, special events)
	if (customSchedule && customSchedule.timeSlot) {
		const customPlaylist = channel.timeBasedPlaylists?.[customSchedule.timeSlot]
		if (customPlaylist && Array.isArray(customPlaylist) && customPlaylist.length > 0) {
			return customPlaylist
		}
	}
	
	// Check for day-specific schedules (e.g., weekend playlists)
	const dayOfWeek = getCurrentTime(timezone).getDay() // 0 = Sunday, 6 = Saturday
	if (channel.dayBasedPlaylists) {
		const dayKey = dayOfWeek === 0 ? 'sunday' : dayOfWeek === 6 ? 'saturday' : 'weekday'
		const dayPlaylist = channel.dayBasedPlaylists[dayKey]
		if (dayPlaylist && dayPlaylist[getCurrentTimeSlot(timezone)]) {
			const playlist = dayPlaylist[getCurrentTimeSlot(timezone)]
			if (Array.isArray(playlist) && playlist.length > 0) {
				return playlist
			}
		}
	}
	
	const timeSlot = getCurrentTimeSlot(timezone, channel.customTimeSlots)
	
	// Check if channel has time-based playlists
	if (channel.timeBasedPlaylists && channel.timeBasedPlaylists[timeSlot]) {
		const playlist = channel.timeBasedPlaylists[timeSlot]
		// Ensure it's an array and has items
		if (Array.isArray(playlist) && playlist.length > 0) {
			return playlist
		}
	}
	
	// Fallback to default items array
	if (Array.isArray(channel.items) && channel.items.length > 0) {
		return channel.items
	}
	
	return []
}

/**
 * Get time until next time slot change (in seconds)
 * Supports custom time slot boundaries
 * @param {string} timezone - IANA timezone string (default: 'Asia/Kolkata')
 * @param {Object} customTimeSlots - Optional custom time slot boundaries
 * @returns {number} Seconds until next slot change
 */
function getSecondsUntilNextSlot(timezone = 'Asia/Kolkata', customTimeSlots = null) {
	const currentTime = getCurrentTime(timezone)
	const hour = currentTime.getHours()
	const minute = currentTime.getMinutes()
	const second = currentTime.getSeconds()
	
	let nextHour = 0
	let nextMinute = 0
	
	// Use custom boundaries if provided
	if (customTimeSlots) {
		const currentSlot = getCurrentTimeSlot(timezone, customTimeSlots)
		const boundaries = [
			{ slot: 'morning', hour: customTimeSlots.morning?.end || 9 },
			{ slot: 'lateMorning', hour: customTimeSlots.lateMorning?.end || 12 },
			{ slot: 'afternoon', hour: customTimeSlots.afternoon?.end || 15 },
			{ slot: 'evening', hour: customTimeSlots.evening?.end || 18 },
			{ slot: 'primeTime', hour: customTimeSlots.primeTime?.end || 21 },
			{ slot: 'night', hour: customTimeSlots.night?.end || 24 },
			{ slot: 'lateNight', hour: customTimeSlots.lateNight?.end || 6 },
		]
		
		// Find next boundary for current slot
		const currentIndex = boundaries.findIndex(b => b.slot === currentSlot)
		if (currentIndex >= 0) {
			const nextBoundary = boundaries[(currentIndex + 1) % boundaries.length]
			nextHour = nextBoundary.hour
			nextMinute = 0
		}
	} else {
		// Default boundaries
		if (hour < 6) {
			nextHour = 6
			nextMinute = 0
		} else if (hour < 9) {
			nextHour = 9
			nextMinute = 0
		} else if (hour < 12) {
			nextHour = 12
			nextMinute = 0
		} else if (hour < 15) {
			nextHour = 15
			nextMinute = 0
		} else if (hour < 18) {
			nextHour = 18
			nextMinute = 0
		} else if (hour < 21) {
			nextHour = 21
			nextMinute = 0
		} else if (hour < 24) {
			nextHour = 24
			nextMinute = 0
		} else {
			nextHour = 6
			nextMinute = 0
		}
	}
	
	// Calculate seconds until next boundary
	const currentSeconds = hour * 3600 + minute * 60 + second
	const nextSeconds = nextHour * 3600 + nextMinute * 60
	const diff = nextSeconds - currentSeconds
	
	// Handle wrap-around (midnight)
	return diff >= 0 ? diff : diff + 86400 // 24 hours in seconds
}

module.exports = {
	getISTTime,
	getCurrentTime,
	getCurrentTimeSlot,
	getTimeSlotName,
	getTimeBasedGreeting,
	selectPlaylistForTime,
	getSecondsUntilNextSlot,
}

