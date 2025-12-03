import React from 'react'

export default function ControlPanel({ 
	power, 
	onPowerToggle, 
	onChannelUp, 
	onChannelDown, 
	volume, 
	onVolumeUp, 
	onVolumeDown 
}) {
	return (
		<div className="control-panel">
			<button 
				className="control-btn power-btn" 
				onClick={onPowerToggle}
			>
				POWER
			</button>
			
			<div className="control-row">
				<button className="control-btn ch-btn" onClick={onChannelDown}>
					CH ▼
				</button>
				<button className="control-btn ch-btn" onClick={onChannelUp}>
					CH ▲
				</button>
			</div>
			
			<div className="control-row">
				<button className="control-btn vol-btn" onClick={onVolumeDown}>
					VOL −
				</button>
				<button className="control-btn vol-btn" onClick={onVolumeUp}>
					VOL +
				</button>
			</div>
			
			<div className="volume-indicator">
				Volume: {Math.round(volume * 100)}%
			</div>
		</div>
	)
}

