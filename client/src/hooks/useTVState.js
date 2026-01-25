/**
 * TV State Reducer
 * 
 * Consolidates 25+ useState calls into ONE useReducer
 * Single source of truth for all TV state
 */

import { useReducer, useMemo } from 'react'

export const initialTVState = {
  // Power & Volume
  power: false,
  volume: 0.5,
  prevVolume: 0.5,
  isMuted: false,
  
  // Playback
  categories: [],
  selectedCategory: null,
  activeVideoIndex: 0,
  externalVideo: null, // { videoId, videoTitle, thumbnail }
  
  // UI State
  menuOpen: false,
  staticActive: false,
  galaxyEnabled: false,
  galaxyVariant: 'galaxy', // 'galaxy', 'orbital', 'liquid'
  isFullscreen: false,
  remoteOverlayVisible: false,
  surveyOpen: false,
  tvGuideOpen: false, // EPG-style guide overlay
  
  // Voice Control
  voiceControlEnabled: false,
  isListening: false,
  lastVoiceCommand: null,
  
  // Playback info
  playbackInfo: null,
  isBuffering: false,
  bufferErrorMessage: '',
  statusMessage: 'POWER DABAO AUR SHURU KARO!',
  crtVolume: null,
  crtIsMuted: false,
  
  // CRT Effects
  crtWarmingUp: false, // TV warm-up animation state
  crtEffectIntensity: 1.0, // 0-1 for CRT effect strength
  
  // Session
  sessionRestored: false,
  userAgeGroup: null,
  easterEggMessage: null,
  
  // TV Frame
  tvFrameRect: null, // { left, top, right, bottom, width, height }
};

/**
 * Action types - keep these organized
 */
export const TVActions = {
  // Power
  SET_POWER: 'SET_POWER',
  SET_VOLUME: 'SET_VOLUME',
  TOGGLE_MUTE: 'TOGGLE_MUTE',
  
  // Playback
  SET_CATEGORIES: 'SET_CATEGORIES',
  SELECT_CATEGORY: 'SELECT_CATEGORY',
  SET_ACTIVE_VIDEO_INDEX: 'SET_ACTIVE_VIDEO_INDEX',
  SET_EXTERNAL_VIDEO: 'SET_EXTERNAL_VIDEO',
  CLEAR_EXTERNAL_VIDEO: 'CLEAR_EXTERNAL_VIDEO',
  
  // UI
  SET_MENU_OPEN: 'SET_MENU_OPEN',
  SET_STATIC_ACTIVE: 'SET_STATIC_ACTIVE',
  TOGGLE_GALAXY: 'TOGGLE_GALAXY',
  SET_GALAXY_VARIANT: 'SET_GALAXY_VARIANT',
  SET_FULLSCREEN: 'SET_FULLSCREEN',
  TOGGLE_REMOTE_OVERLAY: 'TOGGLE_REMOTE_OVERLAY',
  SET_SURVEY_OPEN: 'SET_SURVEY_OPEN',
  SET_TV_GUIDE_OPEN: 'SET_TV_GUIDE_OPEN',
  
  // Voice Control
  SET_VOICE_CONTROL_ENABLED: 'SET_VOICE_CONTROL_ENABLED',
  SET_LISTENING: 'SET_LISTENING',
  SET_LAST_VOICE_COMMAND: 'SET_LAST_VOICE_COMMAND',
  
  // CRT Effects
  SET_CRT_WARMING_UP: 'SET_CRT_WARMING_UP',
  SET_CRT_EFFECT_INTENSITY: 'SET_CRT_EFFECT_INTENSITY',
  
  // Status
  SET_PLAYBACK_INFO: 'SET_PLAYBACK_INFO',
  SET_BUFFERING: 'SET_BUFFERING',
  SET_STATUS_MESSAGE: 'SET_STATUS_MESSAGE',
  SET_BUFFER_ERROR: 'SET_BUFFER_ERROR',
  
  // Session
  RESTORE_SESSION: 'RESTORE_SESSION',
  SET_USER_AGE_GROUP: 'SET_USER_AGE_GROUP',
  SHOW_EASTER_EGG: 'SHOW_EASTER_EGG',
  
  // TV Frame
  SET_TV_FRAME_RECT: 'SET_TV_FRAME_RECT',
  
  // Batch
  RESET_TO_INITIAL: 'RESET_TO_INITIAL'
};

