# 🖥️ System Monitor & Health Dashboard - Complete Guide

## 📋 Overview

The new **System Monitor** dashboard provides comprehensive real-time monitoring and control of all system services with visual health indicators and restart capabilities.

## 🎯 Features

### 1. **Overall System Status**
```
┌─────────────────────────────────────────────────────────┐
│  🟢 HEALTHY                                    [🔄 Restart]
│  Health: 100% | Uptime: 45m                            │
└─────────────────────────────────────────────────────────┘
```

**Status Levels:**
- 🟢 **HEALTHY** (100%) - All systems operational
- 🟡 **DEGRADED** (75-99%) - Minor issues detected
- 🟠 **WARNING** (50-74%) - Multiple issues affecting performance
- 🔴 **CRITICAL** (<50%) - System requires immediate attention

### 2. **Service Status Cards**

Four main services monitored:

#### 🏥 **Health Monitor**
- Tracks API endpoint health
- Automatic periodic health checks (every 10 seconds)
- Restart capability to reset monitoring

#### 📊 **Metrics Collector**
- Counts total API calls made
- Tracks success/failure rates
- Measures response times
- Restart clears metrics and restarts collection

#### 💾 **Cache Monitor**
- Shows total cache usage in MB
- Monitors localStorage, sessionStorage, browser cache
- Restart performs full cleanup while preserving essential keys

#### ⚠️ **Error Tracking**
- Records all errors in the system
- Categorizes by severity and type
- Restart clears error history

### 3. **Endpoint Health Monitoring**

Real-time status of all API endpoints:
```
/health                          🟢 2ms
/api/channels                    🟢 45ms
/api/broadcast-state/all         🟢 89ms
```

**Status Indicators:**
- 🟢 Healthy (response < 1s)
- 🟡 Slow (response 1-2s)
- 🔴 Unhealthy (timeout or error)

### 4. **Performance Metrics**

| Metric | Meaning |
|--------|---------|
| **API Calls** | Total number of API requests made |
| **Failed Requests** | Number of failed API calls |
| **Avg Response Time** | Average API response time in milliseconds |
| **Cache Hit Rate** | Percentage of cached responses used |

### 5. **Restart Mechanisms**

#### Individual Service Restart
- Click "↻ Restart" button on any service card
- Services restart independently without affecting others
- Logged in restart log for audit trail

#### Full System Restart
- Click "[🔄 Full Restart]" button at top
- Restarts ALL services simultaneously
- Clears metrics and cache
- Preserves essential session keys

#### Auto-Restart Setting
- Toggle "Auto-restart failed services"
- When enabled: Failed services automatically restart
- When disabled: Manual restart required

### 6. **Restart Log**

Displays audit trail of all system operations:
```
14:32:15 - Full system restart initiated...
14:32:15 - Restarting Health Monitor...
14:32:15 - ✓ Health Monitor restarted successfully
14:32:15 - Restarting Cache Monitor...
14:32:15 - ✓ Cache Monitor restarted successfully
14:32:15 - ✓ System fully restarted
```

## 🔄 How to Use

### Accessing the Dashboard

1. Click ⚙️ button in TV interface
2. Wait for initialization (1-2 seconds)
3. Click 🖥️ **System Monitor** in sidebar (top item)

### Checking System Health

1. Look at overall status card at top
2. Green = Good, Yellow = Investigate, Red = Action needed
3. Check individual service cards for details

### Restarting a Service

1. Find the service card (e.g., "Health Monitor")
2. Click "↻ Restart" button
3. Watch restart log for confirmation
4. Service will restart and resume monitoring

### Performing Full System Restart

1. Click "[🔄 Full Restart]" button (top right)
2. System will restart all services
3. Check restart log to verify completion
4. All services should show as operational

### Managing Auto-Restart

1. Scroll to "⚙️ Settings" section
2. Toggle "Auto-restart failed services" checkbox
3. Current status shown below toggle
4. Enable for production, disable for debugging

## 📊 Understanding the Metrics

### API Calls
```
Shows total number of API requests since app loaded
Increases with user interaction and background tasks
Success count shows working requests
```

### Failed Requests
```
Counts errors (404, 500, timeouts, etc.)
Green if ≤ 5 errors, Red if > 5 errors
Restart clears this counter
```

