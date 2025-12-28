/**
 * positionCalculator.js
 * 
 * Server-side position calculation for pseudolive broadcasts
 * Uses global epoch for true synchronization across all users
 * Supports time-based playlists for authentic 9XM experience
 */

const { selectPlaylistForTime, getCurrentTimeSlot, getTimeSlotName, getSecondsUntilNextSlot } = require('./timeBasedPlaylist')
const GlobalEpoch = require('../models/GlobalEpoch')
const cache = require('./cache')

// Cache TTL for position calculations (2 seconds - optimized for faster sync)
// Reduced from 5s to 2s for faster synchronization while staying within free tier limits
// With compression and write-through caching, 2s TTL is safe and provides 2.5x faster sync
const POSITION_CACHE_TTL = 2

// Default video duration if not specified
const DEFAULT_VIDEO_DURATION = 300 // 5 minutes

/**
 * Get next time slot
 * @param {string} currentSlot - Current time slot
 * @returns {string} Next time slot
 */
function getNextTimeSlot(currentSlot) {
	const slots = ['morning', 'lateMorning', 'afternoon', 'evening', 'primeTime', 'night', 'lateNight']
	const currentIndex = slots.indexOf(currentSlot)
	return slots[(currentIndex + 1) % slots.length]
}

/**
 * Calculate current position in playlist based on global epoch
 * @param {Object} channel - Channel object
 * @param {Date} globalEpoch - Global epoch (from server)
 * @param {string} timezone - User's timezone (default: 'Asia/Kolkata')
 * @returns {Object} Position object with videoIndex, offset, etc.
 */
function calculatePosition(channel, globalEpoch, timezone = 'Asia/Kolkata') {
	if (!channel) {
		return {
			videoIndex: -1,
			offset: 0,
			item: null,
			error: 'No channel provided',
		}
	}

	// Select playlist based on current time and timezone
	const playlist = selectPlaylistForTime(channel, timezone)
	
	if (!playlist || playlist.length === 0) {
		return {
			videoIndex: -1,
			offset: 0,
			item: null,
			error: 'No items in playlist',
		}
	}

	// Calculate durations
	const durations = playlist.map(item => 
		(typeof item.duration === 'number' && item.duration > 0) 
			? item.duration 
			: DEFAULT_VIDEO_DURATION
	)
	
	const totalDuration = durations.reduce((sum, d) => sum + d, 0)
	
	if (totalDuration === 0) {
		return {
			videoIndex: 0,
			offset: 0,
			item: playlist[0] || null,
			error: 'Zero total duration',
		}
	}

	// Calculate elapsed time from global epoch
	const now = new Date()
	const elapsedMs = now.getTime() - globalEpoch.getTime()
	const elapsedSec = Math.floor(elapsedMs / 1000)
	
	// Calculate position in current cycle
	const cyclePosition = elapsedSec % totalDuration
	
	// Find current video
	let cumulative = 0
	let videoIndex = 0
	let offset = 0
	
	for (let i = 0; i < durations.length; i++) {
		const videoDuration = durations[i]
		const videoEnd = cumulative + videoDuration
		
		if (cyclePosition >= cumulative && cyclePosition < videoEnd) {
			videoIndex = i
			offset = cyclePosition - cumulative
			break
		}
		
		cumulative = videoEnd
	}
	
	// Ensure valid index
	if (videoIndex < 0 || videoIndex >= playlist.length) {
		videoIndex = 0
		offset = 0
	}
	
	const currentItem = playlist[videoIndex] || null
	
	// Calculate next video
	const nextIndex = (videoIndex + 1) % playlist.length
	const nextItem = playlist[nextIndex] || null
	const currentVideoDuration = durations[videoIndex] || DEFAULT_VIDEO_DURATION
	const timeRemaining = Math.max(0, currentVideoDuration - offset)
	
	return {
		videoIndex,
		offset: Math.max(0, Math.min(offset, currentVideoDuration)),
		item: currentItem,
		nextIndex,
		nextItem,
		timeRemaining,
		cyclePosition,
		totalDuration,
		elapsedSec,
		cycleCount: Math.floor(elapsedSec / totalDuration),
		playlistLength: playlist.length,
	}
}

/**
 * Get cached or calculate position for a channel
 * @param {Object} channel - Channel object
 * @param {string} timezone - User's timezone (default: 'Asia/Kolkata')
 * @param {Object} req - Express request object (optional, for timezone detection)
 * @returns {Promise<Object>} Position object
 */
