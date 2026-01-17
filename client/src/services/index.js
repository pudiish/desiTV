/**
 * Index file for services - Centralized exports
 */

// API Client V2 (unified, cached, production-ready)
export { default as apiClientV2, useAPI } from './apiClientV2';

// API Service (uses apiClientV2)
export { APIService, apiService } from './apiService'

// Mood Color Service
export { moodColorService, MOOD_PRESETS, MOOD_KEYWORDS } from './moodColorService'

// Re-export for convenience (backward compatibility)
export {
  apiClientV2 as apiClient,
  apiClientV2 as httpClient,
  apiService as api,
}
