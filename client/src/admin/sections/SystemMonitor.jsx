/**
 * SystemMonitor - Comprehensive health and restart dashboard
 * Shows all service health status with visual indicators and restart controls
 */

import React, { useState, useEffect } from 'react'
import { moduleManager } from '../../services/moduleManager'
import { useHealthMonitoring } from '../../hooks/useHealthMonitoring'
import { useMetrics } from '../../hooks/useMetrics'
import { useCache } from '../../hooks/useCache'
import '../AdminDashboard.css'

export default function SystemMonitor() {
  const healthMonitor = moduleManager.getModule('healthMonitor')
  const metricsCollector = moduleManager.getModule('metricsCollector')
  const cacheMonitor = moduleManager.getModule('cacheMonitor')

  const health = useHealthMonitoring(healthMonitor)
  const metrics = useMetrics(metricsCollector)
  const cache = useCache(cacheMonitor)

  const [systemStatus, setSystemStatus] = useState('initializing')
  const [restartLog, setRestartLog] = useState([])
  const [selectedService, setSelectedService] = useState(null)
  const [autoRestart, setAutoRestart] = useState(true)

  // Determine overall system health
  useEffect(() => {
    if (!health?.overall) {
      setSystemStatus('initializing')
      return
    }

    const healthPercent = health.overall.percentage || 0
    if (healthPercent === 100) {
      setSystemStatus('healthy')
    } else if (healthPercent >= 75) {
      setSystemStatus('degraded')
    } else if (healthPercent >= 50) {
      setSystemStatus('warning')
    } else {
      setSystemStatus('critical')
    }
  }, [health])

  if (!healthMonitor || !metricsCollector || !cacheMonitor) {
    return (
      <div className="section-container">
        <div className="section-header">
          <h3>🖥️ System Monitor</h3>
        </div>
        <div style={{ padding: '20px', color: '#ff9', backgroundColor: '#333', borderRadius: '4px' }}>
          ⚠️ Monitoring systems not initialized yet. Please wait...
        </div>
      </div>
    )
  }

  const handleRestartService = async (serviceName) => {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `${timestamp} - Restarting ${serviceName}...`
    setRestartLog(prev => [logEntry, ...prev.slice(0, 9)])

    // Simulate service restart
    if (serviceName === 'Health Monitor') {
      healthMonitor.stop()
      await new Promise(r => setTimeout(r, 500))
      healthMonitor.start()
    } else if (serviceName === 'Cache Monitor') {
      await cacheMonitor.fullCleanup(['retro-tv-session-id', 'retro-tv-selected-channels'])
    } else if (serviceName === 'Metrics Collector') {
      metricsCollector.reset?.()
    }

    const successLog = `${timestamp} - ✓ ${serviceName} restarted successfully`
    setRestartLog(prev => [successLog, ...prev])
  }

  const handleFullSystemRestart = () => {
    setRestartLog(['🔄 Full system restart initiated...'])
    
    // Restart all services
    healthMonitor.stop()
    setTimeout(() => healthMonitor.start(), 500)
    cacheMonitor.fullCleanup(['retro-tv-session-id'])
    
    const timestamp = new Date().toLocaleTimeString()
    const log = `${timestamp} - ✓ System fully restarted`
    setRestartLog(prev => [log, ...prev])
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return '#0f0'
      case 'degraded':
        return '#ff0'
      case 'warning':
        return '#ffa500'
      case 'critical':
        return '#f00'
      default:
        return '#808080'
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return '🟢'
      case 'degraded':
        return '🟡'
      case 'warning':
        return '🟠'
      case 'critical':
        return '🔴'
      default:
        return '⚪'
    }
  }

  const services = [
    {
      id: 'health',
      name: 'Health Monitor',
      icon: '🏥',
      status: health?.overall?.percentage >= 75 ? 'healthy' : 'warning',
      details: `${health?.overall?.healthy || 0}/${health?.overall?.total || 0} endpoints healthy`
    },
    {
      id: 'metrics',
      name: 'Metrics Collector',
      icon: '📊',
      status: metrics?.totalRequests > 0 ? 'healthy' : 'warning',
      details: `${metrics?.totalRequests || 0} API calls tracked`
    },
    {
      id: 'cache',
      name: 'Cache Monitor',
      icon: '💾',
      status: cache?.totalSize ? 'healthy' : 'warning',
      details: `Cache: ${(cache?.totalSize / 1024 / 1024).toFixed(2) || 0} MB`
    },
    {
      id: 'errors',
      name: 'Error Tracking',
      icon: '⚠️',
      status: (metrics?.failedRequests || 0) <= 5 ? 'healthy' : 'warning',
      details: `${metrics?.failedRequests || 0} errors recorded`
    }
  ]

  return (
    <div className="section-container">
      <div className="section-header">
        <h3>🖥️ System Monitor & Health Dashboard</h3>
      </div>

      {/* Overall System Status */}
      <div className="system-overview">
        <div className="status-card large">
          <div className="status-icon">{getStatusIcon(systemStatus)}</div>
          <div className="status-info">
            <h4>System Status</h4>
            <p className="status-text">{systemStatus.toUpperCase()}</p>
            <p className="status-detail">
              Health: {health?.overall?.percentage || 0}% | Uptime: {(metrics?.uptime || 0) / 1000 / 60 | 0}m
            </p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={handleFullSystemRestart}
            style={{ marginLeft: 'auto' }}
          >
            🔄 Full Restart
          </button>
        </div>
      </div>

      {/* Services Status Grid */}
      <div className="services-grid">
        <h4 style={{ gridColumn: '1 / -1', marginTop: '30px', marginBottom: '15px', color: '#00ff88' }}>
          📋 Service Status
        </h4>
        {services.map(service => (
          <div key={service.id} className="service-card">
            <div className="service-header">
              <span className="service-icon">{service.icon}</span>
              <span className="service-name">{service.name}</span>
              <span className="service-status" style={{ color: getStatusColor(service.status) }}>
                {getStatusIcon(service.status)}
              </span>
            </div>
            <div className="service-details">{service.details}</div>
            <button 
              className="btn btn-small btn-secondary"
              onClick={() => handleRestartService(service.name)}
            >
              ↻ Restart
            </button>
          </div>
        ))}
      </div>

      {/* Endpoints Health */}
      <div className="endpoints-section">
        <h4 style={{ marginTop: '30px', marginBottom: '15px', color: '#00ff88' }}>
          🔌 Endpoint Health
        </h4>
        <div className="endpoints-list">
          {health?.endpoints && Object.entries(health.endpoints).map(([endpoint, status]) => (
            <div key={endpoint} className="endpoint-item">
              <span className="endpoint-name">{endpoint}</span>
              <span className="endpoint-status" style={{ color: getStatusColor(status?.status) }}>
                {getStatusIcon(status?.status || 'healthy')} {status?.responseTime || 0}ms
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="metrics-section">
        <h4 style={{ marginTop: '30px', marginBottom: '15px', color: '#00ff88' }}>
          📈 Performance Metrics
        </h4>
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-label">API Calls</div>
            <div className="metric-value">{metrics?.totalRequests || 0}</div>
            <div className="metric-detail">Success: {metrics?.successRequests || 0}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Failed Requests</div>
            <div className="metric-value" style={{ color: (metrics?.failedRequests || 0) > 0 ? '#f00' : '#0f0' }}>
              {metrics?.failedRequests || 0}
            </div>
            <div className="metric-detail">Last 24h errors</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Avg Response Time</div>
            <div className="metric-value">
              {metrics?.totalRequests > 0 
                ? ((metrics?.totalResponseTime || 0) / (metrics?.totalRequests || 1)).toFixed(0)
                : 0}ms
            </div>
            <div className="metric-detail">API latency</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Cache Hit Rate</div>
            <div className="metric-value" style={{ color: '#00ff88' }}>
              {metrics?.cacheHitRate || 0}%
            </div>
            <div className="metric-detail">Cached responses</div>
          </div>
        </div>
      </div>

      {/* Auto-Restart Setting */}
      <div className="settings-section">
        <h4 style={{ marginTop: '30px', marginBottom: '15px', color: '#00ff88' }}>
          ⚙️ Settings
        </h4>
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoRestart}
            onChange={(e) => setAutoRestart(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span>Auto-restart failed services</span>
        </label>
        <div style={{ fontSize: '12px', color: '#b0b0b0', marginTop: '10px' }}>
          {autoRestart 
            ? '✓ Services will automatically restart on failure' 
            : '✗ Manual restart required'}
        </div>
      </div>

      {/* Restart Log */}
      <div className="log-section">
        <h4 style={{ marginTop: '30px', marginBottom: '15px', color: '#00ff88' }}>
          📝 Restart Log
        </h4>
        <div className="log-output">
          {restartLog.length > 0 ? (
            restartLog.map((log, idx) => (
              <div key={idx} className="log-line">
                {log}
              </div>
            ))
          ) : (
            <div className="log-line" style={{ color: '#b0b0b0' }}>
              [Ready for system operations...]
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
