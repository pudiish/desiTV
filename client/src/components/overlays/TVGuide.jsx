/**
 * TVGuide Component
 * 
 * Classic Electronic Program Guide (EPG) overlay
 * Styled like 90s/2000s cable TV guides with:
 * - Blue background with yellow/white text
 * - Time grid showing what's on
 * - Channel rows with current/upcoming shows
 * - Keyboard navigation (arrow keys)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { broadcastStateManager } from '../../logic/broadcast'
import './TVGuide.css'

/**
 * Format time to 12-hour format
 */
function formatTime(date) {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Format duration
 */
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`
}

/**
 * TVGuide Component
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether guide is visible
 * @param {Function} props.onClose - Close handler
 * @param {Array} props.channels - Array of channel/category objects
 * @param {number} props.activeChannelIndex - Currently active channel
 * @param {Function} props.onChannelSelect - Channel selection handler
 * @param {number} props.currentVideoIndex - Current video index in active channel
 */
export function TVGuide({
  isOpen = false,
  onClose,
  channels = [],
  activeChannelIndex = 0,
  onChannelSelect,
  currentVideoIndex = 0,
}) {
  const [selectedRow, setSelectedRow] = useState(activeChannelIndex)
  const [selectedCol, setSelectedCol] = useState(0)
  const [currentTime, setCurrentTime] = useState(new Date())
  const containerRef = useRef(null)

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  // Reset selection when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedRow(activeChannelIndex)
      setSelectedCol(0)
    }
  }, [isOpen, activeChannelIndex])

  // Generate time slots for the guide (6 hours of content)
  const timeSlots = useMemo(() => {
    const slots = []
    const startTime = new Date()
    startTime.setMinutes(0, 0, 0) // Round to current hour
    
    for (let i = 0; i < 6; i++) {
      const slotTime = new Date(startTime.getTime() + i * 60 * 60 * 1000)
      slots.push({
        time: slotTime,
        label: formatTime(slotTime),
      })
    }
    return slots
  }, [currentTime])

  // Calculate schedule for each channel
  const channelSchedules = useMemo(() => {
    return channels.map((channel) => {
      const videos = channel.items || []
      if (videos.length === 0) {
        return { channel, schedule: [] }
      }

      // Calculate current position using broadcast manager
      let position = null
      try {
        position = broadcastStateManager.calculateCurrentPosition(channel)
      } catch (e) {
        // Fallback to simple calculation
      }

      // Build schedule starting from current video
      const startIndex = position?.videoIndex || 0
      const schedule = []
      let accumulatedTime = 0
      
      // Start time is now minus offset into current video
      const scheduleStartTime = new Date()
      if (position?.offset) {
        scheduleStartTime.setSeconds(scheduleStartTime.getSeconds() - position.offset)
      }

      // Build 6 hours of schedule
      const maxDuration = 6 * 60 * 60 // 6 hours in seconds
      let videoIndex = startIndex
      
      while (accumulatedTime < maxDuration && videos.length > 0) {
        const video = videos[videoIndex % videos.length]
        const duration = video.duration || 300 // Default 5 min if no duration

        const startTime = new Date(scheduleStartTime.getTime() + accumulatedTime * 1000)
        const endTime = new Date(startTime.getTime() + duration * 1000)
        
        schedule.push({
          video,
          videoIndex: videoIndex % videos.length,
          startTime,
          endTime,
          duration,
          isCurrent: videoIndex === startIndex && accumulatedTime === 0,
        })

        accumulatedTime += duration
        videoIndex++
      }

      return { channel, schedule }
    })
  }, [channels, currentTime])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          setSelectedRow((prev) => Math.max(0, prev - 1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setSelectedRow((prev) => Math.min(channels.length - 1, prev + 1))
          break
        case 'ArrowLeft':
          e.preventDefault()
          setSelectedCol((prev) => Math.max(0, prev - 1))
          break
        case 'ArrowRight':
          e.preventDefault()
          setSelectedCol((prev) => prev + 1)
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (onChannelSelect) {
            onChannelSelect(selectedRow)
          }
          onClose?.()
          break
        case 'Escape':
          e.preventDefault()
          onClose?.()
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedRow, selectedCol, channels.length, onChannelSelect, onClose])

  // Scroll selected row into view
  useEffect(() => {
    if (containerRef.current) {
      const row = containerRef.current.querySelector(`[data-row="${selectedRow}"]`)
      if (row) {
        row.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
  }, [selectedRow])

  if (!isOpen) return null

  return (
    <div className="tv-guide-overlay" onClick={onClose}>
      <div 
        className="tv-guide" 
        onClick={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        {/* Header */}
        <div className="tv-guide__header">
          <div className="tv-guide__title">TV GUIDE</div>
          <div className="tv-guide__time">{formatTime(currentTime)}</div>
          <button 
            className="tv-guide__close" 
            onClick={onClose}
            aria-label="Close TV Guide"
          >
            ×
          </button>
        </div>

        {/* Time header row */}
        <div className="tv-guide__time-row">
          <div className="tv-guide__channel-label">CHANNEL</div>
          {timeSlots.map((slot, index) => (
            <div key={index} className="tv-guide__time-slot">
              {slot.label}
            </div>
          ))}
        </div>

        {/* Channel rows */}
        <div className="tv-guide__channels">
          {channelSchedules.map(({ channel, schedule }, rowIndex) => (
            <div
              key={channel._id || rowIndex}
              className={`tv-guide__row ${selectedRow === rowIndex ? 'tv-guide__row--selected' : ''} ${activeChannelIndex === rowIndex ? 'tv-guide__row--active' : ''}`}
              data-row={rowIndex}
              onClick={() => {
                if (onChannelSelect) {
                  onChannelSelect(rowIndex)
                }
                onClose?.()
              }}
            >
              {/* Channel name */}
              <div className="tv-guide__channel-name">
                <span className="tv-guide__channel-num">{rowIndex + 1}</span>
                <span className="tv-guide__channel-text">{channel.name}</span>
              </div>

              {/* Program slots */}
              <div className="tv-guide__programs">
                {schedule.slice(0, 6).map((item, colIndex) => (
                  <div
                    key={colIndex}
                    className={`tv-guide__program ${item.isCurrent ? 'tv-guide__program--current' : ''} ${selectedRow === rowIndex && selectedCol === colIndex ? 'tv-guide__program--focused' : ''}`}
                    style={{
                      // Width based on duration (1 hour = 1 slot)
                      flexBasis: `${Math.min(200, Math.max(80, (item.duration / 3600) * 200))}px`,
                    }}
                  >
                    <div className="tv-guide__program-title">
                      {item.video.title?.substring(0, 30) || 'Unknown'}
                    </div>
                    <div className="tv-guide__program-time">
                      {formatDuration(item.duration)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer with controls hint */}
        <div className="tv-guide__footer">
          <span className="tv-guide__hint">↑↓ Navigate</span>
          <span className="tv-guide__hint">ENTER Select</span>
          <span className="tv-guide__hint">ESC Close</span>
        </div>
      </div>
    </div>
  )
}

export default TVGuide
