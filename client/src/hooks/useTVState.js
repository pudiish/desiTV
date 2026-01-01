/**
 * TV State Reducer
 * 
 * Consolidates 25+ useState calls into ONE useReducer
 * Single source of truth for all TV state
 */

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
  isFullscreen: false,
  remoteOverlayVisible: false,
  surveyOpen: false,
  
  // Playback info
  playbackInfo: null,
  isBuffering: false,
  bufferErrorMessage: '',
  statusMessage: 'POWER DABAO AUR SHURU KARO!',
  crtVolume: null,
  crtIsMuted: false,
  
  // Session
  sessionRestored: false,
  userAgeGroup: null,
  easterEggMessage: null,
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
  SET_FULLSCREEN: 'SET_FULLSCREEN',
  TOGGLE_REMOTE_OVERLAY: 'TOGGLE_REMOTE_OVERLAY',
  SET_SURVEY_OPEN: 'SET_SURVEY_OPEN',
  
  // Status
  SET_PLAYBACK_INFO: 'SET_PLAYBACK_INFO',
  SET_BUFFERING: 'SET_BUFFERING',
  SET_STATUS_MESSAGE: 'SET_STATUS_MESSAGE',
  SET_BUFFER_ERROR: 'SET_BUFFER_ERROR',
  
  // Session
  RESTORE_SESSION: 'RESTORE_SESSION',
  SET_USER_AGE_GROUP: 'SET_USER_AGE_GROUP',
  SHOW_EASTER_EGG: 'SHOW_EASTER_EGG',
  
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
        prevVolume: state.isMuted ? state.volume : state.prevVolume,
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
    
    case TVActions.SET_FULLSCREEN:
      return { ...state, isFullscreen: action.payload };
    
    case TVActions.TOGGLE_REMOTE_OVERLAY:
      return { ...state, remoteOverlayVisible: !state.remoteOverlayVisible };
    
    case TVActions.SET_SURVEY_OPEN:
      return { ...state, surveyOpen: action.payload };
    
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
  const [state, dispatch] = React.useReducer(tvReducer, initialTVState);
  
  // Dispatch helpers (less verbose)
  const actions = {
    setPower: (power) => dispatch({ type: TVActions.SET_POWER, payload: power }),
    setVolume: (vol) => dispatch({ type: TVActions.SET_VOLUME, payload: vol }),
    toggleMute: () => dispatch({ type: TVActions.TOGGLE_MUTE }),
    setCategory: (cat) => dispatch({ type: TVActions.SELECT_CATEGORY, payload: cat }),
    setVideoIndex: (idx) => dispatch({ type: TVActions.SET_ACTIVE_VIDEO_INDEX, payload: idx }),
    playExternal: (video) => dispatch({ type: TVActions.SET_EXTERNAL_VIDEO, payload: video }),
    stopExternal: () => dispatch({ type: TVActions.CLEAR_EXTERNAL_VIDEO }),
    setStatusMessage: (msg) => dispatch({ type: TVActions.SET_STATUS_MESSAGE, payload: msg }),
    setBuffering: (buffering) => dispatch({ type: TVActions.SET_BUFFERING, payload: buffering }),
  };
  
  return [state, actions];
}
