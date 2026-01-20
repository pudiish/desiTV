/**
 * Channel Sync - Simple, Direct Channel Updates
 * 
 * No overhead, no fallbacks, no complexity.
 * Just poll the version and reload if changed.
 */

import { channelManager } from '../logic/channel'

const POLL_INTERVAL = 10 * 1000 // Check every 10 seconds
let pollInterval = null
let lastVersion = null

/**
 * Check if channels.json has been updated
 */
async function checkForUpdates() {
  try {
    const response = await fetch('/data/channels.json?t=' + Date.now(), {
      cache: 'no-cache'
    })
    
    if (!response.ok) return
    
    const data = await response.json()
    const currentVersion = data.version || data.generatedAt
    
    if (!currentVersion) return
    
    // If version changed, reload channels
    if (lastVersion && lastVersion !== currentVersion) {
      console.log('[ChannelSync] Channels updated, reloading...')
      await channelManager.reload()
      lastVersion = currentVersion
      
      // Notify UI to refresh
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('channelsUpdated'))
      }
    } else if (!lastVersion) {
      // First load - just store version
      lastVersion = currentVersion
    }
  } catch (err) {
    // Silent fail - don't spam console
    console.debug('[ChannelSync] Check failed:', err.message)
  }
}

/**
 * Start polling for channel updates
 */
export function startChannelSync() {
  if (pollInterval) return
  
  console.log('[ChannelSync] Starting (checking every 10s)')
  
  // Initial check after 3 seconds
  setTimeout(checkForUpdates, 3000)
  
  // Poll every 10 seconds
  pollInterval = setInterval(checkForUpdates, POLL_INTERVAL)
}

/**
 * Stop polling
 */
export function stopChannelSync() {
  if (pollInterval) {
    clearInterval(pollInterval)
    pollInterval = null
  }
}

/**
 * Force immediate check
 */
export function forceCheck() {
  checkForUpdates()
}
