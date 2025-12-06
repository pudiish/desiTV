/**
 * Index file for services - Centralized exports
 */

// API Client
export { APIClient, apiClient } from './apiClient'

// API Service
export { APIService, apiService } from './apiService'

// Re-export for convenience
export {
  apiClient as httpClient,
  apiService as api,
}
