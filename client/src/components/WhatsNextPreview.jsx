import React, { useState, useEffect, useMemo } from 'react'
import { getPseudoLiveItem } from '../logic/broadcast'

/**
 * WhatsNextPreview - Shows what's currently playing and up next
 * Appears on hover over the TV screen
 */
export default function WhatsNextPreview({ channel, isVisible, playbackInfo = null }) {
	const [currentTime, setCurrentTime] = useState(Date.now())

	// Update time every second for progress calculation
	useEffect(() => {
		if (!isVisible) return
		const interval = setInterval(() => setCurrentTime(Date.now()), 1000)
		return () => clearInterval(interval)
	}, [isVisible])

	// Calculate what's playing - prioritize live playbackInfo data
	const schedule = useMemo(() => {
		if (!channel || !channel.items || channel.items.length === 0) {
			return null
		}

		// Use live playbackInfo if available and from same channel
		if (playbackInfo && playbackInfo.videoIndex !== undefined) {
			const currentIdx = playbackInfo.videoIndex
			const now = channel.items[currentIdx]
			const next = channel.items[(currentIdx + 1) % channel.items.length]
			const afterNext = channel.items[(currentIdx + 2) % channel.items.length]

			return {
				now,
				next,
				afterNext,
				isLiveSynced: true
			}
		}

		// Fallback to calculated pseudo-live if no playbackInfo
		const live = getPseudoLiveItem(channel.items, channel.playlistStartEpoch)
		const currentIdx = live?.videoIndex ?? 0
		const now = channel.items[currentIdx]
		const next = channel.items[(currentIdx + 1) % channel.items.length]
		const afterNext = channel.items[(currentIdx + 2) % channel.items.length]

		return {
			now,
			next,
			afterNext,
			isLiveSynced: false
		}
	}, [channel, currentTime, playbackInfo])

	if (!isVisible || !schedule || !schedule.now) return null

	const formatTime = (seconds) => {
		const mins = Math.floor(seconds / 60)
		const secs = Math.floor(seconds % 60)
		return `${mins}:${secs.toString().padStart(2, '0')}`
	}

	const remaining = Math.max(0, schedule.duration - schedule.offset)

	return (
		<div className="whats-next-preview">
			<div className="preview-header">
				<span className="channel-badge">{channel.name}</span>
				<span className="live-indicator">● LIVE</span>
			</div>

		{/* Now Playing */}
		<div className="preview-now">
			<div className="preview-label">NOW PLAYING</div>
			<div className="preview-title">{schedule.now.title}</div>
		</div>			{/* Up Next */}
			{schedule.next && (
				<div className="preview-next">
					<div className="preview-label">UP NEXT</div>
				<div className="preview-title">{schedule.next.title}</div>
			</div>
		)}			{/* Later */}
			{schedule.afterNext && (
				<div className="preview-later">
					<div className="preview-label">LATER</div>
					<div className="preview-title">{schedule.afterNext.title}</div>
				</div>
			)}
		</div>
	)
}
