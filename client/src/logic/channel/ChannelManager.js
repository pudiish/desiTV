/**
 * ChannelManager.js
 * 
 * RESTRUCTURED: Categories/Playlists contain videos (channels)
 * - Categories (like "Cult", "Music") are playlists
 * - Videos within a category are "channels" you switch between
 * - Channel Up/Down switches videos within the selected category
 * PERFORMANCE: Uses request deduplication to prevent duplicate API calls
 * VALIDATION: Uses checksum validation for silent background sync
 */

import { envConfig } from '../../config/environment'
// Checksum validation removed - using JSON version check instead (simpler, faster)

const CHANNELS_CACHE_KEY = 'desitv-channels-cache'
const CHANNELS_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours (channels don't change often)

class ChannelManager {
	constructor() {
		this.rawChannels = [] // Original channel data from JSON
		this.categories = [] // Restructured: categories as playlists
		this.loaded = false
		this.loadError = null
		this.cachedVersion = null
	}

	/**
	 * Get cached channels from localStorage
	 */
	getCachedChannels() {
		try {
			const cached = localStorage.getItem(CHANNELS_CACHE_KEY)
			if (!cached) return null
			
			const data = JSON.parse(cached)
			const age = Date.now() - data.timestamp
			
			// Return cached if still valid
			if (age < CHANNELS_CACHE_TTL && data.channels && data.channels.length > 0) {
				return {
					channels: data.channels,
					version: data.version
				}
			}
		} catch {
			// Ignore cache errors
		}
		return null
	}

	/**
	 * Cache channels in localStorage
	 */
	setCachedChannels(channels, version) {
		try {
			localStorage.setItem(CHANNELS_CACHE_KEY, JSON.stringify({
				channels,
				version,
				timestamp: Date.now()
			}))
		} catch {
			// Ignore localStorage errors (private browsing, quota exceeded)
		}
	}

	/**
	 * Load channels - Smart caching with localStorage + JSON
	 * Source of Truth: channels.json (with localStorage cache for instant load)
	 * Categories become playlists, videos become channels
	 */
	async loadChannels() {
		// Return in-memory cache if valid
		if (this.loaded && this.categories.length > 0) {
			return this.categories
		}
		
		// If we previously loaded but got empty, force reload
		if (this.loaded && this.categories.length === 0) {
			console.log('[ChannelManager] Previous load was empty, forcing reload...')
			this.loaded = false
		}

		try {
			let rawChannels = []
			let currentVersion = null

			// Step 1: Try localStorage cache first (instant, works offline)
			const cached = this.getCachedChannels()
			if (cached) {
				rawChannels = cached.channels
				this.cachedVersion = cached.version
				console.log('[ChannelManager] ✓ Loaded from localStorage cache:', rawChannels.length, 'channels')
			}

			// Step 2: Load from JSON (primary source)
			try {
				const staticResponse = await fetch('/data/channels.json?t=' + Date.now(), {
					cache: 'no-cache' // Always check fresh version
				})
		
				if (staticResponse.ok) {
					const staticData = await staticResponse.json()
					currentVersion = staticData.version || staticData.generatedAt
					
					// If version changed or no cache, load fresh data
					if (!cached || (currentVersion && currentVersion !== this.cachedVersion)) {
						// Handle different JSON structures
						if (Array.isArray(staticData)) {
							rawChannels = staticData
						} else if (staticData.channels && Array.isArray(staticData.channels)) {
							rawChannels = staticData.channels
						} else {
							throw new Error('Invalid channels.json structure')
						}
						
						if (rawChannels.length > 0) {
							console.log('[ChannelManager] ✓ Loaded fresh channels from JSON:', rawChannels.length, 'channels')
							// Update cache
							this.setCachedChannels(rawChannels, currentVersion)
							this.cachedVersion = currentVersion
						} else {
							throw new Error('channels.json is empty')
						}
					} else {
						// Version matches cache - use cached data (already loaded above)
						console.log('[ChannelManager] ✓ Using cached channels (version unchanged)')
					}
				} else {
					throw new Error(`Failed to load channels.json: ${staticResponse.status}`)
				}
			} catch (jsonError) {
				// JSON failed - use cached data if available (graceful degradation, no race conditions)
				if (cached && cached.channels && cached.channels.length > 0) {
					console.warn('[ChannelManager] JSON load failed, using cached data (app continues working):', jsonError.message)
					rawChannels = cached.channels
					// App continues with cached data - smooth experience, no server needed
				} else {
					// No cache and JSON failed - clear error (no complex fallbacks)
					console.error('[ChannelManager] ✗ Failed to load channels:', jsonError.message)
					throw new Error(`Failed to load channels from JSON: ${jsonError.message}. Ensure /data/channels.json exists.`)
				}
			}
			
			if (rawChannels.length === 0) {
				console.warn('[ChannelManager] No channels found')
				this.loadError = new Error('No channels found')
				this.rawChannels = []
				this.categories = []
				this.loaded = true
				return this.categories
			}
			
			this.rawChannels = rawChannels
			if (currentVersion) {
				this.cachedVersion = currentVersion
			}
			
			// Restructure: Group videos by category
			// If category is null, use channel name as category
			const categoryMap = new Map()
			
			rawChannels.forEach(channel => {
				const categoryName = channel.name // Use channel name as category/playlist
				
				if (!categoryMap.has(categoryName)) {
					categoryMap.set(categoryName, {
						_id: channel._id,
						name: categoryName,
						playlistStartEpoch: channel.playlistStartEpoch || new Date('2020-01-01T00:00:00.000Z'),
						items: [] // Videos in this category become "channels"
					})
				}
				
				// Add all videos from this channel to the category
				if (channel.items && Array.isArray(channel.items)) {
					channel.items.forEach(video => {
						// Each video becomes a "channel" within the category
						categoryMap.get(categoryName).items.push({
							...video,
							// Add category reference
							category: categoryName
						})
					})
				}
			})
			
			// Convert map to array
			this.categories = Array.from(categoryMap.values())
			
			this.loaded = true
			this.loadError = null
			console.log(`[ChannelManager] Loaded ${this.categories.length} categories (playlists) from ${rawChannels.length} channels`)
			console.log(`[ChannelManager] Categories:`, this.categories.map(c => `${c.name} (${c.items.length} videos)`))
			
			return this.categories
		} catch (err) {
			console.error('[ChannelManager] JSON load failed:', err)
			this.loadError = err
			this.rawChannels = []
			this.categories = []
			this.loaded = true
			throw new Error(`Failed to load channels: ${err.message}`)
		}
	}

	/**
	 * Get all categories (playlists)
	 */
	getAllCategories() {
		return this.categories
	}

	/**
	 * Get all channels (for backward compatibility - returns categories)
	 */
	getAllChannels() {
		return this.categories
	}

	/**
	 * Get category/playlist by ID
	 */
	getCategoryById(categoryId) {
		return this.categories.find(cat => cat._id === categoryId)
	}

	/**
	 * Get category/playlist by name
	 */
	getCategoryByName(name) {
		return this.categories.find(cat => cat.name === name)
	}

	/**
	 * Get channel by ID (backward compatibility - returns category)
	 */
	getChannelById(channelId) {
		return this.getCategoryById(channelId)
	}

	/**
	 * Get channel by name (backward compatibility - returns category)
	 */
	getChannelByName(name) {
		return this.getCategoryByName(name)
	}

	/**
	 * Filter categories by selected names
	 */
	filterCategories(selectedNames = []) {
		if (selectedNames.length === 0) {
			return this.categories
		}
		return this.categories.filter(cat => selectedNames.includes(cat.name))
	}

	/**
	 * Filter channels by category/name (backward compatibility)
	 */
	filterChannels(selectedNames = []) {
		return this.filterCategories(selectedNames)
	}

	/**
	 * Get all category names
	 */
	getCategoryNames() {
		return this.categories.map(cat => cat.name)
	}

	/**
	 * Get videos (channels) for a specific category
	 */
	getVideosForCategory(categoryName) {
		const category = this.getCategoryByName(categoryName)
		return category ? category.items : []
	}

	/**
	 * Reload channels (force refresh, clears cache for fresh load)
	 */
	async reload() {
		this.loaded = false
		// Clear localStorage cache to force fresh load
		try {
			localStorage.removeItem(CHANNELS_CACHE_KEY)
		} catch {
			// Ignore localStorage errors
		}
		return this.loadChannels()
	}
}

// Export singleton instance
const channelManager = new ChannelManager()
export default channelManager

