/**
 * Analytics Controller
 * 
 * Handles HTTP requests/responses for analytics endpoints.
 * Delegates business logic to AnalyticsService.
 */

const analyticsService = require('../services/analyticsService');

class AnalyticsController {
  /**
   * POST /api/analytics
   * Receive analytics events from client
   */
  async processEvents(request, response) {
    try {
      const { sessionId, events } = request.body;
      const result = await analyticsService.processEvents(sessionId, events);
      response.json(result);
    } catch (error) {
      if (error.message === 'Invalid request format') {
        return response.status(400).json({ error: error.message });
      }
      console.error('[AnalyticsController] Error processing events:', error);
      response.status(500).json({ error: 'Failed to process analytics' });
    }
  }

  /**
   * POST /api/analytics/survey
   * Receive survey responses
   */
  async processSurvey(request, response) {
    try {
      const { ageGroup, answers, timestamp } = request.body;
      const result = await analyticsService.processSurvey(ageGroup, answers, timestamp);
      response.json(result);
    } catch (error) {
      if (error.message === 'Invalid survey format') {
        return response.status(400).json({ error: error.message });
      }
      console.error('[AnalyticsController] Error processing survey:', error);
      response.status(500).json({ error: 'Failed to process survey' });
    }
  }

  /**
   * GET /api/analytics/summary
   * Get analytics summary (for admin dashboard)
   */
  async getSummary(request, response) {
    try {
      const { startDate, endDate } = request.query;
      const summary = await analyticsService.getSummary(startDate, endDate);
      response.json(summary);
    } catch (error) {
      console.error('[AnalyticsController] Error generating summary:', error);
      response.status(500).json({ error: 'Failed to generate summary' });
    }
  }

  /**
   * GET /api/analytics/events
   * Get raw events (for detailed analysis)
   */
  async getEvents(request, response) {
    try {
      const { limit = 100, eventType } = request.query;
      const result = await analyticsService.getEvents(limit, eventType);
      response.json(result);
    } catch (error) {
      console.error('[AnalyticsController] Error fetching events:', error);
      response.status(500).json({ error: 'Failed to fetch events' });
    }
  }

  /**
   * GET /api/analytics/surveys
   * Get survey responses
   */
  async getSurveys(request, response) {
    try {
      const { ageGroup } = request.query;
      const result = await analyticsService.getSurveys(ageGroup);
      response.json(result);
    } catch (error) {
      console.error('[AnalyticsController] Error fetching surveys:', error);
      response.status(500).json({ error: 'Failed to fetch surveys' });
    }
  }
}

module.exports = new AnalyticsController();


