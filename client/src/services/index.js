/**
 * Index file for services - Centralized exports
 * This allows easy importing from the services directory
 */

// API Client
export { APIClient, apiClient } from './apiClient'

// API Service
export { APIService, apiService } from './apiService'

// Module Manager
export { ModuleManager, moduleManager } from './moduleManager'

// Monitoring Service

// Re-export for convenience
export {
  apiClient as httpClient,
  apiService as api,
  moduleManager,
}
