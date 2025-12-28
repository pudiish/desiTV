/**
 * viewerCountService.js
 * 
 * Service for tracking and displaying viewer counts
 * Creates the "shared experience" feeling
 */

import { apiClient } from '../apiClient'

let viewerCountCache = new Map() // channelId -> { count, timestamp }
const CACHE_TTL = 30 * 1000 // 30 seconds

/**
 * Join a channel (increment viewer count)
 * @param {string} channelId - Channel ID
 * @param {string} channelName - Channel name
 */
export async function joinChannel(channelId, channelName) {
	if (!channelId) return
	
	try {
		const data = await apiClient.post(`/api/viewer-count/${channelId}/join`, {
			channelName,
		})
		
		if (data && data.activeViewers !== undefined) {
			// Update cache
			viewerCountCache.set(channelId, {
				count: data.activeViewers,
				timestamp: Date.now(),
			})
			return data.activeViewers
		}
	} catch (err) {
		// Silently fail - viewer count is not critical
		console.warn('[ViewerCount] Failed to join channel:', err.message)
	}
	
	return null
}

/**
 * Leave a channel (decrement viewer count)
 * @param {string} channelId - Channel ID
 */
export async function leaveChannel(channelId) {
	if (!channelId) return
	
	try {
		const data = await apiClient.post(`/api/viewer-count/${channelId}/leave`, {})
		
		if (data && data.activeViewers !== undefined) {
			// Update cache
			viewerCountCache.set(channelId, {
				count: data.activeViewers,
				timestamp: Date.now(),
			})
			return data.activeViewers
		}
	} catch (err) {
		// Silently fail - viewer count is not critical
		console.warn('[ViewerCount] Failed to leave channel:', err.message)
	}
	
	return null
}

/**
 * Get viewer count for a channel
 * @param {string} channelId - Channel ID
 * @returns {Promise<number>} Viewer count
 */
export async function getViewerCount(channelId) {
	if (!channelId) return 0
	
	// Check cache first
	const cached = viewerCountCache.get(channelId)
	if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
		return cached.count
	}
	
	try {
		const response = await fetch(`/api/viewer-count/${channelId}`)
		if (response.ok) {
			const data = await response.json()
			const count = data.activeViewers || 0
			
			// Update cache
			viewerCountCache.set(channelId, {
				count,
				timestamp: Date.now(),
			})
			
			return count
		}
	} catch (err) {
		console.warn('[ViewerCount] Failed to get viewer count:', err)
	}
	
	return 0
}

/**
 * Format viewer count for display
 * @param {number} count - Viewer count
 * @returns {string} Formatted string
 */
export function formatViewerCount(count) {
	if (!count || count === 0) return ''
	if (count === 1) return '1 viewer'
	if (count < 1000) return `${count} viewers`
	if (count < 1000000) return `${(count / 1000).toFixed(1)}K viewers`
	return `${(count / 1000000).toFixed(1)}M viewers`
}

