import React, { useState, useEffect, useRef } from 'react'

/**
 * CRTInfoOverlay - Displays channel and volume info with retro CRT TV graphics
 * Channel: Top-right corner
 * Volume: Right side vertical bar
 */
export default function CRTInfoOverlay({ activeChannelIndex, channels, volume, isMuted }) {
	const [displayChannel, setDisplayChannel] = useState(null)
	const [displayVolume, setDisplayVolume] = useState(null)
	const [channelFadeOut, setChannelFadeOut] = useState(false)
	const [volumeFadeOut, setVolumeFadeOut] = useState(false)
	const prevChannelIndexRef = useRef(null)
	const isInitialMountRef = useRef(true)
	const channelTimerRef = useRef(null)
	const channelHideTimerRef = useRef(null)
	const volumeTimerRef = useRef(null)
	const volumeHideTimerRef = useRef(null)

	// Handle channel changes - only show when channel actually changes (not on initial load)
	useEffect(() => {
		// Clear any existing timers first
		if (channelTimerRef.current) {
			clearTimeout(channelTimerRef.current)
			channelTimerRef.current = null
		}
		if (channelHideTimerRef.current) {
			clearTimeout(channelHideTimerRef.current)
			channelHideTimerRef.current = null
		}

		// Skip on initial mount
		if (isInitialMountRef.current) {
			isInitialMountRef.current = false
			prevChannelIndexRef.current = activeChannelIndex
			return
		}

		// Only show if channel index actually changed
		if (activeChannelIndex !== null && 
		    activeChannelIndex !== undefined && 
		    activeChannelIndex !== prevChannelIndexRef.current &&
		    channels && 
		    channels.length > 0 &&
		    activeChannelIndex >= 0 &&
		    activeChannelIndex < channels.length) {
			const channel = channels[activeChannelIndex]
			if (channel) {
				// Clear any existing display first
				setDisplayChannel(null)
				setChannelFadeOut(false)
				
				// Show immediately
				setDisplayChannel({
					number: activeChannelIndex + 1,
					name: channel.name || `Channel ${activeChannelIndex + 1}`
				})
				setChannelFadeOut(false)

				// Hide completely after 2.5 seconds (2500ms) - good balance for readability
				// Timeline: 0ms=show, 2000ms=start fade, 2500ms=hide (fade completes at 2500ms)
				channelTimerRef.current = setTimeout(() => {
					setChannelFadeOut(true)
				}, 2000)
				
				channelHideTimerRef.current = setTimeout(() => {
					setDisplayChannel(null)
					setChannelFadeOut(false)
				}, 2500)
				
				// Update previous index
				prevChannelIndexRef.current = activeChannelIndex
			}
		} else {
			// Update previous index even if not showing (for tracking)
			prevChannelIndexRef.current = activeChannelIndex
		}

		// Cleanup function
		return () => {
			if (channelTimerRef.current) {
				clearTimeout(channelTimerRef.current)
				channelTimerRef.current = null
			}
			if (channelHideTimerRef.current) {
				clearTimeout(channelHideTimerRef.current)
				channelHideTimerRef.current = null
			}
		}
	}, [activeChannelIndex, channels])

	// Handle volume changes
	useEffect(() => {
		// Clear any existing timers first
		if (volumeTimerRef.current) {
			clearTimeout(volumeTimerRef.current)
			volumeTimerRef.current = null
		}
		if (volumeHideTimerRef.current) {
			clearTimeout(volumeHideTimerRef.current)
			volumeHideTimerRef.current = null
		}

		if (volume !== null && volume !== undefined) {
			setVolumeFadeOut(false)
			const volumePercent = Math.round(volume * 100)
			setDisplayVolume({
				percent: volumePercent,
				bars: Math.ceil(volumePercent / 10),
				muted: isMuted
			})

			volumeTimerRef.current = setTimeout(() => setVolumeFadeOut(true), 2000)
			volumeHideTimerRef.current = setTimeout(() => setDisplayVolume(null), 2300)
		}

		return () => {
			if (volumeTimerRef.current) {
				clearTimeout(volumeTimerRef.current)
				volumeTimerRef.current = null
			}
			if (volumeHideTimerRef.current) {
				clearTimeout(volumeHideTimerRef.current)
				volumeHideTimerRef.current = null
			}
		}
	}, [volume, isMuted])

	return (
		<>
			{/* Channel Display - Top Right Corner */}
			{displayChannel && (
				<div className={`crt-channel-display ${channelFadeOut ? 'fade-out' : ''}`}>
					<div className="channel-box">
						<div className="channel-label">CH</div>
						<div className="channel-number">{String(displayChannel.number).padStart(2, '0')}</div>
						<div className="channel-name-small">{displayChannel.name}</div>
					</div>
					<div className="scanlines-small" />
				</div>
			)}

			{/* Volume Display - Right Side Vertical */}
			{displayVolume && (
				<div className={`crt-volume-display ${volumeFadeOut ? 'fade-out' : ''}`}>
					<div className="volume-box">
						<div className="volume-label">VOL</div>
						<div className="volume-bars-vertical">
							{Array.from({ length: 10 }).map((_, i) => (
								<div
									key={i}
									className={`volume-bar-vertical ${i < displayVolume.bars ? 'active' : ''}`}
								/>
							))}
						</div>
						<div className="volume-value">
							{displayVolume.muted ? '●' : displayVolume.percent}
						</div>
					</div>
					<div className="scanlines-small" />
				</div>
			)}
		</>
	)
}
