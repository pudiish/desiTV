/**
 * broadcastStateRoutes.js
 * API endpoints for managing broadcast state persistence
 * Handles real-time timeline tracking for pseudo-live broadcasts
 */

const express = require('express')
const router = express.Router()

// In-memory cache for broadcast state (in production, use MongoDB)
const broadcastStateCache = {}

/**
 * GET /api/channels/:channelId/broadcast-state
 * Retrieve current broadcast state for a channel
 */
router.get('/channels/:channelId/broadcast-state', (req, res) => {
	try {
		const { channelId } = req.params

		const state = broadcastStateCache[channelId]

		if (!state) {
			return res.status(404).json({
				error: 'State not found',
				channelId,
				message: 'No broadcast state exists for this channel yet',
			})
		}

		// Calculate current virtual position based on stored state
		const now = new Date()
		const lastUpdate = new Date(state.lastUpdate)
		const timeSinceUpdate = (now.getTime() - lastUpdate.getTime()) / 1000 // seconds

		res.json({
			...state,
			timeSinceLastUpdate: timeSinceUpdate,
			calculatedAt: now.toISOString(),
		})
	} catch (err) {
		console.error('[BroadcastState] GET error:', err)
		res.status(500).json({ error: 'Failed to retrieve state', details: err.message })
	}
})

/**
 * POST /api/channels/:channelId/broadcast-state
 * Save or update broadcast state for a channel
 */
router.post('/channels/:channelId/broadcast-state', (req, res) => {
	try {
		const { channelId } = req.params
		const stateData = req.body

		if (!stateData) {
			return res.status(400).json({ error: 'No state data provided' })
		}

		// Merge with existing state
		const now = new Date()
		broadcastStateCache[channelId] = {
			channelId,
			channelName: stateData.channelName,
			currentVideoIndex: stateData.currentVideoIndex || 0,
			currentTime: stateData.currentTime || 0,
			playlistStartEpoch: stateData.playlistStartEpoch || now,
			sessionStartTime: stateData.sessionStartTime || now,
			lastUpdate: now, // Always update timestamp
			playbackRate: stateData.playbackRate || 1.0,
			virtualElapsedTime: stateData.virtualElapsedTime || 0,
		}

		res.json({
			success: true,
			message: 'Broadcast state saved',
			state: broadcastStateCache[channelId],
			savedAt: now.toISOString(),
		})
	} catch (err) {
		console.error('[BroadcastState] POST error:', err)
		res.status(500).json({ error: 'Failed to save state', details: err.message })
	}
})

/**
 * GET /api/channels/:channelId/broadcast-state/timeline
 * Calculate where we should be in the timeline right now
 */
router.get('/channels/:channelId/broadcast-state/timeline', (req, res) => {
	try {
		const { channelId } = req.params
		const state = broadcastStateCache[channelId]

		if (!state) {
			return res.status(404).json({ error: 'State not found', channelId })
		}

		const now = new Date()
		const playlistStart = new Date(state.playlistStartEpoch)
		const elapsedMs = now.getTime() - playlistStart.getTime()

		res.json({
			channelId,
			currentTime: now.toISOString(),
			playlistStartEpoch: playlistStart.toISOString(),
			elapsedMs,
			elapsedSeconds: Math.floor(elapsedMs / 1000),
			lastStateUpdate: state.lastUpdate,
			timeSinceStateUpdate: (now.getTime() - new Date(state.lastUpdate).getTime()) / 1000,
		})
	} catch (err) {
		console.error('[BroadcastState] Timeline error:', err)
		res.status(500).json({ error: 'Failed to get timeline', details: err.message })
	}
})

/**
 * DELETE /api/channels/:channelId/broadcast-state
 * Clear broadcast state for a channel
 */
router.delete('/channels/:channelId/broadcast-state', (req, res) => {
	try {
		const { channelId } = req.params

		if (broadcastStateCache[channelId]) {
			delete broadcastStateCache[channelId]
		}

		res.json({ success: true, message: 'Broadcast state cleared', channelId })
	} catch (err) {
		console.error('[BroadcastState] DELETE error:', err)
		res.status(500).json({ error: 'Failed to clear state', details: err.message })
	}
})

/**
 * GET /api/broadcast-state/all
 * Get all broadcast states (diagnostic/admin only)
 */
router.get('/broadcast-state/all', (req, res) => {
	try {
		const states = Object.keys(broadcastStateCache).map((channelId) => ({
			channelId,
			...broadcastStateCache[channelId],
		}))

		res.json({
			count: states.length,
			states,
			timestamp: new Date().toISOString(),
		})
	} catch (err) {
		console.error('[BroadcastState] GetAll error:', err)
		res.status(500).json({ error: 'Failed to get all states', details: err.message })
	}
})

module.exports = router
