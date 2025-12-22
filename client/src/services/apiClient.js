/**
 * API Client - Abstraction layer for HTTP requests
 * Provides:
 * - Centralized request/response handling
 * - Automatic error handling
 * - Request/response interceptors
 * - Retry logic
 * - Request logging
 */

import { envConfig } from '../config/environment'
import { API_ENDPOINTS, TIMING } from '../config/constants'
import { getToken, logout } from './authService'

export class APIClient {
  constructor(config = {}) {
    this.baseURL = config.baseURL || envConfig.apiBaseUrl
    this.timeout = config.timeout || TIMING.API_HEALTH_TIMEOUT
    this.interceptors = {
      request: [],
      response: [],
      error: [],
    }
    this.requestLog = []
    this.maxLogSize = config.maxLogSize || 100
    this.csrfToken = null // CSRF token cache
    this.csrfTokenPromise = null // Promise for token fetch in progress
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor)
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor)
  }

  /**
   * Add error interceptor
   */
  addErrorInterceptor(interceptor) {
    this.interceptors.error.push(interceptor)
  }

  /**
   * Apply request interceptors
   */
  async applyRequestInterceptors(config) {
    let finalConfig = { ...config }
    for (const interceptor of this.interceptors.request) {
      finalConfig = await interceptor(finalConfig)
    }
    return finalConfig
  }

  /**
   * Apply response interceptors
   */
  async applyResponseInterceptors(response) {
    let finalResponse = response
    for (const interceptor of this.interceptors.response) {
      finalResponse = await interceptor(finalResponse)
    }
    return finalResponse
  }

  /**
   * Apply error interceptors
   */
  async applyErrorInterceptors(error) {
    let finalError = error
    for (const interceptor of this.interceptors.error) {
      finalError = await interceptor(finalError)
    }
    return finalError
  }

  /**
   * Log request for monitoring
   */
  logRequest(config, duration, status, error = null) {
    const log = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      method: config.method || 'GET',
      url: config.url,
      status,
      duration: Math.round(duration),
      statusType:
        status >= 200 && status < 300
          ? 'success'
          : status >= 400
            ? 'error'
            : 'warning',
      error: error?.message || null,
    }

    this.requestLog.push(log)
    if (this.requestLog.length > this.maxLogSize) {
      this.requestLog.shift()
    }

    return log
  }

  /**
   * Get request logs
   */
  getRequestLogs() {
    return [...this.requestLog]
  }

  /**
   * Clear request logs
   */
  clearRequestLogs() {
    this.requestLog = []
  }

  /**
   * Build full URL
   */
  buildUrl(endpoint) {
    if (endpoint.startsWith('http')) {
      return endpoint
    }
    const base = this.baseURL.replace(/\/$/, '')
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${base}${path}`
  }

  /**
   * Get CSRF token from server
   */
  async getCsrfToken() {
    // Return cached token if available
    if (this.csrfToken) {
      return this.csrfToken
    }

    // If token fetch is in progress, wait for it
    if (this.csrfTokenPromise) {
      return this.csrfTokenPromise
    }

    // Fetch new token
    this.csrfTokenPromise = fetch(`${this.baseURL}/api/csrf-token`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Accept': 'application/json'
      }
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to get CSRF token: ${response.status}`)
        }
        
        // Get token from header or response body
        const tokenFromHeader = response.headers.get('X-CSRF-Token')
        const data = await response.json()
        const token = tokenFromHeader || data.token

        if (!token) {
          throw new Error('CSRF token not found in response')
        }

        this.csrfToken = token
        this.csrfTokenPromise = null
        return token
      })
      .catch((error) => {
        this.csrfTokenPromise = null
        console.warn('[APIClient] Failed to get CSRF token:', error.message)
        // Return null if token fetch fails (graceful degradation)
        return null
      })

    return this.csrfTokenPromise
  }

  /**
   * Clear CSRF token (force refresh on next request)
   */
  clearCsrfToken() {
    this.csrfToken = null
    this.csrfTokenPromise = null
  }

  /**
   * Make HTTP request
   */
  async request(config) {
    try {
      // Apply request interceptors
      const finalConfig = await this.applyRequestInterceptors({
        method: 'GET',
        ...config,
      })

      // Build URL
      const url = this.buildUrl(finalConfig.url)

      // Get CSRF token for state-changing requests
      const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH']
      const needsCsrfToken = stateChangingMethods.includes(finalConfig.method?.toUpperCase())
      
      let csrfToken = null
      if (needsCsrfToken) {
        csrfToken = await this.getCsrfToken()
        // If token fetch failed, retry once
        if (!csrfToken) {
          this.clearCsrfToken() // Clear cache to force fresh fetch
          csrfToken = await this.getCsrfToken()
        }
        // If still no token, log warning but proceed (server will reject with 403)
        if (!csrfToken) {
          console.warn('[APIClient] CSRF token unavailable, request may fail')
        }
      }

      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        ...finalConfig.headers,
      }

      // Add Authorization header if token exists
      const authToken = getToken()
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      // Add CSRF token to headers if available
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }

      // Make request
      const startTime = performance.now()
      const response = await fetch(url, {
        ...finalConfig,
        headers,
        credentials: 'include', // Include cookies for CSRF
        signal: controller.signal,
      })

      // Update CSRF token from response header (if refreshed)
      const newToken = response.headers.get('X-CSRF-Token')
      if (newToken) {
        this.csrfToken = newToken
      }

      clearTimeout(timeoutId)
      const duration = performance.now() - startTime

      // Log request
      this.logRequest(finalConfig, duration, response.status)

      // Parse response
      let data
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      // Handle non-ok status
      if (!response.ok) {
        // Handle 401 Unauthorized - token expired/invalid
        if (response.status === 401) {
          logout()
          // Redirect to login if not already there
          if (typeof window !== 'undefined' && !window.location.pathname.includes('/admin/login')) {
            window.location.href = '/admin/login'
          }
          const error = new Error('Session expired. Please login again.')
          error.status = 401
          error.data = data
          error.response = response
          throw error
        }

        // If CSRF token error, clear token to force refresh
        if (response.status === 403 && (data?.error === 'CSRF token missing' || data?.error === 'Invalid CSRF token')) {
          this.clearCsrfToken()
        }

        const error = new Error(data?.message || `HTTP ${response.status}`)
        error.status = response.status
        error.data = data
        error.response = response
        throw error
      }

      // Apply response interceptors
      const finalResponse = await this.applyResponseInterceptors({
        data,
        status: response.status,
        headers: response.headers,
      })

      return finalResponse.data || finalResponse
    } catch (error) {
      // Apply error interceptors
      const handledError = await this.applyErrorInterceptors(error)
      throw handledError
    }
  }

  /**
   * GET request
   */
  get(url, config = {}) {
    return this.request({ ...config, method: 'GET', url })
  }

  /**
   * POST request
   */
  post(url, data = {}, config = {}) {
    return this.request({
      ...config,
      method: 'POST',
      url,
      body: typeof data === 'string' ? data : JSON.stringify(data),
    })
  }

  /**
   * PUT request
   */
  put(url, data = {}, config = {}) {
    return this.request({
      ...config,
      method: 'PUT',
      url,
      body: typeof data === 'string' ? data : JSON.stringify(data),
    })
  }

  /**
   * PATCH request
   */
  patch(url, data = {}, config = {}) {
    return this.request({
      ...config,
      method: 'PATCH',
      url,
      body: typeof data === 'string' ? data : JSON.stringify(data),
    })
  }

  /**
   * DELETE request
   */
  delete(url, config = {}) {
    return this.request({ ...config, method: 'DELETE', url })
  }
}

// Create singleton instance
export const apiClient = new APIClient()

export default APIClient
