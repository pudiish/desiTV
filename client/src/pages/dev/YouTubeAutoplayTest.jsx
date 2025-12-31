import React, { useEffect, useRef, useState, useCallback } from 'react'
import './YouTubeAutoplayTest.css'

export default function YouTubeAutoplayTest() {
  const playerRef = useRef(null)
  const [videoId, setVideoId] = useState('jNQXAC9IVRw')
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('Initializing...')
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [userInteracted, setUserInteracted] = useState(false)
  const [isMutedAutoplay, setIsMutedAutoplay] = useState(true)

  const onPlayerReady = (event) => {
    console.log('[Test] Player ready')
    setStatus('Player ready')
    setError(null)
    
    if (userInteracted) {
      // User has interacted - can play with sound
      try {
        event.target.unMute()
        event.target.playVideo()
        setStatus('Playing with sound...')
      } catch (err) {
        setStatus('Ready - click play to start')
      }
    } else {
      // Start muted autoplay
      try {
        event.target.mute()
        event.target.playVideo()
        setStatus('Playing muted - click anywhere to enable sound')
        setIsMutedAutoplay(true)
      } catch (err) {
        setStatus('Ready - click play to start')
      }
    }
  }

  const onStateChange = (event) => {
    if (event.data === 1) {
      setIsPlaying(true)
      if (userInteracted) {
        setStatus('✅ Playing with sound!')
      } else {
        setStatus('✅ Playing (muted) - click anywhere to enable sound')
      }
    } else if (event.data === 2) {
      setIsPlaying(false)
      setStatus('Paused')
    } else if (event.data === 3) {
      setStatus('Buffering...')
    } else if (event.data === 0) {
      setIsPlaying(false)
      setStatus('Video ended')
    }
  }

  const onError = (event) => {
    const errorMessages = {
      2: 'Invalid video ID',
      5: 'HTML5 player error',
      100: 'Video not found',
      101: 'Video embedding disabled by owner',
      150: 'Video restricted'
    }
    const errorMsg = errorMessages[event.data] || `Unknown error (${event.data})`
    setError(`YouTube Error: ${errorMsg}`)
    setStatus(`Error: ${errorMsg}`)
  }

  // RetroTV pattern: Reload video to enable sound
  const handleUserInteraction = useCallback(() => {
    if (!userInteracted && playerRef.current && isMutedAutoplay) {
      try {
        const player = playerRef.current
        const videoData = player.getVideoData()
        const currentTime = player.getCurrentTime()
        const vidId = videoData?.videoId || videoId

        console.log('[Test] User interaction - reloading video to enable sound')
        setStatus('Enabling sound...')

        // RetroTV pattern: Reload video at current time
        player.loadVideoById(vidId, currentTime)

        // After reload, unmute
        setTimeout(() => {
          try {
            player.unMute()
            player.playVideo()
            setIsMutedAutoplay(false)
            setUserInteracted(true)
            setStatus('✅ Playing with sound!')
          } catch (err) {
            console.error('[Test] Error unmuting:', err)
            setStatus('Playing (muted)')
          }
        }, 200)
      } catch (err) {
        console.error('[Test] Error in user interaction:', err)
      }
    }
  }, [userInteracted, isMutedAutoplay, videoId])

  const initializePlayer = useCallback(() => {
    if (!window.YT || !window.YT.Player) {
      setStatus('Waiting for YouTube API...')
      return
    }

    if (playerRef.current) {
      try {
        playerRef.current.destroy()
      } catch (err) {}
      playerRef.current = null
    }

    const playerDiv = document.getElementById('player')
    if (playerDiv) {
      playerDiv.innerHTML = ''
    }

    if (!videoId || videoId.trim() === '') {
      setError('Please enter a valid YouTube video ID')
      return
    }

    setStatus('Creating player...')
    setError(null)
    
    try {
      playerRef.current = new window.YT.Player('player', {
        width: '100%',
        height: '100%',
        videoId: videoId.trim(),
        playerVars: { 
          'autoplay': 1, 
          'playsinline': 1,
          'controls': 1,
          'modestbranding': 1,
          'rel': 0,
          'mute': userInteracted ? 0 : 1,
        },
        events: {
          'onReady': onPlayerReady,
          'onStateChange': onStateChange,
          'onError': onError
        }
      })
    } catch (err) {
      setError(`Error creating player: ${err.message}`)
      setStatus('Error creating player')
    }
  }, [videoId, userInteracted])

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      setHasInitialized(true)
      return
    }

    const tag = document.createElement('script')
    tag.src = "https:// www.youtube.com/iframe_api"
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)

    window.onYouTubeIframeAPIReady = () => {
      setHasInitialized(true)
    }
  }, [])

  useEffect(() => {
    if (hasInitialized && videoId) {
      initializePlayer()
    }
  }, [hasInitialized, videoId, initializePlayer])

  useEffect(() => {
    const handleInteraction = () => {
      handleUserInteraction()
    }

    document.addEventListener('click', handleInteraction, { once: true })
    document.addEventListener('touchstart', handleInteraction, { once: true })
    document.addEventListener('keydown', handleInteraction, { once: true })

    return () => {
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('touchstart', handleInteraction)
      document.removeEventListener('keydown', handleInteraction)
    }
  }, [handleUserInteraction])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      padding: '20px',
      fontFamily: 'monospace',
      color: '#d4a574'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '20px', fontSize: '24px' }}>
        YouTube Autoplay Test (RetroTV Pattern)
      </h1>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{
          background: '#1a1a1a',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          fontSize: '12px'
        }}>
          <h2 style={{ marginTop: 0, color: '#4a9eff' }}>RetroTV Pattern:</h2>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>Video starts muted and autoplays</li>
            <li>Click anywhere to reload video and enable sound</li>
            <li>Uses loadVideoById() to restart at current position</li>
          </ul>
          {!userInteracted && (
            <div style={{
              marginTop: '10px',
              padding: '10px',
              background: '#4a9eff',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '11px',
              textAlign: 'center'
            }}>
              👆 Click anywhere to enable sound
            </div>
          )}
          {userInteracted && (
            <div style={{
              marginTop: '10px',
              padding: '10px',
              background: '#00ff88',
              borderRadius: '4px',
              color: '#000',
              fontSize: '11px',
              textAlign: 'center',
              fontWeight: 'bold'
            }}>
              ✅ Sound enabled!
            </div>
          )}
          
          <div style={{ marginTop: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', color: '#4a9eff' }}>
              YouTube Video ID:
            </label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={videoId}
                onChange={(e) => setVideoId(e.target.value)}
                placeholder="Enter YouTube video ID"
                style={{
                  flex: 1,
                  padding: '8px',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  color: '#d4a574',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}
              />
              <button
                onClick={() => initializePlayer()}
                style={{
                  padding: '8px 16px',
                  background: '#4a9eff',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                  fontSize: '12px'
                }}
              >
                Load
              </button>
            </div>
          </div>
        </div>

        <div className="iframe-container">
          <div id="player"></div>
        </div>

        <div style={{
          marginTop: '20px',
          background: '#1a1a1a',
          padding: '15px',
          borderRadius: '8px',
          fontSize: '11px'
        }}>
          <h3 style={{ marginTop: 0, color: '#4a9eff' }}>Status:</h3>
          <p style={{ 
            color: isPlaying ? '#4ade80' : status.includes('Error') ? '#ef4444' : '#d4a574',
            fontWeight: 'bold',
            margin: '10px 0'
          }}>
            {status}
          </p>
          {error && (
            <div style={{
              background: '#ff4444',
              color: '#fff',
              padding: '10px',
              borderRadius: '4px',
              marginTop: '10px'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
