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
	onCategoryUp,
	onCategoryDown,
	volume,
	onVolumeUp,
	onVolumeDown,
	onMute,
	onMenuToggle,
	activeChannelIndex,
	totalChannels,
	menuOpen = false,
	onTapTrigger = null // Handler to trigger iOS gesture unlock
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

	// Mobile-friendly handler that prevents double-firing on touch devices
	const handleMobileClick = (handler, preventDefault = true) => {
		return (e) => {
			if (preventDefault) {
				e.preventDefault()
				e.stopPropagation()
			}
			handler()
		}
	}

	// Touch handler for mobile
	const handleMobileTouch = (handler) => {
		return (e) => {
			e.preventDefault()
			e.stopPropagation()
			handler()
		}
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
						// No sound for menu toggle
						onMenuToggle()
					}
					break
				case 'PageUp':
					e.preventDefault()
					if (power && onCategoryUp) {
						playButtonSound()
						onCategoryUp()
					}
					break
				case 'PageDown':
					e.preventDefault()
					if (power && onCategoryDown) {
						playButtonSound()
						onCategoryDown()
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
	}, [power, onChannelUp, onChannelDown, onCategoryUp, onCategoryDown, onVolumeUp, onVolumeDown, onMute, onMenuToggle, channelInput, menuOpen])

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
						onClick={handleMobileClick(handlePowerClick)}
						onTouchEnd={handleMobileTouch(handlePowerClick)}
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
							onClick={handleMobileClick(() => handleNumberClick(String(num)))}
							onTouchEnd={handleMobileTouch(() => handleNumberClick(String(num)))}
							disabled={!power}
							title={`Channel ${num}`}
						>
							{num}
						</button>
					))}
					<button 
						className="remote-btn num-btn special" 
						onClick={handleMobileClick(() => handleNumberClick('0'))}
						onTouchEnd={handleMobileTouch(() => handleNumberClick('0'))}
						disabled={!power}
					>
						0
					</button>
				</div>

				{/* Channel/Volume Controls */}
				<div className="dpad-section">
					<div className="dpad">
						{/* Top Row: Category Up | Channel Up | Category Down */}
						<div className="dpad-top-row">
							<button
								className="remote-btn category-btn left"
								onClick={handleMobileClick(() => { playButtonSound(); onCategoryUp && onCategoryUp(); })}
								onTouchEnd={handleMobileTouch(() => { playButtonSound(); onCategoryUp && onCategoryUp(); })}
								disabled={!power || !onCategoryUp}
								title="Category Up (Page Up)"
							>
								CAT▲
							</button>
							<button
								className="remote-btn dpad-btn up"
								onClick={handleMobileClick(() => { playButtonSound(); onChannelUp(); })}
								onTouchEnd={handleMobileTouch(() => { playButtonSound(); onChannelUp(); })}
								disabled={!power}
								title="Channel Up (↑)"
							>
								CH▲
							</button>
							<button
								className="remote-btn category-btn right"
								onClick={handleMobileClick(() => { playButtonSound(); onCategoryDown && onCategoryDown(); })}
								onTouchEnd={handleMobileTouch(() => { playButtonSound(); onCategoryDown && onCategoryDown(); })}
								disabled={!power || !onCategoryDown}
								title="Category Down (Page Down)"
							>
								CAT▼
							</button>
						</div>
						{/* Middle Row: Volume Down | Menu | Volume Up */}
						<div className="dpad-middle">
							<button
								className="remote-btn dpad-btn left"
								onClick={handleMobileClick(() => { playButtonSound(); onVolumeDown(); })}
								onTouchEnd={handleMobileTouch(() => { playButtonSound(); onVolumeDown(); })}
								disabled={!power}
								title="Volume Down (←)"
							>
								VOL−
							</button>
							<button
								className="remote-btn dpad-btn center menu-btn"
								onClick={handleMobileClick(() => { onMenuToggle && onMenuToggle(); })}
								onTouchEnd={handleMobileTouch(() => { onMenuToggle && onMenuToggle(); })}
								disabled={!power}
								title="Menu (Esc)"
							>
								MENU
							</button>
							<button
								className="remote-btn dpad-btn right"
								onClick={handleMobileClick(() => { playButtonSound(); onVolumeUp(); })}
								onTouchEnd={handleMobileTouch(() => { playButtonSound(); onVolumeUp(); })}
								disabled={!power}
								title="Volume Up (→)"
							>
								VOL+
							</button>
						</div>
						{/* Bottom Row: Channel Down */}
						<button
							className="remote-btn dpad-btn down"
							onClick={handleMobileClick(() => { playButtonSound(); onChannelDown(); })}
							onTouchEnd={handleMobileTouch(() => { playButtonSound(); onChannelDown(); })}
							disabled={!power}
							title="Channel Down (↓)"
						>
							CH▼
						</button>
					</div>
				</div>

				{/* Mute Button */}
				<div className="mute-section">
					<button
						className={`remote-btn mute-btn ${volume === 0 ? 'active' : ''}`}
						onClick={handleMobileClick(() => { playButtonSound(); onMute(); })}
						onTouchEnd={handleMobileTouch(() => { playButtonSound(); onMute(); })}
						disabled={!power}
						title="Mute (M)"
					>
						{volume === 0 ? '🔇' : '🔊'} MUTE
					</button>
				</div>

				{/* DesiTV Branding */}
				<div className="desitv-brand-section">
					<div className="brand-label">━━ DESI TV ━━</div>
					<div className="brand-tagline">Purana Zamana, Naya Andaaz</div>
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

				{/* Keyboard Hints - Simplified */}
				<div className="keyboard-hints">
					<div className="hint">↑↓ CHANNEL</div>
					<div className="hint">←→ VOLUME</div>
				</div>
			</div>
		</div>
	)
}
