# Remaining Issues to Fix - Priority List

**Last Updated**: 2025-01-27  
**Status**: Based on Project Analysis Report

---

## ✅ COMPLETED (Already Fixed)

1. ✅ **Replaced `axios` with `fetch`** - Done
2. ✅ **Removed `clsx` and `tailwind-merge`** - Done (custom implementations)
3. ✅ **Added React Error Boundaries** - Done
4. ✅ **Removed `react-youtube`** - Done

---

## 🔴 HIGH PRIORITY (Fix Soon)

### 1. **Add Error Tracking Service**
**Status**: ❌ Not Started  
**Priority**: HIGH  
**Effort**: Medium (2-3 hours)

**Issue**: Errors only logged to console, no production monitoring

**Solution**:
- Integrate Sentry or LogRocket
- Add error tracking to ErrorBoundary
- Track API errors
- Set up alerts

**Files to Modify**:
- `client/src/components/ErrorBoundary.jsx` - Add Sentry integration
- `client/src/main.jsx` - Initialize error tracking
- `server/middleware/errorHandler.js` - Add error tracking

---

### 2. **Memory Leak Audit**
**Status**: ❌ Not Started  
**Priority**: HIGH  
**Effort**: Medium (3-4 hours)

**Issue**: 105 intervals/timeouts - potential memory leaks

**Solution**:
- Audit all `setInterval`/`setTimeout` calls
- Verify cleanup in `useEffect` return functions
- Add interval tracking system
- Test for memory leaks

**Files to Check**:
- All components with intervals/timeouts
- `client/src/components/Player.jsx` - Multiple intervals
- `client/src/pages/Home.jsx` - Multiple intervals
- `client/src/logic/broadcast/BroadcastStateManager.js` - Auto-save interval

**Action Items**:
```javascript
// Add to each component with intervals:
useEffect(() => {
  const intervalId = setInterval(() => {
    // ... code
  }, delay);
  
  return () => clearInterval(intervalId); // ✅ Verify this exists
}, [dependencies]);
```

---

### 3. **Add Unit Tests**
**Status**: ❌ Not Started  
**Priority**: HIGH  
**Effort**: High (1-2 weeks)

**Issue**: No test coverage - bugs may go undetected

**Solution**:
- Set up Jest + React Testing Library
- Write tests for critical components
- Test utility functions
- Test API routes

**Files to Create**:
- `client/src/lib/utils.test.js` - Test custom utilities
- `client/src/components/ErrorBoundary.test.jsx` - Test error boundary
- `client/src/logic/broadcast/BroadcastStateManager.test.js` - Test state manager
- `server/routes/channels.test.js` - Test API routes

**Setup**:
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom
```

---

### 4. **HTTPS Enforcement**
**Status**: ❌ Not Started  
**Priority**: HIGH  
**Effort**: Low (30 minutes)

**Issue**: No HTTPS redirect in production

**Solution**:
- Add middleware to redirect HTTP to HTTPS
- Only in production mode

**File to Modify**:
- `server/index.js` - Add HTTPS redirect middleware

**Code**:
```javascript
// Add after security middleware
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

---

## 🟡 MEDIUM PRIORITY (Fix This Month)

### 5. **CSRF Protection**
**Status**: ❌ Not Started  
**Priority**: MEDIUM  
**Effort**: Medium (2-3 hours)

**Issue**: Missing CSRF tokens - security risk

**Solution**:
- Add CSRF middleware
- Generate tokens for forms
- Validate on state-changing requests

**Files to Modify**:
- `server/middleware/security.js` - Add CSRF middleware
- `client/src/services/apiClient.js` - Add CSRF token to requests

---

### 6. **Bundle Analysis & Optimization**
**Status**: ❌ Not Started  
**Priority**: MEDIUM  
**Effort**: Medium (2-3 hours)

**Issue**: No bundle analysis - don't know what's large

**Solution**:
- Install bundle analyzer
- Identify large dependencies
- Optimize code splitting
- Remove unused code

**Setup**:
```bash
npm install --save-dev rollup-plugin-visualizer
# or
npm install --save-dev webpack-bundle-analyzer
```

**Action**:
- Analyze current bundle
- Identify optimization opportunities
- Implement code splitting improvements

---

### 7. **Replace More Dependencies**
**Status**: ❌ Not Started  
**Priority**: MEDIUM  
**Effort**: Medium (4-6 hours)

**Remaining Replaceable Dependencies**:

1. **`express-validator`** → Custom validation
   - Simple validation functions
   - Reduce bundle size

