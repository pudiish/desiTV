/**
 * useYouTubePlayer - Custom hook for YouTube player initialization and management
 * 
 * Extracted from Player.jsx to reduce complexity
 */

import { useEffect, useRef, useCallback } from 'react'
import { PLAYBACK_THRESHOLDS } from '../config/thresholds'

export function useYouTubePlayer(videoId, channelId, startSeconds, userInteracted, onReady, onStateChange, onError) {
	const ytPlayerRef = useRef(null)
	const playerRef = useRef(null)
	const e7Ref = useRef(false)
	const clipSeekTimeRef = useRef(0)
	const onReadyRef = useRef(onReady)
	const onStateChangeRef = useRef(onStateChange)
	const handleVideoErrorRef = useRef(onError)

	// Keep refs updated
	useEffect(() => {
		onReadyRef.current = onReady
		onStateChangeRef.current = onStateChange
		handleVideoErrorRef.current = onError
	}, [onReady, onStateChange, onError])

	// Initialize YouTube player
	const initYouTubePlayer = useCallback(() => {
		if (!window.YT || !window.YT.Player) {
			return false
		}

		const container = document.getElementById('desitv-player-iframe')
		if (!container) {
			return false
		}

		// If player exists, just load new video
		if (ytPlayerRef.current) {
			return true
		}

		// Create new player
		try {
			const containerEl = document.getElementById('desitv-player-iframe')
			if (!containerEl) return false

			ytPlayerRef.current = new window.YT.Player('desitv-player-iframe', {
				width: '100%',
				height: '100%',
				playerVars: {
					autoplay: 0,
					playsinline: 1,
					controls: 0,
					modestbranding: 1,
					rel: 0,
					iv_load_policy: 3,
					mute: userInteracted ? 0 : 1,
					enablejsapi: 1,
				},
				events: {
					onReady: (e) => {
						if (onReadyRef.current) {
							onReadyRef.current(e)
						}
					},
					onStateChange: (e) => {
						if (onStateChangeRef.current) {
							onStateChangeRef.current(e)
						}
					},
					onError: (e) => {
						if (handleVideoErrorRef.current) {
							handleVideoErrorRef.current(e)
						}
					},
				},
			})

			playerRef.current = ytPlayerRef.current
			return true
		} catch (err) {
			console.error('[useYouTubePlayer] Error creating player:', err)
			return false
		}
	}, [userInteracted])

	// Load video to player
	const loadVideoToPlayer = useCallback(() => {
		if (!ytPlayerRef.current || !videoId) return

		// Ensure player is fully initialized
		if (typeof ytPlayerRef.current.loadVideoById !== 'function') {
			console.warn('[useYouTubePlayer] Player not ready, waiting for initialization...')
			setTimeout(() => {
				if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === 'function') {
					loadVideoToPlayer()
				}
			}, 100)
			return
		}

		console.log('[useYouTubePlayer] Loading video:', videoId, 'at', startSeconds, 's')
		e7Ref.current = true

		try {
			ytPlayerRef.current.loadVideoById({
				videoId: videoId,
				startSeconds: 0
			})
			clipSeekTimeRef.current = startSeconds
		} catch (err) {
			console.error('[useYouTubePlayer] Error loading video:', err)
		}
	}, [videoId, startSeconds])

	// Initialize player when video/channel changes
	useEffect(() => {
		if (!videoId || !channelId) {
			return
		}

		if (window.YT && window.YT.Player) {
			if (ytPlayerRef.current) {
				loadVideoToPlayer()
			} else {
				if (!initYouTubePlayer()) {
					const timer = setInterval(() => {
						if (initYouTubePlayer()) {
							clearInterval(timer)
						}
					}, 100)
					return () => clearInterval(timer)
				}
			}
		} else {
			const originalCallback = window.onYouTubeIframeAPIReady
			window.onYouTubeIframeAPIReady = () => {
				if (originalCallback) originalCallback()
				initYouTubePlayer()
			}
		}
	}, [videoId, channelId, startSeconds, userInteracted, initYouTubePlayer, loadVideoToPlayer])

	return {
		playerRef,
		ytPlayerRef,
		e7Ref,
		clipSeekTimeRef,
		loadVideoToPlayer,
	}
}

