/**
 * TypeScript Type Definitions
 * Central type exports for DesiTV server
 */

import { Document } from 'mongoose';

// ===== Model Types =====

export interface IVideo extends Document {
  _id: string;
  title: string;
  youtubeId: string;
  videoId?: string;
  duration: number;
  year?: number;
  tags: string[];
  category?: string;
  thumbnail?: string;
}

export interface IChannel extends Document {
  _id: string;
  name: string;
  description?: string;
  items: IVideo[];
  category: string;
  playlistStartEpoch?: Date;
  customTimeSlots?: Record<string, IVideo[]>;
}

export interface IUserSession extends Document {
  userId: string;
  sessionId: string;
  createdAt: Date;
  lastActiveAt: Date;
  data?: Record<string, unknown>;
}

export interface IGlobalEpoch extends Document {
  epoch: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBroadcastState extends Document {
  channelId: string;
  channelName: string;
  playlistStartEpoch: Date;
  playlistTotalDuration: number;
  videoDurations: number[];
  createdAt: Date;
  updatedAt: Date;
}

// ===== API Response Types =====

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

export interface YouTubeSearchResult {
  success: boolean;
  videos: {
    youtubeId: string;
    title: string;
    thumbnail?: string;
    channel?: string;
    duration?: number;
  }[];
  error?: string;
}

export interface LiveStateResponse {
  live: {
    categoryId: string;
    categoryName: string;
    videoIndex: number;
    videoId: string;
    videoTitle: string;
    position: number;
    duration: number;
    remaining: number;
  };
  sync: {
    serverTimeMs: number;
    epochMs: number;
  };
  playlist: {
    totalDuration: number;
    videoCount: number;
    cycleCount: number;
    cyclePosition: number;
  };
  next?: {
    videoIndex: number;
    videoId: string;
    videoTitle: string;
    duration: number;
    startsIn: number;
  };
}

// ===== Service Types =====

export interface Context {
  playerContext?: {
    status: string;
    currentSong?: string;
    timeline?: unknown;
    queue?: unknown;
  };
  userContext?: {
    authenticated: boolean;
    preferences?: unknown;
    history?: unknown;
  };
  messageContext?: {
    currentMessage: string;
    history?: Array<{ role: string; content: string }>;
    conversationTurn?: number;
  };
  safetyContext?: {
    availableData: string[];
    restrictions: string[];
    hallucination_prevention: boolean;
  };
  isValid: boolean;
  userId: string;
  channelId?: string;
  timestamp: number;
}

export interface Intent {
  pattern: RegExp;
  confidence: number;
}

// ===== Express Request Extensions =====

export interface AuthenticatedRequest extends Express.Request {
  userId?: string;
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

// ===== Cache Types =====

export interface CacheConfig {
  L1_MAX_SIZE: number;
  L1_DEFAULT_TTL: number;
  L2_DEFAULT_TTL: number;
  COMPRESSION_THRESHOLD: number;
}

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  compressed?: boolean;
}

// ===== Export all types =====
export type {
  IVideo,
  IChannel,
  IUserSession,
  IGlobalEpoch,
  IBroadcastState,
  ChatResponse,
  YouTubeSearchResult,
  LiveStateResponse,
  Context,
  Intent,
  AuthenticatedRequest,
  CacheConfig,
  CacheEntry,
};
