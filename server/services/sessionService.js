/**
 * Session Service
 * 
 * Business logic for session operations.
 * Handles session state recovery and persistence.
 */

const UserSession = require('../models/UserSession');
const BroadcastState = require('../models/BroadcastState');

class SessionService {
  /**
   * Retrieve session state for recovery
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Session data with broadcast state
   * @throws {Error} If session not found
   */
  async getSession(sessionId) {
    const session = await UserSession.findOne({ sessionId });

    if (!session) {
      throw new Error('Session not found');
    }

    // Touch session to update last activity
    session.lastActivityAt = new Date();
    await session.save();

    // Also fetch broadcast state for the active channel if available
    let broadcastState = null;
    if (session.activeChannelId) {
      broadcastState = await BroadcastState.findOne({ channelId: session.activeChannelId });
    }

    return {
      session: session.toObject(),
      broadcastState: broadcastState?.toObject() || null,
      recoveredAt: new Date().toISOString(),
    };
  }

  /**
   * Save or update session state
   * @param {string} sessionId - Session ID
   * @param {Object} sessionData - Session data to save
   * @returns {Promise<Object>} Saved session
   */
  async saveSession(sessionId, sessionData) {
    if (!sessionData) {
      throw new Error('No session data provided');
    }

    const currentTime = new Date();

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
        lastActivityAt: currentTime,
        deviceInfo: sessionData.deviceInfo || {},
        // Store recovery state
        recoveryState: {
          lastStableState: sessionData,
          recoveryAttempts: 0,
          lastRecoveryAt: null,
        },
      },
      { upsert: true, new: true }
    );

    return {
      success: true,
      message: 'Session saved',
      session: session.toObject(),
      savedAt: currentTime.toISOString(),
    };
  }

  /**
   * Attempt to recover from a crashed/stale state
   * @param {string} sessionId - Session ID
   * @param {string} reason - Recovery reason
   * @returns {Promise<Object>} Recovery state
   * @throws {Error} If session not found
   */
  async recoverSession(sessionId, reason) {
    const session = await UserSession.findOne({ sessionId });

    if (!session) {
      throw new Error('Session not found for recovery');
    }

    const currentTime = new Date();

    // Increment recovery attempts
    session.recoveryState.recoveryAttempts += 1;
    session.recoveryState.lastRecoveryAt = currentTime;
    session.lastActivityAt = currentTime;

    await session.save();

    // Return the last stable state for recovery
    return {
      success: true,
      message: 'Recovery state retrieved',
      lastStableState: session.recoveryState.lastStableState,
      recoveryAttempts: session.recoveryState.recoveryAttempts,
      reason,
      recoveredAt: currentTime.toISOString(),
    };
  }

  /**
   * Clear session data
   * @param {string} sessionId - Session ID
   * @returns {Promise<Object>} Deletion result
   */
  async clearSession(sessionId) {
    await UserSession.deleteOne({ sessionId });

    return {
      success: true,
      message: 'Session cleared',
      sessionId,
    };
  }

  /**
   * Clear all session data (admin only)
   * @returns {Promise<Object>} Deletion result
   */
  async clearAllSessions() {
    const result = await UserSession.deleteMany({});

    return {
      success: true,
      message: `Cleared ${result.deletedCount} sessions`,
      deletedCount: result.deletedCount,
    };
  }

  /**
   * Health check for sessions
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    const count = await UserSession.countDocuments();
    return {
      status: 'ok',
      sessionCount: count,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all active sessions (admin diagnostic)
   * @returns {Promise<Object>} Active sessions
   */
  async getActiveSessions() {
    // Get sessions active in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const sessions = await UserSession.find({
      lastActivityAt: { $gte: oneHourAgo },
    }).sort({ lastActivityAt: -1 });

    return {
      count: sessions.length,
      sessions: sessions.map((session) => session.toObject()),
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = new SessionService();


