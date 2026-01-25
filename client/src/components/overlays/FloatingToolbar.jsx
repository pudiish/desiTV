import React, { useState, useEffect } from 'react'
import './FloatingToolbar.css'

/**
 * FloatingToolbar - Clean, Minimal Floating Controls
 * 
 * A unified toolbar for toggle buttons (galaxy, chat, etc.)
 * - Fixed position at bottom center (default) or anchored to TV
 * - Clean pill-shaped design with glassmorphism
 * - Auto-hides in fullscreen
 * - Mobile responsive with safe area support
 * 
 * @param {React.ReactNode} children - Toggle buttons to render
 * @param {boolean} isFullscreen - Hide toolbar in fullscreen mode
 * @param {Object} tvFrameRect - Optional TV frame rect for smart positioning
 */
const FloatingToolbar = React.memo(function FloatingToolbar({
  children,
  isFullscreen = false,
  tvFrameRect = null,
  position = 'bottom-center', // 'bottom-center' | 'bottom-left' | 'bottom-right' | 'tv-anchored'
  visible = true
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768)

  // Track mobile state
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Don't render in fullscreen or when not visible
  if (isFullscreen || !visible) {
    return null
  }

  // Calculate smart position based on TV frame
  const getPositionStyle = () => {
    if (position === 'tv-anchored' && tvFrameRect) {
      // Position below the TV frame center
      const bottomOffset = window.innerHeight - tvFrameRect.bottom
      return {
        bottom: Math.max(bottomOffset - 70, 20),
        left: '50%',
        transform: 'translateX(-50%)'
      }
    }

    // Default positions
    const baseStyle = { bottom: isMobile ? 24 : 32 }
    
    switch (position) {
      case 'bottom-left':
        return { ...baseStyle, left: isMobile ? 16 : 24 }
      case 'bottom-right':
        return { ...baseStyle, right: isMobile ? 16 : 24 }
      case 'bottom-center':
      default:
        return { ...baseStyle, left: '50%', transform: 'translateX(-50%)' }
    }
  }

  return (
    <div 
      className={`floating-toolbar ${isHovered ? 'hovered' : ''}`}
      style={getPositionStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-mobile={isMobile}
    >
      <div className="floating-toolbar__inner">
        {children}
      </div>
    </div>
  )
})

export default FloatingToolbar
