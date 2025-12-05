import React from 'react'

export default function CategoryList({ 
	channels = [], 
	selectedChannels = [], 
	onToggleChannel, 
	onSelectAll, 
	onSelectNone 
}) {
	// Ensure channels is an array before mapping
	const safeChannels = Array.isArray(channels) ? channels : []
	
	// Group channels by their name and count videos
	const channelList = safeChannels.map(channel => ({
		name: channel.name,
		count: channel.items?.length || 0,
		_id: channel._id
	})).filter(ch => ch.count > 0) // Only show channels with videos

	return (
		<div className="category-list">
			<div className="category-header">
				<h3>CHANNELS</h3>
				<div className="category-actions">
					<button className="category-link" onClick={onSelectAll}>Select All</button>
					<span> | </span>
					<button className="category-link" onClick={onSelectNone}>None</button>
				</div>
			</div>
			<div className="category-items">
				{channelList.length === 0 ? (
					<div className="category-name" style={{color: '#888', fontSize: '9px'}}>
						No channels available
					</div>
				) : (
					channelList.map(channel => (
						<label key={channel._id} className="category-item">
							<input
								type="checkbox"
								checked={selectedChannels.includes(channel.name)}
								onChange={() => onToggleChannel(channel.name)}
								className="category-checkbox"
							/>
							<span className="category-name">
								{channel.name} ({channel.count})
							</span>
						</label>
					))
				)}
			</div>
		</div>
	)
}
