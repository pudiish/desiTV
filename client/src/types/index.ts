/**
 * TypeScript Type Definitions
 * Central type exports for DesiTV client
 */

// ===== Channel & Video Types =====

export interface Video {
  _id?: string;
  title: string;
  youtubeId?: string;
  videoId?: string;
  duration: number;
  year?: number;
  tags?: string[];
  category?: string;
  thumbnail?: string;
  altYoutubeId?: string;
  backupYoutubeId?: string;
  mirrorYoutubeId?: string;
}

export interface Channel {
  _id: string;
  name: string;
  description?: string;
  items: Video[];
  category?: string;
  playlistStartEpoch?: string | Date;
  _videoSwitchTimestamp?: number;
  customTimeSlots?: Record<string, Video[]>;
}

// ===== Broadcast Position Types =====

export interface BroadcastPosition {
  videoIndex: number;
  video: Video | null;
  offset: number;
  timeRemaining: number;
  nextVideoIndex: number;
  nextVideo: Video | null;
  cyclePosition: number;
  totalPlaylistDuration: number;
  nextTimeRemaining: number;
  isValid: boolean;
  totalElapsedSec?: number;
  adjustedElapsedSec?: number;
  channelOffset?: number;
  cycleCount?: number;
  videoDurations?: number[];
  isSingleVideo?: boolean;
  debugInfo?: string;
}

// ===== Player Types =====

export interface PlayerProps {
  channel: Channel | null;
  onVideoEnd?: () => void;
  onChannelChange?: (channelId: string) => void;
  volume?: number;
  allChannels?: Channel[];
  onBufferingChange?: (isBuffering: boolean, message?: string) => void;
  onPlaybackStateChange?: (state: string) => void;
  onPlaybackProgress?: (progress: number) => void;
  onTapHandlerReady?: (handler: () => void) => void;
  power?: boolean;
}

export type PlayerState = 'idle' | 'loading' | 'playing' | 'buffering' | 'error' | 'paused';

// ===== API Types =====

export interface APIResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  fromCache?: boolean;
}

export interface ChatResponse {
  response: string;
  action?: {
    type: string;
    videoId?: string;
    videoTitle?: string;
    channelId?: string;
    [key: string]: unknown;
  };
  intent?: string;
  sessionId?: string;
  blocked?: boolean;
}

// ===== YouTube API Types =====

export interface YouTubePlayer {
  loadVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => Promise<number>;
  getPlayerState: () => number;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getDuration: () => number;
  getVideoUrl: () => string;
  getVideoData: () => { video_id: string; title: string };
}

export interface YouTubePlayerConfig {
  height?: string;
  width?: string;
  videoId?: string;
  playerVars?: {
    autoplay?: 0 | 1;
    controls?: 0 | 1;
    rel?: 0 | 1;
    modestbranding?: 0 | 1;
    playsinline?: 0 | 1;
    enablejsapi?: 0 | 1;
    origin?: string;
    [key: string]: unknown;
  };
  events?: {
    onReady?: (event: { target: YouTubePlayer }) => void;
    onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
    onError?: (event: { data: number }) => void;
    onPlaybackQualityChange?: (event: { data: string }) => void;
  };
}

// ===== Global Window Types =====

declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, config: YouTubePlayerConfig) => YouTubePlayer;
      PlayerState?: {
        UNSTARTED: number;
        ENDED: number;
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        CUED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// ===== Service Types =====

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface ErrorHandlerResult {
  success: false;
  errorCode: string;
  userMessage: string;
  severity: 'error' | 'warning' | 'info';
  devMessage: string;
  timestamp: string;
}

// ===== State Management Types =====

export interface TVState {
  power: boolean;
  volume: number;
  isMuted: boolean;
  selectedCategory: Channel | null;
  activeVideoIndex: number;
  externalVideo: { videoId: string; videoTitle: string } | null;
  statusMessage: string | null;
  isBuffering: boolean;
  bufferingError: string | null;
  isMenuOpen: boolean;
  staticActive: boolean;
  isFullscreen: boolean;
  galaxyEnabled: boolean;
  remoteOverlayVisible: boolean;
}

// ===== Hook Return Types =====

export interface UseBroadcastPositionReturn {
  position: BroadcastPosition | null;
  isLoading: boolean;
  error: Error | null;
}

// Types are already exported above, no need to re-export
