import React, { useState, useEffect } from 'react'

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

	// Handle channel changes
	useEffect(() => {
		if (activeChannelIndex !== null && activeChannelIndex !== undefined && channels && channels.length > 0) {
			const channel = channels[activeChannelIndex]
			if (channel) {
				setChannelFadeOut(false)
				setDisplayChannel({
					number: activeChannelIndex + 1,
					name: channel.name
				})

				const timer = setTimeout(() => setChannelFadeOut(true), 2500)
				const hideTimer = setTimeout(() => setDisplayChannel(null), 2800)
				return () => {
					clearTimeout(timer)
					clearTimeout(hideTimer)
				}
			}
		}
	}, [activeChannelIndex, channels])

	// Handle volume changes
	useEffect(() => {
		if (volume !== null && volume !== undefined) {
			setVolumeFadeOut(false)
			const volumePercent = Math.round(volume * 100)
			setDisplayVolume({
				percent: volumePercent,
				bars: Math.ceil(volumePercent / 10),
				muted: isMuted
			})

			const timer = setTimeout(() => setVolumeFadeOut(true), 2000)
			const hideTimer = setTimeout(() => setDisplayVolume(null), 2300)
			return () => {
				clearTimeout(timer)
				clearTimeout(hideTimer)
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
