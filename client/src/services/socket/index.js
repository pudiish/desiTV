/**
 * Socket Service - Real-time sync via WebSocket
 * 
 * Primary: WebSocket connection for push-based sync
 * Fallback: HTTP polling if socket fails
 */

import { io } from 'socket.io-client';

// Socket state
let socket = null;
let currentCategoryId = null;
let reconnectAttempts = 0;
let listeners = new Map();

// Config
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 1000;

/**
 * Get socket server URL
 * Note: Vercel doesn't support WebSockets, so in production we connect
 * directly to the Render backend for socket connections
 */
function getSocketUrl() {
  // In production on Vercel, connect to Render backend for WebSocket
  if (import.meta.env.PROD) {
    const hostname = window.location.hostname;
    // Vercel doesn't support WebSockets - connect to Render backend
    if (hostname.includes('vercel.app')) {
      return import.meta.env.VITE_SOCKET_URL || 'https://desitv-api.onrender.com';
    }
    // Other production deployments (e.g., self-hosted)
    return window.location.origin;
  }
  // Development - use local server
  return import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
}

/**
 * Connect to socket server
 */
export function connect() {
  if (socket?.connected) return socket;

  const url = getSocketUrl();
  
  socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: RECONNECT_DELAY_BASE,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[Socket] ✅ Connected');
    reconnectAttempts = 0;
    
    // Re-subscribe to category if we had one
    if (currentCategoryId) {
      socket.emit('subscribe', currentCategoryId);
    }
    
    notifyListeners('connected', { socketId: socket.id });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] ❌ Disconnected: ${reason}`);
    notifyListeners('disconnected', { reason });
  });

  socket.on('connect_error', (error) => {
    console.warn('[Socket] Connection error:', error.message);
    reconnectAttempts++;
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[Socket] Max reconnect attempts reached, falling back to polling');
      notifyListeners('fallback', { reason: 'max_reconnects' });
    }
  });

  socket.on('sync', (data) => {
    notifyListeners('sync', data);
  });

  socket.on('videoChange', (data) => {
    notifyListeners('videoChange', data);
  });

  socket.on('error', (data) => {
    console.error('[Socket] Server error:', data);
    notifyListeners('error', data);
  });

  return socket;
}

/**
 * Get active socket instance
 */
export function getSocket() {
  if (!socket) {
    return connect();
  }
  return socket;
}

/**
 * Disconnect from socket server
 */
export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  currentCategoryId = null;
  reconnectAttempts = 0;
}

/**
 * Subscribe to a category for sync updates
 */
export function subscribeToCategory(categoryId) {
  if (!categoryId) return;
  
  currentCategoryId = categoryId;
  
  if (socket?.connected) {
    socket.emit('subscribe', categoryId);
    console.log(`[Socket] Subscribed to ${categoryId}`);
  } else {
    // Connect first, then subscribe (handled in connect callback)
    connect();
  }
}

/**
 * Request immediate sync
 */
export function requestSync() {
  if (socket?.connected) {
    socket.emit('requestSync');
  }
}

/**
 * Report drift to server (for analytics)
 */
export function reportDrift(driftData) {
  if (socket?.connected) {
    socket.emit('reportDrift', driftData);
  }
}

/**
 * Add event listener
 */
export function addListener(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);
  
  return () => {
    listeners.get(event)?.delete(callback);
  };
}

/**
 * Remove event listener
 */
export function removeListener(event, callback) {
  listeners.get(event)?.delete(callback);
}

/**
 * Notify all listeners
 */
function notifyListeners(event, data) {
  const eventListeners = listeners.get(event);
  if (eventListeners) {
    eventListeners.forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error(`[Socket] Listener error for ${event}:`, e);
      }
    });
  }
}

/**
 * Check if socket is connected
 */
export function isConnected() {
  return socket?.connected ?? false;
}

/**
 * Get connection state
 */
export function getState() {
  return {
    connected: socket?.connected ?? false,
    categoryId: currentCategoryId,
    reconnectAttempts,
    socketId: socket?.id,
  };
}

export default {
  connect,
  disconnect,
  subscribeToCategory,
  requestSync,
  reportDrift,
  addListener,
  removeListener,
  isConnected,
  getState,
};