async function getCachedPosition(channel, timezone = null, req = null) {
	if (!channel || !channel._id) {
		return {
			videoIndex: -1,
			offset: 0,
			error: 'Invalid channel',
		}
	}

	// Get user timezone
	const userTimezone = timezone || (req ? getUserTimezone(req) : 'Asia/Kolkata')
	
	// OPTIMIZED: Ultra-short cache key for free tier
	const channelHash = channel._id.toString().substring(18, 24) // Last 6 chars (more unique)
	const tzHash = userTimezone === 'Asia/Kolkata' ? 'IST' : userTimezone.substring(0, 3)
	const cacheKey = `p:${channelHash}:${tzHash}` // Ultra-short: "p:" instead of "pos:"
	const cached = await cache.get(cacheKey)
	if (cached) {
		// Reconstruct full position from minimal cache
		return {
			videoIndex: cached.v || cached.videoIndex || 0,
			offset: cached.o || cached.offset || 0,
			currentTimeSlot: cached.ts || cached.timeSlot,
			nextTimeSlot: cached.ns || cached.nextSlot,
			secondsUntilNextSlot: cached.su || cached.secUntilNext || 0,
			// Calculate other fields on-demand
			timezone: userTimezone,
			timeSlotName: getTimeSlotName(userTimezone),
			isTransitioning: (cached.su || cached.secUntilNext || 0) < 60,
		}
	}

	// Get global epoch
	const globalEpoch = await GlobalEpoch.getCurrentEpoch()
	
	// Calculate position with timezone
	const position = calculatePosition(channel, globalEpoch, userTimezone)
	
	// Add transition info
	const secondsUntilNextSlot = getSecondsUntilNextSlot(userTimezone, channel.customTimeSlots)
	const currentTimeSlot = getCurrentTimeSlot(userTimezone, channel.customTimeSlots)
	const nextTimeSlot = getNextTimeSlot(currentTimeSlot)
	
	position.timezone = userTimezone
	position.currentTimeSlot = currentTimeSlot
	position.timeSlotName = getTimeSlotName(userTimezone)
	position.secondsUntilNextSlot = secondsUntilNextSlot
	position.nextTimeSlot = nextTimeSlot
	position.isTransitioning = secondsUntilNextSlot < 60 // Less than 1 minute = transitioning
	
	// OPTIMIZED: Ultra-minimal cached position data for free tier
	// Only cache numbers (smallest possible size)
	const minimizedPosition = {
		v: position.videoIndex, // 'v' instead of 'videoIndex' (saves 8 bytes)
		o: position.offset, // 'o' instead of 'offset' (saves 4 bytes)
		ts: position.currentTimeSlot, // 'ts' instead of 'timeSlot' (saves 6 bytes)
		ns: position.nextTimeSlot, // 'ns' instead of 'nextSlot' (saves 5 bytes)
		su: position.secondsUntilNextSlot, // 'su' instead of 'secUntilNext' (saves 8 bytes)
		// Total savings: ~31 bytes per cached position
	}
	
	// Cache for 5 seconds (optimized TTL)
	await cache.set(cacheKey, minimizedPosition, POSITION_CACHE_TTL)
	
	// Return full position with item
	return position
	
	return position
}

/**
 * Batch calculate positions for multiple channels
 * @param {Array<Object>} channels - Array of channel objects
 * @param {string} timezone - User's timezone (default: 'Asia/Kolkata')
 * @returns {Promise<Object>} Map of channelId -> position
 */
async function batchCalculatePositions(channels, timezone = 'Asia/Kolkata') {
	if (!Array.isArray(channels) || channels.length === 0) {
		return {}
	}

	// Get global epoch once (shared for all channels)
	const globalEpoch = await GlobalEpoch.getCurrentEpoch()
	
	const positions = {}
	
	for (const channel of channels) {
		if (!channel || !channel._id) continue
		
		// OPTIMIZED: Ultra-short cache key
		const channelHash = channel._id.toString().substring(18, 24)
		const tzHash = timezone === 'Asia/Kolkata' ? 'IST' : timezone.substring(0, 3)
		const cacheKey = `p:${channelHash}:${tzHash}`
		const cached = await cache.get(cacheKey)
		if (cached) {
			positions[channel._id] = cached
			continue
		}
		
		// Calculate position with timezone
		const position = calculatePosition(channel, globalEpoch, timezone)
		
		// Add transition info
		const secondsUntilNextSlot = getSecondsUntilNextSlot(timezone, channel.customTimeSlots)
		const currentTimeSlot = getCurrentTimeSlot(timezone, channel.customTimeSlots)
		
		position.timezone = timezone
		position.currentTimeSlot = currentTimeSlot
		position.timeSlotName = getTimeSlotName(timezone)
		position.secondsUntilNextSlot = secondsUntilNextSlot
		position.isTransitioning = secondsUntilNextSlot < 60
		
		positions[channel._id] = position
		
		// Cache for 5 seconds
		await cache.set(cacheKey, position, POSITION_CACHE_TTL)
	}
	
	return positions
}

module.exports = {
	calculatePosition,
	getCachedPosition,
	batchCalculatePositions,
}

