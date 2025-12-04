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
		// Timeline epoch - when this channel's broadcast started
		// IMPORTANT: This NEVER changes and defines the entire pseudo-live timeline
		// All video playback positions are calculated from this epoch:
		// elapsedSeconds = (now - playlistStartEpoch) / 1000
		// currentPosition = elapsedSeconds % playlistTotalDuration
		// Then walk through videoDurations to find which video is playing
		playlistStartEpoch: {
			type: Date,
			required: true,
			index: true,
		},
		// Total duration of the entire playlist in seconds
		// Used for: (elapsed_time % total_duration) to find position in cycle
		playlistTotalDuration: {
			type: Number,
			default: 3600, // Default 1 hour
		},
		// Individual video durations for accurate timeline calculation
		// Array of durations for each video in the channel's playlist
		videoDurations: {
			type: [Number],
			default: [],
		},
	},
	{
		timestamps: true, // Adds createdAt and updatedAt automatically
		collection: 'broadcastStates',
	}
)

/**
 * CRITICAL: BroadcastState ONLY tracks timeline, NOT playback state
 *
 * What IS saved:
 * - playlistStartEpoch: Immutable reference point (set once, never changes)
 * - playlistTotalDuration: Total length of entire playlist
 * - videoDurations: Array of video lengths
 *
 * What is NEVER saved (calculated on-the-fly):
 * - currentVideoIndex: Calculated from elapsed time
 * - currentTime: Calculated from elapsed time
 * - playbackRate, virtualElapsedTime, playlistCycleCount: Not needed
 *
 * WHY: Video playback must follow the pseudo-live timeline continuously.
 * If we save currentVideoIndex/currentTime, users would resume from a
 * specific video's saved position instead of from the live timeline.
 *
 * Example:
 * - Channel started 1 hour ago
 * - Video 1: 10 min, Video 2: 10 min, Video 3: 10 min (repeating)
 * - Current time: 35 mins elapsed = Video 2 at 5 min mark
 * - If user closes app and comes back later: 120 mins elapsed = Video 3 at 0 min
 * - Timeline continues naturally, like a real TV broadcast
 */

// Index for efficient queries
BroadcastStateSchema.index({ channelId: 1, updatedAt: -1 })
BroadcastStateSchema.index({ lastAccessTime: -1 }) // For cleanup old records

module.exports = mongoose.model('BroadcastState', BroadcastStateSchema)
