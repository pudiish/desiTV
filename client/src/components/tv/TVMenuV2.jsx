import React, { useState, useEffect, useRef } from 'react'
import { broadcastStateManager } from '../../logic/broadcast'

/**
 * TVMenuV2 - Category/Playlist selector menu
 * 
 * SINGLE SOURCE OF TRUTH:
 * - For ACTIVE category: ONLY use playbackInfo (live YouTube data)
 * - For OTHER categories: Calculate from broadcastStateManager
 * 
 * This prevents the conflict where broadcastStateManager overwrites
 * the actual playing video with its calculated position.
 */
export default function TVMenuV2({
  isOpen,
  onClose,
  channels: categories,
  activeChannelIndex: activeCategoryIndex,
  onChannelSelect: onCategorySelect,
  power,
  playbackInfo = null
}) {
  const [selectedIndex, setSelectedIndex] = useState(activeCategoryIndex)
  const [activeTab, setActiveTab] = useState('channels')
  const menuRef = useRef(null)
  const itemRefs = useRef([])

  // Active category data
  const activeCategory = categories[activeCategoryIndex]
  const activeCategoryItems = activeCategory?.items || []
  const hasActivePlaylist = activeCategoryItems.length > 0

  // Positions for NON-ACTIVE categories only
  const [otherCategoryPositions, setOtherCategoryPositions] = useState({})

  // Calculate positions for NON-ACTIVE categories only
  useEffect(() => {
    if (!isOpen) return

    const updateOtherPositions = () => {
      const positions = {}
      categories.forEach((category, idx) => {
        // SKIP active category - we use playbackInfo for that
        if (idx === activeCategoryIndex) return

        if (category && category.items && category.items.length > 0) {
          try {
            if (!broadcastStateManager.getChannelState(category._id)) {
              broadcastStateManager.initializeChannel(category)
            }
            const position = broadcastStateManager.calculateCurrentPosition(category)
            if (position && position.videoIndex >= 0) {
              const currentVideo = category.items[position.videoIndex]
              const nextIdx = (position.videoIndex + 1) % category.items.length
              const nextVideo = category.items[nextIdx]
              positions[category._id] = {
                now: currentVideo,
                next: nextVideo,
                videoIndex: position.videoIndex
              }
            }
          } catch (err) {
            // Silent fail for non-active categories
          }
        }
      })
      setOtherCategoryPositions(positions)
    }

    updateOtherPositions()
    const interval = setInterval(updateOtherPositions, 2000)
    return () => clearInterval(interval)
  }, [isOpen, categories, activeCategoryIndex])

  // Reset selected index when menu opens
  useEffect(() => {
    if (isOpen) setSelectedIndex(activeCategoryIndex)
  }, [isOpen, activeCategoryIndex])

  // Auto-scroll to selected item
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [selectedIndex])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => Math.max(0, prev - 1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => Math.min(categories.length - 1, prev + 1))
          break
        case 'Enter':
          e.preventDefault()
          if (activeTab === 'channels' && categories[selectedIndex]) {
            onCategorySelect(selectedIndex)
            onClose()
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, categories, activeTab, onCategorySelect, onClose])

  // Format time helper
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, '0')}`
  }

  // ===== ACTIVE CATEGORY DATA (from playbackInfo ONLY) =====
  const nowTitle = playbackInfo?.videoTitle || 'Loading...'
  const nowDuration = playbackInfo?.duration || 0
  const nowOffset = playbackInfo?.currentTime || 0
  const currentVideoIndex = playbackInfo?.videoIndex ?? 0

  // Next video for active category
  const computedNextIndex = hasActivePlaylist && currentVideoIndex >= 0
    ? (currentVideoIndex + 1) % activeCategoryItems.length
    : 0
  const computedNextVideo = hasActivePlaylist ? activeCategoryItems[computedNextIndex] : null

  if (!isOpen || !power) return null

  return (
    <div className="tv-menu-overlay" onClick={onClose}>
      <div className="tv-menu" ref={menuRef} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="tv-menu-header">
          <div className="menu-logo">
            <span className="logo-text">DesiTV™</span>
            <span className="logo-guide">GUIDE</span>
          </div>
          <div className="menu-time">
            {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
          <button className="menu-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="menu-tabs">
          <button
            className={`tab-btn ${activeTab === 'channels' ? 'active' : ''}`}
            onClick={() => setActiveTab('channels')}
          >
            📺 CATEGORIES
          </button>
          <button
            className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            📋 UP NEXT
          </button>
        </div>

        {/* Content */}
        <div className="menu-content">
          {/* Categories Tab */}
          {activeTab === 'channels' && (
            <div className="channels-grid">
              {categories.map((category, idx) => {
                const isActive = idx === activeCategoryIndex
                const isSelected = idx === selectedIndex

                // For active: use playbackInfo
                // For others: use calculated position
                let displayTitle, displayNext

                if (isActive) {
                  displayTitle = nowTitle
                  displayNext = computedNextVideo
                } else {
                  const pos = otherCategoryPositions[category._id]
                  displayTitle = pos?.now?.title || 'Loading...'
                  displayNext = pos?.next
                }

                return (
                  <div
                    key={category._id}
                    ref={el => itemRefs.current[idx] = el}
                    className={`channel-card ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onCategorySelect(idx)
                      onClose()
                    }}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className="channel-num">{String(idx + 1).padStart(2, '0')}</div>
                    <div className="channel-info">
                      <div className="channel-name">{category.name}</div>
                      <div className="now-playing">
                        <span className="now-label">NOW:</span>
                        <span className="now-title">
                          {displayTitle ? displayTitle.substring(0, 35) : 'No content'}
                          {displayTitle && displayTitle.length > 35 ? '...' : ''}
                        </span>
                      </div>
                      {displayNext && (
                        <div className="next-up">
                          <span className="next-label">NEXT:</span>
                          <span className="next-title">
                            {displayNext.title?.substring(0, 30)}
                            {displayNext.title?.length > 30 ? '...' : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="channel-meta">
                      <span className="video-count">{category.items?.length || 0} videos</span>
                      {isActive && <span className="live-badge">● LIVE</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Queue Tab */}
          {activeTab === 'queue' && (
            <div className="queue-view">
              <div className="queue-header">
                <h3>📺 {activeCategory?.name || 'No Category'}</h3>
                <span className="queue-subtitle">What's Playing</span>
              </div>

              {!hasActivePlaylist && (
                <div className="queue-empty">No playlist available.</div>
              )}

              {/* Now Playing */}
              {hasActivePlaylist && (
                <div className="queue-item now-playing-item">
                  <div className="queue-badge now">▶ NOW</div>
                  <div className="queue-info">
                    <div className="queue-title">{nowTitle}</div>
                    <div className="queue-progress">
                      {formatTime(nowOffset)} / {formatTime(nowDuration)}
                    </div>
                  </div>
                </div>
              )}

              {/* Up Next */}
              {computedNextVideo && (
                <div className="queue-item next-item">
                  <div className="queue-badge next">⏭ NEXT</div>
                  <div className="queue-info">
                    <div className="queue-title">{computedNextVideo.title}</div>
                    <div className="queue-duration">{formatTime(computedNextVideo.duration)}</div>
                  </div>
                </div>
              )}

              {/* Upcoming */}
              {hasActivePlaylist && activeCategoryItems.length > 2 && (
                <>
                  <div className="queue-divider">UPCOMING</div>
                  {[1, 2, 3].map((offset) => {
                    const idx = (computedNextIndex + offset) % activeCategoryItems.length
                    const video = activeCategoryItems[idx]
                    if (!video || idx === currentVideoIndex) return null
                    return (
                      <div key={`upcoming-${offset}`} className="queue-item upcoming-item">
                        <div className="queue-badge upcoming">#{offset + 2}</div>
                        <div className="queue-info">
                          <div className="queue-title">{video.title}</div>
                          <div className="queue-duration">{formatTime(video.duration)}</div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
