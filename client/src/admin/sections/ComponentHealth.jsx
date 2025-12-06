/**
 * ComponentHealth - Simplified version (monitoring removed)
 */
import React from 'react'
import '../AdminDashboard.css'

export default function ComponentHealth() {
  return (
    <div className="section-container">
      <div className="section-header">
        <h3>💚 Component Health</h3>
      </div>
      <div style={{ padding: '20px', color: '#ff9', backgroundColor: '#333', borderRadius: '4px' }}>
        ⚠️ Component health monitoring has been disabled as part of the architecture refactor.
        <br />
        <small style={{ color: '#999' }}>Focus is on core TV functionality and JSON-based data flow.</small>
      </div>
    </div>
  )
}
