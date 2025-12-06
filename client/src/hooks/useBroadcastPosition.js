import { useMemo } from 'react'
import { getPseudoLiveItem } from '../utils/pseudoLive'

/**
 * useBroadcastPosition - Single source of truth for broadcast position
 * 
 * This is the ONLY place where broadcast position should be calculated.
 * All components (Player, TVMenu, etc) use this hook to stay perfectly synced.
 * 
 * @param {Object} channel - Channel with items array and playlistStartEpoch
 * @returns {Object} Complete broadcast position state
 */
export function useBroadcastPosition(channel) {
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
			// Calculate broadcast position using pseudoLive algorithm
			const live = getPseudoLiveItem(channel.items, channel.playlistStartEpoch)
			
			if (!live || live.videoIndex === -1) {
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

			const currentVideo = channel.items[live.videoIndex]
			const videoDuration = currentVideo?.duration || 300
			const timeRemaining = Math.max(0, videoDuration - live.offset)
			
			const nextIdx = (live.videoIndex + 1) % channel.items.length
			const nextVideo = channel.items[nextIdx]
			const nextDuration = nextVideo?.duration || 300
			
			const totalDuration = channel.items.reduce((sum, v) => sum + (v.duration || 30), 0)

			return {
				videoIndex: live.videoIndex,
				video: currentVideo,
				offset: live.offset,
				timeRemaining: timeRemaining,
				nextVideoIndex: nextIdx,
				nextVideo: nextVideo,
				cyclePosition: live.cyclePosition,
				totalPlaylistDuration: totalDuration,
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
	}, [channel?.items, channel?.playlistStartEpoch])
}
