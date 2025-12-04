/**
 * IMPROVED Player Component with:
 * - Proper state machine
 * - Unified event cleanup
 * - Stuck state detection & recovery
 * - No race conditions
 * - Proper timeout management
 */

import React, { useEffect, useState, useMemo, useRef, useReducer } from 'react'
import YouTube from 'react-youtube'
import { getPseudoLiveItem, getNextVideoInSequence } from '../utils/pseudoLive'
import { EventCleanupManager } from '../utils/EventCleanupManager'
import { PlayerStateManager } from '../utils/PlayerStateManager'
import { StuckStateDetector } from '../utils/StuckStateDetector'

// Player action types for reducer
const PLAYER_ACTIONS = {
    SET_BUFFERING: 'SET_BUFFERING',
    SET_CURRENT_INDEX: 'SET_CURRENT_INDEX',
    SET_MANUAL_INDEX: 'SET_MANUAL_INDEX',
    SET_CHANNEL_CHANGED: 'SET_CHANNEL_CHANGED',
    RESET_AD_STATE: 'RESET_AD_STATE',
    RECORD_FAILED_VIDEO: 'RECORD_FAILED_VIDEO',
    CLEAR_FAILED_VIDEOS: 'CLEAR_FAILED_VIDEOS',
    INCREMENT_SKIP_ATTEMPTS: 'INCREMENT_SKIP_ATTEMPTS',
    RESET_SKIP_ATTEMPTS: 'RESET_SKIP_ATTEMPTS'
}

const playerReducer = (state, action) => {
    switch (action.type) {
        case PLAYER_ACTIONS.SET_BUFFERING:
            return { ...state, isBuffering: action.payload }
        case PLAYER_ACTIONS.SET_CURRENT_INDEX:
            return { ...state, currentIndex: action.payload }
        case PLAYER_ACTIONS.SET_MANUAL_INDEX:
            return { ...state, manualIndex: action.payload }
        case PLAYER_ACTIONS.SET_CHANNEL_CHANGED:
            return { ...state, channelChanged: action.payload }
        case PLAYER_ACTIONS.RECORD_FAILED_VIDEO:
            return {
                ...state,
                failedVideos: new Set([...state.failedVideos, action.payload])
            }
        case PLAYER_ACTIONS.CLEAR_FAILED_VIDEOS:
            return { ...state, failedVideos: new Set() }
        case PLAYER_ACTIONS.INCREMENT_SKIP_ATTEMPTS:
            return { ...state, skipAttempts: state.skipAttempts + 1 }
        case PLAYER_ACTIONS.RESET_SKIP_ATTEMPTS:
            return { ...state, skipAttempts: 0 }
        default:
            return state
    }
}

