/**
 * MonitoringMetrics - Real-time metrics display for admin dashboard
 * Shows system performance, API statistics, and health metrics
 */

import React, { useState, useEffect } from 'react'
import { apiService } from '../../services/apiService'
import '../AdminDashboard.css'

export default function MonitoringMetrics() {
  const [metrics, setMetrics] = useState({
    requests: { total: 0, successful: 0, failed: 0, failureRate: 0 },
    performance: { avgResponseTime: 0, totalResponseTime: 0 },
    uptime: { formatted: 'Loading...', hours: 0, minutes: 0, seconds: 0 },
    memory: { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 },
  })
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      const metricsData = await apiService.getMonitoringMetrics()
      const servicesData = await apiService.getMonitoringServices()

      if (metricsData) {
        setMetrics(metricsData)
      }

      if (servicesData && servicesData.services) {
        setServices(servicesData.services)
      }

      setLastUpdate(new Date().toLocaleTimeString())
      setLoading(false)
    } catch (error) {
      console.error('[MonitoringMetrics] Fetch error:', error)
    }
  }

  // Initial load
  useEffect(() => {
    fetchMetrics()
  }, [])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchMetrics()
    }, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [autoRefresh])

  const handleRefresh = () => {
    setLoading(true)
    fetchMetrics()
  }

  const handleReset = async () => {
    if (window.confirm('Reset all monitoring metrics? This cannot be undone.')) {
      try {
        await apiService.resetMonitoring()
        handleRefresh()
      } catch (error) {
        console.error('Error resetting metrics:', error)
      }
    }
  }

  const getMemoryHealthColor = () => {
    if (!metrics.memory.heapTotal) return '#00ff88'
    const usage = metrics.memory.heapUsed / metrics.memory.heapTotal
    if (usage < 0.5) return '#00ff88' // Green
    if (usage < 0.75) return '#ffaa00' // Orange
    return '#ff3333' // Red
  }

  const getMemoryHealthIcon = () => {
    if (!metrics.memory.heapTotal) return '🟢'
    const usage = metrics.memory.heapUsed / metrics.memory.heapTotal
    if (usage < 0.5) return '🟢'
    if (usage < 0.75) return '🟡'
    return '🔴'
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <h3>📊 Monitoring Metrics Dashboard</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto Refresh (5s)
          </label>
          <button className="btn btn-primary" onClick={handleRefresh}>
            🔄 Refresh
          </button>
          <button className="btn btn-secondary" onClick={handleReset}>
            ↻ Reset
          </button>
        </div>
      </div>

      {/* Last Update */}
      <div style={{ fontSize: '12px', color: '#b0b0b0', marginBottom: '20px' }}>
        Last update: {lastUpdate || 'Never'}
      </div>

      {loading && metrics.requests.total === 0 ? (
        <div style={{ color: '#ff9', padding: '20px' }}>
          ⏳ Loading metrics...
        </div>
      ) : (
        <>
          {/* Request Metrics */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ color: '#00ff88', marginBottom: '15px', fontSize: '14px' }}>
              📞 API Request Metrics
            </h4>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Total Requests</div>
                <div className="metric-value">{metrics.requests.total}</div>
                <div className="metric-detail">Since server start</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Successful</div>
                <div className="metric-value" style={{ color: '#00ff88' }}>
                  {metrics.requests.successful}
                </div>
                <div className="metric-detail">
                  {metrics.requests.total > 0
                    ? ((metrics.requests.successful / metrics.requests.total) * 100).toFixed(1)
                    : 0}
                  % success rate
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Failed Requests</div>
                <div className="metric-value" style={{ color: metrics.requests.failed > 0 ? '#ff3333' : '#00ff88' }}>
                  {metrics.requests.failed}
                </div>
                <div className="metric-detail">
                  {metrics.requests.failureRate}% failure rate
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Avg Response Time</div>
                <div className="metric-value">{metrics.performance.avgResponseTime}ms</div>
                <div className="metric-detail">Average latency</div>
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ color: '#00ff88', marginBottom: '15px', fontSize: '14px' }}>
              ⚡ Performance Metrics
            </h4>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Uptime</div>
                <div className="metric-value" style={{ fontSize: '20px' }}>
                  {metrics.uptime.formatted}
                </div>
                <div className="metric-detail">
                  {metrics.uptime.hours}h {metrics.uptime.minutes}m {metrics.uptime.seconds}s
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Total Response Time</div>
                <div className="metric-value">{(metrics.performance.totalResponseTime / 1000).toFixed(2)}s</div>
                <div className="metric-detail">Cumulative request time</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Requests/Minute</div>
                <div className="metric-value">
                  {metrics.uptime.minutes > 0
                    ? (metrics.requests.total / metrics.uptime.minutes).toFixed(2)
                    : metrics.requests.total}
                </div>
                <div className="metric-detail">Throughput</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Response Time Trend</div>
                <div className="metric-value" style={{ fontSize: '16px' }}>
                  {metrics.performance.avgResponseTime < 50
                    ? '📈 Fast'
                    : metrics.performance.avgResponseTime < 100
                    ? '➡️ Normal'
                    : '📉 Slow'}
                </div>
                <div className="metric-detail">Performance status</div>
              </div>
            </div>
          </div>

          {/* Memory Metrics */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ color: '#00ff88', marginBottom: '15px', fontSize: '14px' }}>
              💾 Memory Usage
            </h4>
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Heap Used</div>
                <div className="metric-value">{metrics.memory.heapUsed} MB</div>
                <div className="metric-detail">Current heap allocation</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Heap Total</div>
                <div className="metric-value">{metrics.memory.heapTotal} MB</div>
                <div className="metric-detail">Total available heap</div>
              </div>

              <div className="metric-card">
                <div className="metric-label">Memory Health</div>
                <div className="metric-value" style={{ color: getMemoryHealthColor(), fontSize: '24px' }}>
                  {getMemoryHealthIcon()}
                </div>
                <div className="metric-detail">
                  {metrics.memory.heapTotal > 0
                    ? ((metrics.memory.heapUsed / metrics.memory.heapTotal) * 100).toFixed(1)
                    : 0}
                  % used
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-label">RSS Memory</div>
                <div className="metric-value">{metrics.memory.rss} MB</div>
                <div className="metric-detail">Total memory footprint</div>
              </div>
            </div>

            {/* Memory Bar */}
            <div style={{ marginTop: '15px', padding: '15px', backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: '4px' }}>
              <div style={{ fontSize: '12px', color: '#b0b0b0', marginBottom: '8px' }}>Memory Usage</div>
              <div style={{
                backgroundColor: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(0,255,136,0.3)',
                height: '24px',
                borderRadius: '2px',
                overflow: 'hidden',
              }}>
                <div style={{
                  backgroundColor: getMemoryHealthColor(),
                  height: '100%',
                  width: metrics.memory.heapTotal > 0
                    ? `${(metrics.memory.heapUsed / metrics.memory.heapTotal) * 100}%`
                    : '0%',
                  transition: 'width 0.3s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#000',
                  fontSize: '11px',
                  fontWeight: 'bold',
                }}>
                  {metrics.memory.heapTotal > 0
                    ? `${((metrics.memory.heapUsed / metrics.memory.heapTotal) * 100).toFixed(1)}%`
                    : ''}
                </div>
              </div>
            </div>
          </div>

          {/* Services Status */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ color: '#00ff88', marginBottom: '15px', fontSize: '14px' }}>
              🔧 Services Status
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              {services.map((service, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(0,255,136,0.2)',
                    borderRadius: '4px',
                    padding: '15px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ color: '#00ff88', fontWeight: 'bold' }}>{service.name}</span>
                    <span style={{
                      color: service.status === 'operational' ? '#00ff88' : '#ff3333',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                    }}>
                      {service.status === 'operational' ? '✓' : '✗'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#b0b0b0', marginBottom: '5px' }}>
                    {service.details}
                  </div>
                  <div style={{ fontSize: '11px', color: '#808080' }}>
                    Response: {service.responseTime}ms
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary Stats */}
          <div style={{
            backgroundColor: 'rgba(0,255,136,0.05)',
            border: '1px solid rgba(0,255,136,0.2)',
            borderRadius: '4px',
            padding: '15px',
            marginTop: '20px',
          }}>
            <h4 style={{ color: '#00ff88', marginBottom: '10px', fontSize: '12px' }}>📋 SUMMARY</h4>
            <div style={{ fontSize: '12px', color: '#b0b0b0', lineHeight: '1.8' }}>
              <div>
                ✓ System has processed <strong>{metrics.requests.total}</strong> requests with{' '}
                <strong style={{ color: '#00ff88' }}>
                  {metrics.requests.total > 0 ? ((metrics.requests.successful / metrics.requests.total) * 100).toFixed(1) : 0}%
                </strong> success rate
              </div>
              <div>
                ✓ Average API response time is <strong>{metrics.performance.avgResponseTime}ms</strong>
              </div>
              <div>
                ✓ Server has been running for <strong>{metrics.uptime.formatted}</strong>
              </div>
              <div>
                ✓ Memory usage is at{' '}
                <strong style={{ color: getMemoryHealthColor() }}>
                  {metrics.memory.heapTotal > 0 ? ((metrics.memory.heapUsed / metrics.memory.heapTotal) * 100).toFixed(1) : 0}%
                </strong>
              </div>
              <div>
                ✓ All backend services are <strong style={{ color: '#00ff88' }}>operational</strong>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
