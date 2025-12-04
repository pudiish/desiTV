# 🗺️ PROJECT ROADMAP & VISUAL GUIDES

---

## 📊 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RETRO TV APPLICATION                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                         REACT COMPONENTS LAYER                            │
│                  (Home, Player, Admin, Landing)                           │
└──────────────┬───────────────────────────────────────────┬────────────────┘
               │                                           │
               ▼                                           ▼
        ┌──────────────────┐              ┌──────────────────────┐
        │   TV Experience  │              │  Admin Dashboard     │
        │   (pages/Home)   │              │  (admin/sections)    │
        └────────┬─────────┘              └────────┬─────────────┘
                 │                                 │
                 ▼                                 ▼
        ┌──────────────────────────────────────────────────┐
        │         CUSTOM HOOKS LAYER (NEW)                 │
        │  useInitialization, useSessionCleanup, etc.      │
        │  useHealthMonitoring, useMetrics, useErrors      │
        └──────────────────┬─────────────────────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │   MODULE MANAGER (Dependency DI)    │
        │   - Initialization orchestration    │
        │   - Lifecycle management            │
        │   - Service registration            │
        └──────────────────┬──────────────────┘
                           │
        ┌──────────────────▼──────────────────┬──────────────────────┐
        │      SERVICES LAYER                 │   CONFIG LAYER       │
        │                                     │                      │
        │  ┌─────────────────────┐           │  ┌────────────────┐  │
        │  │   APIClient         │           │  │  constants.js  │  │
        │  │  (HTTP Abstraction) │           │  │  - TIMING      │  │
        │  └────────┬────────────┘           │  │  - PLAYBACK    │  │
        │           │                        │  │  - STORAGE     │  │
        │           ▼                        │  │  - ENDPOINTS   │  │
        │  ┌─────────────────────┐           │  └────────────────┘  │
        │  │   APIService        │           │  ┌────────────────┐  │
        │  │  (API Wrapper)      │           │  │environment.js  │  │
        │  │  - 30+ endpoints    │           │  │ - Mode detect  │  │
        │  │  - Error handling   │           │  │ - API URL      │  │
        │  └────────┬────────────┘           │  └────────────────┘  │
        │           │                        │                      │
        └───────────┼────────────────────────┴──────────────────────┘
                    │
                    ▼
        ┌──────────────────────────────────┐
        │   MONITORING LAYER (NEW)         │
        │                                  │
        │  ┌──────────────────────────┐   │
        │  │ HealthMonitor            │   │
        │  │ (API endpoint health)    │   │
        │  └──────────────┬───────────┘   │
        │                 │                │
        │  ┌──────────────┼───────────┐   │
        │  │ MetricsCollector        │   │
        │  │ (Performance metrics)   │   │
        │  ├─────────────┼───────────┤   │
        │  │ ErrorAggregator        │   │
        │  │ (Error tracking)       │   │
        │  ├─────────────┼───────────┤   │
        │  │ CacheMonitor           │   │
        │  │ (Cache management)     │   │
        │  └─────────────┼───────────┘   │
        │                 │                │
        └─────────────────┼────────────────┘
                          │
                          ▼
        ┌──────────────────────────────────┐
        │   EXISTING UTILITIES              │
        │  (Still compatible)               │
        │                                  │
        │  - SessionManager                │
        │  - BroadcastStateManager         │
        │  - YouTubeRetryManager           │
        │  - EventCleanupManager           │
        └──────────────────────────────────┘
```

---

## 🔄 DATA FLOW DIAGRAM

### API Request Flow
```
Component
   │
   ├─ Call: apiService.getChannels()
   │
   ├─ APIService wrapper method
   │    │
   │    ├─ Calls: apiClient.get('/api/channels')
   │    │
   │    ├─ Request Interceptor
   │    │   ├─ metricsCollector.recordRequestStart()
   │    │   └─ Validate/enrich request
   │    │
   │    ├─ Fetch Request to Backend
   │    │
   │    ├─ Response Received
   │    │   │
   │    │   ├─ Response Interceptor
   │    │   │   ├─ metricsCollector.recordRequestEnd()
   │    │   │   └─ Log request
   │    │   │
   │    │   ├─ Parse Response
   │    │   │
   │    │   └─ Return Data
   │    │
   │    └─ Error Handler
   │         └─ errorAggregator.recordError()
   │
   └─ Component Receives Data