/**
 * TV State Reducer
 * Single dispatcher for all state changes
 */
export function tvReducer(state, action) {
  switch (action.type) {
    // Power & Volume
    case TVActions.SET_POWER:
      return { ...state, power: action.payload };
    
    case TVActions.SET_VOLUME:
      return {
        ...state,
        prevVolume: state.isMuted ? state.prevVolume : state.volume,
        volume: action.payload,
        isMuted: false
      };
    
    case TVActions.TOGGLE_MUTE:
      return {
        ...state,
        isMuted: !state.isMuted,
        prevVolume: state.isMuted ? state.prevVolume : state.volume,
        volume: state.isMuted ? state.prevVolume : 0
      };
    
    // Playback
    case TVActions.SET_CATEGORIES:
      return { ...state, categories: action.payload };
    
    case TVActions.SELECT_CATEGORY:
      return {
        ...state,
        selectedCategory: action.payload,
        activeVideoIndex: 0
      };
    
    case TVActions.SET_ACTIVE_VIDEO_INDEX:
      return { ...state, activeVideoIndex: action.payload };
    
    case TVActions.SET_EXTERNAL_VIDEO:
      return { ...state, externalVideo: action.payload };
    
    case TVActions.CLEAR_EXTERNAL_VIDEO:
      return { ...state, externalVideo: null };
    
    // UI
    case TVActions.SET_MENU_OPEN:
      return { ...state, menuOpen: action.payload };
    
    case TVActions.SET_STATIC_ACTIVE:
      return { ...state, staticActive: action.payload };
    
    case TVActions.TOGGLE_GALAXY:
      return { ...state, galaxyEnabled: !state.galaxyEnabled };
    
    case TVActions.SET_GALAXY_VARIANT:
      return { ...state, galaxyVariant: action.payload };
    
    case TVActions.SET_FULLSCREEN:
      return { ...state, isFullscreen: action.payload };
    
    case TVActions.TOGGLE_REMOTE_OVERLAY:
      return { ...state, remoteOverlayVisible: action.payload !== undefined ? action.payload : !state.remoteOverlayVisible };
    
    case TVActions.SET_SURVEY_OPEN:
      return { ...state, surveyOpen: action.payload };
    
    case TVActions.SET_TV_GUIDE_OPEN:
      return { ...state, tvGuideOpen: action.payload };
    
    // Voice Control
    case TVActions.SET_VOICE_CONTROL_ENABLED:
      return { ...state, voiceControlEnabled: action.payload };
    
    case TVActions.SET_LISTENING:
      return { ...state, isListening: action.payload };
    
    case TVActions.SET_LAST_VOICE_COMMAND:
      return { ...state, lastVoiceCommand: action.payload };
    
    // CRT Effects
    case TVActions.SET_CRT_WARMING_UP:
      return { ...state, crtWarmingUp: action.payload };
    
    case TVActions.SET_CRT_EFFECT_INTENSITY:
      return { ...state, crtEffectIntensity: action.payload };
    
    // Status
    case TVActions.SET_PLAYBACK_INFO:
      return { ...state, playbackInfo: action.payload };
    
    case TVActions.SET_BUFFERING:
      return { ...state, isBuffering: action.payload };
    
    case TVActions.SET_STATUS_MESSAGE:
      return { ...state, statusMessage: action.payload };
    
    case TVActions.SET_BUFFER_ERROR:
      return { ...state, bufferErrorMessage: action.payload };
    
    // Session
    case TVActions.RESTORE_SESSION:
      return { ...state, ...action.payload, sessionRestored: true };
    
    case TVActions.SET_USER_AGE_GROUP:
      return { ...state, userAgeGroup: action.payload };
    
    case TVActions.SHOW_EASTER_EGG:
      return { ...state, easterEggMessage: action.payload };
    
    // TV Frame
    case TVActions.SET_TV_FRAME_RECT:
      return { ...state, tvFrameRect: action.payload };
    
    // Batch
    case TVActions.RESET_TO_INITIAL:
      return initialTVState;
    
    default:
      console.warn(`[TVReducer] Unknown action: ${action.type}`);
      return state;
  }
}

