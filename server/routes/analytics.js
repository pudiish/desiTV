const express = require('express')
const router = express.Router()

// In-memory storage for analytics (replace with database in production)
const analyticsData = {
	sessions: [],
	events: [],
	surveys: []
}

/**
 * POST /api/analytics
 * Receive analytics events from client
 */
router.post('/', (req, res) => {
	try {
		const { sessionId, events } = req.body
		
		if (!sessionId || !Array.isArray(events)) {
			return res.status(400).json({ error: 'Invalid request format' })
		}
		
		// Store events
		analyticsData.events.push(...events.map(event => ({
			...event,
			receivedAt: Date.now()
		})))
		
		// Track session if new
		const existingSession = analyticsData.sessions.find(s => s.sessionId === sessionId)
		if (!existingSession) {
			analyticsData.sessions.push({
				sessionId,
				startTime: events[0]?.timestamp || Date.now(),
				lastUpdate: Date.now(),
				eventCount: events.length
			})
		} else {
			existingSession.lastUpdate = Date.now()
			existingSession.eventCount += events.length
		}
		
		// Keep only last 10000 events (prevent memory issues)
		if (analyticsData.events.length > 10000) {
			analyticsData.events = analyticsData.events.slice(-10000)
		}
		
		res.json({ success: true, received: events.length })
	} catch (error) {
		console.error('[Analytics] Error processing events:', error)
		res.status(500).json({ error: 'Failed to process analytics' })
	}
})

/**
 * POST /api/survey
 * Receive survey responses
 */
router.post('/survey', (req, res) => {
	try {
		const { ageGroup, answers, timestamp } = req.body
		
		if (!ageGroup || !answers) {
			return res.status(400).json({ error: 'Invalid survey format' })
		}
		
		// Store survey response
		analyticsData.surveys.push({
			ageGroup,
			answers,
			timestamp: timestamp || Date.now(),
			receivedAt: Date.now()
		})
		
		// Keep only last 1000 surveys
		if (analyticsData.surveys.length > 1000) {
			analyticsData.surveys = analyticsData.surveys.slice(-1000)
		}
		
		res.json({ success: true })
	} catch (error) {
		console.error('[Analytics] Error processing survey:', error)
		res.status(500).json({ error: 'Failed to process survey' })
	}
})

/**
 * GET /api/analytics/summary
 * Get analytics summary (for admin dashboard)
 */
router.get('/summary', (req, res) => {
	try {
		const { startDate, endDate } = req.query
		
		let filteredEvents = analyticsData.events
		let filteredSurveys = analyticsData.surveys
		
		// Filter by date range if provided
		if (startDate) {
			const start = parseInt(startDate)
			filteredEvents = filteredEvents.filter(e => e.timestamp >= start)
			filteredSurveys = filteredSurveys.filter(s => s.timestamp >= start)
		}
		if (endDate) {
			const end = parseInt(endDate)
			filteredEvents = filteredEvents.filter(e => e.timestamp <= end)
			filteredSurveys = filteredSurveys.filter(s => s.timestamp <= end)
		}
		
		// Calculate summary statistics
		const summary = {
			totalSessions: analyticsData.sessions.length,
			totalEvents: filteredEvents.length,
			totalSurveys: filteredSurveys.length,
			eventTypes: {},
			ageGroups: {},
			channelChanges: 0,
			powerOns: 0,
			powerOffs: 0,
			menuOpens: 0,
			fullscreenEnters: 0,
			errors: 0,
			averageEaseOfUse: null,
			averageSatisfaction: null
		}
		
		// Count event types
		filteredEvents.forEach(event => {
			summary.eventTypes[event.eventName] = (summary.eventTypes[event.eventName] || 0) + 1
			
			if (event.eventName === 'channel_change') summary.channelChanges++
			if (event.eventName === 'tv_power_on') summary.powerOns++
			if (event.eventName === 'tv_power_off') summary.powerOffs++
			if (event.eventName === 'menu_open') summary.menuOpens++
			if (event.eventName === 'fullscreen_enter') summary.fullscreenEnters++
			if (event.eventName === 'error') summary.errors++
			
			if (event.ageGroup) {
				summary.ageGroups[event.ageGroup] = (summary.ageGroups[event.ageGroup] || 0) + 1
			}
		})
		
		// Calculate survey averages
		const easeOfUseAnswers = filteredSurveys
			.map(s => s.answers.ease_of_use)
			.filter(a => a !== undefined)
		
		const satisfactionAnswers = filteredSurveys
			.map(s => s.answers.satisfaction)
			.filter(a => a !== undefined)
		
		if (easeOfUseAnswers.length > 0) {
			summary.averageEaseOfUse = (
				easeOfUseAnswers.reduce((sum, val) => sum + val, 0) / easeOfUseAnswers.length
			).toFixed(2)
		}
		
		if (satisfactionAnswers.length > 0) {
			summary.averageSatisfaction = (
				satisfactionAnswers.reduce((sum, val) => sum + val, 0) / satisfactionAnswers.length
			).toFixed(2)
		}
		
		res.json(summary)
	} catch (error) {
		console.error('[Analytics] Error generating summary:', error)
		res.status(500).json({ error: 'Failed to generate summary' })
	}
})

/**
 * GET /api/analytics/events
 * Get raw events (for detailed analysis)
 */
router.get('/events', (req, res) => {
	try {
		const { limit = 100, eventType } = req.query
		
		let events = analyticsData.events
		
		if (eventType) {
			events = events.filter(e => e.eventName === eventType)
		}
		
		// Return most recent events
		events = events.slice(-parseInt(limit))
		
		res.json({ events, total: analyticsData.events.length })
	} catch (error) {
		console.error('[Analytics] Error fetching events:', error)
		res.status(500).json({ error: 'Failed to fetch events' })
	}
})

/**
 * GET /api/analytics/surveys
 * Get survey responses
 */
router.get('/surveys', (req, res) => {
	try {
		const { ageGroup } = req.query
		
		let surveys = analyticsData.surveys
		
		if (ageGroup) {
			surveys = surveys.filter(s => s.ageGroup === ageGroup)
		}
		
		res.json({ surveys, total: analyticsData.surveys.length })
	} catch (error) {
		console.error('[Analytics] Error fetching surveys:', error)
		res.status(500).json({ error: 'Failed to fetch surveys' })
	}
})

module.exports = router

