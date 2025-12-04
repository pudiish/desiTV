/**
 * sessionRoutes.js
 * API endpoints for session caching and state recovery
 * Handles persistent session state across browser refreshes
 */

const express = require('express')
const router = express.Router()
const UserSession = require('../models/UserSession')
const BroadcastState = require('../models/BroadcastState')

/**
 * GET /api/session/:sessionId
 * Retrieve session state for recovery
 */
router.get('/:sessionId', async (req, res) => {
	try {
		const { sessionId } = req.params

		const session = await UserSession.findOne({ sessionId })

		if (!session) {
			return res.status(404).json({
				error: 'Session not found',
				sessionId,
				message: 'No session exists - will create new on save',
			})
		}

		// Touch session to update last activity
		session.lastActivityAt = new Date()
		await session.save()

		// Also fetch broadcast state for the active channel if available
		let broadcastState = null
		if (session.activeChannelId) {
			broadcastState = await BroadcastState.findOne({ channelId: session.activeChannelId })
		}

		res.json({
			session: session.toObject(),
			broadcastState: broadcastState?.toObject() || null,
			recoveredAt: new Date().toISOString(),
		})
	} catch (err) {
		console.error('[Session] GET error:', err)
		res.status(500).json({ error: 'Failed to retrieve session', details: err.message })
	}
})

/**
 * POST /api/session/:sessionId
 * Save or update session state
 */
router.post('/:sessionId', async (req, res) => {
	try {
		const { sessionId } = req.params
		const sessionData = req.body

		if (!sessionData) {
			return res.status(400).json({ error: 'No session data provided' })
		}

		const now = new Date()

		// Upsert session
		const session = await UserSession.findOneAndUpdate(
			{ sessionId },
			{
				sessionId,
				activeChannelId: sessionData.activeChannelId,
				activeChannelIndex: sessionData.activeChannelIndex || 0,
				volume: sessionData.volume ?? 0.5,
				isPowerOn: sessionData.isPowerOn ?? false,
				selectedChannels: sessionData.selectedChannels || [],
				currentVideoIndex: sessionData.currentVideoIndex || 0,
				currentPlaybackPosition: sessionData.currentPlaybackPosition || 0,
				timeline: sessionData.timeline || {},
				lastActivityAt: now,
				deviceInfo: sessionData.deviceInfo || {},
				// Store recovery state
				recoveryState: {
					lastStableState: sessionData,
					recoveryAttempts: 0,
					lastRecoveryAt: null,
				},
			},
			{ upsert: true, new: true }
		)

		res.json({
			success: true,
			message: 'Session saved',
			session: session.toObject(),
			savedAt: now.toISOString(),
		})
	} catch (err) {
		console.error('[Session] POST error:', err)
		res.status(500).json({ error: 'Failed to save session', details: err.message })
	}
})

/**
 * POST /api/session/:sessionId/recovery
 * Attempt to recover from a crashed/stale state
 */
router.post('/:sessionId/recovery', async (req, res) => {
	try {
		const { sessionId } = req.params
		const { reason } = req.body

		const session = await UserSession.findOne({ sessionId })

		if (!session) {
			return res.status(404).json({ error: 'Session not found for recovery' })
		}

		const now = new Date()

		// Increment recovery attempts
		session.recoveryState.recoveryAttempts += 1
		session.recoveryState.lastRecoveryAt = now
		session.lastActivityAt = now

		await session.save()

		// Return the last stable state for recovery
		res.json({
			success: true,
			message: 'Recovery state retrieved',
			lastStableState: session.recoveryState.lastStableState,
			recoveryAttempts: session.recoveryState.recoveryAttempts,
			reason,
			recoveredAt: now.toISOString(),
		})
	} catch (err) {
		console.error('[Session] Recovery error:', err)
		res.status(500).json({ error: 'Failed to recover session', details: err.message })
	}
})

/**
 * DELETE /api/session/:sessionId
 * Clear session data
 */
router.delete('/:sessionId', async (req, res) => {
	try {
		const { sessionId } = req.params

		await UserSession.deleteOne({ sessionId })

		res.json({ success: true, message: 'Session cleared', sessionId })
	} catch (err) {
		console.error('[Session] DELETE error:', err)
		res.status(500).json({ error: 'Failed to clear session', details: err.message })
	}
})

/**
 * GET /api/session/active/all
 * Get all active sessions (admin diagnostic)
 */
router.get('/active/all', async (req, res) => {
	try {
		// Get sessions active in the last hour
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
		
		const sessions = await UserSession.find({
			lastActivityAt: { $gte: oneHourAgo },
		}).sort({ lastActivityAt: -1 })

		res.json({
			count: sessions.length,
			sessions: sessions.map((s) => s.toObject()),
			timestamp: new Date().toISOString(),
		})
	} catch (err) {
		console.error('[Session] GetAll error:', err)
		res.status(500).json({ error: 'Failed to get sessions', details: err.message })
	}
})

module.exports = router
