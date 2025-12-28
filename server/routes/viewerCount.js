/**
 * viewerCount.js
 * 
 * API endpoints for tracking and retrieving viewer counts
 * Creates the "shared experience" - knowing others are watching
 */

const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
const ViewerCount = require('../models/ViewerCount')
const cache = require('../utils/cache')

// Cache TTL for viewer counts (30 seconds - optimized for free tier)
// Viewer counts don't need real-time accuracy, 30s is fine
// Reduces database queries significantly
const VIEWER_COUNT_CACHE_TTL = 30

/**
 * POST /api/viewer-count/:channelId/join
 * User joins a channel (increment viewer count)
 */
router.post('/:channelId/join', async (req, res) => {
	try {
		const { channelId } = req.params
		const { channelName } = req.body
		
		if (!channelId) {
			return res.status(400).json({ error: 'Channel ID required' })
		}
		
		// Check MongoDB connection before attempting database operation
		if (mongoose.connection.readyState !== 1) {
			console.warn('[ViewerCount] MongoDB not connected, skipping viewer count update')
			// Return success anyway - viewer count is non-critical
			return res.json({
				success: true,
				channelId,
				activeViewers: 0,
				totalViews: 0,
				skipped: true,
			})
		}
		
		let viewerCount = null
		try {
			viewerCount = await ViewerCount.incrementViewer(
				channelId,
				channelName || 'Unknown Channel'
			)
		} catch (dbErr) {
			console.warn('[ViewerCount] Increment failed (non-critical):', dbErr.message)
			// Continue - viewer count is optional
		}
		
		// Clear cache (use short key) - handle short channelIds gracefully
		try {
			const channelHash = channelId.toString().length >= 24 
				? channelId.toString().substring(18, 24)
				: channelId.toString().substring(Math.max(0, channelId.toString().length - 6))
			await cache.delete(`vc:${channelHash}`)
		} catch (cacheErr) {
			console.warn('[ViewerCount] Cache delete failed (non-critical):', cacheErr.message)
		}
		
		// Always return success - viewer count is non-critical
		return res.json({
			success: true,
			channelId,
			activeViewers: viewerCount ? viewerCount.activeViewers : 0,
			totalViews: viewerCount ? viewerCount.totalViews : 0,
		})
	} catch (err) {
		// Never return 500 - viewer count is non-critical
		console.warn('[ViewerCount] Join error (non-critical):', err.message)
		// Always return 200 OK
		return res.json({
			success: true,
			channelId: req.params.channelId || 'unknown',
			activeViewers: 0,
			totalViews: 0,
		})
	}
})

/**
 * POST /api/viewer-count/:channelId/leave
 * User leaves a channel (decrement viewer count)
 */
router.post('/:channelId/leave', async (req, res) => {
	try {
		const { channelId } = req.params
		
		if (!channelId) {
			return res.status(400).json({ error: 'Channel ID required' })
		}
		
		// Check MongoDB connection before attempting database operation
		if (mongoose.connection.readyState !== 1) {
			console.warn('[ViewerCount] MongoDB not connected, skipping viewer count update')
			// Return success anyway - viewer count is non-critical
			return res.json({
				success: true,
				channelId,
				activeViewers: 0,
				skipped: true,
			})
		}
		
		let viewerCount = null
		try {
			viewerCount = await ViewerCount.decrementViewer(channelId)
		} catch (dbErr) {
			console.warn('[ViewerCount] Decrement failed (non-critical):', dbErr.message)
			// Continue - viewer count is optional
		}
		
		// Clear cache (use short key) - handle short channelIds gracefully
		try {
			const channelHash = channelId.toString().length >= 24 
				? channelId.toString().substring(18, 24)
				: channelId.toString().substring(Math.max(0, channelId.toString().length - 6))
			await cache.delete(`vc:${channelHash}`)
		} catch (cacheErr) {
			console.warn('[ViewerCount] Cache delete failed (non-critical):', cacheErr.message)
		}
		
		// Always return success - viewer count is non-critical
		return res.json({
			success: true,
			channelId,
			activeViewers: viewerCount ? viewerCount.activeViewers : 0,
		})
	} catch (err) {
		// Never return 500 - viewer count is non-critical
		console.warn('[ViewerCount] Leave error (non-critical):', err.message)
		// Always return 200 OK
		return res.json({
			success: true,
			channelId: req.params.channelId || 'unknown',
			activeViewers: 0,
		})
	}
})

/**
 * GET /api/viewer-count/:channelId
 * Get current viewer count for a channel
 */
router.get('/:channelId', async (req, res) => {
	try {
		const { channelId } = req.params
		
		// OPTIMIZED: Ultra-short cache key for free tier
		// Handle short channelIds gracefully
		const channelHash = channelId.toString().length >= 24 
			? channelId.toString().substring(18, 24)
			: channelId.toString().substring(Math.max(0, channelId.toString().length - 6))
		const cacheKey = `vc:${channelHash}` // Shortened from 'viewer-count:xxx'
		const cached = await cache.get(cacheKey)
		if (cached) {
			return res.json({
				channelId,
				activeViewers: cached.activeViewers || 0,
				totalViews: cached.totalViews || 0,
				cached: true,
			})
		}
		
		const viewerCount = await ViewerCount.findOne({ channelId })
		
		// OPTIMIZED: Ultra-minimal cached data for free tier
		// Use single-letter keys to save memory
		const response = {
			a: viewerCount ? viewerCount.activeViewers : 0, // 'a' = activeViewers
			t: viewerCount ? viewerCount.totalViews : 0, // 't' = totalViews
			// Backward compatibility
			activeViewers: viewerCount ? viewerCount.activeViewers : 0,
			totalViews: viewerCount ? viewerCount.totalViews : 0,
		}
		
		// Cache for 30 seconds (optimized for free tier)
		await cache.set(cacheKey, response, VIEWER_COUNT_CACHE_TTL)
		
		// Return full response with metadata
		res.json({
			channelId,
			...response,
			cached: false,
		})
	} catch (err) {
		console.error('[ViewerCount] GET error:', err)
		res.status(500).json({ error: 'Failed to get viewer count', details: err.message })
	}
})

/**
 * GET /api/viewer-count/all
 * Get viewer counts for all channels (for admin/stats)
 */
router.get('/all', async (req, res) => {
	try {
		const viewerCounts = await ViewerCount.find({ activeViewers: { $gt: 0 } })
			.sort({ activeViewers: -1 })
			.limit(50)
			.lean()
		
		res.json({
			count: viewerCounts.length,
			channels: viewerCounts.map(vc => ({
				channelId: vc.channelId,
				channelName: vc.channelName,
				activeViewers: vc.activeViewers,
				totalViews: vc.totalViews,
			})),
		})
	} catch (err) {
		console.error('[ViewerCount] GetAll error:', err)
		res.status(500).json({ error: 'Failed to get all viewer counts', details: err.message })
	}
})

module.exports = router

