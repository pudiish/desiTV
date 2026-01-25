/**
 * VoiceControl Component
 * 
 * Voice command control for the retro TV
 * Shows microphone button and displays voice commands as subtitles
 */

import React, { useState } from 'react'
import { useVoiceControl } from '../../hooks/useVoiceControl'
import './VoiceControl.css'

/**
 * VoiceControl component
 * 
 * @param {Object} props
 * @param {Function} props.onChannelUp - Channel up handler
 * @param {Function} props.onChannelDown - Channel down handler
 * @param {Function} props.onVolumeUp - Volume up handler
 * @param {Function} props.onVolumeDown - Volume down handler
 * @param {Function} props.onMute - Mute handler
 * @param {Function} props.onPowerToggle - Power toggle handler
 * @param {Function} props.onPlay - Play/search handler
 * @param {Function} props.onNowPlaying - Now playing query handler
 * @param {Function} props.onMenuToggle - Menu toggle handler
 * @param {Function} props.onCategoryUp - Category up handler
 * @param {Function} props.onCategoryDown - Category down handler
 * @param {Function} props.onGoToChannel - Go to channel handler
 * @param {boolean} props.isVisible - Whether the control should be visible
 */
export function VoiceControl({
  onChannelUp,
  onChannelDown,
  onVolumeUp,
  onVolumeDown,
  onMute,
  onPowerToggle,
  onPlay,
  onNowPlaying,
  onMenuToggle,
  onCategoryUp,
  onCategoryDown,
  onGoToChannel,
  isVisible = true,
}) {
  const [enabled, setEnabled] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const {
    isSupported,
    isListening,
    lastTranscript,
    lastCommand,
    error,
    showSubtitle,
    startListening,
    stopListening,
  } = useVoiceControl({
    enabled,
    onChannelUp,
    onChannelDown,
    onVolumeUp,
    onVolumeDown,
    onMute,
    onPowerToggle,
    onPlay,
    onNowPlaying,
    onMenuToggle,
    onCategoryUp,
    onCategoryDown,
    onGoToChannel,
  })

  // Don't render if not visible or not supported
  if (!isVisible) return null

  const handleToggle = () => {
    if (enabled) {
      stopListening()
      setEnabled(false)
    } else {
      setEnabled(true)
      // startListening is handled by the hook when enabled
    }
  }

  if (!isSupported) {
    return (
      <div className="voice-control voice-control--unsupported">
        <button 
          className="voice-control__btn voice-control__btn--disabled"
          title="Voice control not supported in this browser"
          aria-label="Voice control not supported"
          disabled
        >
          <span className="voice-control__icon">🎤</span>
          <span className="voice-control__slash">⊘</span>
        </button>
      </div>
    )
  }

  return (
    <div className="voice-control">
      {/* Microphone Toggle Button */}
      <button
        className={`voice-control__btn ${enabled ? 'voice-control__btn--active' : ''} ${isListening ? 'voice-control__btn--listening' : ''}`}
        onClick={handleToggle}
        onMouseEnter={() => setShowHelp(true)}
        onMouseLeave={() => setShowHelp(false)}
        title={enabled ? 'Disable Voice Control' : 'Enable Voice Control'}
        aria-label={enabled ? 'Disable Voice Control' : 'Enable Voice Control'}
        aria-pressed={enabled}
      >
        <span className="voice-control__icon">
          {isListening ? '🔴' : '🎤'}
        </span>
        {isListening && (
          <span className="voice-control__pulse" />
        )}
      </button>

      {/* Help Tooltip */}
      {showHelp && !enabled && (
        <div className="voice-control__help">
          <div className="voice-control__help-title">Voice Commands</div>
          <ul className="voice-control__help-list">
            <li>"Channel up" / "Channel down"</li>
            <li>"Volume up" / "Volume down"</li>
            <li>"Mute"</li>
            <li>"Play [song name]"</li>
            <li>"What's playing"</li>
          </ul>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="voice-control__error">
          {error === 'not-allowed' ? 'Microphone access denied' : error}
        </div>
      )}

      {/* Voice Subtitle Display - Appears on TV Screen */}
      {showSubtitle && lastTranscript && (
        <div className="voice-subtitle">
          <div className="voice-subtitle__text">
            "{lastTranscript}"
          </div>
          {lastCommand && (
            <div className="voice-subtitle__command">
              {lastCommand.type.replace(/([A-Z])/g, ' $1').trim()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VoiceControl
