/**
 * Checksum Utility - Silent Data Validation
 * 
 * Generates checksums for data to detect mismatches
 * Used for silent background sync without user disruption
 */

const crypto = require('crypto')

/**
 * Generate checksum for data
 * @param {any} data - Data to checksum
 * @returns {string} Checksum hash
 */
function generateChecksum(data) {
	const str = typeof data === 'string' ? data : JSON.stringify(data)
	return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16) // 16 chars for efficiency
}

/**
 * Generate checksum for channel data
 * @param {Array|Object} channels - Channel(s) to checksum
 * @returns {string} Checksum
 */
function generateChannelChecksum(channels) {
	if (!channels) return ''
	
	// Normalize to array
	const channelArray = Array.isArray(channels) ? channels : [channels]
	
	// Create minimal representation for checksum (only critical fields)
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
		playlistStartEpoch: ch.playlistStartEpoch?.toISOString(),
		timeBasedPlaylists: ch.timeBasedPlaylists ? Object.keys(ch.timeBasedPlaylists).reduce((acc, key) => {
			acc[key] = ch.timeBasedPlaylists[key]?.length || 0
			return acc
		}, {}) : null,
	}))
	
	return generateChecksum(minimal)
}

/**
 * Generate checksum for global epoch
 * @param {Date|string} epoch - Epoch to checksum
 * @returns {string} Checksum
 */
function generateEpochChecksum(epoch) {
	if (!epoch) return ''
	const epochStr = epoch instanceof Date ? epoch.toISOString() : epoch
	return generateChecksum(epochStr)
}

/**
 * Generate checksum for position data
 * @param {Object} position - Position object
 * @returns {string} Checksum
 */
function generatePositionChecksum(position) {
	if (!position) return ''
	
	// Only checksum critical fields
	const minimal = {
		v: position.videoIndex ?? position.v,
		o: position.offset ?? position.o,
		ts: position.currentTimeSlot ?? position.ts,
		ch: position.channelId?.toString() || position.ch,
	}
	
	return generateChecksum(minimal)
}

/**
 * Add checksum to response data
 * @param {any} data - Response data
 * @param {string} type - Type of data ('channels', 'epoch', 'position')
 * @returns {Object} Data with checksum
 */
function addChecksum(data, type) {
	let checksum = ''
	
	switch (type) {
		case 'channels':
			checksum = generateChannelChecksum(data)
			break
		case 'epoch':
			checksum = generateEpochChecksum(data)
			break
		case 'position':
			checksum = generatePositionChecksum(data)
			break
		default:
			checksum = generateChecksum(data)
	}
	
	return {
		data,
		checksum,
		checksumType: type,
	}
}

/**
 * Validate checksum
 * @param {any} data - Data to validate
 * @param {string} expectedChecksum - Expected checksum
 * @param {string} type - Type of data
 * @returns {boolean} True if valid
 */
function validateChecksum(data, expectedChecksum, type) {
	if (!expectedChecksum) return false
	
	let actualChecksum = ''
	
	switch (type) {
		case 'channels':
			actualChecksum = generateChannelChecksum(data)
			break
		case 'epoch':
			actualChecksum = generateEpochChecksum(data)
			break
		case 'position':
			actualChecksum = generatePositionChecksum(data)
			break
		default:
			actualChecksum = generateChecksum(data)
	}
	
	return actualChecksum === expectedChecksum
}

module.exports = {
	generateChecksum,
	generateChannelChecksum,
	generateEpochChecksum,
	generatePositionChecksum,
	addChecksum,
	validateChecksum,
}

