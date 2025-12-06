import { useMemo } from 'react'
import LocalBroadcastStateManager from '../utils/LocalBroadcastStateManager'

/**
 * useBroadcastPosition - Single source of truth for broadcast position
 * 
 * Uses LocalBroadcastStateManager for localStorage-based timeline
 * All components (Player, TVMenu, etc) use this hook to stay perfectly synced.
 * 
 * @param {Object} channel - Channel with items array
 * @returns {Object} Complete broadcast position state
 */
export function useBroadcastPosition(channel) {
	// Get state timestamp to trigger recalculation on epoch changes
	const stateTimestamp = channel?._id 
		? LocalBroadcastStateManager.getChannelState(channel._id)?.lastAccessTime
		: null

	return useMemo(() => {
		if (!channel?.items || channel.items.length === 0) {
			return {
				videoIndex: -1,
				video: null,
				offset: 0,
				timeRemaining: 0,
				nextVideoIndex: 0,
				nextVideo: null,
				cyclePosition: 0,
				totalPlaylistDuration: 0,
				nextTimeRemaining: 0,
				isValid: false
			}
		}

		try {
			// Initialize channel state if needed
			if (!LocalBroadcastStateManager.getChannelState(channel._id)) {
				LocalBroadcastStateManager.initializeChannel(channel)
			}

			// Calculate broadcast position using LocalBroadcastStateManager
			const position = LocalBroadcastStateManager.calculateCurrentPosition(channel)
			
			if (!position || position.videoIndex === -1) {
				return {
					videoIndex: 0,
					video: channel.items[0],
					offset: 0,
					timeRemaining: channel.items[0]?.duration || 300,
					nextVideoIndex: 1 % channel.items.length,
					nextVideo: channel.items[1 % channel.items.length],
					cyclePosition: 0,
					totalPlaylistDuration: channel.items.reduce((sum, v) => sum + (v.duration || 30), 0),
					nextTimeRemaining: 0,
					isValid: true
				}
			}

			const currentVideo = channel.items[position.videoIndex]
			const videoDuration = currentVideo?.duration || 300
			const timeRemaining = Math.max(0, videoDuration - position.offset)
			
			const nextIdx = (position.videoIndex + 1) % channel.items.length
			const nextVideo = channel.items[nextIdx]
			const nextDuration = nextVideo?.duration || 300

			return {
				videoIndex: position.videoIndex,
				video: currentVideo,
				offset: position.offset,
				timeRemaining: timeRemaining,
				nextVideoIndex: nextIdx,
				nextVideo: nextVideo,
				cyclePosition: position.cyclePosition,
				totalPlaylistDuration: position.totalDuration,
				nextTimeRemaining: nextDuration,
				isValid: true
			}
		} catch (err) {
			console.error('[useBroadcastPosition] Error calculating position:', err)
			return {
				videoIndex: 0,
				video: channel.items?.[0] || null,
				offset: 0,
				timeRemaining: channel.items?.[0]?.duration || 300,
				nextVideoIndex: 1 % (channel.items?.length || 1),
				nextVideo: channel.items?.[1] || null,
				cyclePosition: 0,
				totalPlaylistDuration: channel.items?.reduce((sum, v) => sum + (v.duration || 30), 0) || 0,
				nextTimeRemaining: channel.items?.[1]?.duration || 300,
				isValid: false
			}
		}
	}, [channel?._id, channel?.items, stateTimestamp])
}
