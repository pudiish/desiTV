/**
 * viewerCount.js
 * 
 * API endpoints for tracking and retrieving viewer counts
 * Creates the "shared experience" - knowing others are watching
 */

const express = require('express')
const router = express.Router()
const ViewerCount = require('../models/ViewerCount')
const cache = require('../utils/cache')

// Cache TTL for viewer counts (15 seconds - optimized for 25MB Redis)
const VIEWER_COUNT_CACHE_TTL = 15

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
		
		const viewerCount = await ViewerCount.incrementViewer(
			channelId,
			channelName || 'Unknown Channel'
		)
		
		// Clear cache
		await cache.delete(`viewer-count:${channelId}`)
		
		res.json({
			success: true,
			channelId,
			activeViewers: viewerCount.activeViewers,
			totalViews: viewerCount.totalViews,
		})
	} catch (err) {
		console.error('[ViewerCount] Join error:', err)
		res.status(500).json({ error: 'Failed to join channel', details: err.message })
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
		
		const viewerCount = await ViewerCount.decrementViewer(channelId)
		
		// Clear cache
		await cache.delete(`viewer-count:${channelId}`)
		
		res.json({
			success: true,
			channelId,
			activeViewers: viewerCount ? viewerCount.activeViewers : 0,
		})
	} catch (err) {
		console.error('[ViewerCount] Leave error:', err)
		res.status(500).json({ error: 'Failed to leave channel', details: err.message })
	}
})

/**
 * GET /api/viewer-count/:channelId
 * Get current viewer count for a channel
 */
router.get('/:channelId', async (req, res) => {
	try {
		const { channelId } = req.params
		
		// Check cache first
		const cacheKey = `viewer-count:${channelId}`
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
		
		// Minimize cached data - only numbers, no metadata
		const response = {
			activeViewers: viewerCount ? viewerCount.activeViewers : 0,
			totalViews: viewerCount ? viewerCount.totalViews : 0,
		}
		
		// Cache for 15 seconds (reduced from 30s)
		await cache.set(cacheKey, response, VIEWER_COUNT_CACHE_TTL)
		
		// Return full response with metadata
		res.json({
			channelId,
			...response,
			cached: false,
		})
		
		res.json(response)
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

