/**
 * useInitialization - Hook for initializing services and modules
 * Handles setup of core services on application start
 */

import { useEffect, useRef, useState } from 'react'
import { moduleManager } from '../services/moduleManager'

export function useInitialization() {
  const [initialized, setInitialized] = useState(false)
  const [initError, setInitError] = useState(null)
  const [loading, setLoading] = useState(true)
  const initRef = useRef(false)

  useEffect(() => {
    // Prevent double initialization
    if (initRef.current) {
      return
    }
    initRef.current = true

    const initialize = async () => {
      try {
        console.log('[useInitialization] Starting application initialization...')
        setLoading(true)

        // Initialize module manager
        const result = await moduleManager.initialize()

        if (result.errors && result.errors.length > 0) {
          console.warn('[useInitialization] Initialization had warnings:', result.errors)
        }

        // Start health monitoring if available
        const healthMonitor = moduleManager.getModule('healthMonitor')
        if (healthMonitor && typeof healthMonitor.start === 'function') {
          healthMonitor.start()
          console.log('[useInitialization] ✓ Health monitoring started')
        }

        console.log('[useInitialization] ✓ Initialization complete')
        setInitialized(true)
        setLoading(false)
      } catch (err) {
        console.error('[useInitialization] Initialization failed:', err)
        setInitError(err.message)
        setLoading(false)
      }
    }

    initialize()

    // Cleanup on unmount
    return () => {
      // Don't shutdown on unmount as it would affect the entire app
      // Only shutdown should happen explicitly when app fully unloads
    }
  }, [])

  return {
    initialized,
    initError,
    loading,
    moduleManager,
  }
}

export default useInitialization
