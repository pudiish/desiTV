import React, { useEffect, useRef, useState } from 'react'

/**
 * TVRemote - Retro TV remote control styled after classic VCR remotes
 * Features: Power, Channel, Volume, Number pad, Menu, Play controls
 */
export default function TVRemote({
	power,
	onPowerToggle,
	onChannelUp,
	onChannelDown,
	onChannelDirect,
	volume,
	onVolumeUp,
	onVolumeDown,
	onMute,
	onMenuToggle,
	onPlayPause,
	onStop,
	onRecord,
	activeChannelIndex,
	totalChannels,
	menuOpen = false,
	onTapTrigger = null, // Handler to trigger iOS gesture unlock
	onFullscreenToggle = null // Handler to toggle fullscreen
}) {
	const [channelInput, setChannelInput] = useState('')
	const channelInputTimeout = useRef(null)
	const shutdownSoundRef = useRef(null)
	const buttonClickSoundRef = useRef(null)

	// Initialize audio
	useEffect(() => {
		shutdownSoundRef.current = new Audio('/sounds/tv-shutdown-386167.mp3')
		shutdownSoundRef.current.volume = 0.5
		
		// Static noise for button clicks
		buttonClickSoundRef.current = new Audio('/sounds/tv-static-noise-291374.mp3')
		buttonClickSoundRef.current.volume = 0.1
	}, [])

	// Play shutdown sound when TV turns off
	const handlePowerClick = () => {
		if (power && shutdownSoundRef.current) {
			shutdownSoundRef.current.currentTime = 0
			shutdownSoundRef.current.play().catch(() => {})
		}
		playButtonSound()
		if (onTapTrigger) onTapTrigger()
		onPowerToggle()
	}

	const playButtonSound = () => {
		if (buttonClickSoundRef.current) {
			buttonClickSoundRef.current.currentTime = 0
			buttonClickSoundRef.current.play().catch(() => {})
		}
		if (onTapTrigger) onTapTrigger()
	}

	// Handle number pad input for direct channel access
	const handleNumberClick = (num) => {
		playButtonSound()
		if (onTapTrigger) onTapTrigger()
		if (!power) return
		
		const newInput = channelInput + num
		setChannelInput(newInput)

		// Clear existing timeout
		if (channelInputTimeout.current) {
			clearTimeout(channelInputTimeout.current)
		}

		// Auto-submit after 1.5 seconds or if 2 digits entered
		channelInputTimeout.current = setTimeout(() => {
			const channelNum = parseInt(newInput)
			if (channelNum > 0 && channelNum <= totalChannels) {
				onChannelDirect(channelNum - 1) // Convert to 0-indexed
			}
			setChannelInput('')
		}, newInput.length >= 2 ? 100 : 1500)
	}

	// Keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e) => {
			// Ignore if typing in an input
			if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

			// While menu is open, prevent remote keys from changing channel/volume
			const menuBlockingKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9']
			if (menuOpen && menuBlockingKeys.includes(e.key)) {
				e.preventDefault()
				return
			}

			switch (e.key) {
				case 'ArrowUp':
					e.preventDefault()
					if (power) {
						playButtonSound()
						onChannelUp()
					}
					break
				case 'ArrowDown':
					e.preventDefault()
					if (power) {
						playButtonSound()
						onChannelDown()
					}
					break
				case 'ArrowRight':
					e.preventDefault()
					if (power) {
						playButtonSound()
						onVolumeUp()
					}
					break
				case 'ArrowLeft':
					e.preventDefault()
					if (power) {
						playButtonSound()
						onVolumeDown()
					}
					break
				case ' ':
				case 'Enter':
					e.preventDefault()
					handlePowerClick()
					break
				case 'm':
				case 'M':
					e.preventDefault()
					if (power) {
						playButtonSound()
						onMute()
					}
					break
				case 'Escape':
					e.preventDefault()
					if (power && onMenuToggle) {
						playButtonSound()
						onMenuToggle()
					}
					break
				case 'f':
				case 'F':
					e.preventDefault()
					if (power && onFullscreenToggle) {
						playButtonSound()
						onFullscreenToggle()
					}
					break
				case '0':
				case '1':
				case '2':
				case '3':
				case '4':
				case '5':
				case '6':
				case '7':
				case '8':
				case '9':
					e.preventDefault()
					handleNumberClick(e.key)
					break
				default:
					break
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [power, onChannelUp, onChannelDown, onVolumeUp, onVolumeDown, onMute, onMenuToggle, onFullscreenToggle, channelInput, menuOpen])

	return (
		<div className="tv-remote">
			{/* Remote Body */}
			<div className="remote-body">
				{/* Brand Label */}
				<div className="remote-brand">DesiTV™</div>

				{/* Power Button */}
				<div className="remote-section power-section">
					<button 
						className={`remote-btn power-btn ${power ? 'on' : ''}`}
						onClick={handlePowerClick}
						title="Power (Space/Enter)"
					>
						<span className="power-icon">⏻</span>
					</button>
					<div className="power-led">
						<div className={`led ${power ? 'on' : ''}`}></div>
					</div>
				</div>

				{/* Channel Display */}
				<div className="channel-display">
					<span className="channel-label">CH</span>
					<span className="channel-number">
						{channelInput || (power ? String(activeChannelIndex + 1).padStart(2, '0') : '--')}
					</span>
				</div>

				{/* Number Pad */}
				<div className="number-pad">
					{[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
						<button
							key={num}
							className="remote-btn num-btn"
							onClick={() => handleNumberClick(String(num))}
							disabled={!power}
							title={`Channel ${num}`}
						>
							{num}
						</button>
					))}
					<button className="remote-btn num-btn special" onClick={() => handleNumberClick('0')} disabled={!power}>
						0
					</button>
				</div>

				{/* Channel/Volume Controls */}
				<div className="dpad-section">
					<div className="dpad">
						<button
							className="remote-btn dpad-btn up"
							onClick={() => { playButtonSound(); onChannelUp(); }}
							disabled={!power}
							title="Channel Up (↑)"
						>
							CH▲
						</button>
						<div className="dpad-middle">
							<button
								className="remote-btn dpad-btn left"
								onClick={() => { playButtonSound(); onVolumeDown(); }}
								disabled={!power}
								title="Volume Down (←)"
							>
								VOL−
							</button>
							<button
								className="remote-btn dpad-btn center menu-btn"
								onClick={() => { playButtonSound(); onMenuToggle && onMenuToggle(); }}
								disabled={!power}
								title="Menu (Esc)"
							>
								MENU
							</button>
							<button
								className="remote-btn dpad-btn right"
								onClick={() => { playButtonSound(); onVolumeUp(); }}
								disabled={!power}
								title="Volume Up (→)"
							>
								VOL+
							</button>
						</div>
						<button
							className="remote-btn dpad-btn down"
							onClick={() => { playButtonSound(); onChannelDown(); }}
							disabled={!power}
							title="Channel Down (↓)"
						>
							CH▼
						</button>
					</div>
				</div>

				{/* Mute and Fullscreen Buttons */}
				<div className="mute-section">
					<button
						className={`remote-btn mute-btn ${volume === 0 ? 'active' : ''}`}
						onClick={() => { playButtonSound(); onMute(); }}
						disabled={!power}
						title="Mute (M)"
					>
						{volume === 0 ? '🔇' : '🔊'} MUTE
					</button>
					{onFullscreenToggle && (
						<button
							className="remote-btn fullscreen-btn"
							onClick={() => { playButtonSound(); onFullscreenToggle(); }}
							disabled={!power}
							title="Fullscreen (F)"
						>
							⛶ FULLSCREEN
						</button>
					)}
				</div>

				{/* VCR Controls */}
				<div className="vcr-section">
					<div className="vcr-label">━━ VCR ━━</div>
					<div className="vcr-buttons">
						<button 
							className="remote-btn vcr-btn record"
							onClick={() => { playButtonSound(); onRecord && onRecord(); }}
							disabled={!power}
							title="Record"
						>
							⏺
						</button>
						<button 
							className="remote-btn vcr-btn play"
							onClick={() => { playButtonSound(); onPlayPause && onPlayPause(); }}
							disabled={!power}
							title="Play/Pause"
						>
							▶
						</button>
						<button 
							className="remote-btn vcr-btn stop"
							onClick={() => { playButtonSound(); onStop && onStop(); }}
							disabled={!power}
							title="Stop"
						>
							⏹
						</button>
					</div>
					<div className="vcr-buttons secondary">
						<button className="remote-btn vcr-btn small" disabled={!power}>⏮</button>
						<button className="remote-btn vcr-btn small" disabled={!power}>⏪</button>
						<button className="remote-btn vcr-btn small" disabled={!power}>⏩</button>
						<button className="remote-btn vcr-btn small" disabled={!power}>⏭</button>
					</div>
				</div>

				{/* Volume Indicator */}
				<div className="volume-bar-section">
					<div className="volume-label">VOLUME</div>
					<div className="volume-bar">
						<div 
							className="volume-fill" 
							style={{ width: `${volume * 100}%` }}
						></div>
					</div>
					<div className="volume-percent">{Math.round(volume * 100)}%</div>
				</div>

				{/* Keyboard Hints */}
				<div className="keyboard-hints">
					<div className="hint">↑↓ CH</div>
					<div className="hint">←→ VOL</div>
					<div className="hint">0-9 DIRECT</div>
					<div className="hint">M MUTE</div>
					{onFullscreenToggle && <div className="hint">F FULLSCREEN</div>}
				</div>
			</div>
		</div>
	)
}