/**
 * Helper hook to use TV state + dispatch with less boilerplate
 */
export function useTVState() {
  const [state, dispatch] = useReducer(tvReducer, initialTVState);
  
  // Memoize actions to keep stable references across renders
  const actions = useMemo(() => ({
    // Power & Volume
    setPower: (power) => dispatch({ type: TVActions.SET_POWER, payload: power }),
    setVolume: (vol) => dispatch({ type: TVActions.SET_VOLUME, payload: vol }),
    toggleMute: () => dispatch({ type: TVActions.TOGGLE_MUTE }),
    
    // Playback
    setCategory: (cat) => dispatch({ type: TVActions.SELECT_CATEGORY, payload: cat }),
    setVideoIndex: (idx) => dispatch({ type: TVActions.SET_ACTIVE_VIDEO_INDEX, payload: idx }),
    playExternal: (video) => dispatch({ type: TVActions.SET_EXTERNAL_VIDEO, payload: video }),
    clearExternalVideo: () => dispatch({ type: TVActions.CLEAR_EXTERNAL_VIDEO }),
    
    // UI State
    setMenuOpen: (open) => dispatch({ type: TVActions.SET_MENU_OPEN, payload: open }),
    setStaticActive: (active) => dispatch({ type: TVActions.SET_STATIC_ACTIVE, payload: active }),
    setFullscreen: (fullscreen) => dispatch({ type: TVActions.SET_FULLSCREEN, payload: fullscreen }),
    toggleGalaxy: () => dispatch({ type: TVActions.TOGGLE_GALAXY }),
    setGalaxyVariant: (variant) => dispatch({ type: TVActions.SET_GALAXY_VARIANT, payload: variant }),
    setRemoteOverlayVisible: (visible) => dispatch({ type: TVActions.TOGGLE_REMOTE_OVERLAY, payload: visible }),
    setTvGuideOpen: (open) => dispatch({ type: TVActions.SET_TV_GUIDE_OPEN, payload: open }),
    
    // Voice Control
    setVoiceControlEnabled: (enabled) => dispatch({ type: TVActions.SET_VOICE_CONTROL_ENABLED, payload: enabled }),
    setListening: (listening) => dispatch({ type: TVActions.SET_LISTENING, payload: listening }),
    setLastVoiceCommand: (command) => dispatch({ type: TVActions.SET_LAST_VOICE_COMMAND, payload: command }),
    
    // CRT Effects
    setCrtWarmingUp: (warmingUp) => dispatch({ type: TVActions.SET_CRT_WARMING_UP, payload: warmingUp }),
    setCrtEffectIntensity: (intensity) => dispatch({ type: TVActions.SET_CRT_EFFECT_INTENSITY, payload: intensity }),
    
    // Status
    setStatusMessage: (msg) => dispatch({ type: TVActions.SET_STATUS_MESSAGE, payload: msg }),
    setLoading: (loading) => dispatch({ type: TVActions.SET_BUFFERING, payload: loading }),
    setError: (error) => dispatch({ type: TVActions.SET_BUFFER_ERROR, payload: error }),
    
    // TV Frame
    setTvFrameRect: (rect) => dispatch({ type: TVActions.SET_TV_FRAME_RECT, payload: rect }),
    
    // Batch
    resetState: () => dispatch({ type: TVActions.RESET_TO_INITIAL }),
  }), []);

  return [state, actions];
}
