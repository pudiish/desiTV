/**
 * ChannelManager.js
 * 
 * RESTRUCTURED: Categories/Playlists contain videos (channels)
 * - Categories (like "Cult", "Music") are playlists
 * - Videos within a category are "channels" you switch between
 * - Channel Up/Down switches videos within the selected category
 */

class ChannelManager {
	constructor() {
		this.rawChannels = [] // Original channel data from JSON
		this.categories = [] // Restructured: categories as playlists
		this.loaded = false
		this.loadError = null
	}

	/**
	 * Load channels from JSON and restructure into categories
	 * Categories become playlists, videos become channels
	 */
	async loadChannels() {
		if (this.loaded && this.categories.length > 0) {
			return this.categories
		}

		try {
			const response = await fetch('/data/channels.json?t=' + Date.now())
			
			if (!response.ok) {
				throw new Error(`Failed to load channels.json: ${response.status}`)
			}

			const data = await response.json()
			const rawChannels = data.channels || []
			
			if (rawChannels.length === 0) {
				console.warn('[ChannelManager] channels.json is empty')
				this.loadError = new Error('No channels found in JSON file')
				this.rawChannels = []
				this.categories = []
				this.loaded = true
				return this.categories
			}
			
			this.rawChannels = rawChannels
			
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
	 * Reload channels (force refresh)
	 */
	async reload() {
		this.loaded = false
		return this.loadChannels()
	}
}

// Export singleton instance
const channelManager = new ChannelManager()
export default channelManager

