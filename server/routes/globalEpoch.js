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
const { addChecksum } = require('../utils/checksum')

// Cache TTL for global epoch (2 hours - optimized for free tier)
// Epoch never changes, so long cache is safe and reduces DB queries
// Small data size, safe to cache longer
const EPOCH_CACHE_TTL = 7200 // 2 hours in seconds

/**
 * GET /api/global-epoch
 * Get the current global epoch (public endpoint - all users need this)
 * Cached for 1 hour since epoch never changes
 */
router.get('/', async (req, res) => {
	try {
		// OPTIMIZED: Ultra-short cache key for free tier
		const cacheKey = 'ge' // Shortened from 'global-epoch' (saves 11 bytes per key)
		const cached = await cache.get(cacheKey)
		if (cached) {
			const epochDate = new Date(cached.epoch || cached.e)
			// VALIDATION: Add checksum to cached response
			const response = addChecksum(epochDate.toISOString(), 'epoch')
			return res.json({
				epoch: epochDate,
				timezone: cached.timezone || cached.tz,
				createdAt: cached.createdAt || epochDate,
				cached: true,
				...response, // Include checksum
			})
		}

		// Get or create global epoch
		const globalEpoch = await GlobalEpoch.getOrCreate()
		
		// OPTIMIZED: Ultra-minimal cached data for free tier
		// Use single-letter keys to save memory
		const response = {
			e: globalEpoch.epoch.toISOString(), // 'e' = epoch (saves 4 bytes)
			tz: globalEpoch.timezone || 'Asia/Kolkata', // 'tz' = timezone (saves 6 bytes)
			// Backward compatibility
			epoch: globalEpoch.epoch.toISOString(),
			timezone: globalEpoch.timezone || 'Asia/Kolkata',
		}

		// OPTIMIZED: Ultra-minimal cached data for free tier
		// Use single-letter keys to save memory
		const cacheData = {
			e: globalEpoch.epoch.toISOString(), // 'e' = epoch (saves 4 bytes)
			tz: globalEpoch.timezone || 'Asia/Kolkata', // 'tz' = timezone (saves 6 bytes)
			// Backward compatibility
			epoch: globalEpoch.epoch.toISOString(),
			timezone: globalEpoch.timezone || 'Asia/Kolkata',
		}
		
		// Cache for 2 hours (optimized TTL)
		await cache.set(cacheKey, cacheData, EPOCH_CACHE_TTL)
		
		// VALIDATION: Add checksum for silent background sync
		const response = addChecksum(globalEpoch.epoch.toISOString(), 'epoch')
		
		// Return full response with metadata and checksum
		res.json({
			epoch: globalEpoch.epoch,
			timezone: globalEpoch.timezone || 'Asia/Kolkata',
			createdAt: globalEpoch.createdAt,
			cached: false,
			...response, // Include checksum
		})
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
		await cache.delete('ge') // Use short key
		
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

