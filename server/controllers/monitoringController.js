/**
 * Monitoring Controller
 * 
 * Handles HTTP requests/responses for monitoring endpoints.
 * Delegates business logic to MonitoringService.
 */

const monitoringService = require('../services/monitoringService');

class MonitoringController {
  /**
   * GET /api/monitoring/health
   * Overall system health check
   */
  async getHealthStatus(request, response) {
    try {
      const healthStatus = monitoringService.getHealthStatus();
      response.json(healthStatus);
    } catch (error) {
      console.error('[MonitoringController] Health check error:', error);
      response.status(500).json({ error: 'Failed to get health status', details: error.message });
    }
  }

  /**
   * GET /api/monitoring/endpoints
   * Check health of all available endpoints
   */
  async getEndpointsStatus(request, response) {
    try {
      const endpointsStatus = monitoringService.getEndpointsStatus();
      response.json(endpointsStatus);
    } catch (error) {
      console.error('[MonitoringController] Endpoints status error:', error);
      response.status(500).json({ error: 'Failed to get endpoints status', details: error.message });
    }
  }

  /**
   * GET /api/monitoring/services
   * Check status of backend services
   */
  async getServicesStatus(request, response) {
    try {
      const servicesStatus = monitoringService.getServicesStatus();
      response.json(servicesStatus);
    } catch (error) {
      console.error('[MonitoringController] Services status error:', error);
      response.status(500).json({ error: 'Failed to get services status', details: error.message });
    }
  }

  /**
   * GET /api/monitoring/metrics
   * System performance metrics
   */
  async getMetrics(request, response) {
    try {
      const metrics = monitoringService.getMetrics();
      response.json(metrics);
    } catch (error) {
      console.error('[MonitoringController] Metrics error:', error);
      response.status(500).json({ error: 'Failed to get metrics', details: error.message });
    }
  }

  /**
   * GET /api/monitoring/status
   * Quick status check for all systems
   */
  async getSystemStatus(request, response) {
    try {
      const systemStatus = monitoringService.getSystemStatus();
      response.json(systemStatus);
    } catch (error) {
      console.error('[MonitoringController] System status error:', error);
      response.status(500).json({ error: 'Failed to get system status', details: error.message });
    }
  }

  /**
   * POST /api/monitoring/reset
   * Reset monitoring metrics
   */
  async resetMetrics(request, response) {
    try {
      const resetResult = monitoringService.resetMetrics();
      response.json(resetResult);
    } catch (error) {
      console.error('[MonitoringController] Reset metrics error:', error);
      response.status(500).json({ error: 'Failed to reset metrics', details: error.message });
    }
  }
}

module.exports = new MonitoringController();


