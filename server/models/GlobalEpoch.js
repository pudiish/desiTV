/**
 * GlobalEpoch.js
 * 
 * Single source of truth for broadcast timeline across ALL users
 * This ensures everyone sees the same content at the same time - true synchronization
 * 
 * CRITICAL: Only ONE document should exist (with _id: 'global')
 * This epoch is set once and NEVER changes - it's the reference point for all channels
 */

const mongoose = require('mongoose')

const GlobalEpochSchema = new mongoose.Schema(
	{
		_id: {
			type: String,
			default: 'global',
			required: true,
		},
		// The immutable epoch - when the global broadcast timeline started
		// All channels calculate their position from this epoch
		epoch: {
			type: Date,
			required: true,
			index: true,
		},
		// When this epoch was created (for tracking)
		createdAt: {
			type: Date,
			default: () => new Date(),
		},
		// Optional: Timezone (defaults to IST)
		timezone: {
			type: String,
			default: 'Asia/Kolkata', // IST
		},
	},
	{
		collection: 'globalEpoch',
		timestamps: false, // We manage createdAt manually
	}
)

// Ensure only one document exists
GlobalEpochSchema.statics.getOrCreate = async function() {
	let globalEpoch = await this.findById('global')
	
	if (!globalEpoch) {
		// First time - create the global epoch
		// Use a fixed date in the past to ensure consistency
		// This allows channels to have started at different times but sync to global timeline
		const fixedEpoch = new Date('2020-01-01T00:00:00.000Z')
		
		globalEpoch = await this.create({
			_id: 'global',
			epoch: fixedEpoch,
			timezone: 'Asia/Kolkata',
		})
		
		console.log('[GlobalEpoch] Created global epoch:', globalEpoch.epoch.toISOString())
	}
	
	return globalEpoch
}

// Get current epoch (cached for performance)
GlobalEpochSchema.statics.getCurrentEpoch = async function() {
	const globalEpoch = await this.getOrCreate()
	return globalEpoch.epoch
}

// Note: Don't create index on _id - MongoDB doesn't allow custom indexes on _id
// The _id field is automatically indexed by MongoDB

module.exports = mongoose.model('GlobalEpoch', GlobalEpochSchema)

