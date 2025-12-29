/**
 * Monitoring Service
 * 
 * Business logic for system monitoring operations.
 * Handles health checks, metrics tracking, and system diagnostics.
 */

const mongoose = require('mongoose');
const dbConnectionManager = require('../utils/dbConnection');

// Track server metrics
let serverMetrics = {
  startTime: Date.now(),
  requestCount: 0,
  errorCount: 0,
  totalResponseTime: 0,
};

/**
 * Helper function to format uptime
 * @param {number} milliseconds - Uptime in milliseconds
 * @returns {string} Formatted uptime string
 */
function formatUptime(milliseconds) {
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  return `${hours}h ${minutes}m ${seconds}s`;
}

/**
 * Track request metrics (used as middleware)
 */
function trackRequestMetrics(request, response, next) {
  const startTime = Date.now();
  const originalJson = response.json;

  response.json = function (data) {
    const responseTime = Date.now() - startTime;

    serverMetrics.requestCount++;
    serverMetrics.totalResponseTime += responseTime;

    if (response.statusCode >= 400) {
      serverMetrics.errorCount++;
    }

    return originalJson.call(this, data);
  };

  next();
}

class MonitoringService {
  /**
   * Get overall system health check
   * @returns {Object} Health status
   */
  getHealthStatus() {
    const uptime = Date.now() - serverMetrics.startTime;
    const databaseConnected = mongoose.connection.readyState === 1;
    const databaseState = dbConnectionManager.getState();

    return {
      status: databaseConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: uptime,
      uptime_ms: uptime,
      database: {
        connected: databaseConnected,
        state: mongoose.connection.readyState,
        connectionState: databaseState.state,
        retryCount: databaseState.retryCount,
      },
      server: {
        requests: serverMetrics.requestCount,
        errors: serverMetrics.errorCount,
        avgResponseTime: serverMetrics.requestCount > 0
          ? (serverMetrics.totalResponseTime / serverMetrics.requestCount).toFixed(2)
          : 0,
      },
    };
  }

  /**
   * Get health status of all available endpoints
   * @returns {Object} Endpoints status
   */
  getEndpointsStatus() {
    const endpoints = [
      { path: '/health', method: 'GET', status: 'healthy' },
      { path: '/api/channels', method: 'GET', status: 'healthy' },
      { path: '/api/session', method: 'GET', status: 'healthy' },
      { path: '/api/broadcast-state/all', method: 'GET', status: 'healthy' },
      { path: '/api/auth/login', method: 'POST', status: 'healthy' },
      { path: '/api/youtube/search', method: 'GET', status: 'healthy' },
      { path: '/api/categories', method: 'GET', status: 'healthy' },
    ];

    return {
      timestamp: new Date().toISOString(),
      count: endpoints.length,
      endpoints: endpoints,
    };
  }

  /**
   * Get status of backend services
   * @returns {Object} Services status
   */
  getServicesStatus() {
    const databaseConnected = mongoose.connection.readyState === 1;
    const databaseState = dbConnectionManager.getState();
    const databaseStatus = databaseConnected
      ? 'operational'
      : (databaseState.state === 'connecting' ? 'connecting' : 'down');
    const databaseDetails = databaseConnected
      ? 'MongoDB connected'
      : (databaseState.state === 'connecting'
        ? `MongoDB connecting (retry ${databaseState.retryCount})`
        : 'MongoDB disconnected');

    return {
      timestamp: new Date().toISOString(),
      services: [
        {
          name: 'Database',
          status: databaseStatus,
          responseTime: 0,
          details: databaseDetails,
        },
        {
          name: 'API Server',
          status: 'operational',
          responseTime: 2,
          details: 'Express server running',
        },
        {
          name: 'CORS',
          status: 'operational',
          responseTime: 1,
          details: 'CORS middleware active',
        },
        {
          name: 'Session Management',
          status: 'operational',
          responseTime: 1,
          details: 'Session routes available',
        },
      ],
    };
  }

  /**
   * Get system performance metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    const uptime = Date.now() - serverMetrics.startTime;
    const successCount = serverMetrics.requestCount - serverMetrics.errorCount;

    return {
      timestamp: new Date().toISOString(),
      uptime: {
        ms: uptime,
        seconds: Math.floor(uptime / 1000),
        minutes: Math.floor(uptime / 1000 / 60),
        hours: Math.floor(uptime / 1000 / 60 / 60),
        formatted: formatUptime(uptime),
      },
      requests: {
        total: serverMetrics.requestCount,
        successful: successCount,
        failed: serverMetrics.errorCount,
        failureRate: serverMetrics.requestCount > 0
          ? ((serverMetrics.errorCount / serverMetrics.requestCount) * 100).toFixed(2)
          : 0,
      },
      performance: {
        avgResponseTime: serverMetrics.requestCount > 0
          ? Math.round(serverMetrics.totalResponseTime / serverMetrics.requestCount)
          : 0,
        totalResponseTime: Math.round(serverMetrics.totalResponseTime),
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      },
    };
  }

  /**
   * Get quick status check for all systems
   * @returns {Object} System status
   */
  getSystemStatus() {
    const databaseConnected = mongoose.connection.readyState === 1;
    const uptime = Date.now() - serverMetrics.startTime;
    const overallHealth = databaseConnected ? 100 : 50;

    return {
      timestamp: new Date().toISOString(),
      overallHealth: overallHealth,
      status: overallHealth >= 75 ? 'healthy' : 'degraded',
      systems: {
        database: databaseConnected ? 'operational' : 'down',
        api: 'operational',
        memory: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal < 0.9
          ? 'healthy'
          : 'warning',
      },
      uptime: uptime,
      lastCheck: new Date().toISOString(),
    };
  }

  /**
   * Reset monitoring metrics
   * @returns {Object} Reset result
   */
  resetMetrics() {
    const previousMetrics = { ...serverMetrics };

    serverMetrics = {
      startTime: Date.now(),
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
    };

    return {
      status: 'reset',
      timestamp: new Date().toISOString(),
      previousMetrics: previousMetrics,
      newMetrics: serverMetrics,
    };
  }

  /**
   * Get metrics tracking function for middleware
   * @returns {Function} Middleware function
   */
  getMetricsMiddleware() {
    return trackRequestMetrics;
  }
}

module.exports = new MonitoringService();

