# Chat Deployment Verification Checklist

## Pre-Deployment

- [ ] **Local Testing**
  - [ ] Run `npm run dev` in project root
  - [ ] Chat works locally (type "What's playing?")
  - [ ] Check browser console - no errors about API URLs
  - [ ] Backend is running at `http://localhost:5000`

- [ ] **Environment Variables**
  - [ ] `.env` has `VITE_API_BASE=https://desitv-api.onrender.com`
  - [ ] `.env` has `API_BASE_URL=https://desitv-api.onrender.com/` (for backend)
  - [ ] All other required vars are present

- [ ] **Code Changes**
  - [ ] `client/src/services/apiClientV2.js` - uses `envConfig.apiBaseUrl`
  - [ ] `client/src/config/environment.js` - handles `.onrender.com` domain
  - [ ] No other hardcoded `/api` paths in service files

## Deployment to Render/Vercel

### Render Backend
- [ ] Backend deployment has correct env vars:
  - [ ] `GOOGLE_AI_KEY` set
  - [ ] `MONGO_URI` set
  - [ ] `YOUTUBE_API_KEY` set
  - [ ] `PORT=5000` or similar
- [ ] Verify at: `https://desitv-api.onrender.com/health`
  - [ ] Should return `{"status": "ok", ...}`

### Vercel Frontend
- [ ] Frontend deployment has:
  - [ ] `VITE_API_BASE=https://desitv-api.onrender.com` in Environment Variables
  - [ ] Build command: `cd client && npm run build`
  - [ ] Install command: `npm install`
- [ ] Check deployment logs - no errors

## Post-Deployment Testing

### 1. Basic Connectivity
- [ ] Access frontend: `https://desitv.vercel.app`
- [ ] Page loads without errors
- [ ] Open DevTools Console - no error messages

### 2. API Connectivity
- [ ] Backend health check works
  - [ ] Open in browser: `https://desitv-api.onrender.com/health`
  - [ ] Returns valid JSON with `"status": "ok"`

### 3. Chat Functionality
- [ ] Click chat icon 🤖
- [ ] Greeting message appears
- [ ] Type test message: "What's playing?"
- [ ] AI responds (not the "not sure" error)

### 4. Network Verification
- [ ] Open DevTools → Network tab
- [ ] Send chat message
- [ ] Check request details:
  - [ ] **URL**: `https://desitv-api.onrender.com/api/chat/message`
  - [ ] **Status**: `200` (not 404 or 500)
  - [ ] **Response**: `{"response": "...", "sessionId": "...", ...}`

### 5. Browser Console Verification
- [ ] Open DevTools → Console tab
- [ ] Send chat message
- [ ] Look for log: `[APIClientV2] POST https://desitv-api.onrender.com/api/chat/message`
  - [ ] This confirms correct URL is being used

## Troubleshooting

### Chat Returns "Not sure" or No Response
1. Check backend logs on Render:
   - [ ] Look for chat route logs
   - [ ] Check for AI API key errors
   - [ ] Verify EnhancedVJCore initialization

2. Verify API key:
   - [ ] GOOGLE_AI_KEY is set on backend
   - [ ] Key is valid and has quota

### CORS Error in Console
```
Access to XMLHttpRequest at 'https://desitv-api.onrender.com/api/chat/message'
from origin 'https://desitv.vercel.app' has been blocked by CORS policy
```
- [ ] Backend CORS is configured (check server/index.js)
- [ ] Vercel domain matches CORS whitelist
- [ ] Restart backend after CORS changes

### Chat URL Shows Wrong Domain
- [ ] Verify `VITE_API_BASE` is set in Vercel environment
- [ ] Rebuild frontend on Vercel
- [ ] Clear browser cache (Ctrl+Shift+R)

### Backend 404 for Chat Endpoint
- [ ] Verify chat route is mounted: `/api/chat` in server/index.js
- [ ] Check route file exists: `server/routes/chat.js`
- [ ] Backend has no syntax errors (check logs)

## Quick Debug Commands

### Check Frontend Config
In browser console:
```javascript
// Should show correct API base URL
localStorage.getItem('desitv-debug') === 'true' ? 'debug on' : 'debug off'
// Or import and check:
import { envConfig } from '/path/to/config/environment'
console.log(envConfig.apiBaseUrl)
```

### Test Backend Directly
```bash
# From any terminal, test the backend API
curl -X POST https://desitv-api.onrender.com/api/chat/message \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","sessionId":"test"}'

# Should return chat response, not 404
```

### Monitor Backend Logs
- [ ] Render Dashboard → Service → Logs
- [ ] Watch for incoming chat requests
- [ ] Look for any error messages

## Rollback Plan

If chat stops working after deployment:

1. **Immediate**: Revert frontend deployment
   - [ ] Vercel → Deployments → Click previous working version

2. **Debug**: Check what changed
   - [ ] Verify env vars weren't accidentally cleared
   - [ ] Check if backend IP/URL changed

3. **Re-deploy**: After fixes
   - [ ] Verify changes locally first
   - [ ] Push to main branch
   - [ ] Trigger new deployment

## Success Criteria ✅

- [ ] Chat opens without errors
- [ ] Can send messages
- [ ] Receive AI responses (not "not sure")
- [ ] Network requests go to correct backend URL
- [ ] Works on both mobile and desktop browsers
- [ ] No CORS errors in console
- [ ] Responses are fast (< 3 seconds)

---

**Last Updated**: January 3, 2026  
**Status**: Ready for Deployment
