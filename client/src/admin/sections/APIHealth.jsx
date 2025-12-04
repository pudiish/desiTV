/**
 * APIHealth - Enhanced admin section for API health monitoring
 * Shows detailed API endpoint status, response times, and health metrics
 */

import React, { useState, useEffect } from 'react'
import { moduleManager } from '../../services/moduleManager'
import { useHealthMonitoring } from '../../hooks/useHealthMonitoring'
import '../AdminDashboard.css'

export default function APIHealth() {
  const healthMonitor = moduleManager.getModule('healthMonitor')
  const health = useHealthMonitoring(healthMonitor)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)

  useEffect(() => {
    if (autoRefresh && healthMonitor) {
      const interval = setInterval(() => {
        healthMonitor.checkHealth()
        setLastRefresh(new Date().toLocaleTimeString())
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [autoRefresh, healthMonitor])

  const handleRefresh = async () => {
    if (healthMonitor) {
      await healthMonitor.checkHealth()
      setLastRefresh(new Date().toLocaleTimeString())
    }
  }

  const getStatusIcon = (status) => {
    if (status === 'healthy') return '🟢'
    if (status === 'unhealthy') return '🔴'
    return '🟡'
  }

  const getStatusColor = (status) => {
    if (status === 'healthy') return '#0f0'
    if (status === 'unhealthy') return '#f00'
    return '#ff0'
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <h3>🔌 API Health Monitor</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto Refresh
          </label>
          <button className="btn btn-primary" onClick={handleRefresh}>
            Refresh Now
          </button>
        </div>
      </div>

      {/* Overall Health */}
      <div className="health-grid">
        <div className="health-card">
          <div className="health-icon">{getStatusIcon(health.overall?.percentage === 100 ? 'healthy' : 'unhealthy')}</div>
          <h4>Overall Health</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold' }}>{health.overall?.percentage || 0}%</p>
          <small>
            {health.overall?.healthy || 0}/{health.overall?.total || 0} endpoints
          </small>
        </div>

        <div className="health-card">
          <div className="health-icon">✅</div>
          <h4>Healthy Endpoints</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f0' }}>
            {health.overall?.healthy || 0}
          </p>
        </div>

        <div className="health-card">
          <div className="health-icon">❌</div>
          <h4>Unhealthy Endpoints</h4>
          <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#f00' }}>
            {health.overall?.unhealthy || 0}
          </p>
        </div>

        <div className="health-card">
          <div className="health-icon">⏱️</div>
          <h4>Last Check</h4>
          <p style={{ fontSize: '12px' }}>{lastRefresh || health.lastCheck?.split('T')[1]?.slice(0, 8) || 'Never'}</p>
        </div>
      </div>

      {/* Detailed Endpoint Status */}
      <div className="section-content">
        <h4>Endpoint Status</h4>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Response Time</th>
                <th>Last Check</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(health.endpoints || {}).map(([endpoint, status]) => (
                <tr key={endpoint}>
                  <td style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                    {endpoint.replace('/api/', '').replace('/health', 'HEALTH')}
                  </td>
                  <td style={{ color: getStatusColor(status?.status) }}>
                    {getStatusIcon(status?.status)} {status?.status}
                  </td>
                  <td>{status?.duration ? `${status.duration}ms` : 'N/A'}</td>
                  <td style={{ fontSize: '11px' }}>
                    {status?.timestamp?.split('T')[1]?.slice(0, 8) || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error Display */}
      {Object.values(health.endpoints || {}).some((s) => s.status === 'unhealthy') && (
        <div className="section-content" style={{ backgroundColor: '#300', borderColor: '#f00' }}>
          <h4 style={{ color: '#f00' }}>⚠️ Unhealthy Endpoints Detected</h4>
          <ul style={{ marginLeft: '20px', fontSize: '12px' }}>
            {Object.entries(health.endpoints || {})
              .filter(([_, status]) => status?.status === 'unhealthy')
              .map(([endpoint, status]) => (
                <li key={endpoint}>
                  <strong>{endpoint}</strong>: {status?.error || 'No response'}
                </li>
              ))}
          </ul>
        </div>
      )}

      <style jsx>{`
        .data-table {
          width: 100%;
          border-collapse: collapse;
          background: #111;
          border: 1px solid #333;
          font-family: monospace;
          font-size: 12px;
        }

        .data-table thead {
          background: #222;
          border-bottom: 1px solid #333;
        }

        .data-table th,
        .data-table td {
          padding: 10px;
          border-right: 1px solid #333;
          text-align: left;
        }

        .data-table tbody tr:hover {
          background: #1a1a1a;
        }

        .section-content {
          background: #0a0a0a;
          border: 1px solid #333;
          border-radius: 4px;
          padding: 15px;
          margin-top: 15px;
          font-size: 13px;
        }
      `}</style>
    </div>
  )
}
