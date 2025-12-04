/**
 * UserSession.js
 * MongoDB model for storing user session state
 * Enables seamless recovery across browser refreshes and device switches
 */

const mongoose = require('mongoose')

const UserSessionSchema = new mongoose.Schema(
	{
		// Session identifier (generated client-side or from fingerprint)
		sessionId: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		// Current active channel ID
		activeChannelId: {
			type: String,
			required: true,
		},
		// Active channel index in the filtered list
		activeChannelIndex: {
			type: Number,
			default: 0,
		},
		// Volume level (0-1)
		volume: {
			type: Number,
			default: 0.5,
			min: 0,
			max: 1,
		},
		// Power state
		isPowerOn: {
			type: Boolean,
			default: false,
		},
		// Selected channel names for filtering
		selectedChannels: {
			type: [String],
			default: [],
		},
		// Current video index within the active channel
		currentVideoIndex: {
			type: Number,
			default: 0,
		},
		// Current playback position in seconds
		currentPlaybackPosition: {
			type: Number,
			default: 0,
		},
		// Timeline data for pseudo-live sync
		timeline: {
			playlistStartEpoch: Date,
			virtualElapsedTime: Number,
			playlistTotalDuration: Number,
			cyclePosition: Number,
		},
		// Last activity timestamp
		lastActivityAt: {
			type: Date,
			default: () => new Date(),
		},
		// Session creation time
		createdAt: {
			type: Date,
			default: () => new Date(),
		},
		// Device info for multi-device support
		deviceInfo: {
			userAgent: String,
			screenWidth: Number,
			screenHeight: Number,
		},
		// Recovery data for crash recovery
		recoveryState: {
			lastStableState: {
				type: mongoose.Schema.Types.Mixed,
				default: null,
			},
			recoveryAttempts: {
				type: Number,
				default: 0,
			},
			lastRecoveryAt: Date,
		},
	},
	{
		timestamps: true,
		collection: 'userSessions',
	}
)

// Index for efficient session lookup and cleanup
UserSessionSchema.index({ sessionId: 1, lastActivityAt: -1 })
UserSessionSchema.index({ lastActivityAt: 1 }, { expireAfterSeconds: 86400 * 7 }) // Auto-delete after 7 days

// Method to update activity timestamp
UserSessionSchema.methods.touch = function () {
	this.lastActivityAt = new Date()
	return this.save()
}

// Static method to get or create session
UserSessionSchema.statics.getOrCreate = async function (sessionId, defaultData = {}) {
	let session = await this.findOne({ sessionId })
	
	if (!session) {
		session = await this.create({
			sessionId,
			...defaultData,
			lastActivityAt: new Date(),
		})
	}
	
	return session
}

module.exports = mongoose.model('UserSession', UserSessionSchema)
