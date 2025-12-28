/**
 * globalEpoch.js
 * 
 * API endpoints for managing the global broadcast epoch
 * This is the single source of truth for timeline synchronization
 */

const express = require('express')
const router = express.Router()
const GlobalEpoch = require('../models/GlobalEpoch')
const cache = require('../utils/cache')
const { requireAuth } = require('../middleware/auth')

// Cache TTL for global epoch (1 hour - it rarely changes)
const EPOCH_CACHE_TTL = 3600 // 1 hour in seconds

/**
 * GET /api/global-epoch
 * Get the current global epoch (public endpoint - all users need this)
 * Cached for 1 hour since epoch never changes
 */
router.get('/', async (req, res) => {
	try {
		// Check cache first
		const cacheKey = 'global-epoch'
		const cached = await cache.get(cacheKey)
		if (cached) {
			return res.json({
				epoch: cached.epoch,
				timezone: cached.timezone,
				createdAt: cached.createdAt,
				cached: true,
			})
		}

		// Get or create global epoch
		const globalEpoch = await GlobalEpoch.getOrCreate()
		
		const response = {
			epoch: globalEpoch.epoch,
			timezone: globalEpoch.timezone || 'Asia/Kolkata',
			createdAt: globalEpoch.createdAt,
			cached: false,
		}

		// Cache for 1 hour
		await cache.set(cacheKey, response, EPOCH_CACHE_TTL)
		
		res.json(response)
	} catch (err) {
		console.error('[GlobalEpoch] GET error:', err)
		res.status(500).json({ 
			error: 'Failed to get global epoch', 
			details: err.message 
		})
	}
})

/**
 * POST /api/global-epoch/reset
 * Reset the global epoch (admin only - use with extreme caution!)
 * This will affect ALL users - only use if absolutely necessary
 */
router.post('/reset', requireAuth, async (req, res) => {
	try {
		// Delete existing global epoch
		await GlobalEpoch.deleteOne({ _id: 'global' })
		
		// Clear cache
		await cache.delete('global-epoch')
		
		// Create new epoch
		const newEpoch = await GlobalEpoch.getOrCreate()
		
		console.log(`[GlobalEpoch] Reset by admin ${req.admin?.username || 'unknown'}`)
		
		res.json({
			success: true,
			message: 'Global epoch reset successfully',
			epoch: newEpoch.epoch,
			warning: 'All users will now sync to new timeline',
		})
	} catch (err) {
		console.error('[GlobalEpoch] Reset error:', err)
		res.status(500).json({ 
			error: 'Failed to reset global epoch', 
			details: err.message 
		})
	}
})

module.exports = router

