/**
 * AppInitializer - Root component that initializes all services
 * Wraps the main app and handles module initialization
 */

import React, { useEffect, useState } from 'react'
import { useInitialization } from '../hooks/useInitialization'

export function AppInitializer({ children }) {
  const { initialized, loading, initError } = useInitialization()
  const [showError, setShowError] = useState(false)

  useEffect(() => {
    if (initError) {
      setShowError(true)
      // Auto-hide error after 10 seconds
      const timeout = setTimeout(() => setShowError(false), 10000)
      return () => clearTimeout(timeout)
    }
  }, [initError])

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          backgroundColor: '#000',
          color: '#0f0',
          fontFamily: 'monospace',
        }}
      >
        <div>
          <div>RETRO TV INITIALIZING...</div>
          <div style={{ fontSize: '12px', marginTop: '20px', opacity: 0.7 }}>
            Loading modules and services...
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {showError && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: '#8B0000',
            color: '#fff',
            padding: '20px',
            zIndex: 9999,
            fontFamily: 'monospace',
            fontSize: '12px',
          }}
        >
          <strong>⚠️ Initialization Warning:</strong> {initError}
          <br />
          <small>Some features may not work correctly. Refresh to try again.</small>
        </div>
      )}
      {children}
    </>
  )
}

export default AppInitializer
