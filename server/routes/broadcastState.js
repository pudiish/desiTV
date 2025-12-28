/**
 * Broadcast state routes
 * Manages broadcast state persistence and timeline tracking
 */

const express = require('express')
const router = express.Router()
const BroadcastState = require('../models/BroadcastState')

/**
 * Get all broadcast states (diagnostic/admin only)
 * Must be defined before /:channelId route
 */
router.get('/all', async (req, res) => {
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

/**
 * Get broadcast state for a channel
 * Calculates virtual position based on elapsed time
 */
router.get('/:channelId', async (req, res) => {
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

		const now = new Date()
		const lastSessionEndTime = new Date(state.lastSessionEndTime)
		const elapsedSinceLastSessionMs = now.getTime() - lastSessionEndTime.getTime()
		const elapsedSinceLastSessionSec = elapsedSinceLastSessionMs / 1000

		state.virtualElapsedTime = state.virtualElapsedTime + elapsedSinceLastSessionSec

		let cyclePosition = state.virtualElapsedTime
		let videoIndex = 0
		let currentTime = 0

		if (state.videoDurations && state.videoDurations.length > 0) {
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
 * Save or update broadcast state for a channel
 */
router.post('/:channelId', async (req, res) => {
	try {
		const { channelId } = req.params
		const stateData = req.body

		if (!stateData) {
			return res.status(400).json({ error: 'No state data provided' })
		}

		const now = new Date()

		const state = await BroadcastState.findOneAndUpdate(
			{ channelId },
			{
				channelId,
				channelName: stateData.channelName || 'Unknown',
				playlistStartEpoch: stateData.playlistStartEpoch || now,
				currentVideoIndex: stateData.currentVideoIndex || 0,
				currentTime: stateData.currentTime || 0,
				lastSessionEndTime: now,
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
 * Calculate current timeline position
 */
router.get('/:channelId/timeline', async (req, res) => {
	try {
		const { channelId } = req.params
		const state = await BroadcastState.findOne({ channelId })

		if (!state) {
			return res.status(404).json({ error: 'State not found', channelId })
		}

		const now = new Date()
		const playlistStart = new Date(state.playlistStartEpoch)
		const lastSessionEnd = new Date(state.lastSessionEndTime)

		const totalElapsedMs = now.getTime() - playlistStart.getTime()
		const totalElapsedSec = totalElapsedMs / 1000

		const sessionGapMs = now.getTime() - lastSessionEnd.getTime()
		const sessionGapSec = sessionGapMs / 1000

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
 * Clear broadcast state for a channel
 */
router.delete('/:channelId', async (req, res) => {
	try {
		const { channelId } = req.params

		await BroadcastState.deleteOne({ channelId })

		res.json({ success: true, message: 'Broadcast state cleared', channelId })
	} catch (err) {
		console.error('[BroadcastState] DELETE error:', err)
		res.status(500).json({ error: 'Failed to clear state', details: err.message })
	}
})

module.exports = router
