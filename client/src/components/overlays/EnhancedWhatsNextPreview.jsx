/**
 * EnhancedWhatsNextPreview.jsx
 * 
 * Enhanced version with viewer count, time slot display, and better UX
 * Shows the authentic 9XM experience with shared viewing
 */

import React, { useState, useEffect, useMemo } from 'react'
import { positionAt } from '@shared/broadcastPosition.js'
import { now as clockNow } from '../../services/time'
// Viewer count service removed - not needed for core functionality
import { getTimeSlotName, getTimeBasedGreeting } from '../../utils/timeBasedProgramming'
import { getUserTimezone } from '../../services/api/timezoneService'

export default function EnhancedWhatsNextPreview({ channel, isVisible, playbackInfo = null }) {
	const [refreshKey, setRefreshKey] = useState(0)
	// Viewer count removed - not needed for core functionality
	const [timeSlot, setTimeSlot] = useState('')

	// Update every second to trigger re-render for schedule recalculation
	useEffect(() => {
		if (!isVisible) return
		const interval = setInterval(() => setRefreshKey(k => k + 1), 1000)
		return () => clearInterval(interval)
	}, [isVisible])

	// Viewer count removed - not needed for core functionality

	// Update time slot display (timezone-aware)
	useEffect(() => {
		if (!isVisible) return
		const userTimezone = getUserTimezone()
		// Use channel's timezone if available, otherwise user's timezone
		const timezone = channel?.timezone || userTimezone
		setTimeSlot(getTimeSlotName(timezone))
		const interval = setInterval(() => setTimeSlot(getTimeSlotName(timezone)), 60000) // Update every minute
		return () => clearInterval(interval)
	}, [isVisible, channel?.timezone])

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
		const live = positionAt(clockNow(), Date.parse(channel.playlistStartEpoch), channel.items)
		const currentIdx = live.isValid ? live.videoIndex : 0
		const now = channel.items[currentIdx]
		const next = channel.items[(currentIdx + 1) % channel.items.length]
		const afterNext = channel.items[(currentIdx + 2) % channel.items.length]

		return {
			now,
			next,
			afterNext,
			isLiveSynced: false
		}
	}, [channel, refreshKey, playbackInfo])

	if (!isVisible || !schedule || !schedule.now) return null

	// Use channel's timezone if available, otherwise user's timezone
	const timezone = channel?.timezone || getUserTimezone()
	const greeting = getTimeBasedGreeting(timezone)

	return (
		<div className="whats-next-preview enhanced">
			<div className="preview-header">
				<div className="header-top">
					<span className="channel-badge">{channel.name}</span>
					<span className="live-indicator">● LIVE</span>
				</div>
				{timeSlot && (
					<div className="time-slot-badge">{timeSlot}</div>
				)}
				{/* Viewer count removed - not needed for core functionality */}
			</div>

			{/* Greeting */}
			<div className="preview-greeting">{greeting}</div>

			{/* Now Playing */}
			<div className="preview-now">
				<div className="preview-label">NOW PLAYING</div>
				<div className="preview-title">{schedule.now.title}</div>
			</div>

			{/* Up Next */}
			{schedule.next && (
				<div className="preview-next">
					<div className="preview-label">UP NEXT</div>
					<div className="preview-title">{schedule.next.title}</div>
				</div>
			)}

			{/* Later */}
			{schedule.afterNext && (
				<div className="preview-later">
					<div className="preview-label">LATER</div>
					<div className="preview-title">{schedule.afterNext.title}</div>
				</div>
			)}
		</div>
	)
}

