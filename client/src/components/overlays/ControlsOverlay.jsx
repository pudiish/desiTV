import React, { useMemo } from 'react'
import './ControlsOverlay.css'

/**
 * ControlsOverlay - TV-Relative Controls Positioning System
 * 
 * Positions UI controls (toggles, buttons) relative to the TV frame
 * rather than the viewport. This ensures controls stay visually
 * connected to the TV across all screen sizes and layouts.
 * 
 * Architecture:
 * - Uses absolute positioning within a fixed container
 * - Calculates offsets based on tvFrameRect from TVFrame component
 * - Supports desktop (side-positioned) and mobile (bottom-positioned) layouts
 * - Respects fullscreen mode by hiding or repositioning controls
 * 
 * @param {Object} tvFrameRect - Bounding rect from TVFrame
 * @param {boolean} isFullscreen - Whether TV is in fullscreen mode
 * @param {React.ReactNode} leftControls - Controls for left side (e.g., background toggle)
 * @param {React.ReactNode} rightControls - Controls for right side (e.g., chat toggle)
 */
const ControlsOverlay = React.memo(function ControlsOverlay({
  tvFrameRect,
  isFullscreen = false,
  leftControls = null,
  rightControls = null,
  bottomLeftControls = null,
  bottomRightControls = null,
  isMobile = false
}) {
  // Calculate positions based on TV frame rect
  const positions = useMemo(() => {
    if (!tvFrameRect) {
      return {
        left: { bottom: 20, left: 20 },
        right: { bottom: 24, right: 24 },
        bottomLeft: { bottom: 20, left: 20 },
        bottomRight: { bottom: 24, right: 24 }
      }
    }

    const { left, right, bottom, width, height } = tvFrameRect
    const margin = 16 // Gap between TV and controls
    const bottomOffset = 24 // Distance from bottom of TV frame
    
    if (isMobile) {
      // Mobile: Position at bottom corners, accounting for safe areas
      // Controls stay below the TV frame
      return {
        left: null, // Not used on mobile
        right: null, // Not used on mobile
        bottomLeft: {
          bottom: `calc(${window.innerHeight - bottom + bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
          left: `max(${left}px, calc(12px + env(safe-area-inset-left, 0px)))`
        },
        bottomRight: {
          bottom: `calc(${window.innerHeight - bottom + bottomOffset}px + env(safe-area-inset-bottom, 0px))`,
          right: `max(${window.innerWidth - right}px, calc(12px + env(safe-area-inset-right, 0px)))`
        }
      }
    }

    // Desktop: Position controls relative to TV frame edges
    // Left controls align with left edge of TV
    // Right controls align with right edge of TV
    return {
      left: {
        bottom: window.innerHeight - bottom + bottomOffset,
        left: Math.max(left - 60, 20) // Slightly outside TV left edge
      },
      right: {
        bottom: window.innerHeight - bottom + bottomOffset,
        right: Math.max(window.innerWidth - right - 60, 24) // Slightly outside TV right edge
      },
      bottomLeft: {
        bottom: window.innerHeight - bottom + bottomOffset,
        left: left + margin
      },
      bottomRight: {
        bottom: window.innerHeight - bottom + bottomOffset,
        right: window.innerWidth - right + margin
      }
    }
  }, [tvFrameRect, isMobile])

  // Don't render in fullscreen mode (TVFrame handles its own controls)
  if (isFullscreen) {
    return null
  }

  return (
    <div className="controls-overlay" data-mobile={isMobile}>
      {/* Left side controls (desktop) or bottom-left (mobile) */}
      {leftControls && !isMobile && (
        <div 
          className="controls-overlay__left"
          style={positions.left}
        >
          {leftControls}
        </div>
      )}

      {/* Right side controls (desktop) or bottom-right (mobile) */}
      {rightControls && !isMobile && (
        <div 
          className="controls-overlay__right"
          style={positions.right}
        >
          {rightControls}
        </div>
      )}

      {/* Bottom-left controls (both desktop and mobile) */}
      {bottomLeftControls && (
        <div 
          className="controls-overlay__bottom-left"
          style={positions.bottomLeft}
        >
          {bottomLeftControls}
        </div>
      )}

      {/* Bottom-right controls (both desktop and mobile) */}
      {bottomRightControls && (
        <div 
          className="controls-overlay__bottom-right"
          style={positions.bottomRight}
        >
          {bottomRightControls}
        </div>
      )}
    </div>
  )
})

export default ControlsOverlay
