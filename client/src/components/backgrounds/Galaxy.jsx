/**
 * Galaxy Background Component
 * Animated starfield background effect inspired by reactbits.dev
 * Shows when TV is powered on
 * Star speed reacts to video playback - simulates audio reactivity
 */
import React, { useRef, useEffect } from 'react'
import './Galaxy.css'

const Galaxy = ({ isActive = true, baseSpeed = 0.3, density = 400, volume = 0.5, isPlaying = false, isBuffering = false }) => {
  const canvasRef = useRef(null)
  const animationRef = useRef(null)
  const starsRef = useRef([])
  const currentSpeedRef = useRef(baseSpeed)
  const targetSpeedRef = useRef(baseSpeed)
  const pulsePhaseRef = useRef(0)
  const beatIntensityRef = useRef(0)

  // Calculate target speed based on volume and playback state
  useEffect(() => {
    if (!isPlaying || isBuffering) {
      // When paused or buffering, slow drift
      targetSpeedRef.current = 0.1
    } else {
      // When playing, speed based on volume with beat simulation
      const minSpeed = 0.2
      const maxSpeed = 1.5
      targetSpeedRef.current = minSpeed + (volume * volume) * (maxSpeed - minSpeed)
    }
  }, [volume, isPlaying, isBuffering])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    let width = window.innerWidth
    let height = window.innerHeight

    // Set canvas size
    const setCanvasSize = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height
    }

    setCanvasSize()

    // Create stars
    const createStars = () => {
      starsRef.current = []
      for (let i = 0; i < density; i++) {
        starsRef.current.push({
          x: Math.random() * width - width / 2,
          y: Math.random() * height - height / 2,
          z: Math.random() * 1000,
          size: Math.random() * 2 + 0.5,
          color: getStarColor(),
          pulseOffset: Math.random() * Math.PI * 2, // Random phase offset for each star
        })
      }
    }

    // Generate random star colors (white, blue-white, yellow, orange)
    const getStarColor = () => {
      const colors = [
        'rgba(255, 255, 255, 1)',      // White
        'rgba(200, 220, 255, 1)',      // Blue-white
        'rgba(255, 250, 230, 1)',      // Yellow-white
        'rgba(255, 220, 180, 1)',      // Orange-white
        'rgba(180, 200, 255, 1)',      // Cool blue
        'rgba(255, 180, 180, 1)',      // Warm pink
      ]
      return colors[Math.floor(Math.random() * colors.length)]
    }

    createStars()

    // Simulate beat detection with pseudo-random pulses
    let lastBeatTime = 0
    const simulateBeat = (timestamp) => {
      if (!isPlaying || volume === 0) {
        beatIntensityRef.current *= 0.95 // Fade out
        return
      }

      // Create pseudo-random "beats" based on time
      // Faster beats at higher volume, slower at lower volume
      const beatInterval = 300 + (1 - volume) * 400 // 300-700ms between beats
      
      if (timestamp - lastBeatTime > beatInterval) {
        // Random intensity for each beat (simulates audio dynamics)
        beatIntensityRef.current = 0.3 + Math.random() * 0.7 * volume
        lastBeatTime = timestamp
      } else {
        // Decay between beats
        beatIntensityRef.current *= 0.92
      }
    }

    // Animation loop
    let lastTimestamp = 0
    const animate = (timestamp) => {
      const deltaTime = timestamp - lastTimestamp
      lastTimestamp = timestamp

      if (!isActive) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }

      // Simulate audio beats when playing
      simulateBeat(timestamp)

      // Update pulse phase for flowing motion
      pulsePhaseRef.current += deltaTime * 0.003 * (isPlaying ? 1 : 0.2)

      // Smooth interpolation towards target speed (lerp)
      const lerpFactor = 0.08
      currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * lerpFactor
      
      // Add beat-reactive speed boost
      const beatBoost = beatIntensityRef.current * 0.8
      const speed = currentSpeedRef.current + beatBoost

      // Trail effect - faster speed = more trail
      const trailOpacity = Math.max(0.08, 0.25 - speed * 0.08)
      ctx.fillStyle = `rgba(0, 0, 10, ${trailOpacity})`
      ctx.fillRect(0, 0, width, height)

      const centerX = width / 2
      const centerY = height / 2

      starsRef.current.forEach((star) => {
        // Move star towards viewer - speed affects movement
        // Add individual pulse variation for organic feel
        const individualPulse = Math.sin(pulsePhaseRef.current + star.pulseOffset) * 0.2
        const starSpeed = speed * (1 + individualPulse * (isPlaying ? 1 : 0.1))
        star.z -= starSpeed * 10

        // Reset star if it's too close
        if (star.z <= 0) {
          star.x = Math.random() * width - width / 2
          star.y = Math.random() * height - height / 2
          star.z = 1000
          star.color = getStarColor()
          star.pulseOffset = Math.random() * Math.PI * 2
        }

        // Calculate 3D projection
        const scale = 200 / star.z
        const x = star.x * scale + centerX
        const y = star.y * scale + centerY

        // Calculate size based on distance, speed, and beat
        const baseSize = star.size * scale * 0.5
        const sizeBoost = 1 + speed * 0.3 + beatIntensityRef.current * 0.5
        const size = baseSize * sizeBoost

        // Calculate opacity based on distance and beat
        const baseOpacity = Math.min(1, (1000 - star.z) / 500)
        const beatGlow = beatIntensityRef.current * 0.3
        const opacity = Math.min(1, baseOpacity + beatGlow)

        // Only draw if on screen
        if (x >= 0 && x <= width && y >= 0 && y <= height) {
          ctx.save()
          
          // Outer glow - bigger at higher speeds and on beats
          const glowSize = size * (3 + speed + beatIntensityRef.current * 2)
          const gradient = ctx.createRadialGradient(x, y, 0, x, y, glowSize)
          gradient.addColorStop(0, star.color.replace('1)', `${opacity})`))
          gradient.addColorStop(0.5, star.color.replace('1)', `${opacity * 0.3})`))
          gradient.addColorStop(1, 'transparent')
          
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(x, y, glowSize, 0, Math.PI * 2)
          ctx.fill()

          // Core - pulses with beat
          ctx.fillStyle = star.color.replace('1)', `${opacity})`)
          ctx.beginPath()
          ctx.arc(x, y, size, 0, Math.PI * 2)
          ctx.fill()

          // Draw trail/streak for fast-moving stars
          if (speed > 0.15 && star.z < 700) {
            const trailIntensity = speed * 2 + beatIntensityRef.current
            const trailLength = (1000 - star.z) / 80 * trailIntensity
            ctx.strokeStyle = star.color.replace('1)', `${opacity * 0.4 * Math.min(1, speed)}`)
            ctx.lineWidth = size * 0.6
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(x, y)
            
            const trailScale = 200 / (star.z + trailLength * 8)
            const trailX = star.x * trailScale + centerX
            const trailY = star.y * trailScale + centerY
            ctx.lineTo(trailX, trailY)
            ctx.stroke()
          }

          ctx.restore()
        }
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    // Start animation
    animationRef.current = requestAnimationFrame(animate)

    // Handle resize
    const handleResize = () => {
      setCanvasSize()
      createStars()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      window.removeEventListener('resize', handleResize)
    }
  }, [isActive, baseSpeed, density, isPlaying, volume])

  return (
    <canvas
      ref={canvasRef}
      className={`galaxy-canvas ${isActive ? 'active' : ''}`}
      aria-hidden="true"
    />
  )
}

export default Galaxy
