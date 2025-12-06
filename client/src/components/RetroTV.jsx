// src/components/RetroTV.jsx
import React, { useEffect, useRef, useState } from "react";
import "./RetroTV.css";

/**
 * Props:
 *  - channel: object { _id, name, items: [{ videoId, title, duration }] }
 *  - onChannelUp: function
 *  - onChannelDown: function
 */
export default function RetroTV({ channel, onChannelUp, onChannelDown }) {
  const playerRef = useRef(null);
  const ytRef = useRef(null);
  const [videoIndex, setVideoIndex] = useState(0);
  const [started, setStarted] = useState(
    sessionStorage.getItem("retro_tv_gesture") === "1"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [staticVisible, setStaticVisible] = useState(false);
  const [error, setError] = useState(null);
  const channelIdRef = useRef(null);

  // Get current video from channel playlist
  const currentVideo = channel?.items?.[videoIndex];
  const videoId = currentVideo?.videoId;

  // Reset video index when channel changes
  useEffect(() => {
    if (channel?._id !== channelIdRef.current) {
      channelIdRef.current = channel?._id;
      setVideoIndex(0);
      setStaticVisible(false);
      setIsLoading(false);
    }
  }, [channel?._id]);

  // Load YT API once
  useEffect(() => {
    if (window.YT && window.YT.Player) {
      return;
    }
    const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existing) return;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    tag.async = true;
    document.body.appendChild(tag);
  }, []);

  // Create player once, then update video
  useEffect(() => {
    if (!videoId) {
      console.log('[RetroTV] No videoId available');
      return;
    }

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        console.log('[RetroTV] Waiting for YT API...');
        return false;
      }

      // Check if player container exists
      const container = document.getElementById("retro-tv-iframe");
      if (!container) {
        console.log('[RetroTV] Container not found');
        return false;
      }

      // If player already exists, just load new video
      if (ytRef.current && playerRef.current) {
        console.log('[RetroTV] Loading video:', videoId);
        try {
          ytRef.current.loadVideoById(videoId);
          if (started) {
            setTimeout(() => tryPlayUnmute(), 500);
          }
        } catch (err) {
          console.error('[RetroTV] Error loading video:', err);
        }
        return true;
      }

      // Create new player
      console.log('[RetroTV] Creating player with videoId:', videoId);
      try {
        ytRef.current = new window.YT.Player("retro-tv-iframe", {
          height: "100%",
          width: "100%",
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            playsinline: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            iv_load_policy: 3,
            mute: 1,
          },
          events: {
            onReady: (e) => {
              console.log('[RetroTV] Player ready');
              playerRef.current = e.target;
              if (started) {
                setTimeout(() => tryPlayUnmute(), 300);
              }
            },
            onStateChange: (e) => {
              if (e.data === 0) { // Video ended
                console.log('[RetroTV] Video ended, playing next');
                playNextVideo();
              }
            },
            onError: (e) => {
              console.error('[RetroTV] Player error:', e.data);
              setError(`YT Error ${e.data}`);
              setTimeout(() => playNextVideo(), 1000);
            },
          },
        });
        return true;
      } catch (err) {
        console.error('[RetroTV] Error creating player:', err);
        setError(`Failed to create player: ${err.message}`);
        return false;
      }
    };

    // Try to initialize, poll if API not ready
    if (!initPlayer()) {
      const timer = setInterval(() => {
        if (initPlayer()) {
          clearInterval(timer);
        }
      }, 100);
      return () => clearInterval(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, started]);

  // helper: attempt to play and unmute (handles promise rejection)
  const tryPlayUnmute = async () => {
    if (!playerRef.current) return;
    setError(null);
    try {
      playerRef.current.unMute?.();
    } catch (_) {}
    try {
      // YouTube's playVideo returns void; we can call getIframe().contentWindow.postMessage if needed
      playerRef.current.playVideo?.();
    } catch (err) {
      // final attempt using HTML5 video fallback not available; report error
      console.warn("playVideo failed:", err);
    }
  };

  // Called when user taps the overlay / power button
  const onUserGesture = async () => {
    setStarted(true);
    sessionStorage.setItem("retro_tv_gesture", "1");
    // ensure player exists
    if (!playerRef.current) {
      // player still initializing; wait
      const waitTimer = setInterval(() => {
        if (playerRef.current) {
          clearInterval(waitTimer);
          tryPlayUnmute();
        }
      }, 50);
      return;
    }

    // First, try to play while muted to satisfy autoplay rules (some browsers allow muted play without gesture)
    try {
      playerRef.current.playVideo?.();
    } catch (_) {}
    // Then attempt to unmute (allowed because of user gesture)
    try {
      playerRef.current.unMute?.();
    } catch (_) {}

    // If unmute fails (some browsers may keep it muted), it's okay — user can toggle
  };

  // Play next video in playlist
  const playNextVideo = () => {
    if (!channel?.items) return;
    
    const nextIndex = (videoIndex + 1) % channel.items.length;
    setStaticVisible(true);
    
    setTimeout(() => {
      setVideoIndex(nextIndex);
      setStaticVisible(false);
    }, 400);
  };

  // Play previous video in playlist
  const playPreviousVideo = () => {
    if (!channel?.items) return;
    
    const prevIndex = videoIndex === 0 ? channel.items.length - 1 : videoIndex - 1;
    setStaticVisible(true);
    
    setTimeout(() => {
      setVideoIndex(prevIndex);
      setStaticVisible(false);
    }, 400);
  };

  // Handle channel up (external)
  const handleChannelUp = () => {
    if (onChannelUp) {
      setStaticVisible(true);
      setTimeout(() => {
        onChannelUp();
        setStaticVisible(false);
      }, 700);
    }
  };

  // Handle channel down (external)
  const handleChannelDown = () => {
    if (onChannelDown) {
      setStaticVisible(true);
      setTimeout(() => {
        onChannelDown();
        setStaticVisible(false);
      }, 700);
    }
  };

  return (
    <div className="retro-tv-wrapper">
      <div className={`tv-frame ${started ? "on" : "off"}`}>
        {!started && (
          <div className="tv-overlay" role="button" onClick={onUserGesture}>
            <div className="power-button">⏻ POWER</div>
            <div className="tap-text">Tap to Start TV</div>
          </div>
        )}

        <div className="tv-viewport">
          <div id="retro-tv-iframe" className="tv-iframe" />

          {/* static / glitch overlay */}
          {staticVisible && (
            <div className="tv-static">
              <div className="static-noise" />
            </div>
          )}

          {/* Video info overlay */}
          {started && currentVideo && (
            <div className="video-info">
              <div className="video-title">{currentVideo.title || 'Now Playing'}</div>
              <div className="video-counter">
                {videoIndex + 1} / {channel?.items?.length || 0}
              </div>
            </div>
          )}

          <div className="crt-lines" />
        </div>

        <div className="tv-controls">
          <div className="control-row">
            <button onClick={handleChannelUp} title="Channel Up">
              CH ▲
            </button>
            <button onClick={handleChannelDown} title="Channel Down">
              CH ▼
            </button>
          </div>
          
          <div className="control-row">
            <button onClick={playPreviousVideo} title="Previous Video">
              ⏮ PREV
            </button>
            <button onClick={playNextVideo} title="Next Video">
              NEXT ⏭
            </button>
          </div>
        </div>

        {error && <div className="tv-error">Error: {error}</div>}
      </div>
    </div>
  );
}
