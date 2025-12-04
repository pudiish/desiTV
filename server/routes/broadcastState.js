/**
 * broadcastStateRoutes.js
 * API endpoints for managing broadcast state persistence
 * Handles real-time timeline tracking for pseudo-live broadcasts
 * Now fully integrated with MongoDB for persistent storage
 */

const express = require('express')
const router = express.Router()
const BroadcastState = require('../models/BroadcastState')

/**
 * GET /api/broadcast-state/:channelId
 * Retrieve current broadcast state for a channel
 * Calculates virtual position based on elapsed time since last session
 */
router.get('/broadcast-state/:channelId', async (req, res) => {
	try {
		const { channelId } = req.params

		let state = await BroadcastState.findOne({ channelId })

		if (!state) {
			return res.status(404).json({
				error: 'State not found',
				channelId,
				message: 'No broadcast state exists for this channel yet',
			})
		}

		// Calculate how much time elapsed since last session ended
		const now = new Date()
		const lastSessionEndTime = new Date(state.lastSessionEndTime)
		const elapsedSinceLastSessionMs = now.getTime() - lastSessionEndTime.getTime()
		const elapsedSinceLastSessionSec = elapsedSinceLastSessionMs / 1000

		// Update virtual elapsed time
		state.virtualElapsedTime = state.virtualElapsedTime + elapsedSinceLastSessionSec

		// Calculate current position in the broadcast timeline
		let cyclePosition = state.virtualElapsedTime
		let videoIndex = 0
		let currentTime = 0

		if (state.videoDurations && state.videoDurations.length > 0) {
			// Find which video we're in based on accumulated duration
			let accumulatedTime = 0
			const playlistDuration = state.playlistTotalDuration || 3600

			cyclePosition = state.virtualElapsedTime % playlistDuration

			for (let i = 0; i < state.videoDurations.length; i++) {
				if (accumulatedTime + state.videoDurations[i] > cyclePosition) {
					videoIndex = i
					currentTime = cyclePosition - accumulatedTime
					break
				}
				accumulatedTime += state.videoDurations[i]
			}
		}

		res.json({
			...state.toObject(),
			videoIndex,
			currentTime,
			cyclePosition,
			timeSinceLastSession: elapsedSinceLastSessionSec,
			calculatedAt: now.toISOString(),
		})
	} catch (err) {
		console.error('[BroadcastState] GET error:', err)
		res.status(500).json({ error: 'Failed to retrieve state', details: err.message })
	}
})

/**
 * POST /api/broadcast-state/:channelId
 * Save or update broadcast state for a channel
 * Called periodically during playback to persist state
 */
router.post('/broadcast-state/:channelId', async (req, res) => {
	try {
		const { channelId } = req.params
		const stateData = req.body

		if (!stateData) {
			return res.status(400).json({ error: 'No state data provided' })
		}

		const now = new Date()

		// Use findByIdAndUpdate with upsert to create or update
		const state = await BroadcastState.findOneAndUpdate(
			{ channelId },
			{
				channelId,
				channelName: stateData.channelName || 'Unknown',
				playlistStartEpoch: stateData.playlistStartEpoch || now,
				currentVideoIndex: stateData.currentVideoIndex || 0,
				currentTime: stateData.currentTime || 0,
				lastSessionEndTime: now, // Update when this save happened
				lastAccessTime: now,
				playlistTotalDuration: stateData.playlistTotalDuration || 3600,
				videoDurations: stateData.videoDurations || [],
				playbackRate: stateData.playbackRate || 1.0,
				virtualElapsedTime: stateData.virtualElapsedTime || 0,
				playlistCycleCount: stateData.playlistCycleCount || 0,
				updatedAt: now,
			},
			{ upsert: true, new: true }
		)

		res.json({
			success: true,
			message: 'Broadcast state saved to MongoDB',
			state: state.toObject(),
			savedAt: now.toISOString(),
		})
	} catch (err) {
		console.error('[BroadcastState] POST error:', err)
		res.status(500).json({ error: 'Failed to save state', details: err.message })
	}
})

/**
 * GET /api/broadcast-state/:channelId/timeline
 * Calculate where we should be in the timeline right now
 * Accounts for time passed since last session ended
 */
router.get('/broadcast-state/:channelId/timeline', async (req, res) => {
	try {
		const { channelId } = req.params
		const state = await BroadcastState.findOne({ channelId })

		if (!state) {
			return res.status(404).json({ error: 'State not found', channelId })
		}

		const now = new Date()
		const playlistStart = new Date(state.playlistStartEpoch)
		const lastSessionEnd = new Date(state.lastSessionEndTime)

		// Calculate elapsed time from playlist start to now
		const totalElapsedMs = now.getTime() - playlistStart.getTime()
		const totalElapsedSec = totalElapsedMs / 1000

		// Time passed since last session
		const sessionGapMs = now.getTime() - lastSessionEnd.getTime()
		const sessionGapSec = sessionGapMs / 1000

		// Calculate position in current cycle
		const playlistDurationSec = state.playlistTotalDuration || 3600
		const cyclePosition = totalElapsedSec % playlistDurationSec

		res.json({
			channelId,
			currentTime: now.toISOString(),
			playlistStartEpoch: playlistStart.toISOString(),
			lastSessionEndTime: lastSessionEnd.toISOString(),
			totalElapsedMs,
			totalElapsedSec: Math.floor(totalElapsedSec),
			sessionGapSec: Math.floor(sessionGapSec),
			playlistDurationSec,
			cyclePosition: Math.floor(cyclePosition),
			cycleCount: Math.floor(totalElapsedSec / playlistDurationSec),
			virtualElapsedTime: state.virtualElapsedTime + sessionGapSec,
		})
	} catch (err) {
		console.error('[BroadcastState] Timeline error:', err)
		res.status(500).json({ error: 'Failed to get timeline', details: err.message })
	}
})

/**
 * DELETE /api/broadcast-state/:channelId
 * Clear broadcast state for a channel
 */
router.delete('/broadcast-state/:channelId', async (req, res) => {
	try {
		const { channelId } = req.params

		await BroadcastState.deleteOne({ channelId })

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
router.get('/broadcast-state/all', async (req, res) => {
	try {
		const states = await BroadcastState.find({}).sort({ lastAccessTime: -1 })

		res.json({
			count: states.length,
			states: states.map((state) => state.toObject()),
			timestamp: new Date().toISOString(),
		})
	} catch (err) {
		console.error('[BroadcastState] GetAll error:', err)
		res.status(500).json({ error: 'Failed to get all states', details: err.message })
	}
})

module.exports = router
