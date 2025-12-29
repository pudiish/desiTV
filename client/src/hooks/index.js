/**
 * Index file for hooks - Centralized exports
 * 
 * ALL the hooks! Not just ONE random one.
 * That's like having a toolbox with one screwdriver - useless! 🔧
 */

// Playback & Sync
export { useBroadcastPosition } from './useBroadcastPosition'
export { useLiveSync } from './useLiveSync'
export { useBufferingState } from './useBufferingState'
export { useYouTubePlayer } from './useYouTubePlayer'

// Navigation
export { useCategoryNavigation } from './useCategoryNavigation'
export { useChannelNavigation } from './useChannelNavigation'
export { useTVControls } from './useTVControls'

// UI & UX
export { useRemoteOverlay } from './useRemoteOverlay'
export { useStatusMessage } from './useStatusMessage'
export { useEasterEggs } from './useEasterEggs'

// App State
export { useAppInitialization } from './useAppInitialization'
export { useSessionManagement } from './useSessionManagement'

// Utilities
export { useSafeInterval } from './useSafeInterval'
