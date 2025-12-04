/**
 * useSessionCleanup - Hook for pre-session cleanup before starting TV
 * Ensures all state is clean and fresh when user starts TV experience
 */

import { useEffect } from 'react'
import { STORAGE } from '../config/constants'

export function useSessionCleanup(cacheMonitor, onCleanupComplete = null) {
  useEffect(() => {
    /**
     * Perform full cleanup before TV session starts
     */
    const performCleanup = async () => {
      console.log('[useSessionCleanup] Starting pre-TV cleanup...')

      try {
        // Preserve essential session keys
        const preserveKeys = [
          STORAGE.SESSION_ID_KEY,
          STORAGE.SELECTED_CHANNELS_KEY,
          STORAGE.USER_PREFERENCES_KEY,
        ]

        // Full cache cleanup
        if (cacheMonitor) {
          await cacheMonitor.fullCleanup(preserveKeys)
        }

        // Clear any pending timers/intervals
        if (typeof window !== 'undefined') {
          // Store original functions
          const originalSetTimeout = window.setTimeout
          const originalSetInterval = window.setInterval

          // We don't clear all timeouts/intervals as that would break UI
          // Instead, components should manage their own cleanup
        }

        console.log('[useSessionCleanup] ✓ Cleanup complete')

        if (onCleanupComplete) {
          onCleanupComplete()
        }

        return true
      } catch (err) {
        console.error('[useSessionCleanup] Cleanup error:', err)
        return false
      }
    }

    // Run cleanup once on mount
    performCleanup()
  }, [cacheMonitor, onCleanupComplete])
}

export default useSessionCleanup
