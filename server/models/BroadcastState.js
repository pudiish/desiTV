/**
 * BroadcastState.js
 * MongoDB model for persisting broadcast state across sessions
 * Ensures TV broadcast never stops - continuous timeline
 */

const mongoose = require('mongoose')

const BroadcastStateSchema = new mongoose.Schema(
	{
		channelId: {
			type: String,
			required: true,
			unique: true,
			index: true,
		},
		channelName: {
			type: String,
			required: true,
		},
		// Timeline epoch - when this channel's broadcast started (never changes)
		playlistStartEpoch: {
			type: Date,
			required: true,
			index: true,
		},
		// Current video index in playlist (changes as broadcast progresses)
		currentVideoIndex: {
			type: Number,
			default: 0,
		},
		// Current playback offset in seconds within the current video
		currentTime: {
			type: Number,
			default: 0,
		},
		// When the app last saved state (for calculating elapsed time)
		lastSessionEndTime: {
			type: Date,
			default: () => new Date(),
		},
		// When user last accessed this channel
		lastAccessTime: {
			type: Date,
			default: () => new Date(),
		},
		// Total duration of the entire playlist in seconds
		playlistTotalDuration: {
			type: Number,
			default: 3600, // Default 1 hour
		},
		// Individual video durations for accurate timeline calculation
		videoDurations: {
			type: [Number],
			default: [],
		},
		// Playback rate (1.0 = normal speed)
		playbackRate: {
			type: Number,
			default: 1.0,
		},
		// Last update timestamp
		updatedAt: {
			type: Date,
			default: () => new Date(),
		},
		// Virtual elapsed time since playlist start (in seconds)
		virtualElapsedTime: {
			type: Number,
			default: 0,
		},
		// Track how many times this broadcast has cycled through
		playlistCycleCount: {
			type: Number,
			default: 0,
		},
	},
	{
		timestamps: true, // Adds createdAt and updatedAt automatically
		collection: 'broadcastStates',
	}
)

// Index for efficient queries
BroadcastStateSchema.index({ channelId: 1, updatedAt: -1 })
BroadcastStateSchema.index({ lastAccessTime: -1 }) // For cleanup old records

module.exports = mongoose.model('BroadcastState', BroadcastStateSchema)
