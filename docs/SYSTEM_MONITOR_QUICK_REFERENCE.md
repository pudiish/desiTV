# 🎛️ QUICK REFERENCE - System Monitor

## 🚀 Quick Start
1. Click ⚙️ admin button
2. Click 🖥️ **System Monitor** (top menu item)
3. View real-time system health

## 📊 Dashboard Layout

```
┌────────────────────────────────────────────────┐
│ 🖥️ SYSTEM MONITOR                              │
├────────────────────────────────────────────────┤
│                                                │
│  [Overall Status Card with Restart Button]    │
│                                                │
│  [🏥 Health] [📊 Metrics] [💾 Cache] [⚠️ Err]  │
│                                                │
│  [Endpoint Health List]                       │
│                                                │
│  [Metrics Grid: Calls | Failures | Time | Hit]│
│                                                │
│  [Auto-Restart Toggle]                        │
│                                                │
│  [Restart Log Output]                         │
│                                                │
└────────────────────────────────────────────────┘
```

## 🎯 Status Meanings

| Status | Color | Meaning | Action |
|--------|-------|---------|--------|
| HEALTHY | 🟢 | Working perfect | Monitor |
| DEGRADED | 🟡 | Minor issues | Investigate |
| WARNING | 🟠 | Multiple issues | Restart service |
| CRITICAL | 🔴 | Serious problems | Full restart |

## 🔄 How to Restart

### Restart One Service
```
1. Find service card (e.g., "🏥 Health Monitor")
2. Click "↻ Restart" button
3. Watch restart log for ✓ confirmation
4. Status returns to normal
```

### Restart Everything
```
1. Click "[🔄 Full Restart]" button (top right)
2. All services restart simultaneously
3. Watch restart log for "✓ System fully restarted"
4. All services should show healthy
```

### Enable Auto-Restart
```
1. Scroll to "⚙️ Settings" section
2. Check "Auto-restart failed services"
3. Services now restart automatically on failure
4. Recommended for production
```

## 📈 Key Metrics

| Metric | What It Shows | Good Range |
|--------|---------------|-----------|
| **API Calls** | Total requests | Increases with use |
| **Failed Requests** | Errors | ≤ 5 is good |
| **Response Time** | API speed | < 100ms is good |
| **Cache Hit Rate** | Cache efficiency | > 50% is good |

## 🟢 Green Indicators

✓ Health is 100%
✓ All endpoints responding
✓ Response times < 100ms
✓ Few/no errors
✓ Cache hit rate high
✓ Uptime increasing
✓ No recent restarts

## 🔴 Red Flags

✗ Health < 50%
✗ Endpoints timing out
✗ Response times > 500ms
✗ Multiple failed requests
✗ Cache errors
✗ Frequent restarts
✗ Auto-restart toggling on/off

## 📝 Restart Log Guide

| Message | Meaning |
|---------|---------|
| `Restart initiated` | Service is stopping |
| `Restarting...` | Service is restarting |
| `✓ restarted successfully` | Service is back online |
| `System fully restarted` | All services restored |

## 🔧 Troubleshooting

### Monitor shows "initializing"
**Wait 1-2 seconds** for modules to load

### All services showing degraded
**Click [🔄 Full Restart]** at top

### Cache not clearing  
**Ensure modules are initialized**, then restart cache

### Nothing responding
**Reload page** (F5) and try again

### Restart button grayed out
**Click it again**, or reload admin page

## ⚡ 1-Click Fixes

| Problem | Fix |
|---------|-----|
| Slow API | Restart Health Monitor ↻ |
| High memory | Restart Cache Monitor ↻ |
| Lots of errors | Restart Error Tracking ↻ |
| Everything slow | [🔄 Full Restart] |

## 📞 What Each Service Does

### 🏥 Health Monitor
- **Monitors:** API endpoint health
- **Checks:** Response times and status
- **Restart:** Clears health history, resumes checking

### 📊 Metrics Collector  
- **Tracks:** API calls, successes, failures
- **Measures:** Response times
- **Restart:** Clears counters, starts fresh

### 💾 Cache Monitor
- **Watches:** localStorage, sessionStorage, browser cache
- **Measures:** Cache size and hit rate
- **Restart:** Cleans cache, keeps essential keys

### ⚠️ Error Tracking
- **Records:** All errors in system
- **Categorizes:** By type and severity
- **Restart:** Clears error history

## 🎮 Button Reference

| Button | Does | Location |
|--------|------|----------|
| `↻ Restart` | Restart one service | Each service card |
| `🔄 Full Restart` | Restart all services | Top right |
| `Auto-restart toggle` | Enable/disable auto restart | Settings section |
| `Refresh Now` | Manual health check | API Health section |
| `Clear Cache` | Clean cache manually | Cache Manager section |

## 📱 Mobile Tips

- Collapse sidebar to see more
- Scroll down for all metrics
- Buttons are touch-friendly
- Tap and hold for info

## 🌙 Retro Theme Colors

- **Green:** `#00ff88` (working)
- **Bright Green:** `#00ff00` (active)
- **Red:** `#ff0000` (errors)
- **Yellow:** `#ffff00` (warning)
- **Orange:** `#ffa500` (caution)

## 💡 Pro Tips

1. **Check regularly** - Quick glance daily
2. **Act on yellow** - Don't wait for red
3. **Use Full Restart** - Better than individual restarts
4. **Enable auto-restart** - For production stability
5. **Review logs** - Spot patterns of failures
6. **Clear cache** - If memory usage grows
7. **Monitor response time** - Early warning sign

## 🎯 Best Practice Schedule

| Frequency | Action |
|-----------|--------|
| **Daily** | Quick health check (1 min) |
| **Weekly** | Review restart log, full restart |
| **Monthly** | Performance analysis, tuning |
| **Quarterly** | Deep diagnostic, optimization |

---

**Remember:** 🟢 Green is good, 🔴 Red needs action!

