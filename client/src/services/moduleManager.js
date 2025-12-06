/**
 * Module Manager - Dependency Injection Container
 * Centralizes initialization and lifecycle management of all services and managers
 * Allows for easy mocking and testing
 */

import { apiClient, APIClient } from './apiClient'
import { apiService, APIService } from './apiService'

export class ModuleManager {
  constructor(config = {}) {
    this.config = config
    this.modules = {}
    this.initialized = false
    this.listeners = []
    this.initializationErrors = []
  }

  /**
   * Initialize all modules
   */
  async initialize() {
    console.log('[ModuleManager] Starting initialization...')

    try {
      // Initialize core services first
      this.registerModule('apiClient', apiClient)
      this.registerModule('apiService', apiService)

      this.initialized = true
      this.notifyListeners('initialized')
      console.log('[ModuleManager] ✓ Initialization complete')

      return {
        success: true,
        modules: Object.keys(this.modules),
        errors: this.initializationErrors,
      }
    } catch (err) {
      console.error('[ModuleManager] Initialization failed:', err)
      this.initialized = false
      this.notifyListeners('failed')
      throw err
    }
  }

  /**
   * Register a module
   */
  registerModule(name, module) {
    this.modules[name] = module
    console.log(`[ModuleManager] ✓ Registered module: ${name}`)
  }

  /**
   * Get a module
   */
  getModule(name) {
    if (!this.modules[name]) {
      console.warn(`[ModuleManager] Warning: Module "${name}" not found`)
    }
    return this.modules[name]
  }


  /**
   * Get all modules
   */
  getAllModules() {
    return { ...this.modules }
  }

  /**
   * Shutdown all modules
   */
  async shutdown() {
    console.log('[ModuleManager] Shutting down modules...')

    for (const [name, module] of Object.entries(this.modules)) {
      if (typeof module?.shutdown === 'function') {
        try {
          await module.shutdown()
          console.log(`[ModuleManager] ✓ Shutdown ${name}`)
        } catch (err) {
          console.error(`[ModuleManager] Error shutting down ${name}:`, err)
        }
      }
    }

    this.initialized = false
    this.notifyListeners('shutdown')
  }

  /**
   * Reset all modules
   */
  async reset() {
    console.log('[ModuleManager] Resetting modules...')
    await this.shutdown()
    this.modules = {}
    await this.initialize()
  }

  /**
   * Subscribe to initialization events
   */
  onEvent(listener) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  /**
   * Notify listeners of events
   */
  notifyListeners(event) {
    this.listeners.forEach((listener) => {
      try {
        listener(event)
      } catch (err) {
        console.error('[ModuleManager] Error in listener:', err)
      }
    })
  }

  /**
   * Get initialization status
   */
  getStatus() {
    return {
      initialized: this.initialized,
      modules: Object.keys(this.modules),
      errors: this.initializationErrors,
    }
  }
}

// Create singleton instance
export const moduleManager = new ModuleManager({
  enableMonitoring: false,
})

export default ModuleManager