```

### Error Tracking Flow
```
Error Occurs
   │
   ├─ In Component: try/catch
   │ or API Interceptor: Error caught
   │
   ├─ Call: errorAggregator.recordError()
   │
   ├─ Error Processing
   │   ├─ Calculate severity
   │   ├─ Categorize by type
   │   └─ Store in history
   │
   ├─ Notify Listeners
   │   ├─ AdminDashboard (if viewing)
   │   ├─ ComponentHealth section
   │   └─ useErrors hook (if subscribed)
   │
   └─ Update Visible in Admin
       └─ Show recent errors
       └─ Show error counts
       └─ Show severity breakdown
```

### Cache Cleanup Flow
```
User enters TV View (Home.jsx)
   │
   ├─ useSessionCleanup hook mounts
   │
   ├─ Get cacheMonitor from moduleManager
   │
   ├─ Call: cacheMonitor.fullCleanup(preserveKeys)
   │
   ├─ Clear sessionStorage (100%)
   │
   ├─ Clear localStorage (except preserved keys)
   │
   ├─ Clear browser cache
   │
   ├─ Update stats
   │
   ├─ Notify listeners
   │
   └─ TV Session Ready (zero stale state)
```

---

## 🏗️ Module Dependency Graph

```
                    ┌─────────────────────┐
                    │  ModuleManager      │
                    │  (DI Container)     │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
    ┌────────────┐      ┌────────────┐      ┌──────────────┐
    │ APIClient  │      │ APIService │      │   Monitoring │
    │            │      │            │      │     Systems  │
    │ - Fetch    │      │ - Channels │      │              │
    │ - Timeout  │      │ - Sessions │      ├──────────────┤
    │ - Intercept│      │ - Broadcast│      │ HealthMonitor│
    │ - Log      │      │ - Health   │      │              │
    └─────┬──────┘      └─────┬──────┘      ├──────────────┤
          │                   │              │ MetricsCollec
          │                   │              │ ErrorAggr    │
          │                   │              │ CacheMonitor │
          │                   │              └──────────────┘
          └───────────────────┴──────────────────────┬──────┘
                                                     │
                                  ┌──────────────────▼────┐
                                  │  Hooks Layer         │
                                  │                      │
                                  ├──────────────────────┤
                                  │ useInitialization   │
                                  │ useSessionCleanup   │
                                  │ useHealthMonitoring │
                                  │ useMetrics          │
                                  │ useErrors           │
                                  │ useCache            │
                                  └──────────────────────┘
                                          │
                                          ▼
                                  ┌──────────────────────┐
                                  │  React Components    │
                                  │                      │
                                  ├──────────────────────┤
                                  │ Home (TV)            │
                                  │ Admin Dashboard      │
                                  │ Admin Sections       │
                                  │ AppInitializer       │
                                  └──────────────────────┘
```

---

## 📈 Initialization Sequence

```
1. User opens app
   │
   ├─ main.jsx renders
   │  └─ <AppInitializer> mounts
   │
   ├─ AppInitializer component
   │  └─ useInitialization hook
   │
   ├─ moduleManager.initialize()
   │  │
   │  ├─ Create APIClient instance
   │  │
   │  ├─ Create APIService instance
   │  │  └─ Pass APIClient as dependency
   │  │
   │  ├─ Create HealthMonitor (conditional)
   │  │  └─ Pass APIService as dependency
   │  │
   │  ├─ Create MetricsCollector
   │  │
   │  ├─ Create ErrorAggregator
   │  │
   │  ├─ Create CacheMonitor
   │  │
   │  ├─ Setup Interceptors
   │  │  ├─ Request → MetricsCollector
   │  │  ├─ Response → MetricsCollector
   │  │  └─ Error → ErrorAggregator
   │  │
   │  └─ Start HealthMonitor
   │
   ├─ Modules available
   │  └─ moduleManager.getModule('healthMonitor')
   │
   ├─ useInitialization returns
   │  └─ initialized = true
   │
   ├─ Render main app content
   │
   ├─ Home component mounts
   │  ├─ useSessionCleanup runs
   │  ├─ Cache cleanup executed
   │  └─ TV ready
   │
   └─ User sees retro TV interface
