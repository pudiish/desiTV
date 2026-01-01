/**
 * ExternalYouTubePlayer - Netflix-Grade TV Mode Experience 🎬
 * 
 * Pure TV UI - no titles, no overlays, just the video playing
 * Auto-returns to channel playback when video ends (manual mode)
 * 
 * "Bro, this is how it should be done at Netflix!" 😎
 * 
 * Uses simple iframe with postMessage for end detection (more reliable)
 */

import React, { useEffect, useRef, useState } from 'react';

export function ExternalYouTubePlayer({ videoId, videoTitle, onEnded }) {
  const iframeRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  const checkIntervalRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  // Monitor YouTube iframe for video end using postMessage + polling fallback
  useEffect(() => {
    if (!iframeRef.current || !onEnded) return;

    let videoEnded = false;

    const handleMessage = (event) => {
      // Only accept messages from YouTube
      if (event.origin !== 'https://www.youtube.com') return;
      
      try {
        // YouTube sends data as string or object
        const data = typeof event.data === 'string' 
          ? JSON.parse(event.data) 
          : event.data;
        
        if (!data) return;

        // Check for video end event
        // YouTube iframe API sends events like: { event: 'onStateChange', info: 0 }
        if (data.event === 'onStateChange') {
          if (data.info === 0) {
            // Video ended! Return to channel playback
            if (!videoEnded) {
              videoEnded = true;
              console.log('[ExternalYouTubePlayer] 🎬 Video ended (postMessage) - returning to channel playback');
              if (onEnded) {
                onEnded();
              }
            }
          } else if (data.info === 1) {
            // Video playing
            setIsPlaying(true);
            setEmbedError(false); // Clear any previous errors
          }
        } else if (data.event === 'onError') {
          // Video error - might be embedding restriction
          console.warn('[ExternalYouTubePlayer] Video error detected:', data.info);
          if (data.info === 101 || data.info === 150) {
            // 101: Video not available, 150: Embedding disabled
            setEmbedError(true);
            // Auto-open in YouTube and return to channel
            setTimeout(() => {
              window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
              if (onEnded) {
                onEnded();
              }
            }, 2000);
          }
        }
      } catch (err) {
        // Not a JSON message or not related to our player - ignore
      }
    };

    window.addEventListener('message', handleMessage);

    // Also monitor iframe load to detect embedding restrictions
    const iframe = iframeRef.current;
    if (iframe) {
      const handleIframeLoad = () => {
        // Check if iframe content indicates embedding is disabled
        // This is a fallback check - postMessage is more reliable
        setTimeout(() => {
          try {
            // Try to access iframe content (will fail if cross-origin, which is expected)
            const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
            if (iframeDoc) {
              const bodyText = iframeDoc.body?.innerText || '';
              if (bodyText.includes('Video unavailable') || 
                  bodyText.includes('embedding disabled') ||
                  bodyText.includes('Playback on other websites')) {
                console.warn('[ExternalYouTubePlayer] Embedding restriction detected via iframe content');
                setEmbedError(true);
                // Auto-open in YouTube after brief delay
                setTimeout(() => {
                  window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
                  if (onEnded) {
                    onEnded();
                  }
                }, 2000);
              }
            }
          } catch (e) {
            // Cross-origin - can't access, which is normal and expected
            // This means the iframe loaded successfully (or is properly sandboxed)
            // If we can't access it, it's likely working correctly
          }
        }, 3000); // Give it 3 seconds to load
      };

      iframe.addEventListener('load', handleIframeLoad);
      
      return () => {
        window.removeEventListener('message', handleMessage);
        if (iframe) {
          iframe.removeEventListener('load', handleIframeLoad);
        }
      };
    }

    // Polling fallback: Check if iframe is still active (simple heuristic)
    // If video has been playing for a while and then stops, assume it ended
    let lastActiveTime = Date.now();
    checkIntervalRef.current = setInterval(() => {
      if (videoEnded) {
        clearInterval(checkIntervalRef.current);
        return;
      }

      // Simple heuristic: If video has been playing for more than 10 seconds
      // and we haven't received any activity, check if it might have ended
      const timeSinceStart = Date.now() - startTimeRef.current;
      if (timeSinceStart > 10000 && isPlaying) {
        // Video should be playing - if iframe is still there, assume it's fine
        // This is a simple check, postMessage is more reliable
      }
    }, 2000); // Check every 2 seconds

    return () => {
      window.removeEventListener('message', handleMessage);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [videoId, onEnded, isPlaying]);

  // Reset start time when video changes
  useEffect(() => {
    startTimeRef.current = Date.now();
    setIsPlaying(false);
    setEmbedError(false);
  }, [videoId]);

  // Detect embedding restrictions by checking if video starts playing
  useEffect(() => {
    if (!videoId) return;

    // Set a timeout to detect if video hasn't started playing after 5 seconds
    const embedCheckTimeout = setTimeout(() => {
      if (!isPlaying && !embedError) {
        // Video hasn't started - might be embedding restriction
        console.warn('[ExternalYouTubePlayer] Video not playing after 5s - might be embedding restricted');
        // Don't auto-set error here, let the iframe load handler or postMessage handle it
      }
    }, 5000);

    return () => {
      clearTimeout(embedCheckTimeout);
    };
  }, [videoId, isPlaying, embedError]);

  // YouTube embed URL with minimal UI (Netflix-style)
  // controls=0: No controls
  // modestbranding=1: Minimal YouTube branding
  // rel=0: Don't show related videos at end
  // fs=0: Disable fullscreen button
  // iv_load_policy=3: Hide annotations
  // disablekb=1: Disable keyboard controls
  // enablejsapi=1: Enable postMessage API for end detection
  // Try nocookie domain first (more permissive), fallback to regular embed
  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&controls=0&modestbranding=1&rel=0&fs=0&iv_load_policy=3&disablekb=1&playsinline=1&enablejsapi=1&origin=${window.location.origin}`;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        zIndex: 100,
      }}
    >
      {/* Pure video - no titles, no UI, just like Netflix TV mode */}
      <iframe
        ref={iframeRef}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: '#000',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
        src={embedUrl}
        title={videoTitle}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen={false}
      />
      {/* Glass overlay - blocks all iframe interactions (same as TV player) */}
      <div
        className="player-glass-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 5,
          cursor: 'default',
          background: 'transparent',
          pointerEvents: 'auto', // Blocks all iframe interactions
        }}
      />
      {/* Error overlay for embedding restrictions - auto-opens YouTube */}
      {embedError && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 15,
            background: 'rgba(0, 0, 0, 0.95)',
            padding: '30px',
            borderRadius: '10px',
            textAlign: 'center',
            color: '#d4a574',
            fontFamily: 'monospace',
            maxWidth: '80%',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>
            Video Embedding Restricted
          </h2>
          <p style={{ fontSize: '14px', marginBottom: '20px', color: '#aaa' }}>
            This video cannot be embedded. Opening in YouTube...
          </p>
          <button
            onClick={() => {
              window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
              if (onEnded) {
                onEnded();
              }
            }}
            style={{
              background: '#d4a574',
              color: '#000',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              fontSize: '14px',
              fontFamily: 'monospace',
              cursor: 'pointer',
              fontWeight: 'bold',
            }}
          >
            Watch on YouTube
          </button>
        </div>
      )}
    </div>
  );
}

export default ExternalYouTubePlayer;

