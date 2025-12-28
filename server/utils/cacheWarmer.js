/**
 * Cache Warmer - Pre-loads frequently accessed data into cache
 * 
 * Strategy: Pre-warm cache on startup to eliminate cold start misses
 * - Loads all channels into cache
 * - Runs in background periodically
 * - Handles errors gracefully
 */

const Channel = require('../models/Channel')
const cache = require('./cache')

const CACHE_TTL = {
	CHANNELS_LIST: 300, // 5 minutes (extended since write-through ensures consistency)
	CHANNEL_DETAIL: 600, // 10 minutes (extended since write-through ensures consistency)
}

/**
 * Minimize channel data for caching (only essential fields)
 */
function minimizeChannel(ch) {
	return {
		_id: ch._id,
		name: ch.name,
		playlistStartEpoch: ch.playlistStartEpoch,
		timezone: ch.timezone,
		items: (ch.items || []).map(item => ({
			_id: item._id,
			youtubeId: item.youtubeId || item.videoId, // Support both
			title: item.title,
			duration: item.duration,
			thumbnail: item.thumbnail,
		})),
		// Only include time-based playlists if they exist
		timeBasedPlaylists: ch.timeBasedPlaylists ? Object.keys(ch.timeBasedPlaylists).reduce((acc, slot) => {
			if (ch.timeBasedPlaylists[slot] && ch.timeBasedPlaylists[slot].length > 0) {
				acc[slot] = ch.timeBasedPlaylists[slot].map(item => ({
					_id: item._id,
					youtubeId: item.youtubeId || item.videoId,
					title: item.title,
					duration: item.duration,
				}))
			}
			return acc
		}, {}) : undefined,
	}
}

/**
 * Minimize channels list for caching
 */
function minimizeChannels(channels) {
	return channels.map(ch => ({
		_id: ch._id,
		name: ch.name,
		playlistStartEpoch: ch.playlistStartEpoch,
		items: (ch.items || []).map(item => ({
			_id: item._id,
			youtubeId: item.youtubeId || item.videoId,
			title: item.title,
			duration: item.duration,
			thumbnail: item.thumbnail,
		})),
	}))
}

/**
 * Pre-warm channels list cache
 */
async function warmChannelsList() {
	try {
		console.log('[CacheWarmer] 🔥 Pre-warming channels list cache...')
		
		const channels = await Channel.find()
			.select('name playlistStartEpoch items._id items.youtubeId items.title items.duration items.thumbnail')
			.lean()
		
		const minimized = minimizeChannels(channels)
		
		await cache.set('ch:all', minimized, CACHE_TTL.CHANNELS_LIST)
		
		console.log(`[CacheWarmer] ✅ Pre-warmed channels list: ${channels.length} channels`)
		return minimized
	} catch (err) {
		console.error('[CacheWarmer] ❌ Failed to pre-warm channels list:', err.message)
		return null
	}
}

/**
 * Pre-warm single channel cache
 */
async function warmChannel(channelId) {
	try {
		const channelHash = channelId.toString().substring(18, 24)
		const cacheKey = `ch:${channelHash}`
		
		const ch = await Channel.findById(channelId).lean()
		if (!ch) {
			console.warn(`[CacheWarmer] Channel not found: ${channelId}`)
			return null
		}
		
		const minimized = minimizeChannel(ch)
		await cache.set(cacheKey, minimized, CACHE_TTL.CHANNEL_DETAIL)
		
		console.log(`[CacheWarmer] ✅ Pre-warmed channel: ${ch.name}`)
		return minimized
	} catch (err) {
		console.error(`[CacheWarmer] ❌ Failed to pre-warm channel ${channelId}:`, err.message)
		return null
	}
}

/**
 * Pre-warm all channels cache
 */
async function warmAllChannels() {
	try {
		console.log('[CacheWarmer] 🔥 Pre-warming all channels cache...')
		
		// First, warm the list
		await warmChannelsList()
		
		// Then, warm individual channels
		const channels = await Channel.find().select('_id').lean()
		let warmed = 0
		
		for (const ch of channels) {
			await warmChannel(ch._id)
			warmed++
		}
		
		console.log(`[CacheWarmer] ✅ Pre-warmed ${warmed} individual channels`)
		return warmed
	} catch (err) {
		console.error('[CacheWarmer] ❌ Failed to pre-warm all channels:', err.message)
		return 0
	}
}

/**
 * Start periodic cache warming (every 5 minutes)
 */
let warmingInterval = null

function startPeriodicWarming(intervalMinutes = 5) {
	if (warmingInterval) {
		clearInterval(warmingInterval)
	}
	
	warmingInterval = setInterval(async () => {
		console.log('[CacheWarmer] 🔄 Periodic cache refresh...')
		await warmChannelsList()
	}, intervalMinutes * 60 * 1000)
	
	console.log(`[CacheWarmer] ✅ Started periodic warming (every ${intervalMinutes} minutes)`)
}

function stopPeriodicWarming() {
	if (warmingInterval) {
		clearInterval(warmingInterval)
		warmingInterval = null
		console.log('[CacheWarmer] ⏹️  Stopped periodic warming')
	}
}

module.exports = {
	warmChannelsList,
	warmChannel,
	warmAllChannels,
	startPeriodicWarming,
	stopPeriodicWarming,
	minimizeChannel,
	minimizeChannels,
	CACHE_TTL,
}

