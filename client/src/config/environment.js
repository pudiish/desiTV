/**
 * Environment Configuration
 * Manages environment-specific settings and variables
 * Works seamlessly for: Local dev, Vercel, Render, any deployment
 * 
 * All ports are configured via environment variables in .env file:
 * - PORT / VITE_SERVER_PORT: Backend server port
 * - VITE_CLIENT_PORT: Frontend dev server port
 */

// Get ports from Vite env (set in .env file)
const getServerPort = () => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    const port = import.meta.env.VITE_SERVER_PORT || import.meta.env.PORT
    if (!port) {
      console.warn('⚠️  VITE_SERVER_PORT not set in .env')
    }
    return port || ''
  }
  return ''
}

class EnvironmentConfig {
  constructor() {
    this.isProduction = this.getIsProduction()
    this.isDevelopment = !this.isProduction
    this.debug = this.getDebugMode()
    this.appVersion = this.getAppVersion()
    // apiBaseUrl is computed dynamically via getter
  }

  /**
   * Get API base URL - DYNAMICALLY computed based on current hostname
   * This ensures it works correctly when accessed from any device
   */
  get apiBaseUrl() {
    return this.getApiBaseUrl()
  }

  /**
   * Get API base URL - works for all environments
   * Priority: Network detection > Proxy (localhost) > Production rewrites
   */
  getApiBaseUrl() {
    // In browser environment - detect hostname dynamically
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
      
      // Check if accessing from local network IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      const isLocalNetwork = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)
      
      // LOCAL NETWORK ACCESS: Connect directly to backend on same IP
      // This is checked FIRST so mobile/other devices work correctly
      if (isLocalNetwork) {
        const serverPort = getServerPort()
        return `http://${hostname}:${serverPort}`
      }
      
      // LOCALHOST: Use empty string (Vite proxy handles /api routes)
      if (isLocalhost) {
        return ''  // Vite proxy will forward /api/* to backend
      }
      
      // PRODUCTION on Vercel: Use Render API directly (rewrites not reliable)
      if (hostname.includes('vercel.app')) {
        return 'https://desitv-api.onrender.com'  // Direct connection to Render API
      }
      
      // PRODUCTION on Render or custom domain
      if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE) {
        return import.meta.env.VITE_API_BASE.replace(/\/$/, '')
      }
      
      // Fallback: Use same origin
      return window.location.origin
    }

    // SSR or non-browser fallback
    const serverPort = getServerPort()
    return `http://localhost:${serverPort}`
  }

  /**
   * Check if running in production
   */
  getIsProduction() {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.MODE === 'production' || import.meta.env.PROD === true
    }
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      // Local network IPs are still development
      const isLocalNetwork = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname)
      return !['localhost', '127.0.0.1'].includes(hostname) && !isLocalNetwork
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