2. **`express-rate-limit`** → Custom limiter
   - In-memory rate limiter
   - More control

3. **`cors`** → Custom CORS handler
   - Simple CORS logic
   - Reduce dependency

**Files to Modify**:
- `server/middleware/security.js` - Replace rate limiter
- `server/index.js` - Replace CORS
- Create `server/middleware/validation.js` - Custom validation

---

### 8. **Async localStorage Operations**
**Status**: ❌ Not Started  
**Priority**: MEDIUM  
**Effort**: Medium (3-4 hours)

**Issue**: Synchronous localStorage blocks UI

**Solution**:
- Use IndexedDB for large data
- Async state saves
- Web Workers for heavy computations

**Files to Modify**:
- `client/src/utils/SessionManager.js` - Use IndexedDB
- `client/src/logic/broadcast/BroadcastStateManager.js` - Async saves

---

## 🟢 LOW PRIORITY (Nice to Have)

### 9. **Service Worker for Offline Support**
**Status**: ❌ Not Started  
**Priority**: LOW  
**Effort**: High (1 week)

**Issue**: No offline functionality

**Solution**:
- Add service worker
- Cache static assets
- Offline page support
- Background sync

---

### 10. **Multiple Video Sources**
**Status**: ❌ Not Started  
**Priority**: LOW  
**Effort**: High (1 week)

**Issue**: Single point of failure (YouTube only)

**Solution**:
- Add Vimeo/Dailymotion as backup
- Fallback chain: YouTube → Vimeo → Error

---

### 11. **Database Connection Retry Logic**
**Status**: ❌ Not Started  
**Priority**: LOW  
**Effort**: Medium (2-3 hours)

**Issue**: No retry on database connection failure

**Solution**:
- Add connection retry with exponential backoff
- Graceful degradation if DB unavailable

**File to Modify**:
- `server/index.js` - MongoDB connection logic

---

### 12. **Binary Search for Large Playlists**
**Status**: ❌ Not Started  
**Priority**: LOW  
**Effort**: Low (1-2 hours)

**Issue**: Linear search O(n) for position calculation

**Solution**:
- Use binary search for playlists with 100+ videos
- Improve from O(n) to O(log n)

**File to Modify**:
- `client/src/logic/broadcast/BroadcastStateManager.js` - Position calculation

---

### 13. **Memoization of Expensive Calculations**
**Status**: ❌ Not Started  
**Priority**: LOW  
**Effort**: Low (1-2 hours)

**Issue**: Position calculations repeated unnecessarily

**Solution**:
- Add `useMemo` for expensive calculations
- Cache computed values

**Files to Modify**:
- `client/src/hooks/useBroadcastPosition.js` - Add memoization
- Components using position calculations

---

## 📊 Summary by Priority

### High Priority (4 items)
1. Error Tracking Service
2. Memory Leak Audit
3. Unit Tests
4. HTTPS Enforcement

**Estimated Time**: 1-2 weeks

### Medium Priority (4 items)
5. CSRF Protection
6. Bundle Analysis
7. Replace More Dependencies
8. Async localStorage

**Estimated Time**: 2-3 weeks

### Low Priority (5 items)
9. Service Worker
10. Multiple Video Sources
11. Database Retry Logic
12. Binary Search Optimization
13. Memoization

**Estimated Time**: 3-4 weeks

---

## 🎯 Recommended Order

### Week 1-2 (Critical)
1. ✅ Error Tracking (Sentry)
2. ✅ Memory Leak Audit
3. ✅ HTTPS Enforcement
4. ✅ Start Unit Tests (basic setup)

### Week 3-4 (Important)
5. ✅ CSRF Protection
6. ✅ Bundle Analysis
7. ✅ Replace express-validator
8. ✅ Replace express-rate-limit

### Month 2+ (Enhancements)
9. ✅ Service Worker
10. ✅ Multiple Video Sources
11. ✅ Database Retry Logic
12. ✅ Performance Optimizations

---

## 📝 Quick Reference

**Total Issues Remaining**: 13  
**High Priority**: 4  
**Medium Priority**: 4  
**Low Priority**: 5  

**Estimated Total Time**: 6-8 weeks for all issues

**Next Immediate Action**: Set up error tracking (Sentry) - 2-3 hours

---

## 🔗 Related Documents

- `PROJECT_ANALYSIS_REPORT.md` - Full analysis
- `FIXES_APPLIED.md` - What's been fixed
- `TEST_RESULTS.md` - Test verification

