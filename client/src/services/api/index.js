/**
 * API Services Index
 * 
 * All the services that talk to the server.
 * Think of this as the diplomatic corps of the app! 🌍
 */

// Global epoch management
export * from './globalEpochService'

// Live state sync removed - clients calculate position locally using BroadcastStateManager

// Timezone handling
export * from './timezoneService'

// Viewer count tracking - REMOVED (not needed for core functionality)
