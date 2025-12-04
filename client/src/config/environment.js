/**
 * Environment Configuration
 * Manages environment-specific settings and variables
 */

class EnvironmentConfig {
  constructor() {
    this.apiBaseUrl = this.getApiBaseUrl()
    this.isProduction = this.getIsProduction()
    this.isDevelopment = !this.isProduction
    this.debug = this.getDebugMode()
  }

  /**
   * Get API base URL from environment or default
   */
  getApiBaseUrl() {
    // Check Vite env first (for client-side)
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const viteUrl = import.meta.env.VITE_API_BASE
      if (viteUrl) return viteUrl
    }

    // Default based on environment
    if (typeof window !== 'undefined') {
      // Browser environment
      const isDev = window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1'
      return isDev ? 'http://localhost:5002' : window.location.origin
    }

    // Fallback
    return 'http://localhost:5002'
  }

  /**
   * Check if running in production
   */
  getIsProduction() {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.MODE === 'production'
    }
    if (typeof process !== 'undefined' && process.env) {
      return process.env.NODE_ENV === 'production'
    }
    return false
  }

  /**
   * Check if debug mode is enabled
   */
  getDebugMode() {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_DEBUG === 'true'
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('debug-mode') === 'true'
    }
    return false
  }

  /**
   * Get full API URL for an endpoint
   */
  getApiUrl(endpoint) {
    const base = this.apiBaseUrl.replace(/\/$/, '') // Remove trailing slash
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${base}${path}`
  }

  /**
   * Log configuration (only in development)
   */
  log() {
    if (this.isDevelopment) {
      console.log('[EnvironmentConfig]', {
        apiBaseUrl: this.apiBaseUrl,
        isProduction: this.isProduction,
        isDevelopment: this.isDevelopment,
        debug: this.debug,
      })
    }
  }
}

// Create singleton instance
export const envConfig = new EnvironmentConfig()

// Also export the class for testing
export default EnvironmentConfig
