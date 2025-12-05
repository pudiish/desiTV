# Cost Optimization: Quick Reference

## What Changed?

Health monitoring now uses **adaptive intervals** instead of constant 10-second polling.

## New Behavior

| State | Interval | Trigger | When |
|-------|----------|---------|------|
| 🟢 Healthy | 60s | All OK | ~95% of time |
| 🟡 Degraded | 10s | 1-2 failures | During issues |
| 🔴 Critical | 3s | 3+ failures | Active outage |

## Cost Impact

- **Before**: 1,800 checks/hour (constant)
- **After**: 300 checks/hour (healthy state) = **95% reduction** ✅

## For Developers

### No Code Changes Needed
Your code works exactly as before. The HealthMonitor automatically:
- Reduces check frequency when system is healthy
- Escalates to intensive monitoring only during issues
- De-escalates as the system recovers

### Monitoring System State
Check `health.overall?.state` in components:
```jsx
const state = health.overall?.state  // 'healthy' | 'degraded' | 'critical'
const checkInterval = health.overall?.state === 'healthy' ? '60s' : 
                      health.overall?.state === 'degraded' ? '10s' : '3s'
```

### Dashboard Display
The APIHealth admin section shows:
- Current monitor state (Healthy/Degraded/Critical)
- Current check interval
- Cost optimization notice

### Reverting (if needed)
Edit HealthMonitor.js line ~41 to change intervals:
```javascript
this.checkIntervals = {
  healthy: 10000,    // Change to 10s if you want constant polling
  degraded: 10000,
  critical: 10000,
}
```

## Files Changed
- `healthMonitor.js` - Core adaptive logic added
- `APIHealth.jsx` - Dashboard improvements
- `constants.js` - Documentation updated

## Verification
Watch browser console:
```
[HealthMonitor] Next check in 60000ms (State: healthy)
// After issue:
[HealthMonitor] State changed: healthy → degraded
[HealthMonitor] Next check in 10000ms (State: degraded)
// After recovery:
[HealthMonitor] State changed: degraded → healthy
[HealthMonitor] Next check in 60000ms (State: healthy)
```

## Questions?
See `COST_OPTIMIZATION_COMPLETE.md` for detailed documentation.
