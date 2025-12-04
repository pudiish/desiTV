/**
 * Error Aggregator - Centralized error tracking and reporting
 * Collects, aggregates, and provides insights into application errors
 */

import { ERROR, CACHE } from '../config/constants'

export class ErrorAggregator {
  constructor() {
    this.errors = []
    this.errorsByType = {}
    this.errorsByEndpoint = {}
    this.listeners = []
    this.maxErrors = ERROR.MAX_ERROR_LOG_SIZE
  }

  /**
   * Record an error
   */
  recordError(errorData) {
    const error = {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      type: errorData.type || 'unknown',
      message: errorData.message || 'Unknown error',
      status: errorData.status || null,
      endpoint: errorData.endpoint || null,
      details: errorData.details || null,
      severity: this.calculateSeverity(errorData),
    }

    // Add to main list
    this.errors.push(error)
    if (this.errors.length > this.maxErrors) {
      this.errors.shift()
    }

    // Track by type
    if (!this.errorsByType[error.type]) {
      this.errorsByType[error.type] = []
    }
    this.errorsByType[error.type].push(error)
    if (this.errorsByType[error.type].length > 50) {
      this.errorsByType[error.type].shift()
    }

    // Track by endpoint
    if (error.endpoint) {
      if (!this.errorsByEndpoint[error.endpoint]) {
        this.errorsByEndpoint[error.endpoint] = []
      }
      this.errorsByEndpoint[error.endpoint].push(error)
      if (this.errorsByEndpoint[error.endpoint].length > 50) {
        this.errorsByEndpoint[error.endpoint].shift()
      }
    }

    this.notifyListeners()
    console.error(`[ErrorAggregator] ${error.type}: ${error.message}`)

    return error
  }

  /**
   * Calculate error severity
   */
  calculateSeverity(errorData) {
    if (errorData.status >= 500) return 'critical'
    if (errorData.status >= 400) return 'high'
    if (errorData.type === 'network_error') return 'high'
    if (errorData.type === 'timeout') return 'medium'
    return 'low'
  }

  /**
   * Get all errors
   */
  getErrors() {
    return [...this.errors]
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 10) {
    return this.errors.slice(-limit).reverse()
  }

  /**
   * Get errors by type
   */
  getErrorsByType(type) {
    return (this.errorsByType[type] || []).slice(-10).reverse()
  }

  /**
   * Get errors by endpoint
   */
  getErrorsByEndpoint(endpoint) {
    return (this.errorsByEndpoint[endpoint] || []).slice(-10).reverse()
  }

  /**
   * Get error summary
   */
  getErrorSummary() {
    const summary = {
      total: this.errors.length,
      byType: {},
      byEndpoint: {},
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      recent: this.getRecentErrors(5),
    }

    // Count by type
    Object.entries(this.errorsByType).forEach(([type, errors]) => {
      summary.byType[type] = errors.length
    })

    // Count by endpoint
    Object.entries(this.errorsByEndpoint).forEach(([endpoint, errors]) => {
      summary.byEndpoint[endpoint] = errors.length
    })

    // Count by severity
    this.errors.forEach((error) => {
      summary.bySeverity[error.severity]++
    })

    return summary
  }

  /**
   * Clear errors
   */
  clearErrors() {
    this.errors = []
    this.errorsByType = {}
    this.errorsByEndpoint = {}
    this.notifyListeners()
  }

  /**
   * Clear errors of specific type
   */
  clearErrorsByType(type) {
    this.errors = this.errors.filter((e) => e.type !== type)
    delete this.errorsByType[type]
    this.notifyListeners()
  }

  /**
   * Subscribe to error updates
   */
  onErrorsChange(listener) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  /**
   * Notify listeners
   */
  notifyListeners() {
    this.listeners.forEach((listener) => {
      try {
        listener(this.getErrorSummary())
      } catch (err) {
        console.error('[ErrorAggregator] Error in listener:', err)
      }
    })
  }
}

export default ErrorAggregator
