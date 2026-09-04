/**
 * Channel Sync - WebSocket Real-Time Updates
 * 
 * Industry-grade architecture:
 * - Primary: WebSocket for instant updates (no polling!)
 * - Fallback: REST API polling if WebSocket disconnects
 * 
 * When admin adds/removes videos, server pushes update via WebSocket.
 * Client receives event and refreshes data instantly.
 */

import { io } from 'socket.io-client'
import { channelManager } from '../logic/channel'
import { envConfig } from '../config/environment'

// Configuration
const FALLBACK_POLL_INTERVAL = 30 * 1000 // 30s fallback polling (only if WebSocket fails)
const RECONNECT_DELAY = 3000

// State
let socket = null
let fallbackInterval = null
let lastVersion = null
let isConnected = false

/**
 * Get API base URL
 */
function getApiBase() {
  return envConfig.apiBaseUrl
}

/**
 * Socket.io needs an absolute URL. On localhost envConfig returns '' so HTTP
 * goes through the Vite proxy, but Vite only proxies /api and /health - the
 * socket must reach the API server directly on its own port.
 */
function getSocketUrl() {
  const apiBase = getApiBase()
  if (apiBase) return apiBase

  const serverPort = import.meta.env.VITE_SERVER_PORT
  return serverPort ? `http://localhost:${serverPort}` : window.location.origin
}

/**
 * Notify UI of channel update
 */
function notifyUpdate() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('channelsUpdated'))
  }
}

/**
 * Handle channel update from WebSocket
 */
async function handleChannelUpdate(data) {
  console.log('[ChannelSync] 📡 Received update:', data)
  
  // Update version
  if (data.version) {
    lastVersion = data.version
  }
  
  // Reload channel data and notify UI
  try {
    await channelManager.reload()
    notifyUpdate()
    console.log('[ChannelSync] ✅ Channels reloaded successfully')
  } catch (err) {
    console.error('[ChannelSync] Failed to reload channels:', err)
  }
}

/**
 * Initialize WebSocket connection
 */
function initSocket() {
  const socketUrl = getSocketUrl()

  console.log('[ChannelSync] 🔌 Connecting to WebSocket:', socketUrl)

  socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: RECONNECT_DELAY,
    reconnectionAttempts: 10,
    timeout: 10000,
  })

  socket.on('connect', () => {
    console.log('[ChannelSync] ✅ WebSocket connected')
    isConnected = true
    
    // Subscribe to channel updates
    socket.emit('channels:subscribe', (response) => {
      if (response?.success) {
        console.log('[ChannelSync] 📡 Subscribed to channel updates')
      }
    })
    
    // Stop fallback polling when connected
    stopFallbackPolling()
  })

  socket.on('disconnect', (reason) => {
    console.log('[ChannelSync] ⚠️ WebSocket disconnected:', reason)
    isConnected = false
    
    // Start fallback polling
    startFallbackPolling()
  })

  socket.on('connect_error', (error) => {
    console.log('[ChannelSync] ⚠️ WebSocket connection error:', error.message)
    isConnected = false
    
    // Start fallback polling
    startFallbackPolling()
  })

  // Listen for channel events
  socket.on('channels:updated', handleChannelUpdate)
  socket.on('channels:created', handleChannelUpdate)
  socket.on('channels:deleted', handleChannelUpdate)
  socket.on('channels:videoAdded', handleChannelUpdate)
  socket.on('channels:videoRemoved', handleChannelUpdate)
  socket.on('channels:bulkAdded', handleChannelUpdate)
}

/**
 * Fallback: Check for updates via REST API
 */
async function checkForUpdates() {
  try {
    const apiBase = getApiBase()
    const response = await fetch(`${apiBase}/api/channels?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'pragma': 'no-cache' }
    })
    
    if (!response.ok) return
    
    const data = await response.json()
    const responseData = data.data || data
    const currentVersion = responseData.version || responseData.generatedAt
    
    if (!currentVersion) return
    
    // If version changed, reload
    if (lastVersion && lastVersion !== currentVersion) {
      console.log('[ChannelSync] 🔄 Version changed (fallback polling), reloading...')
      await channelManager.reload()
      lastVersion = currentVersion
      notifyUpdate()
    } else if (!lastVersion) {
      lastVersion = currentVersion
    }
  } catch (err) {
    console.debug('[ChannelSync] Fallback check failed:', err.message)
  }
}

/**
 * Start fallback polling (only when WebSocket is disconnected)
 */
function startFallbackPolling() {
  if (fallbackInterval) return
  
  console.log('[ChannelSync] 🔄 Starting fallback polling (WebSocket unavailable)')
  fallbackInterval = setInterval(checkForUpdates, FALLBACK_POLL_INTERVAL)
  
  // Initial check
  setTimeout(checkForUpdates, 1000)
}

/**
 * Stop fallback polling
 */
function stopFallbackPolling() {
  if (fallbackInterval) {
    clearInterval(fallbackInterval)
    fallbackInterval = null
    console.log('[ChannelSync] ⏹️ Stopped fallback polling')
  }
}

/**
 * Start channel sync (WebSocket + fallback)
 */
export function startChannelSync() {
  if (socket) {
    console.log('[ChannelSync] Already running')
    return
  }
  
  console.log('[ChannelSync] 🚀 Starting (WebSocket primary, REST fallback)')
  
  // Initialize WebSocket
  initSocket()
  
  // Start fallback polling initially (will stop when WebSocket connects)
  startFallbackPolling()
}

/**
 * Stop channel sync
 */
export function stopChannelSync() {
  // Disconnect WebSocket
  if (socket) {
    socket.emit('channels:unsubscribe')
    socket.disconnect()
    socket = null
  }
  
  // Stop fallback polling
  stopFallbackPolling()
  
  isConnected = false
  console.log('[ChannelSync] ⏹️ Stopped')
}

/**
 * Force immediate check (for manual refresh)
 */
export function forceCheck() {
  if (isConnected && socket) {
    // Request version from server
    socket.emit('channels:getVersion', (response) => {
      if (response?.success && response.version !== lastVersion) {
        handleChannelUpdate({ version: response.version })
      }
    })
  } else {
    // Fallback to REST API
    checkForUpdates()
  }
}

/**
 * Get connection status
 */
export function isWebSocketConnected() {
  return isConnected
}

/**
 * Get current data version
 */
export function getCurrentVersion() {
  return lastVersion
}
