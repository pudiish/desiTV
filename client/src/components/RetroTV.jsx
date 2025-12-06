// src/components/RetroTV.jsx
import React, { useEffect, useRef, useState } from "react";
import "./RetroTV.css";

/**
 * Props:
 *  - initialVideoId: string (YouTube video id)
 *  - channels: array of { id: string, title?: string }
 */
export default function RetroTV({ initialVideoId, channels = [] }) {
  const playerRef = useRef(null);
  const ytRef = useRef(null);
  const [videoId, setVideoId] = useState(initialVideoId);
  const [started, setStarted] = useState(
    sessionStorage.getItem("retro_tv_gesture") === "1"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [staticVisible, setStaticVisible] = useState(false);
  const [error, setError] = useState(null);

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

    // you can define a no-op; real ready is handled in createPlayer below
  }, []);

  // Create or reuse player
  useEffect(() => {
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
      // if player already exists, simply cue the initial video (no destroy)
      if (ytRef.current) {
        // update video if needed
        ytRef.current.cueVideoById(videoId);
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
              // try to play (may succeed if gesture already happened)
              tryPlayUnmute();
            }
          },
          onStateChange: (e) => {
            // You can use state for analytics / UI
          },
          onError: (e) => {
            setError(`YT Error ${e.data}`);
          },
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Channel switcher: show static, then load videoId and autoplay (user gesture already happened)
  const switchChannel = (nextId) => {
    if (!ytRef.current) {
      setVideoId(nextId);
      return;
    }
    setStaticVisible(true);
    setIsLoading(true);
    // short static duration
    setTimeout(() => {
      ytRef.current.loadVideoById({ videoId: nextId, startSeconds: 0 });
      setVideoId(nextId);
      // small delay to allow player to start
      setTimeout(() => {
        // if user gesture occurred, we can call play and unmute
        if (sessionStorage.getItem("retro_tv_gesture") === "1") {
          try {
            ytRef.current.unMute?.();
          } catch (_) {}
          try {
            ytRef.current.playVideo?.();
          } catch (_) {}
        }
        setStaticVisible(false);
        setIsLoading(false);
      }, 600); // tweak for taste
    }, 700); // static duration
  };

  return (
    <div className="retro-tv-wrapper">
      <div className={`tv-frame ${started ? "on" : "off"}`}>
        {!started && (
          <div className="tv-overlay" role="button" onClick={onUserGesture}>
            <div className="power-button">POWER</div>
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

          <div className="crt-lines" />
        </div>

        <div className="tv-controls">
          <button onClick={() => {
            const i = channels.findIndex(c => c.id === videoId);
            const next = channels[(i + 1) % channels.length];
            switchChannel(next.id);
          }}>CH ▲</button>

          <button onClick={() => {
            const i = channels.findIndex(c => c.id === videoId);
            const prev = channels[(i - 1 + channels.length) % channels.length];
            switchChannel(prev.id);
          }}>CH ▼</button>
        </div>

        {error && <div className="tv-error">Error: {error}</div>}
      </div>
    </div>
  );
}
