/**
 * Environment Configuration
 * Manages environment-specific settings and variables
 * Works seamlessly for: Local dev, Vercel, Render, any deployment
 */

class EnvironmentConfig {
  constructor() {
    this.isProduction = this.getIsProduction()
    this.isDevelopment = !this.isProduction
    this.apiBaseUrl = this.getApiBaseUrl()
    this.debug = this.getDebugMode()
    this.appVersion = this.getAppVersion()
  }

  /**
   * Get API base URL - works for all environments
   * Priority: VITE_API_BASE env > Proxy (dev) > Same origin (prod)
   */
  getApiBaseUrl() {
    // 1. Check Vite env variable (set in Vercel or .env)
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const viteUrl = import.meta.env.VITE_API_BASE
      if (viteUrl) {
        return viteUrl.replace(/\/$/, '') // Remove trailing slash
      }
    }

    // 2. In browser environment
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
      
      // Development: Use empty string (proxy handles /api routes)
      if (isLocalhost) {
        return ''  // Vite proxy will handle /api/* routes
      }
      
      // Production on Vercel: Routes are rewritten to API server
      // Return empty string so /api/* uses Vercel rewrites
      if (hostname.includes('vercel.app')) {
        return ''
      }
      
      // Fallback: Use same origin (for self-hosted setups)
      return window.location.origin
    }

    // 3. Fallback for SSR or non-browser
    return 'http://localhost:5002'
  }

  /**
   * Check if running in production
   */
  getIsProduction() {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.MODE === 'production' || import.meta.env.PROD === true
    }
    if (typeof window !== 'undefined') {
      return !['localhost', '127.0.0.1'].includes(window.location.hostname)
    }
    return false
  }

  /**
   * Check if debug mode is enabled
   */
  getDebugMode() {
    // Check env variable
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      if (import.meta.env.VITE_DEBUG === 'true') return true
    }
    // Check localStorage
    if (typeof localStorage !== 'undefined') {
      if (localStorage.getItem('desitv-debug') === 'true') return true
    }
    // Debug enabled by default in development
    return this.isDevelopment
  }

  /**
   * Get app version
   */
  getAppVersion() {
    if (typeof __APP_VERSION__ !== 'undefined') {
      return __APP_VERSION__
    }
    return '1.0.0'
  }

  /**
   * Get full API URL for an endpoint
   */
  getApiUrl(endpoint) {
    const base = this.apiBaseUrl
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${base}${path}`
  }

  /**
   * Enable debug mode at runtime
   */
  enableDebug() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('desitv-debug', 'true')
      this.debug = true
    }
  }

  /**
   * Disable debug mode at runtime
   */
  disableDebug() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('desitv-debug')
      this.debug = false
    }
  }

  /**
   * Log configuration (only in development/debug)
   */
  log() {
    if (this.debug) {
      console.log('[DesiTV™ Config]', {
        apiBaseUrl: this.apiBaseUrl || '(using proxy)',
        isProduction: this.isProduction,
        isDevelopment: this.isDevelopment,
        debug: this.debug,
        appVersion: this.appVersion,
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'N/A',
      })
    }
  }

  /**
   * Get config summary
   */
  getSummary() {
    return {
      apiBaseUrl: this.apiBaseUrl || '(proxy)',
      isProduction: this.isProduction,
      isDevelopment: this.isDevelopment,
      debug: this.debug,
      appVersion: this.appVersion,
    }
  }
}

// Create singleton instance
export const envConfig = new EnvironmentConfig()

// Log config on load (development only)
if (envConfig.isDevelopment) {
  envConfig.log()
}

// Also export the class for testing
export default EnvironmentConfig
