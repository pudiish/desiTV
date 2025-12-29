/**
 * Session Controller
 * 
 * Handles HTTP requests/responses for session endpoints.
 * Delegates business logic to SessionService.
 */

const sessionService = require('../services/sessionService');

class SessionController {
  /**
   * GET /api/session/:sessionId
   * Retrieve session state for recovery
   */
  async getSession(request, response) {
    try {
      const { sessionId } = request.params;
      const result = await sessionService.getSession(sessionId);
      response.json(result);
    } catch (error) {
      if (error.message === 'Session not found') {
        return response.status(404).json({
          error: 'Session not found',
          sessionId: request.params.sessionId,
          message: 'No session exists - will create new on save',
        });
      }
      console.error('[SessionController] GET error:', error);
      response.status(500).json({ error: 'Failed to retrieve session', details: error.message });
    }
  }

  /**
   * POST /api/session/:sessionId
   * Save or update session state
   */
  async saveSession(request, response) {
    try {
      const { sessionId } = request.params;
      const sessionData = request.body;
      const result = await sessionService.saveSession(sessionId, sessionData);
      response.json(result);
    } catch (error) {
      if (error.message === 'No session data provided') {
        return response.status(400).json({ error: error.message });
      }
      console.error('[SessionController] POST error:', error);
      response.status(500).json({ error: 'Failed to save session', details: error.message });
    }
  }

  /**
   * POST /api/session/:sessionId/recovery
   * Attempt to recover from a crashed/stale state
   */
  async recoverSession(request, response) {
    try {
      const { sessionId } = request.params;
      const { reason } = request.body;
      const result = await sessionService.recoverSession(sessionId, reason);
      response.json(result);
    } catch (error) {
      if (error.message === 'Session not found for recovery') {
        return response.status(404).json({ error: error.message });
      }
      console.error('[SessionController] Recovery error:', error);
      response.status(500).json({ error: 'Failed to recover session', details: error.message });
    }
  }

  /**
   * DELETE /api/session/:sessionId
   * Clear session data
   */
  async clearSession(request, response) {
    try {
      const { sessionId } = request.params;
      const result = await sessionService.clearSession(sessionId);
      response.json(result);
    } catch (error) {
      console.error('[SessionController] DELETE error:', error);
      response.status(500).json({ error: 'Failed to clear session', details: error.message });
    }
  }

  /**
   * DELETE /api/session/clear-all
   * Clear all session data (admin only)
   */
  async clearAllSessions(request, response) {
    try {
      const result = await sessionService.clearAllSessions();
      response.json(result);
    } catch (error) {
      console.error('[SessionController] Clear all error:', error);
      response.status(500).json({ error: 'Failed to clear all sessions', details: error.message });
    }
  }

  /**
   * GET /api/session/health
   * Health check endpoint
   */
  async getHealthStatus(request, response) {
    try {
      const result = await sessionService.getHealthStatus();
      response.json(result);
    } catch (error) {
      response.status(500).json({ status: 'error', error: error.message });
    }
  }

  /**
   * GET /api/session/active/all
   * Get all active sessions (admin diagnostic)
   */
  async getActiveSessions(request, response) {
    try {
      const result = await sessionService.getActiveSessions();
      response.json(result);
    } catch (error) {
      console.error('[SessionController] GetAll error:', error);
      response.status(500).json({ error: 'Failed to get sessions', details: error.message });
    }
  }
}

module.exports = new SessionController();


