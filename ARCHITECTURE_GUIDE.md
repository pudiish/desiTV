# Retro TV Architecture & Implementation Guide

**Version**: 2.0 (Restructured)  
**Date**: December 4, 2025

---

## 📚 Quick Navigation

- [Architecture Overview](#architecture-overview)
- [Services & Modules](#services--modules)
- [Hooks System](#hooks-system)
- [Monitoring & Health](#monitoring--health)
- [Component Integration](#component-integration)
- [Configuration](#configuration)
- [Development Guide](#development-guide)
- [Troubleshooting](#troubleshooting)

---

## 🏗️ Architecture Overview

### New Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Components                      │
│            (Home, Player, Admin Dashboard)               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│              Custom Hooks Layer                          │
│  useInitialization, useSessionCleanup, useHealthMonitoring│
│  useMetrics, useErrors, useCache                        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│            Services & Modules                            │
│  APIClient, APIService, ModuleManager                   │
└────────┬────────────────────────────────┬───────────────┘
         │                                │
┌────────▼──────────┐       ┌────────────▼─────────────┐
│  Monitoring Layer │       │  Configuration Layer     │
│  HealthMonitor    │       │  Constants, Environment  │
│  MetricsCollector │       │  API Endpoints           │
│  ErrorAggregator  │       │  Feature Flags           │
│  CacheMonitor     │       └──────────────────────────┘
└───────────────────┘

                     │
        ┌────────────▼────────────────┐
        │  Existing Utilities         │
        │  SessionManager             │
        │  BroadcastStateManager      │
        │  YouTubeRetryManager        │
        │  EventCleanupManager        │
        └─────────────────────────────┘
```

### Key Principles

1. **Single Responsibility**: Each service handles one concern
2. **Dependency Injection**: Modules injected through manager
3. **Monitoring First**: Observable from ground up
4. **Clean Sessions**: Pre-TV cleanup ensures fresh state
5. **Modular Configuration**: Constants centralized for easy tuning

---

## 🔌 Services & Modules

### 1. APIClient (`src/services/apiClient.js`)

Low-level HTTP abstraction using Fetch API.

**Features**:
- Automatic timeout handling
- Request/response interceptors
- Request logging
- Error handling

**Usage**:
```javascript
import { apiClient } from '@/services/apiClient'

// Make a request
const data = await apiClient.get('/api/channels')

// Add interceptor
apiClient.addRequestInterceptor((config) => {
  config.headers = config.headers || {}
  config.headers.Authorization = `Bearer ${token}`
  return config
})
```

### 2. APIService (`src/services/apiService.js`)

High-level API wrapper with typed endpoints.

**Features**:
- Wrapped endpoints for channels, sessions, broadcast state
- Consistent error handling
- Request logging integration

**Usage**:
```javascript
import { apiService } from '@/services/apiService'

// Get channels
const channels = await apiService.getChannels()

// Save session
await apiService.saveSession(sessionId, { volume: 0.5 })

// Check health
const health = await apiService.checkHealth()
```

### 3. ModuleManager (`src/services/moduleManager.js`)

Dependency injection container for all services.

**Features**:
- Centralized module initialization
- Lifecycle management
- Error tracking
- Event notifications

**Usage**:
```javascript
import { moduleManager } from '@/services/moduleManager'

// Initialize all modules
await moduleManager.initialize()

// Get a specific module
const healthMonitor = moduleManager.getModule('healthMonitor')

// Subscribe to initialization events
moduleManager.onEvent((event) => {
  if (event === 'initialized') {
    console.log('All modules ready')
  }
})
```

---

## 📊 Monitoring & Health

### HealthMonitor (`src/monitoring/healthMonitor.js`)

Tracks API endpoint health continuously.

**API**:
```javascript
// Start monitoring
healthMonitor.start()

// Stop monitoring
healthMonitor.stop()

// Check health manually
await healthMonitor.checkHealth()

// Get status
const status = healthMonitor.getStatus()
// Returns: { endpoints: {...}, overall: {...}, isMonitoring: true }

// Subscribe to changes
healthMonitor.onStatusChange((status) => {
  console.log('Health updated:', status)
})
```

### MetricsCollector (`src/monitoring/metricsCollector.js`)

Collects performance and usage metrics.

**API**:
```javascript
// Record API events (automatic via interceptors)
metricsCollector.recordRequestStart(url)
metricsCollector.recordRequestEnd(status, duration)
metricsCollector.recordError('api_error')

// Get metrics
const metrics = metricsCollector.getMetrics()
// Returns: { apiCalls, responseTimes, averageResponseTime, cacheHitRate, ... }

// Reset metrics
metricsCollector.reset()

// Subscribe to changes
metricsCollector.onMetricsChange((metrics) => {
  console.log('Metrics updated:', metrics)
})
```

### ErrorAggregator (`src/monitoring/errorAggregator.js`)

Aggregates and categorizes errors.

**API**:
```javascript
// Record error
errorAggregator.recordError({
  type: 'api_error',
  message: 'Channel not found',
  status: 404,
  endpoint: '/api/channels/123'
})

// Get summary
const summary = errorAggregator.getErrorSummary()
// Returns: { total, byType, byEndpoint, bySeverity, recent }

// Clear errors
errorAggregator.clearErrors()
errorAggregator.clearErrorsByType('api_error')

// Subscribe to changes
errorAggregator.onErrorsChange((summary) => {
  console.log('Errors updated:', summary)
})
```

### CacheMonitor (`src/monitoring/cacheMonitor.js`)

Manages and monitors all cache types.

**API**:
```javascript
// Get cache stats
const stats = cacheMonitor.getStats()
// Returns: { localStorage: {...}, sessionStorage: {...}, browserCache: {...} }

// Clear caches
cacheMonitor.clearLocalStorage(['key-to-preserve'])
cacheMonitor.clearSessionStorage()
await cacheMonitor.clearBrowserCache()

// Full cleanup for TV session
await cacheMonitor.fullCleanup(['retro-tv-session-id'])

// Get total size
const size = cacheMonitor.getTotalSize()
// Returns: { bytes, KB, MB }

// Subscribe to changes
cacheMonitor.onStatsChange((stats) => {
  console.log('Cache updated:', stats)
})
```

---

## 🎣 Hooks System

### useInitialization

Initializes all services on app startup.

```javascript
import { useInitialization } from '@/hooks'

function App() {
  const { initialized, loading, initError, moduleManager } = useInitialization()

  if (loading) return <div>Loading...</div>
  if (initError) return <div>Error: {initError}</div>

  return <MainApp />
}
```

### useSessionCleanup

Performs pre-TV cleanup when entering TV view.

```javascript
import { useSessionCleanup } from '@/hooks'
import { moduleManager } from '@/services'

function TVView() {
  const cacheMonitor = moduleManager.getModule('cacheMonitor')

  useSessionCleanup(cacheMonitor, () => {
    console.log('Cleanup complete')
  })

  return <TVComponent />
}
```

### useHealthMonitoring

Subscribe to health status updates.

```javascript
import { useHealthMonitoring } from '@/hooks'
import { moduleManager } from '@/services'

function StatusDisplay() {
  const healthMonitor = moduleManager.getModule('healthMonitor')
  const health = useHealthMonitoring(healthMonitor)

  return <div>{health.overall.percentage}% healthy</div>
}
```

### useMetrics

Subscribe to performance metrics.

```javascript
import { useMetrics } from '@/hooks'
import { moduleManager } from '@/services'

function MetricsDisplay() {
  const metricsCollector = moduleManager.getModule('metricsCollector')
  const metrics = useMetrics(metricsCollector)

  return <div>Avg Response: {metrics.averageResponseTime}ms</div>
}
```

### useErrors

Subscribe to error updates.

```javascript
import { useErrors } from '@/hooks'
import { moduleManager } from '@/services'

function ErrorDisplay() {
  const errorAggregator = moduleManager.getModule('errorAggregator')
  const errors = useErrors(errorAggregator)

  return <div>Errors: {errors.total}</div>
}
```

### useCache

Manage and subscribe to cache updates.

```javascript
import { useCache } from '@/hooks'
import { moduleManager } from '@/services'

function CacheDisplay() {
  const cacheMonitor = moduleManager.getModule('cacheMonitor')
  const { stats, clearLocalStorage, getTotalSize } = useCache(cacheMonitor)

  return (
    <div>
      <div>Cache: {getTotalSize().MB} MB</div>
      <button onClick={() => clearLocalStorage()}>Clear</button>
    </div>
  )
}
```

---

## 📋 Configuration

### Constants (`src/config/constants.js`)

All configuration in one place.

```javascript
import { TIMING, PLAYBACK, API_ENDPOINTS, FEATURES } from '@/config/constants'

// Timing
TIMING.SWITCH_BEFORE_END        // 2 seconds
TIMING.MAX_BUFFER_TIME          // 8000 ms
TIMING.HEALTH_CHECK_INTERVAL    // 10000 ms

// Playback
PLAYBACK.DEFAULT_VOLUME         // 0.5
PLAYBACK.DEFAULT_VIDEO_DURATION // 300 seconds

// API Endpoints
API_ENDPOINTS.CHANNELS          // '/api/channels'
API_ENDPOINTS.BROADCAST_STATE   // '/api/broadcast-state'

// Feature Flags
FEATURES.ENABLE_SESSION_PERSISTENCE
FEATURES.ENABLE_CACHE_CLEANUP
FEATURES.ENABLE_ADMIN_MONITORING
```

### Environment (`src/config/environment.js`)

Environment-specific configuration.

```javascript
import { envConfig } from '@/config/environment'

envConfig.isProduction          // boolean
envConfig.isDevelopment         // boolean
envConfig.apiBaseUrl            // 'http://localhost:5002'
envConfig.getApiUrl(endpoint)   // Builds full URL
```

---

## 🧩 Component Integration

### Integration Steps

1. **In your component**, import what you need:
```javascript
import { useInitialization, useHealthMonitoring } from '@/hooks'
import { moduleManager } from '@/services'
import { API_ENDPOINTS } from '@/config/constants'
```

2. **Use the hooks**:
```javascript
function MyComponent() {
  const { initialized } = useInitialization()
  const healthMonitor = moduleManager.getModule('healthMonitor')
  const health = useHealthMonitoring(healthMonitor)

  if (!initialized) return <Loading />

  return <div>Health: {health.overall.percentage}%</div>
}
```

3. **Call APIs through service**:
```javascript
import { apiService } from '@/services'

const channels = await apiService.getChannels()
const health = await apiService.checkHealth()
```

### Adding New API Endpoints

1. Add to `src/config/constants.js`:
```javascript
export const API_ENDPOINTS = {
  // ... existing
  MY_ENDPOINT: '/api/my-endpoint',
}
```

2. Add method to `src/services/apiService.js`:
```javascript
async getMyData() {
  try {
    return await this.client.get(API_ENDPOINTS.MY_ENDPOINT)
  } catch (error) {
    console.error('[APIService] Error:', error)
    throw error
  }
}
```

3. Use in component:
```javascript
const data = await apiService.getMyData()
```

---

## 🎯 Admin Dashboard

### New Sections

1. **Component Health** (`APIHealth.jsx`)
   - API endpoint status
   - Response times
   - Overall health percentage

2. **Cache Manager** (`CacheManagerUI.jsx`)
   - View cache sizes
   - Clear individual caches
   - Full cleanup button

3. **System Health** (`ComponentHealth.jsx`)
   - Performance metrics
   - Error tracking
   - Response time history

### Accessing in Admin

The admin dashboard automatically initializes all monitoring. Simply navigate to the respective tabs:

- 📊 Dashboard → Component Health
- 🔌 API Health → API endpoint status
- 💾 Cache Manager → Cache management

---

## 🔄 Data Flow

### Session Initialization Flow

```
App Starts
  ↓
AppInitializer mounts
  ↓
useInitialization runs
  ↓
ModuleManager.initialize()
  ↓
  ├─ APIClient created
  ├─ APIService created
  ├─ HealthMonitor created & started
  ├─ MetricsCollector created
  ├─ ErrorAggregator created
  └─ CacheMonitor created
  ↓
Interceptors setup
  ↓
Home component mounts
  ↓
useSessionCleanup runs
  ↓
Cache cleanup (preserve session keys)
  ↓
TV Session Ready
```

### API Request Flow

```
Component calls apiService.getChannels()
  ↓
APIService calls apiClient.get('/api/channels')
  ↓
Request Interceptors run
  ↓
Fetch request made
  ↓
Response Interceptors run
  ↓
MetricsCollector records (via interceptor)
  ↓
Return data to component
```

### Error Handling Flow

```
API Error occurs
  ↓
Error Interceptor runs
  ↓
ErrorAggregator.recordError() called
  ↓
Error stored and categorized
  ↓
Listeners notified
  ↓
Admin Dashboard updated
```

---

## 🐛 Troubleshooting

### Issue: Services not initialized

**Cause**: Component renders before AppInitializer completes

**Solution**: Check loading state:
```javascript
const { initialized, loading } = useInitialization()
if (loading) return <div>Loading...</div>
```

### Issue: Health monitor not updating

**Cause**: Monitor not started

**Solution**: Monitor starts automatically. Check:
```javascript
const healthMonitor = moduleManager.getModule('healthMonitor')
console.log(healthMonitor.isMonitoring) // Should be true
```

### Issue: Cache not being cleared

**Cause**: Protected keys preserved

**Solution**: Specify preserve keys:
```javascript
cache.fullCleanup(['retro-tv-session-id']) // This key is preserved
```

### Issue: Metrics showing 0

**Cause**: No API calls made yet

**Solution**: Metrics update as calls are made. Give it time or make a test call:
```javascript
await apiService.checkHealth()
```

### Issue: Admin sections not showing

**Cause**: Module manager not initialized

**Solution**: Ensure AppInitializer wraps your app:
```javascript
<AppInitializer>
  <BrowserRouter>
    {/* Routes */}
  </BrowserRouter>
</AppInitializer>
```

---

## 📖 File Structure Reference

```
src/
├── config/
│   ├── constants.js          # All constants
│   ├── environment.js        # Environment config
│   └── index.js             # Config exports
│
├── services/
│   ├── apiClient.js         # HTTP client
│   ├── apiService.js        # API wrapper
│   ├── moduleManager.js     # DI container
│   └── index.js             # Service exports
│
├── monitoring/
│   ├── healthMonitor.js     # API health
│   ├── metricsCollector.js  # Performance metrics
│   ├── errorAggregator.js   # Error tracking
│   └── cacheMonitor.js      # Cache management
│
├── hooks/
│   ├── useInitialization.js      # App init
│   ├── useSessionCleanup.js      # Pre-TV cleanup
│   ├── useHealthMonitoring.js    # Health subscription
│   ├── useMetrics.js             # Metrics subscription
│   ├── useErrors.js              # Error subscription
│   ├── useCache.js               # Cache subscription
│   └── index.js                  # Hooks exports
│
├── components/
│   ├── AppInitializer.jsx   # Root initializer
│   └── ... (existing)
│
├── admin/
│   ├── sections/
│   │   ├── APIHealth.jsx    # NEW
│   │   ├── CacheManagerUI.jsx # NEW
│   │   ├── ComponentHealth.jsx # NEW
│   │   └── ... (existing)
│   └── AdminDashboard.jsx
│
└── utils/
    └── ... (existing managers)
```

---

## ✅ Best Practices

1. **Always use useInitialization in root component**
```javascript
function App() {
  const { initialized } = useInitialization()
  if (!initialized) return <Loading />
  return <MainContent />
}
```

2. **Call APIs through apiService, never directly**
```javascript
// ✓ Good
const data = await apiService.getChannels()

// ✗ Bad
fetch('/api/channels')
```

3. **Subscribe to monitoring in components that need it**
```javascript
const health = useHealthMonitoring(healthMonitor)
```

4. **Use constants for all magic numbers**
```javascript
// ✓ Good
setTimeout(callback, TIMING.SESSION_SAVE_DEBOUNCE)

// ✗ Bad
setTimeout(callback, 500)
```

5. **Let modules manage their own lifecycle**
```javascript
// ✓ Good - modules auto-manage
const healthMonitor = moduleManager.getModule('healthMonitor')

// ✗ Bad - manual management
const hm = new HealthMonitor()
hm.start()
```

---

## 🚀 Next Steps

1. Review existing components for refactoring opportunities
2. Add custom hooks for frequently repeated patterns
3. Extend monitoring for specific use cases
4. Add analytics tracking using MetricsCollector
5. Create error recovery strategies using ErrorAggregator

---

**For questions or contributions, refer to the comprehensive audit document.**
