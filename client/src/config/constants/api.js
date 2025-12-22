/**
 * API Constants
 * 
 * All API endpoints and API-related constants
 */

export const API_ENDPOINTS = {
  // Broadcast State
  BROADCAST_STATE: '/api/broadcast-state',
  BROADCAST_STATE_ALL: '/api/broadcast-state/all',
  
  // Session
  SESSION: '/api/session',
  
  // Channels
  CHANNELS: '/api/channels',
  CHANNEL: '/api/channels/:id',
  
  // Categories
  CATEGORIES: '/api/categories',
  
  // Auth
  AUTH_LOGIN: '/api/auth/login',
  AUTH_LOGOUT: '/api/auth/logout',
  AUTH_REGISTER: '/api/auth/register',
  
  // YouTube
  YOUTUBE_SEARCH: '/api/youtube/search',
  
  // Health & Monitoring
  HEALTH: '/health',
  MONITORING_HEALTH: '/api/monitoring/health',
  MONITORING_ENDPOINTS: '/api/monitoring/endpoints',
  MONITORING_SERVICES: '/api/monitoring/services',
  MONITORING_METRICS: '/api/monitoring/metrics',
  MONITORING_STATUS: '/api/monitoring/status',
  MONITORING_RESET: '/api/monitoring/reset',
}