export default function Player({
    channel,
    onVideoEnd,
    onChannelChange,
    volume = 0.5,
    uiLoadTime,
    allChannels = [],
    shouldAdvanceVideo = false,
    onBufferingChange = null
}) {
    const playerRef = useRef(null)
    const channelIdRef = useRef(null)
    const channelChangeCounterRef = useRef(0)

    // Unified event management
    const eventManagerRef = useRef(new EventCleanupManager('Player'))

    // State machine
    const stateManagerRef = useRef(new PlayerStateManager())

    // Stuck state detection
    const stuckDetectorRef = useRef(new StuckStateDetector(15000))

    // Reducer for complex state
    const [playerState, dispatch] = useReducer(playerReducer, {
        currentIndex: 0,
        manualIndex: null,
        channelChanged: false,
        isBuffering: false,
        failedVideos: new Set(),
        skipAttempts: 0
    })

    const SWITCH_BEFORE_END = 3
    const MAX_SKIP_ATTEMPTS = Math.max(channel?.items?.length || 10, 10)

    // Items array - safe normalized
    const items = Array.isArray(channel?.items) ? channel.items : []

    // Check if Ads channel
    const isAdsChannel = useMemo(() => {
        return channel?.name && (
            channel.name.toLowerCase() === 'ads' ||
            channel.name.toLowerCase() === 'ad' ||
            channel.name.toLowerCase() === 'advertisements'
        )
    }, [channel?.name])

    // Compute pseudo-live position
    const effectiveStartEpoch = useMemo(() => {
        if (uiLoadTime && channel?.playlistStartEpoch) {
            return new Date(uiLoadTime)
        }
        return channel?.playlistStartEpoch || new Date('2020-01-01T00:00:00Z')
    }, [uiLoadTime, channel?.playlistStartEpoch])

    const live = useMemo(() => getPseudoLiveItem(items, effectiveStartEpoch), [items, effectiveStartEpoch])

    const liveIndex = live?.videoIndex ?? 0
    const currIndex = playerState.channelChanged
        ? liveIndex
        : (playerState.manualIndex !== null ? playerState.manualIndex : playerState.currentIndex)
    const current = items[currIndex]

    // ------- Channel Change Handler -------
    useEffect(() => {
        if (channel?._id !== channelIdRef.current) {
            const wasChannelChange = channelIdRef.current !== null
            channelIdRef.current = channel?._id
            channelChangeCounterRef.current++

            // COMPLETE CLEANUP on channel change
            eventManagerRef.current.cleanupAll()

            if (playerRef.current) {
                try {
                    playerRef.current.stopVideo()
                } catch (err) {
                    console.warn('[Player] Error stopping video:', err)
                }
            }

            // Reset all state
            dispatch({ type: PLAYER_ACTIONS.CLEAR_FAILED_VIDEOS })
            dispatch({ type: PLAYER_ACTIONS.RESET_SKIP_ATTEMPTS })
            dispatch({ type: PLAYER_ACTIONS.SET_CURRENT_INDEX, payload: 0 })
            dispatch({ type: PLAYER_ACTIONS.SET_MANUAL_INDEX, payload: null })
            dispatch({ type: PLAYER_ACTIONS.SET_CHANNEL_CHANGED, payload: true })
            dispatch({ type: PLAYER_ACTIONS.SET_BUFFERING, payload: false })

            // Reset state machine
            stateManagerRef.current.reset()
            stuckDetectorRef.current.reset()

            if (onChannelChange) onChannelChange()

            // Clear channel changed flag after brief moment
            if (wasChannelChange) {
                eventManagerRef.current.setTimeout('channel_change_reset', () => {
                    dispatch({ type: PLAYER_ACTIONS.SET_CHANNEL_CHANGED, payload: false })
                }, 100)
            }
        }
    }, [channel?._id, onChannelChange])

    // ------- Volume Sync -------
    useEffect(() => {
        if (playerRef.current) {
            try {
                playerRef.current.setVolume(volume * 100)
                if (volume > 0) {
                    playerRef.current.unMute()
                } else {
                    playerRef.current.mute()
                }
            } catch (err) {
                console.warn('[Player] Error syncing volume:', err)
            }
        }
    }, [volume])

    // ------- Handle Ad Advance -------
    useEffect(() => {
        if (shouldAdvanceVideo && !isAdsChannel && stateManagerRef.current.isReadyForPlayback()) {
            const nextIndex = (currIndex + 1) % items.length
            dispatch({ type: PLAYER_ACTIONS.SET_MANUAL_INDEX, payload: nextIndex })
            dispatch({ type: PLAYER_ACTIONS.SET_CURRENT_INDEX, payload: nextIndex })
        }
    }, [shouldAdvanceVideo, isAdsChannel, currIndex, items.length])

    // ------- STUCK STATE DETECTION -------
    useEffect(() => {
        const unsubscribe = stateManagerRef.current.onStateChange((info) => {
            stuckDetectorRef.current.recordStateChange(info.current, { age: info.age })

            // Check if stuck
            if (stuckDetectorRef.current.isPlayerStuck()) {
                console.warn('[Player] STUCK STATE DETECTED:', stuckDetectorRef.current.getDiagnostics())

                const recovery = stuckDetectorRef.current.getRecoveryAction()
                if (recovery) {
                    console.warn('[Player] Attempting recovery:', recovery.action)
                    stuckDetectorRef.current.recordRecoveryAttempt(recovery.reason)

                    // Attempt recovery based on action
                    switch (recovery.action) {
                        case 'SKIP_VIDEO':
                            eventManagerRef.current.setTimeout('recovery_skip', () => {
                                switchToNextVideo(true)
                            }, recovery.delay)
                            break

                        case 'FORCE_END_TRANSITION':
                            eventManagerRef.current.setTimeout('recovery_transition', () => {
                                stateManagerRef.current.forceTransitionTo(
                                    PlayerStateManager.STATES.IDLE,
                                    'recovery'
                                )
                            }, recovery.delay)
                            break

                        case 'RESET_PLAYER':
                            eventManagerRef.current.setTimeout('recovery_reset', () => {
                                resetPlayer()
                            }, recovery.delay)
                            break
                    }
                }
            }
        })

        return () => {
            unsubscribe()
        }
    }, [])

    // ------- Progress Monitoring -------
    function startProgressMonitoring() {
        const abortSignal = eventManagerRef.current.createAbortController('progress').signal

        eventManagerRef.current.setInterval('progress_check', () => {
            if (abortSignal.aborted || !playerRef.current) return
            if (stateManagerRef.current.currentState === PlayerStateManager.STATES.TRANSITIONING) return

            try {
                Promise.all([
                    playerRef.current.getCurrentTime(),
                    playerRef.current.getDuration()
                ])
                    .then(([currentTime, duration]) => {
                        if (abortSignal.aborted) return
                        if (duration && currentTime && duration > 0) {
                            const timeRemaining = duration - currentTime

                            if (
                                timeRemaining <= SWITCH_BEFORE_END &&
                                timeRemaining > 0 &&
                                stateManagerRef.current.currentState !== PlayerStateManager.STATES.TRANSITIONING
                            ) {
                                switchToNextVideo()
                            }
                        }
                    })
                    .catch((err) => {
                        if (!abortSignal.aborted) {
                            console.warn('[Player] Error getting video time:', err)
                        }
                    })
            } catch (err) {
                if (!abortSignal.aborted) {
                    console.warn('[Player] Error in progress monitor:', err)
                }
            }
        }, 500)
    }

    // ------- Video Switching -------
    function switchToNextVideo(skipFailed = false) {
        // Prevent overlapping transitions
        if (stateManagerRef.current.currentState === PlayerStateManager.STATES.TRANSITIONING) {
            return
        }

        // If ad channel, notify parent
        if (isAdsChannel) {
            stateManagerRef.current.transitionTo(PlayerStateManager.STATES.TRANSITIONING, 'ad_end')
            if (onVideoEnd) onVideoEnd()
            return
        }

        // Transition to transitioning state
        if (!stateManagerRef.current.transitionTo(PlayerStateManager.STATES.TRANSITIONING, 'video_end')) {
            return
        }

        // Stop progress monitoring
        eventManagerRef.current.cleanup('progress')

        // Pause video
        if (playerRef.current) {
            try {
                playerRef.current.pauseVideo()
            } catch (err) {
                console.warn('[Player] Error pausing:', err)
            }
        }

        // Notify parent for ad insertion
        if (onVideoEnd) onVideoEnd()

        // Wait to see if ad interrupts
        eventManagerRef.current.setTimeout('transition_complete', () => {
            // Check if channel changed (ad inserted)
            if (channelIdRef.current === channel?._id && !isAdsChannel) {
                const nextIndex = findNextAvailableVideo(currIndex, skipFailed)
                dispatch({ type: PLAYER_ACTIONS.SET_CURRENT_INDEX, payload: nextIndex })
                dispatch({ type: PLAYER_ACTIONS.SET_MANUAL_INDEX, payload: nextIndex })
            }

            // End transition
            stateManagerRef.current.transitionTo(PlayerStateManager.STATES.IDLE, 'transition_end')
        }, 500)
    }

    function findNextAvailableVideo(currentIdx, skipFailed) {
        if (items.length === 1) return 0

        let nextIdx = currentIdx
        let attempts = 0
        const maxAttempts = items.length

        do {
            nextIdx = (nextIdx + 1) % items.length
            attempts++

            if (attempts >= maxAttempts && playerState.failedVideos.size >= items.length) {
                dispatch({ type: PLAYER_ACTIONS.CLEAR_FAILED_VIDEOS })
                break
            }
        } while (
            skipFailed &&
            playerState.failedVideos.has(items[nextIdx]?.youtubeId) &&
            attempts < maxAttempts
        )

        return nextIdx
    }

    // ------- Error Handling -------
    function handleVideoError(error) {
        const errorCode = error?.data
        const isUnavailable =
            errorCode === 100 || errorCode === 101 || errorCode === 150 || errorCode === 2

        if (isUnavailable && current?.youtubeId) {
            console.warn(`[Player] Video unavailable (${errorCode}):`, current.youtubeId)

            // Show error message
            if (onBufferingChange) {
                const messages = { 100: 'VIDEO NOT FOUND', 101: 'NOT EMBEDDABLE', 150: 'RESTRICTED', 2: 'INVALID ID' }
                onBufferingChange(true, messages[errorCode] || `ERROR ${errorCode}`)
            }

            // Mark failed
            dispatch({
                type: PLAYER_ACTIONS.RECORD_FAILED_VIDEO,
                payload: current.youtubeId
            })
            dispatch({ type: PLAYER_ACTIONS.INCREMENT_SKIP_ATTEMPTS })

            // Skip if haven't exceeded max
            if (playerState.skipAttempts < MAX_SKIP_ATTEMPTS) {
                eventManagerRef.current.setTimeout('error_skip', () => {
                    switchToNextVideo(true)
                }, 1000)
            } else {
                console.error('[Player] Max skip attempts reached')
                dispatch({ type: PLAYER_ACTIONS.RESET_SKIP_ATTEMPTS })
                stateManagerRef.current.transitionTo(PlayerStateManager.STATES.ERROR, 'max_skips')
            }
        } else {
            console.error('[Player] YouTube error:', error)
        }

        stateManagerRef.current.transitionTo(PlayerStateManager.STATES.ERROR, 'video_error')
    }

    // ------- State Change Handler -------
    function onStateChange(event) {
        const state = event.data

        switch (state) {
            case 0: // Ended
                if (stateManagerRef.current.currentState !== PlayerStateManager.STATES.TRANSITIONING) {
                    if (isAdsChannel) {
                        if (onVideoEnd) onVideoEnd()
                    } else {
                        switchToNextVideo()
                    }
                }
                break

            case 1: // Playing
                stateManagerRef.current.transitionTo(PlayerStateManager.STATES.PLAYING, 'youtube_playing')
                eventManagerRef.current.setTimeout('buffer_clear', () => {
                    dispatch({ type: PLAYER_ACTIONS.SET_BUFFERING, payload: false })
                }, 200)

                if (!eventManagerRef.current.getAbortSignal('progress')?.aborted) {
                    startProgressMonitoring()
                }
                break

            case 3: // Buffering
                stateManagerRef.current.transitionTo(PlayerStateManager.STATES.BUFFERING, 'youtube_buffering')
                dispatch({ type: PLAYER_ACTIONS.SET_BUFFERING, payload: true })
                break

            case 5: // Cued
                stateManagerRef.current.transitionTo(PlayerStateManager.STATES.LOADING, 'youtube_cued')
                eventManagerRef.current.setTimeout('progress_restart', () => {
                    if (!eventManagerRef.current.getAbortSignal('progress')?.aborted) {
                        startProgressMonitoring()
                    }
                }, 1000)
                break
        }
    }

    // ------- Player Ready -------
    function onReady(e) {
        playerRef.current = e.target
        stateManagerRef.current.transitionTo(PlayerStateManager.STATES.LOADING, 'player_ready')

        try {
            e.target.mute()
            e.target.setVolume(volume * 100)

            try {
                e.target.setPlaybackQuality('medium')
            } catch (err) {
                // Quality not available
            }

            if (live?.offset) {
                e.target.seekTo(live.offset, true)
            }
            e.target.playVideo()

            eventManagerRef.current.setTimeout('unmute', () => {
                if (playerRef.current && volume > 0) {
                    try {
                        playerRef.current.unMute()
                    } catch (err) {
                        console.warn('[Player] Error unmuting:', err)
                    }
                }
            }, 500)

            startProgressMonitoring()
        } catch (err) {
            console.error('[Player] Error in onReady:', err)
            stateManagerRef.current.transitionTo(PlayerStateManager.STATES.ERROR, 'ready_error')
        }
    }

    // ------- Reset Player -------
    function resetPlayer() {
        eventManagerRef.current.cleanupAll()
        if (playerRef.current) {
            try {
                playerRef.current.stopVideo()
            } catch (err) {
                console.warn('[Player] Error stopping during reset:', err)
            }
        }
        stateManagerRef.current.reset()
        stuckDetectorRef.current.reset()
        dispatch({ type: PLAYER_ACTIONS.CLEAR_FAILED_VIDEOS })
        dispatch({ type: PLAYER_ACTIONS.RESET_SKIP_ATTEMPTS })
    }

    // ------- Cleanup on Unmount -------
    useEffect(() => {
        return () => {
            eventManagerRef.current.cleanupAll()
        }
    }, [])

    // ------- Render -------
    if (!channel || !items.length || !current) return null

    const playerKey = `${channel?._id}-${current.youtubeId}-${currIndex}-${channelChangeCounterRef.current}`

    const opts = {
        width: '100%',
        height: '100%',
        playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            start: live?.offset || 0,
            iv_load_policy: 3,
            showinfo: 0,
            fs: 0,
            cc_load_policy: 0,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            widget_referrer: window.location.origin,
            quality: 'medium',
            autohide: 1,
            loop: 0
        }
    }

    return (
        <div className="player-wrapper">
            <YouTube
                key={playerKey}
                videoId={current.youtubeId}
                opts={opts}
                onReady={onReady}
                onStateChange={onStateChange}
                onError={handleVideoError}
                className="youtube-player-container"
                iframeClassName="youtube-iframe"
            />
            {playerState.isBuffering && (
                <div className="static-effect-tv">
                    <div className="static-noise-overlay" />
                </div>
            )}
        </div>
    )
}
