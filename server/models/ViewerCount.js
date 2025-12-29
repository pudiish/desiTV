/**
 * ViewerCount.js
 * 
 * Tracks how many users are currently watching each channel
 * Creates the "shared experience" feeling - knowing others are watching too
 */

const mongoose = require('mongoose')

const ViewerCountSchema = new mongoose.Schema(
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
		// Active viewers (updated every 30 seconds)
		activeViewers: {
			type: Number,
			default: 0,
			min: 0,
		},
		// Last update timestamp
		lastUpdated: {
			type: Date,
			default: () => new Date(),
			index: true,
		},
		// Total views (cumulative, never decreases)
		totalViews: {
			type: Number,
			default: 0,
			min: 0,
		},
	},
	{
		collection: 'viewerCounts',
		timestamps: true,
	}
)

// Index for efficient queries
ViewerCountSchema.index({ channelId: 1, lastUpdated: -1 })
ViewerCountSchema.index({ activeViewers: -1 }) // For "most watched" queries

// Static method to increment viewer count
ViewerCountSchema.statics.incrementViewer = async function(channelId, channelName) {
	const now = new Date()
	
	// Use $inc only - it handles both existing docs and upserts correctly
	// For new docs, $inc starts from default value (0) so 0+1=1
	const result = await this.findOneAndUpdate(
		{ channelId },
		{
			$set: {
				channelName,
				lastUpdated: now,
			},
			$inc: {
				activeViewers: 1,
				totalViews: 1,
			},
		},
		{ upsert: true, new: true }
	)
	
	return result
}

// Static method to decrement viewer count
ViewerCountSchema.statics.decrementViewer = async function(channelId) {
	const result = await this.findOneAndUpdate(
		{ channelId },
		{
			$inc: { activeViewers: -1 },
			$set: { lastUpdated: new Date() },
		},
		{ new: true }
	)
	
	// Ensure count doesn't go negative
	if (result && result.activeViewers < 0) {
		result.activeViewers = 0
		await result.save()
	}
	
	return result
}

// Static method to get viewer count (with caching)
ViewerCountSchema.statics.getViewerCount = async function(channelId) {
	const viewerCount = await this.findOne({ channelId })
	return viewerCount ? viewerCount.activeViewers : 0
}

// Static method to cleanup stale viewers (called periodically)
ViewerCountSchema.statics.cleanupStaleViewers = async function() {
	const now = new Date()
	const staleThreshold = 60 * 1000 // 1 minute - if no update in 1 min, consider stale
	
	const staleCounts = await this.find({
		lastUpdated: { $lt: new Date(now.getTime() - staleThreshold) },
		activeViewers: { $gt: 0 },
	})
	
	for (const count of staleCounts) {
		// Reduce by 50% (assume some viewers left)
		count.activeViewers = Math.max(0, Math.floor(count.activeViewers * 0.5))
		count.lastUpdated = now
		await count.save()
	}
	
	return staleCounts.length
}

module.exports = mongoose.model('ViewerCount', ViewerCountSchema)

