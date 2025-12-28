/**
 * Checksum Validator - Silent Background Sync
 * 
 * Validates checksums and silently refreshes data on mismatch
 * No user disruption - seamless background sync
 */

// Import checksum generation (will be defined below)

/**
 * Validate and refresh channels if checksum mismatch
 * @param {Array} currentChannels - Current channel data
 * @param {string} expectedChecksum - Expected checksum from server
 * @param {Function} refreshFn - Function to refresh channels
 * @returns {Promise<boolean>} True if refresh was needed
 */
export async function validateAndRefreshChannels(currentChannels, expectedChecksum, refreshFn) {
	if (!expectedChecksum) return false
	
	try {
		const actualChecksum = generateChannelChecksum(currentChannels)
		
		if (actualChecksum !== expectedChecksum) {
			console.log('[Checksum] Channel mismatch detected, silently refreshing...')
			// Silently refresh in background
			await refreshFn()
			return true
		}
		
		return false
	} catch (err) {
		console.warn('[Checksum] Validation error:', err)
		return false
	}
}

/**
 * Validate and refresh epoch if checksum mismatch
 * @param {Date|string} currentEpoch - Current epoch
 * @param {string} expectedChecksum - Expected checksum from server
 * @param {Function} refreshFn - Function to refresh epoch
 * @returns {Promise<boolean>} True if refresh was needed
 */
export async function validateAndRefreshEpoch(currentEpoch, expectedChecksum, refreshFn) {
	if (!expectedChecksum) return false
	
	try {
		const epochStr = currentEpoch instanceof Date ? currentEpoch.toISOString() : currentEpoch
		const actualChecksum = generateEpochChecksum(epochStr)
		
		if (actualChecksum !== expectedChecksum) {
			console.log('[Checksum] Epoch mismatch detected, silently refreshing...')
			// Silently refresh in background
			await refreshFn()
			return true
		}
		
		return false
	} catch (err) {
		console.warn('[Checksum] Validation error:', err)
		return false
	}
}

/**
 * Generate checksum for channels (client-side)
 * @param {Array|Object} channels - Channel(s)
 * @returns {string} Checksum
 */
function generateChannelChecksum(channels) {
	if (!channels) return ''
	
	const channelArray = Array.isArray(channels) ? channels : [channels]
	
	const minimal = channelArray.map(ch => ({
		_id: ch._id?.toString(),
		name: ch.name,
		itemsCount: ch.items?.length || 0,
		itemsHash: ch.items?.map(item => ({
			_id: item._id?.toString(),
			youtubeId: item.youtubeId,
			duration: item.duration,
		})).reduce((acc, item) => {
			return acc + (item.youtubeId || '') + (item.duration || 0)
		}, '') || '',
		playlistStartEpoch: ch.playlistStartEpoch?.toISOString?.(),
		timeBasedPlaylists: ch.timeBasedPlaylists ? Object.keys(ch.timeBasedPlaylists).reduce((acc, key) => {
			acc[key] = ch.timeBasedPlaylists[key]?.length || 0
			return acc
		}, {}) : null,
	}))
	
	return generateChecksum(minimal)
}

/**
 * Generate checksum for epoch (client-side)
 * @param {Date|string} epoch - Epoch
 * @returns {string} Checksum
 */
function generateEpochChecksum(epoch) {
	if (!epoch) return ''
	const epochStr = epoch instanceof Date ? epoch.toISOString() : epoch
	return generateChecksum(epochStr)
}

/**
 * Generate checksum (client-side)
 * @param {any} data - Data
 * @returns {string} Checksum
 */
function generateChecksum(data) {
	const str = typeof data === 'string' ? data : JSON.stringify(data)
	
	// Use Web Crypto API for hashing (browser-compatible)
	if (typeof crypto !== 'undefined' && crypto.subtle) {
		// Async version for production
		return hashString(str)
	} else {
		// Fallback: simple hash for development
		let hash = 0
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i)
			hash = ((hash << 5) - hash) + char
			hash = hash & hash // Convert to 32-bit integer
		}
		return Math.abs(hash).toString(16).substring(0, 16)
	}
}

/**
 * Hash string using Web Crypto API
 * @param {string} str - String to hash
 * @returns {Promise<string>} Hash
 */
async function hashString(str) {
	const encoder = new TextEncoder()
	const data = encoder.encode(str)
	const hashBuffer = await crypto.subtle.digest('SHA-256', data)
	const hashArray = Array.from(new Uint8Array(hashBuffer))
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)
}

// Make hashString synchronous for checksum generation
// Use a simple synchronous hash for now
function generateChecksumSync(data) {
	const str = typeof data === 'string' ? data : JSON.stringify(data)
	
	// Simple but effective hash function
	let hash = 0
	if (str.length === 0) return hash.toString(16).substring(0, 16)
	
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i)
		hash = ((hash << 5) - hash) + char
		hash = hash & hash // Convert to 32-bit integer
	}
	
	return Math.abs(hash).toString(16).substring(0, 16).padStart(16, '0')
}

// Export sync version for use in validation
export const generateChecksum = generateChecksumSync

