/**
 * useVoiceControl Hook
 * 
 * Voice command recognition for retro TV control
 * Uses the Web Speech API for browser-native speech recognition
 * 
 * Supported Commands:
 * - "Channel up" / "Next channel"
 * - "Channel down" / "Previous channel"
 * - "Volume up" / "Louder"
 * - "Volume down" / "Softer"
 * - "Mute" / "Unmute"
 * - "Power on" / "Power off" / "Turn on/off"
 * - "Play [song name]" / "Search [query]"
 * - "What's playing" / "Now playing"
 * - "Go to [channel name]"
 * 
 * Retro Feature: Voice commands appear as subtitles on TV screen
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// Check if Web Speech API is available
const SpeechRecognition = 
  typeof window !== 'undefined' 
    ? window.SpeechRecognition || window.webkitSpeechRecognition 
    : null;

/**
 * Voice command patterns and their handlers
 */
const VOICE_COMMANDS = {
  // Channel control
  channelUp: [
    /channel\s*up/i,
    /next\s*channel/i,
    /channel\s*plus/i,
    /agla\s*channel/i,  // Hindi
  ],
  channelDown: [
    /channel\s*down/i,
    /previous\s*channel/i,
    /channel\s*minus/i,
    /pichla\s*channel/i,  // Hindi
  ],
  // Volume control
  volumeUp: [
    /volume\s*up/i,
    /louder/i,
    /increase\s*volume/i,
    /awaaz\s*badha/i,  // Hindi
  ],
  volumeDown: [
    /volume\s*down/i,
    /softer/i,
    /quieter/i,
    /decrease\s*volume/i,
    /awaaz\s*kam/i,  // Hindi
  ],
  mute: [
    /^mute$/i,
    /mute\s*(?:it|tv|sound)?/i,
    /unmute/i,
    /toggle\s*mute/i,
    /awaaz\s*band/i,  // Hindi
  ],
  // Power control
  powerOn: [
    /power\s*on/i,
    /turn\s*on/i,
    /tv\s*on/i,
    /chalu\s*karo/i,  // Hindi
  ],
  powerOff: [
    /power\s*off/i,
    /turn\s*off/i,
    /tv\s*off/i,
    /band\s*karo/i,  // Hindi
  ],
  // Search/play
  play: [
    /play\s+(.+)/i,
    /search\s+(.+)/i,
    /bajao\s+(.+)/i,  // Hindi
  ],
  // Now playing
  nowPlaying: [
    /what('s|s)?\s*playing/i,
    /now\s*playing/i,
    /current\s*song/i,
    /kya\s*chal\s*raha/i,  // Hindi
  ],
  // Menu
  openMenu: [
    /open\s*menu/i,
    /show\s*menu/i,
    /menu/i,
  ],
  closeMenu: [
    /close\s*menu/i,
    /hide\s*menu/i,
  ],
  // Category navigation
  categoryUp: [
    /category\s*up/i,
    /next\s*category/i,
    /next\s*playlist/i,
  ],
  categoryDown: [
    /category\s*down/i,
    /previous\s*category/i,
    /previous\s*playlist/i,
  ],
  // Go to channel
  goToChannel: [
    /go\s*to\s+(.+)/i,
    /switch\s*to\s+(.+)/i,
    /change\s*to\s+(.+)/i,
  ],
};

/**
 * Parse transcript and match to command
 */
function parseCommand(transcript) {
  const cleanedTranscript = transcript.toLowerCase().trim();
  
  for (const [commandType, patterns] of Object.entries(VOICE_COMMANDS)) {
    for (const pattern of patterns) {
      const match = cleanedTranscript.match(pattern);
      if (match) {
        return {
          type: commandType,
          transcript: cleanedTranscript,
          match: match[1] || null, // Captured group if any
        };
      }
    }
  }
  
  return null;
}

/**
 * useVoiceControl Hook
 * 
 * @param {Object} options - Configuration options
 * @param {Function} options.onChannelUp - Channel up handler
 * @param {Function} options.onChannelDown - Channel down handler
 * @param {Function} options.onVolumeUp - Volume up handler
 * @param {Function} options.onVolumeDown - Volume down handler
 * @param {Function} options.onMute - Mute toggle handler
 * @param {Function} options.onPowerToggle - Power toggle handler
 * @param {Function} options.onPlay - Play/search handler (receives query)
 * @param {Function} options.onNowPlaying - Now playing query handler
 * @param {Function} options.onMenuToggle - Menu toggle handler
 * @param {Function} options.onCategoryUp - Category up handler
 * @param {Function} options.onCategoryDown - Category down handler
 * @param {Function} options.onGoToChannel - Go to specific channel (receives channel name)
 * @param {Function} options.onCommand - Generic command handler for all commands
 * @param {boolean} options.enabled - Whether voice control is enabled
 */
export function useVoiceControl(options = {}) {
  const {
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
    onCommand,
    enabled = false,
  } = options;

  const [isSupported] = useState(() => !!SpeechRecognition);
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastCommand, setLastCommand] = useState(null);
  const [error, setError] = useState(null);
  const [showSubtitle, setShowSubtitle] = useState(false);
  
  const recognitionRef = useRef(null);
  const subtitleTimeoutRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if (!isSupported || !enabled) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN'; // English (India) for Hinglish support
    recognition.maxAlternatives = 3;

    recognition.onstart = () => {
      console.log('[VoiceControl] Recognition started');
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      console.log('[VoiceControl] Recognition ended');
      setIsListening(false);
      // Auto-restart if still enabled
      if (enabled && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Already running
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('[VoiceControl] Error:', event.error);
      setError(event.error);
      if (event.error === 'not-allowed') {
        setIsListening(false);
      }
    };

    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript;
      const isFinal = lastResult.isFinal;

      setLastTranscript(transcript);
      
      // Show subtitle effect
      setShowSubtitle(true);
      if (subtitleTimeoutRef.current) {
        clearTimeout(subtitleTimeoutRef.current);
      }
      subtitleTimeoutRef.current = setTimeout(() => {
        setShowSubtitle(false);
      }, 2500);

      // Only process final results
      if (isFinal) {
        const command = parseCommand(transcript);
        if (command) {
          console.log('[VoiceControl] Command detected:', command);
          setLastCommand(command);
          
          // Call generic handler first
          if (onCommand) {
            onCommand(command);
          }
          
          // Execute specific handler
          switch (command.type) {
            case 'channelUp':
              onChannelUp?.();
              break;
            case 'channelDown':
              onChannelDown?.();
              break;
            case 'volumeUp':
              onVolumeUp?.();
              break;
            case 'volumeDown':
              onVolumeDown?.();
              break;
            case 'mute':
              onMute?.();
              break;
            case 'powerOn':
            case 'powerOff':
              onPowerToggle?.();
              break;
            case 'play':
              if (command.match && onPlay) {
                onPlay(command.match);
              }
              break;
            case 'nowPlaying':
              onNowPlaying?.();
              break;
            case 'openMenu':
              onMenuToggle?.(true);
              break;
            case 'closeMenu':
              onMenuToggle?.(false);
              break;
            case 'categoryUp':
              onCategoryUp?.();
              break;
            case 'categoryDown':
              onCategoryDown?.();
              break;
            case 'goToChannel':
              if (command.match && onGoToChannel) {
                onGoToChannel(command.match);
              }
              break;
            default:
              console.log('[VoiceControl] Unknown command type:', command.type);
          }
        }
      }
    };

    recognitionRef.current = recognition;

    // Start recognition
    try {
      recognition.start();
    } catch (e) {
      console.error('[VoiceControl] Failed to start:', e);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Already stopped
        }
      }
      if (subtitleTimeoutRef.current) {
        clearTimeout(subtitleTimeoutRef.current);
      }
    };
  }, [
    isSupported, 
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
    onCommand
  ]);

  // Manual start/stop
  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error('[VoiceControl] Failed to start:', e);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('[VoiceControl] Failed to stop:', e);
      }
    }
    setIsListening(false);
  }, [isListening]);

  return {
    // State
    isSupported,
    isListening,
    lastTranscript,
    lastCommand,
    error,
    showSubtitle,
    // Actions
    startListening,
    stopListening,
  };
}

export default useVoiceControl;
