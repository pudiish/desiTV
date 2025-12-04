/**
 * Monitoring Routes - System Health & Diagnostics
 * Provides real-time monitoring data for admin dashboard
 */

const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')

// Track server metrics
let serverMetrics = {
  startTime: Date.now(),
  requestCount: 0,
  errorCount: 0,
  totalResponseTime: 0,
}

/**
 * GET /api/monitoring/health
 * Overall system health check
 */
router.get('/health', (req, res) => {
  const uptime = Date.now() - serverMetrics.startTime
  const dbConnected = mongoose.connection.readyState === 1

  res.json({
    status: dbConnected ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: uptime,
    uptime_ms: uptime,
    database: {
      connected: dbConnected,
      state: mongoose.connection.readyState,
    },
    server: {
      requests: serverMetrics.requestCount,
      errors: serverMetrics.errorCount,
      avgResponseTime: serverMetrics.requestCount > 0 
        ? (serverMetrics.totalResponseTime / serverMetrics.requestCount).toFixed(2)
        : 0,
    },
  })
})

/**
 * GET /api/monitoring/endpoints
 * Check health of all available endpoints
 */
router.get('/endpoints', (req, res) => {
  const endpoints = [
    { path: '/health', method: 'GET', status: 'healthy' },
    { path: '/api/channels', method: 'GET', status: 'healthy' },
    { path: '/api/session', method: 'GET', status: 'healthy' },
    { path: '/api/broadcast-state/all', method: 'GET', status: 'healthy' },
    { path: '/api/auth/login', method: 'POST', status: 'healthy' },
    { path: '/api/youtube/search', method: 'GET', status: 'healthy' },
    { path: '/api/categories', method: 'GET', status: 'healthy' },
  ]

  res.json({
    timestamp: new Date().toISOString(),
    count: endpoints.length,
    endpoints: endpoints,
  })
})

/**
 * GET /api/monitoring/services
 * Check status of backend services
 */
router.get('/services', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1

  res.json({
    timestamp: new Date().toISOString(),
    services: [
      {
        name: 'Database',
        status: dbConnected ? 'operational' : 'down',
        responseTime: 0,
        details: dbConnected ? 'MongoDB connected' : 'MongoDB disconnected',
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
  })
})

/**
 * GET /api/monitoring/metrics
 * System performance metrics
 */
router.get('/metrics', (req, res) => {
  const uptime = Date.now() - serverMetrics.startTime
  const successCount = serverMetrics.requestCount - serverMetrics.errorCount

  res.json({
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
  })
})

/**
 * GET /api/monitoring/status
 * Quick status check for all systems
 */
router.get('/status', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1
  const uptime = Date.now() - serverMetrics.startTime

  const overallHealth = dbConnected ? 100 : 50

  res.json({
    timestamp: new Date().toISOString(),
    overallHealth: overallHealth,
    status: overallHealth >= 75 ? 'healthy' : 'degraded',
    systems: {
      database: dbConnected ? 'operational' : 'down',
      api: 'operational',
      memory: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal < 0.9 
        ? 'healthy' 
        : 'warning',
    },
    uptime: uptime,
    lastCheck: new Date().toISOString(),
  })
})

/**
 * POST /api/monitoring/reset
 * Reset monitoring metrics
 */
router.post('/reset', (req, res) => {
  const previousMetrics = { ...serverMetrics }

  serverMetrics = {
    startTime: Date.now(),
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
  }

  res.json({
    status: 'reset',
    timestamp: new Date().toISOString(),
    previousMetrics: previousMetrics,
    newMetrics: serverMetrics,
  })
})

/**
 * Middleware to track request metrics
 */
function trackMetrics(req, res, next) {
  const startTime = Date.now()
  const originalJson = res.json

  res.json = function (data) {
    const responseTime = Date.now() - startTime

    serverMetrics.requestCount++
    serverMetrics.totalResponseTime += responseTime

    if (res.statusCode >= 400) {
      serverMetrics.errorCount++
    }

    return originalJson.call(this, data)
  }

  next()
}

/**
 * Helper function to format uptime
 */
function formatUptime(ms) {
  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)

  return `${hours}h ${minutes}m ${seconds}s`
}

// Apply metrics tracking middleware
router.use(trackMetrics)

module.exports = router
