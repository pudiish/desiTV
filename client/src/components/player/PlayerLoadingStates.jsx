/**
 * PlayerLoadingStates - Loading state messages
 * 
 * Extracted from Player.jsx to reduce complexity
 */

import React from 'react'

export default function PlayerLoadingStates({ channel, items, current }) {
	if (!channel) {
		return (
			<div className="player-wrapper player-loading">
				<div className="tv-off-message">CHANNEL SELECT KARO</div>
			</div>
		)
	}

	if (!items || items.length === 0) {
		return (
			<div className="player-wrapper player-loading">
				<div className="tv-off-message">IS CHANNEL MEIN VIDEO NAHI</div>
			</div>
		)
	}

	if (!current) {
		return (
			<div className="player-wrapper player-loading">
				<div className="tv-off-message">VIDEO AA RAHA HAI...</div>
			</div>
		)
	}

	return null
}
