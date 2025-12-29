/**
 * Analytics Service
 * 
 * Business logic for analytics operations.
 * Handles event tracking, survey responses, and analytics summary.
 * 
 * Note: Uses in-memory storage. Replace with database in production.
 */

// In-memory storage for analytics (replace with database in production)
const analyticsData = {
  sessions: [],
  events: [],
  surveys: []
};

// Limits to prevent memory issues
const MAX_EVENTS = 10000;
const MAX_SURVEYS = 1000;

class AnalyticsService {
  /**
   * Process analytics events from client
   * @param {string} sessionId - Session ID
   * @param {Array} events - Array of events
   * @returns {Promise<Object>} Processing result
   */
  async processEvents(sessionId, events) {
    if (!sessionId || !Array.isArray(events)) {
      throw new Error('Invalid request format');
    }

    // Store events
    analyticsData.events.push(...events.map(event => ({
      ...event,
      receivedAt: Date.now()
    })));

    // Track session if new
    const existingSession = analyticsData.sessions.find(s => s.sessionId === sessionId);
    if (!existingSession) {
      analyticsData.sessions.push({
        sessionId,
        startTime: events[0]?.timestamp || Date.now(),
        lastUpdate: Date.now(),
        eventCount: events.length
      });
    } else {
      existingSession.lastUpdate = Date.now();
      existingSession.eventCount += events.length;
    }

    // Keep only last MAX_EVENTS (prevent memory issues)
    if (analyticsData.events.length > MAX_EVENTS) {
      analyticsData.events = analyticsData.events.slice(-MAX_EVENTS);
    }

    return {
      success: true,
      received: events.length
    };
  }

  /**
   * Process survey response
   * @param {string} ageGroup - Age group
   * @param {Object} answers - Survey answers
   * @param {number} timestamp - Optional timestamp
   * @returns {Promise<Object>} Processing result
   */
  async processSurvey(ageGroup, answers, timestamp) {
    if (!ageGroup || !answers) {
      throw new Error('Invalid survey format');
    }

    // Store survey response
    analyticsData.surveys.push({
      ageGroup,
      answers,
      timestamp: timestamp || Date.now(),
      receivedAt: Date.now()
    });

    // Keep only last MAX_SURVEYS
    if (analyticsData.surveys.length > MAX_SURVEYS) {
      analyticsData.surveys = analyticsData.surveys.slice(-MAX_SURVEYS);
    }

    return { success: true };
  }

  /**
   * Get analytics summary
   * @param {number} startDate - Optional start date timestamp
   * @param {number} endDate - Optional end date timestamp
   * @returns {Promise<Object>} Analytics summary
   */
  async getSummary(startDate, endDate) {
    let filteredEvents = analyticsData.events;
    let filteredSurveys = analyticsData.surveys;

    // Filter by date range if provided
    if (startDate) {
      const start = parseInt(startDate);
      filteredEvents = filteredEvents.filter(event => event.timestamp >= start);
      filteredSurveys = filteredSurveys.filter(survey => survey.timestamp >= start);
    }
    if (endDate) {
      const end = parseInt(endDate);
      filteredEvents = filteredEvents.filter(event => event.timestamp <= end);
      filteredSurveys = filteredSurveys.filter(survey => survey.timestamp <= end);
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
    };

    // Count event types
    filteredEvents.forEach(event => {
      summary.eventTypes[event.eventName] = (summary.eventTypes[event.eventName] || 0) + 1;

      if (event.eventName === 'channel_change') summary.channelChanges++;
      if (event.eventName === 'tv_power_on') summary.powerOns++;
      if (event.eventName === 'tv_power_off') summary.powerOffs++;
      if (event.eventName === 'menu_open') summary.menuOpens++;
      if (event.eventName === 'fullscreen_enter') summary.fullscreenEnters++;
      if (event.eventName === 'error') summary.errors++;

      if (event.ageGroup) {
        summary.ageGroups[event.ageGroup] = (summary.ageGroups[event.ageGroup] || 0) + 1;
      }
    });

    // Calculate survey averages
    const easeOfUseAnswers = filteredSurveys
      .map(survey => survey.answers.ease_of_use)
      .filter(answer => answer !== undefined);

    const satisfactionAnswers = filteredSurveys
      .map(survey => survey.answers.satisfaction)
      .filter(answer => answer !== undefined);

    if (easeOfUseAnswers.length > 0) {
      summary.averageEaseOfUse = (
        easeOfUseAnswers.reduce((sum, value) => sum + value, 0) / easeOfUseAnswers.length
      ).toFixed(2);
    }

    if (satisfactionAnswers.length > 0) {
      summary.averageSatisfaction = (
        satisfactionAnswers.reduce((sum, value) => sum + value, 0) / satisfactionAnswers.length
      ).toFixed(2);
    }

    return summary;
  }

  /**
   * Get raw events for detailed analysis
   * @param {number} limit - Maximum number of events to return
   * @param {string} eventType - Optional event type filter
   * @returns {Promise<Object>} Events data
   */
  async getEvents(limit, eventType) {
    let events = analyticsData.events;

    if (eventType) {
      events = events.filter(event => event.eventName === eventType);
    }

    // Return most recent events
    events = events.slice(-parseInt(limit));

    return {
      events,
      total: analyticsData.events.length
    };
  }

  /**
   * Get survey responses
   * @param {string} ageGroup - Optional age group filter
   * @returns {Promise<Object>} Surveys data
   */
  async getSurveys(ageGroup) {
    let surveys = analyticsData.surveys;

    if (ageGroup) {
      surveys = surveys.filter(survey => survey.ageGroup === ageGroup);
    }

    return {
      surveys,
      total: analyticsData.surveys.length
    };
  }
}

module.exports = new AnalyticsService();


