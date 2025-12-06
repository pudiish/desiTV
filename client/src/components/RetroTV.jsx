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

  // Create or reuse player
  useEffect(() => {
    if (!videoId) return;

    if (!window.YT || !window.YT.Player) {
      // wait for API; poll until available
      const timer = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(timer);
          createPlayer();
        }
      }, 50);
      return () => clearInterval(timer);
    } else {
      createPlayer();
    }

    function createPlayer() {
      // if player already exists, load new video
      if (ytRef.current && playerRef.current) {
        ytRef.current.loadVideoById(videoId);
        if (started) {
          setTimeout(() => tryPlayUnmute(), 300);
        }
        return;
      }

      ytRef.current = new window.YT.Player("retro-tv-iframe", {
        height: "100%",
        width: "100%",
        videoId,
        playerVars: {
          autoplay: 0,        // we will call play() after gesture
          playsinline: 1,     // required on iPhone to play inline
          controls: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          mute: 1,            // start muted to be allowed to autoplay (if autoplay were used)
        },
        events: {
          onReady: (e) => {
            playerRef.current = e.target;
            // if user already performed gesture in earlier session, try autoplay
            if (started) {
              tryPlayUnmute();
            }
          },
          onStateChange: (e) => {
            // Video ended - play next in playlist
            if (e.data === 0) { // YT.PlayerState.ENDED
              playNextVideo();
            }
          },
          onError: (e) => {
            setError(`YT Error ${e.data}`);
            // Try next video on error
            setTimeout(() => playNextVideo(), 1000);
          },
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, channel?._id]);

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
