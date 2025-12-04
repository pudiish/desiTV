/**
 * ComponentHealth - Admin section for component and system metrics
 * Shows performance metrics, error tracking, and system status
 */

import React, { useState, useEffect } from 'react'
import { moduleManager } from '../../services/moduleManager'
import { useMetrics } from '../../hooks/useMetrics'
import { useErrors } from '../../hooks/useErrors'
import '../AdminDashboard.css'

export default function ComponentHealth() {
  const metricsCollector = moduleManager.getModule('metricsCollector')
  const errorAggregator = moduleManager.getModule('errorAggregator')
  const metrics = useMetrics(metricsCollector)
  const errors = useErrors(errorAggregator)
  const [expandedSection, setExpandedSection] = useState(null)

  const formatUptime = (ms) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const getHealthColor = (value) => {
    if (value > 90) return '#0f0' // green
    if (value > 70) return '#ff0' // yellow
    return '#f00' // red
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <h3>📊 System & Component Health</h3>
        <button className="btn btn-primary" onClick={() => metricsCollector?.reset()}>
          Reset Metrics
        </button>
      </div>

      {/* Metrics Summary */}
      <div className="health-grid">
        <div className="health-card">
          <div className="health-icon">⏱️</div>
          <h4>Session Uptime</h4>
          <p style={{ fontSize: '18px', fontWeight: 'bold' }}>
            {formatUptime(metrics.uptime)}
          </p>
        </div>

        <div className="health-card">
          <div className="health-icon">🔄</div>
          <h4>API Calls</h4>
          <p style={{ fontSize: '18px', fontWeight: 'bold' }}>
            {metrics.apiCalls?.total || 0}
          </p>
          <small style={{ color: '#0f0' }}>✓ {metrics.apiCalls?.success || 0}</small>
          <small style={{ color: '#f00', marginLeft: '10px' }}>
            ✗ {metrics.apiCalls?.failed || 0}
          </small>
        </div>

        <div className="health-card">
          <div className="health-icon">⚡</div>
          <h4>Avg Response Time</h4>
          <p style={{ fontSize: '18px', fontWeight: 'bold' }}>
            {metrics.averageResponseTime || 0}ms
          </p>
        </div>

        <div className="health-card">
          <div className="health-icon">💾</div>
          <h4>Cache Hit Rate</h4>
          <p style={{ fontSize: '18px', fontWeight: 'bold', color: getHealthColor(metrics.cacheHitRate) }}>
            {metrics.cacheHitRate || 0}%
          </p>
        </div>
      </div>

      {/* API Calls Breakdown */}
      <div className="section-content">
        <h4>API Calls Breakdown</h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '15px',
            marginTop: '15px',
          }}
        >
          <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#1a1a1a', borderRadius: '4px' }}>
            <div style={{ color: '#999', fontSize: '12px' }}>Total Calls</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold' }}>
              {metrics.apiCalls?.total || 0}
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#1a3a1a', borderRadius: '4px' }}>
            <div style={{ color: '#999', fontSize: '12px' }}>Successful</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f0' }}>
              {metrics.apiCalls?.success || 0}
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#3a1a1a', borderRadius: '4px' }}>
            <div style={{ color: '#999', fontSize: '12px' }}>Failed</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f00' }}>
              {metrics.apiCalls?.failed || 0}
            </div>
          </div>

          <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#1a2a3a', borderRadius: '4px' }}>
            <div style={{ color: '#999', fontSize: '12px' }}>Pending</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0ff' }}>
              {metrics.apiCalls?.pending || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Error Summary */}
      {errors.total > 0 && (
        <div className="section-content" style={{ backgroundColor: '#3a1a1a', borderColor: '#f00' }}>
          <h4 style={{ color: '#f00' }}>⚠️ Errors ({errors.total})</h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '10px',
              marginTop: '10px',
            }}
          >
            <div>
              <div style={{ color: '#f00', fontWeight: 'bold', fontSize: '16px' }}>
                {errors.bySeverity?.critical || 0}
              </div>
              <small style={{ color: '#999' }}>Critical</small>
            </div>
            <div>
              <div style={{ color: '#ff6600', fontWeight: 'bold', fontSize: '16px' }}>
                {errors.bySeverity?.high || 0}
              </div>
              <small style={{ color: '#999' }}>High</small>
            </div>
            <div>
              <div style={{ color: '#ff0', fontWeight: 'bold', fontSize: '16px' }}>
                {errors.bySeverity?.medium || 0}
              </div>
              <small style={{ color: '#999' }}>Medium</small>
            </div>
            <div>
              <div style={{ color: '#0ff', fontWeight: 'bold', fontSize: '16px' }}>
                {errors.bySeverity?.low || 0}
              </div>
              <small style={{ color: '#999' }}>Low</small>
            </div>
          </div>

          {/* Recent Errors */}
          {errors.recent?.length > 0 && (
            <div style={{ marginTop: '15px' }}>
              <h5>Recent Errors</h5>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', maxHeight: '200px', overflowY: 'auto' }}>
                {errors.recent.map((error, idx) => (
                  <div key={idx} style={{ padding: '5px', borderBottom: '1px solid #333', color: '#f00' }}>
                    <strong>{error.type}</strong>: {error.message}
                    <div style={{ color: '#999', fontSize: '10px' }}>
                      {error.timestamp?.split('T')[1]?.slice(0, 8)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Response Times Chart */}
      <div className="section-content">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setExpandedSection(expandedSection === 'times' ? null : 'times')}
        >
          <h4 style={{ margin: 0 }}>Response Time History</h4>
          <span>{expandedSection === 'times' ? '▼' : '▶'}</span>
        </div>

        {expandedSection === 'times' && metrics.responseTimes && (
          <div style={{ marginTop: '15px' }}>
            <div style={{ fontSize: '11px', fontFamily: 'monospace' }}>
              {metrics.responseTimes.slice(-10).reverse().map((entry, idx) => (
                <div key={idx} style={{ padding: '3px 0', display: 'flex', gap: '10px' }}>
                  <span style={{ width: '60px', color: '#999' }}>
                    {entry.duration}ms
                  </span>
                  <span
                    style={{
                      color: entry.status >= 200 && entry.status < 300 ? '#0f0' : '#f00',
                      width: '40px',
                    }}
                  >
                    {entry.status}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: '16px',
                      backgroundColor: entry.status >= 200 && entry.status < 300 ? '#0a3a0a' : '#3a0a0a',
                      borderRadius: '2px',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(entry.duration / 10, 100)}%`,
                        backgroundColor: entry.status >= 200 && entry.status < 300 ? '#0f0' : '#f00',
                        borderRadius: '2px',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .section-content {
          background: #0a0a0a;
          border: 1px solid #333;
          border-radius: 4px;
          padding: 15px;
          margin-top: 15px;
        }
      `}</style>
    </div>
  )
}