```

---

## 📍 Feature Location Map

### To Find...

**Configuration**
```
Constants → src/config/constants.js
Environment → src/config/environment.js
```

**API Access**
```
Make API calls → apiService (from @/services)
HTTP Config → apiClient (from @/services)
Endpoints → API_ENDPOINTS in constants
```

**Health Monitoring**
```
Check health → moduleManager.getModule('healthMonitor')
View in admin → Admin Dashboard → API Health
Details → src/admin/sections/APIHealth.jsx
```

**Error Tracking**
```
Record errors → moduleManager.getModule('errorAggregator')
View errors → Admin Dashboard → Component Health
Details → src/admin/sections/ComponentHealth.jsx
```

**Cache Management**
```
Manage cache → moduleManager.getModule('cacheMonitor')
Control cache → Admin Dashboard → Cache Manager
UI → src/admin/sections/CacheManagerUI.jsx
```

**Session Cleanup**
```
Cleanup logic → src/hooks/useSessionCleanup.js
Used in → src/pages/Home.jsx
Config → src/config/constants.js (STORAGE keys)
```

---

## 🎯 How Components Use The System

### Home Component (TV View)
```javascript
import { useSessionCleanup } from '@/hooks'
import { moduleManager } from '@/services'

function Home() {
  // Initialize cleanup
  const cacheMonitor = moduleManager.getModule('cacheMonitor')
  useSessionCleanup(cacheMonitor)
  
  // Make API calls
  const channels = await apiService.getChannels()
  
  // Access monitoring (optional)
  const health = useHealthMonitoring(healthMonitor)
  
  return <TVInterface />
}
```

### Admin Component
```javascript
import { useHealthMonitoring, useMetrics, useErrors } from '@/hooks'
import { moduleManager } from '@/services'

function AdminDashboard() {
  // Subscribe to monitoring
  const health = useHealthMonitoring(healthMonitor)
  const metrics = useMetrics(metricsCollector)
  const errors = useErrors(errorAggregator)
  
  return (
    <div>
      <APIHealth health={health} />
      <ComponentHealth metrics={metrics} errors={errors} />
      <CacheManagerUI />
    </div>
  )
}
```

---

## 🔌 Integration Checklist

To integrate new features:

1. **Configuration**
   - [ ] Add constants to `src/config/constants.js`

2. **API Endpoints**
   - [ ] Add endpoint to `API_ENDPOINTS` in constants
   - [ ] Add method to `src/services/apiService.js`

3. **Monitoring** (if needed)
   - [ ] Error aggregator automatically captures errors
   - [ ] Metrics automatically tracked
   - [ ] Add custom monitoring if needed

4. **Component**
   - [ ] Import `apiService` from `@/services`
   - [ ] Use hooks from `@/hooks` for monitoring
   - [ ] Use `moduleManager.getModule()` for services

5. **Admin** (if needed)
   - [ ] Add new section to `src/admin/sections/`
   - [ ] Import and add to `AdminDashboard.jsx`

---

## ✅ Quality Assurance Checklist

Before deploying:

```
Architecture
  [ ] Modules have single responsibility
  [ ] No circular dependencies
  [ ] Dependency injection working
  [ ] Error handling complete

Services
  [ ] APIClient interceptors working
  [ ] APIService methods callable
  [ ] ModuleManager initializing all modules
  [ ] Modules accessible via getModule()

Monitoring
  [ ] HealthMonitor tracking endpoints
  [ ] MetricsCollector recording data
  [ ] ErrorAggregator storing errors
  [ ] CacheMonitor reporting sizes

Hooks
  [ ] useInitialization works on app start
  [ ] useSessionCleanup clears cache
  [ ] Other hooks update in real-time
  [ ] No memory leaks from subscriptions

Admin
  [ ] APIHealth showing endpoint status
  [ ] CacheManagerUI showing cache control
  [ ] ComponentHealth showing metrics
  [ ] All auto-refresh working

Integration
  [ ] Home.jsx cleanup working
  [ ] Admin sections rendering
  [ ] No console errors
  [ ] No breaking changes
  [ ] Existing features still work
```

---

## 📞 Support & Debugging

### Issue: Modules not initializing
→ Check `useInitialization` hook is in AppInitializer  
→ Check console for initialization errors  
→ Review moduleManager logs

### Issue: API calls failing
→ Check `API_ENDPOINTS` in constants  
→ Check `apiService` methods exist  
→ Check health monitor for endpoint issues

### Issue: Cache not clearing
→ Check `useSessionCleanup` is called  
→ Check `cacheMonitor.fullCleanup()` preservation keys  
→ Check cache manager UI for individual clearing

### Issue: Admin not showing data
→ Check modules are initialized  
→ Check hooks are subscribed  
→ Check admin sections imported correctly

---

**This roadmap serves as a complete reference for understanding, maintaining, and extending the Retro TV application architecture.**
