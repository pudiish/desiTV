/**
 * CacheManager - Admin section for cache management and monitoring
 * Shows cache usage, allows clearing caches, and provides detailed breakdown
 */

import React, { useState, useEffect } from 'react'
import { moduleManager } from '../../services/moduleManager'
import { useCache } from '../../hooks/useCache'
import '../AdminDashboard.css'

export default function CacheManagerSection() {
  const cacheMonitor = moduleManager.getModule('cacheMonitor')
  const cache = useCache(cacheMonitor)
  const [clearing, setClearing] = useState(false)
  const [lastAction, setLastAction] = useState(null)
  const [expandedSection, setExpandedSection] = useState(null)

  useEffect(() => {
    // Refresh stats on mount and periodically
    if (cacheMonitor) {
      cacheMonitor.updateStats()
      const interval = setInterval(() => cacheMonitor.updateStats(), 10000)
      return () => clearInterval(interval)
    }
  }, [cacheMonitor])

  const handleClearLocalStorage = async () => {
    setClearing(true)
    try {
      cache.clearLocalStorage([
        'retro-tv-session-id',
        'retro-tv-selected-channels',
        'retro-tv-preferences',
      ])
      setLastAction({ type: 'success', message: 'localStorage cleared' })
    } catch (err) {
      setLastAction({ type: 'error', message: `Error: ${err.message}` })
    }
    setClearing(false)
  }

  const handleClearSessionStorage = async () => {
    setClearing(true)
    try {
      cache.clearSessionStorage()
      setLastAction({ type: 'success', message: 'sessionStorage cleared' })
    } catch (err) {
      setLastAction({ type: 'error', message: `Error: ${err.message}` })
    }
    setClearing(false)
  }

  const handleClearBrowserCache = async () => {
    setClearing(true)
    try {
      await cache.clearBrowserCache()
      setLastAction({ type: 'success', message: 'Browser cache cleared' })
    } catch (err) {
      setLastAction({ type: 'error', message: `Error: ${err.message}` })
    }
    setClearing(false)
  }

  const handleFullCleanup = async () => {
    setClearing(true)
    try {
      await cache.fullCleanup(['retro-tv-session-id', 'retro-tv-selected-channels'])
      setLastAction({
        type: 'success',
        message: 'Full cleanup complete (session preserved)',
      })
    } catch (err) {
      setLastAction({ type: 'error', message: `Error: ${err.message}` })
    }
    setClearing(false)
  }

  const handleClearItem = (key, storage) => {
    cache.clearStorageItem(key, storage)
    setLastAction({ type: 'success', message: `Cleared ${storage}[${key}]` })
  }

  const totalSize = cache.getTotalSize()

  return (
    <div className="section-container">
      <div className="section-header">
        <h3>💾 Cache Management</h3>
        <button className="btn btn-primary" onClick={() => cacheMonitor?.updateStats()} disabled={clearing}>
          Refresh Stats
        </button>
      </div>

      {/* Action Result */}
      {lastAction && (
        <div
          style={{
            padding: '10px',
            marginBottom: '15px',
            backgroundColor: lastAction.type === 'success' ? '#003300' : '#330000',
            borderLeft: `3px solid ${lastAction.type === 'success' ? '#0f0' : '#f00'}`,
            color: lastAction.type === 'success' ? '#0f0' : '#f00',
            fontSize: '12px',
            fontFamily: 'monospace',
          }}
        >
          {lastAction.type === 'success' ? '✓' : '✗'} {lastAction.message}
        </div>
      )}

      {/* Cache Summary */}
      <div className="health-grid">
        <div className="health-card">
          <div className="health-icon">📊</div>
          <h4>Total Cache Size</h4>
          <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{totalSize.MB} MB</p>
          <small>{totalSize.KB} KB</small>
        </div>

        <div className="health-card">
          <div className="health-icon">📦</div>
          <h4>localStorage</h4>
          <p style={{ fontSize: '18px' }}>{cache.stats.localStorage.items} items</p>
          <small>{cache.stats.localStorage.sizeKB} KB</small>
        </div>

        <div className="health-card">
          <div className="health-icon">📝</div>
          <h4>sessionStorage</h4>
          <p style={{ fontSize: '18px' }}>{cache.stats.sessionStorage.items} items</p>
          <small>{cache.stats.sessionStorage.sizeKB} KB</small>
        </div>

        <div className="health-card">
          <div className="health-icon">🌐</div>
          <h4>Browser Cache</h4>
          <p style={{ fontSize: '18px' }}>{cache.stats.browserCache.count} caches</p>
          <small>{cache.stats.browserCache.available ? 'Available' : 'Unavailable'}</small>
        </div>
      </div>

      {/* Clear Actions */}
      <div className="section-content">
        <h4>Clear Cache Actions</h4>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '10px',
            marginTop: '15px',
          }}
        >
          <button
            className="btn btn-danger"
            onClick={handleClearLocalStorage}
            disabled={clearing}
            style={{ padding: '10px', textAlign: 'left' }}
          >
            <div>🗑️ Clear localStorage</div>
            <small>({cache.stats.localStorage.items} items)</small>
          </button>

          <button
            className="btn btn-danger"
            onClick={handleClearSessionStorage}
            disabled={clearing}
            style={{ padding: '10px', textAlign: 'left' }}
          >
            <div>🗑️ Clear sessionStorage</div>
            <small>({cache.stats.sessionStorage.items} items)</small>
          </button>

          <button
            className="btn btn-danger"
            onClick={handleClearBrowserCache}
            disabled={clearing}
            style={{ padding: '10px', textAlign: 'left' }}
          >
            <div>🗑️ Clear Browser Cache</div>
            <small>({cache.stats.browserCache.count} caches)</small>
          </button>

          <button
            className="btn btn-warning"
            onClick={handleFullCleanup}
            disabled={clearing}
            style={{
              padding: '10px',
              textAlign: 'left',
              backgroundColor: '#333300',
              borderColor: '#ff0',
            }}
          >
            <div>⚡ Full Cleanup</div>
            <small>Clear all (preserve session)</small>
          </button>
        </div>
      </div>

      {/* localStorage Details */}
      <div className="section-content">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() =>
            setExpandedSection(expandedSection === 'localStorage' ? null : 'localStorage')
          }
        >
          <h4 style={{ margin: 0 }}>localStorage Details</h4>
          <span>{expandedSection === 'localStorage' ? '▼' : '▶'}</span>
        </div>

        {expandedSection === 'localStorage' && (
          <div style={{ marginTop: '10px', fontSize: '11px', fontFamily: 'monospace' }}>
            {Object.entries(cache.stats.localStorage.details).length === 0 ? (
              <div style={{ color: '#999' }}>No items</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px', gap: '10px' }}>
                {Object.entries(cache.stats.localStorage.details).map(([key, details]) => (
                  <React.Fragment key={key}>
                    <div style={{ wordBreak: 'break-word', color: '#0f0' }}>{key}</div>
                    <div style={{ textAlign: 'right' }}>{details.sizeKB} KB</div>
                    <button
                      style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        backgroundColor: '#300',
                        color: '#f00',
                        border: '1px solid #f00',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleClearItem(key, 'localStorage')}
                    >
                      Delete
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* sessionStorage Details */}
      <div className="section-content">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
          }}
          onClick={() =>
            setExpandedSection(expandedSection === 'sessionStorage' ? null : 'sessionStorage')
          }
        >
          <h4 style={{ margin: 0 }}>sessionStorage Details</h4>
          <span>{expandedSection === 'sessionStorage' ? '▼' : '▶'}</span>
        </div>

        {expandedSection === 'sessionStorage' && (
          <div style={{ marginTop: '10px', fontSize: '11px', fontFamily: 'monospace' }}>
            {Object.entries(cache.stats.sessionStorage.details).length === 0 ? (
              <div style={{ color: '#999' }}>No items</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px', gap: '10px' }}>
                {Object.entries(cache.stats.sessionStorage.details).map(([key, details]) => (
                  <React.Fragment key={key}>
                    <div style={{ wordBreak: 'break-word', color: '#0f0' }}>{key}</div>
                    <div style={{ textAlign: 'right' }}>{details.sizeKB} KB</div>
                    <button
                      style={{
                        padding: '4px 8px',
                        fontSize: '10px',
                        backgroundColor: '#300',
                        color: '#f00',
                        border: '1px solid #f00',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleClearItem(key, 'sessionStorage')}
                    >
                      Delete
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .btn-danger {
          background-color: #330;
          border-color: #f00;
          color: #f00;
        }

        .btn-danger:hover:not(:disabled) {
          background-color: #550;
        }

        .btn-warning {
          background-color: #333300;
          border-color: #ff0;
          color: #ff0;
        }

        .btn-warning:hover:not(:disabled) {
          background-color: #555500;
        }
      `}</style>
    </div>
  )
}