### Response Time
```
Milliseconds (ms) for average API response
Lower is better (target < 100ms)
Helps identify slow endpoints
```

### Cache Hit Rate
```
Percentage of requests served from cache
Higher percentage = better performance
100% = all requests cached (may be debugging issue)
0% = no caching enabled
```

## 🎯 Common Scenarios

### Scenario 1: Slow API Responses
**Symptoms:** Red status, high response time
**Action:**
1. Check "Avg Response Time" metric
2. Review individual endpoint latencies
3. Click "↻ Restart" on Health Monitor
4. If persists, restart full system

### Scenario 2: Many Errors Accumulating
**Symptoms:** High failed request count, warning status
**Action:**
1. Check error tracking service
2. Note which endpoints are failing
3. Click "↻ Restart" on error tracking
4. Fix backend issues if needed

### Scenario 3: High Memory Usage
**Symptoms:** Large cache size, degraded performance
**Action:**
1. Check cache size in Cache Monitor
2. Click "↻ Restart" on Cache Monitor
3. Cache will be cleaned (essential keys preserved)
4. If auto-restart enabled, will restart automatically

### Scenario 4: System Becoming Unresponsive
**Symptoms:** Multiple degraded services, status warning/critical
**Action:**
1. Click "[🔄 Full Restart]" button
2. All services will reinitialize
3. Watch restart log for completion
4. System should return to normal

## ⚙️ Configuration

To adjust monitoring intervals, edit:

```javascript
// client/src/config/constants.js

export const TIMING = {
  HEALTH_CHECK_INTERVAL: 10000,  // Check health every 10 seconds
  API_HEALTH_TIMEOUT: 5000,      // Timeout API calls after 5 seconds
  // ... other timings
}
```

## 🔗 Related Endpoints

The system monitors these backend endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Basic health status |
| `/api/channels` | GET | Channel service health |
| `/api/broadcast-state/all` | GET | Broadcast state service health |

**Note:** Added `/api/broadcast-state/all` endpoint in backend to fix 404 error

## 📈 Best Practices

1. **Regular Monitoring**
   - Check system monitor daily
   - Look for any yellow/red indicators
   - Address warnings promptly

2. **Proactive Restarts**
   - Restart services during low-traffic periods
   - Use full restart weekly for maintenance
   - Enable auto-restart in production

3. **Log Analysis**
   - Review restart logs for patterns
   - Check if services restart frequently
   - Investigate root causes of failures

4. **Cache Management**
   - Restart cache monitor if memory usage grows
   - Monitor cache hit rate for efficiency
   - Full system restart clears all caches

5. **Production Readiness**
   - Enable auto-restart before going live
   - Document monitoring procedures
   - Set up alerts for critical status

## 🚀 Quick Actions

| Problem | Quick Fix |
|---------|-----------|
| Slow API response | Click restart on Health Monitor |
| Memory usage high | Click restart on Cache Monitor |
| Errors accumulating | Click restart on Error Tracking |
| Everything slow | Click [🔄 Full Restart] |
| Need to clear cache | Restart Cache Monitor |

## 📱 Visual Indicators

### Status Symbols
- 🟢 Healthy / Working
- 🟡 Degraded / Warning
- 🟠 Caution / Needs attention
- 🔴 Critical / Action required

### Action Buttons
- ↻ Restart individual service
- 🔄 Full system restart
- ⚙️ Settings/configuration

### Icons by Section
- 🖥️ System Monitor (overall)
- 🏥 Health Monitor
- 📊 Metrics Collector
- 💾 Cache Monitor
- ⚠️ Error Tracking

## 🔍 Troubleshooting

**Issue:** System Monitor shows "initializing"
- **Fix:** Wait 1-2 seconds for modules to load

**Issue:** All services show yellow/degraded
- **Fix:** Click "[🔄 Full Restart]" to reinitialize

**Issue:** Restart button doesn't respond
- **Fix:** Reload the admin dashboard (F5)

**Issue:** Cache not clearing
- **Fix:** Check browser dev tools, may need hard refresh

## 📞 Support

For issues with the System Monitor:
1. Check restart log for error messages
2. Review component health metrics
3. Verify backend endpoints are responding
4. Contact development team if persistent

---

**System Monitor is now your central hub for maintaining optimal system performance!**

