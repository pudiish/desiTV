/**
 * ChannelManager.js
 * 
 * Manages channel data and filtering
 * Moved from logic/channelManager.js for better organization
 */

class ChannelManager {
	constructor() {
		this.channels = []
		this.loaded = false
		this.loadError = null
	}

	/**
	 * Load channels from JSON file ONLY
	 * No server dependency - pure client-side
	 */
	async loadChannels() {
		if (this.loaded && this.channels.length > 0) {
			return this.channels
		}

		try {
			const response = await fetch('/data/channels.json?t=' + Date.now())
			
			if (!response.ok) {
				throw new Error(`Failed to load channels.json: ${response.status}`)
			}

			const data = await response.json()
			const channels = data.channels || []
			
			if (channels.length === 0) {
				console.warn('[ChannelManager] channels.json is empty')
				this.loadError = new Error('No channels found in JSON file')
				this.channels = []
				this.loaded = true
				return this.channels
			}
			
			this.channels = channels
			this.loaded = true
			this.loadError = null
			console.log(`[ChannelManager] Loaded ${channels.length} channels from JSON`)
			return this.channels
		} catch (err) {
			console.error('[ChannelManager] JSON load failed:', err)
			this.loadError = err
			this.channels = []
			this.loaded = true
			throw new Error(`Failed to load channels: ${err.message}`)
		}
	}

	/**
	 * Get all channels
	 */
	getAllChannels() {
		return this.channels
	}

	/**
	 * Get channel by ID
	 */
	getChannelById(channelId) {
		return this.channels.find(ch => ch._id === channelId)
	}

	/**
	 * Get channel by name
	 */
	getChannelByName(name) {
		return this.channels.find(ch => ch.name === name)
	}

	/**
	 * Filter channels by category/name
	 */
	filterChannels(selectedNames = []) {
		if (selectedNames.length === 0) {
			return this.channels
		}
		return this.channels.filter(ch => selectedNames.includes(ch.name))
	}

	/**
	 * Get categories from channels
	 */
	getCategories() {
		const categories = new Set()
		this.channels.forEach(ch => {
			ch.items?.forEach(item => {
				if (item.category) {
					categories.add(item.category)
				}
			})
		})
		return Array.from(categories)
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

