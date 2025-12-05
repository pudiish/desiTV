# DesiTV™ Security Implementation Guide

## 🔐 Overview

This document describes the comprehensive security implementation for DesiTV™, designed to protect the application while staying within free tier limits of Vercel, Render.com, and MongoDB Atlas.

## 🛡️ Security Features Implemented

### 1. JWT-Based Authentication

**Location:** `server/middleware/auth.js`, `server/routes/auth.js`

```
Admin Login Flow:
1. POST /api/auth/login with username & password
2. Server validates credentials against MongoDB
3. Returns JWT token (valid for 7 days)
4. Client stores token in localStorage
5. All admin requests include Authorization: Bearer <token>
```

**Features:**
- Bcrypt password hashing (12 rounds)
- JWT tokens with 7-day expiry
- Token refresh capability
- Account lockout after 5 failed attempts (15 min)
- Audit logging for admin actions

### 2. Rate Limiting (DDoS Protection)

**Location:** `server/middleware/security.js`

| Limiter | Requests | Window | Purpose |
|---------|----------|--------|---------|
| General | 100 | 15 min | Overall protection |
| Auth | 5 | 15 min | Brute force prevention |
| API | 60 | 1 min | API abuse prevention |
| Admin | 30 | 1 min | Admin action throttling |

### 3. Security Headers (Helmet)

**Configured protections:**
- Content-Security-Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection
- Strict-Transport-Security

**YouTube embedding:** CSP allows YouTube iframe embeds while blocking other sources.

### 4. Input Sanitization

- **MongoDB Sanitization:** Prevents NoSQL injection attacks
- **HPP Protection:** Prevents HTTP Parameter Pollution
- **Request Size Limit:** 1MB maximum request body

### 5. Concurrent User Management

Tracks and limits concurrent connections for free tier optimization:
- Max concurrent users: 50
- Connection cleanup: Every 5 minutes
- Graceful handling when limit reached

## 🔒 Protected Endpoints

### Admin-Only Routes (Require JWT)

| Method | Endpoint | Action |
|--------|----------|--------|
| POST | /api/channels | Create channel |
| POST | /api/channels/:id/videos | Add video |
| DELETE | /api/channels/:id | Delete channel |
| DELETE | /api/channels/:id/videos/:vid | Delete video |
| GET | /api/channels/admin/cache-stats | View cache |

### Public Routes (No Auth Required)

| Method | Endpoint | Action |
|--------|----------|--------|
| GET | /api/channels | List channels |
| GET | /api/channels/:id | Get channel |
| GET | /api/channels/:id/current | Get current video |
| POST | /api/auth/login | Admin login |
| POST | /api/auth/setup | Initial setup |
| GET | /health | Health check |

## 🚀 Free Tier Limits Configuration

```javascript
FREE_TIER_LIMITS = {
  maxConcurrentUsers: 50,
  maxDailyRequests: 10000,
  maxRequestSize: '1mb',
  rateLimits: {
    general: '100 requests per 15 minutes',
    auth: '5 attempts per 15 minutes',
    api: '60 requests per minute',
    admin: '30 requests per minute'
  }
}
```

## 📱 Client-Side Authentication

**Location:** `client/src/services/authService.js`

```javascript
// Login
const result = await login(username, password);

// Check if authenticated
if (isAuthenticated()) { ... }

// Make authenticated request
const response = await authFetch('/api/channels', {
  method: 'POST',
  body: JSON.stringify(data)
});

// Logout
logout();
```

## 🔑 Default Admin Credentials

```
Username: admin
Password: DesiTV2024!
```

**⚠️ IMPORTANT:** Change these in production!

## 🛠️ Testing Security

### Test Rate Limiting
```bash
# Make rapid requests to trigger rate limit
for i in {1..110}; do curl http://localhost:5003/api/channels; done
```

### Test Auth Protection
```bash
# Without token (should fail)
curl -X DELETE http://localhost:5003/api/channels/123
# Response: {"error":"Authentication required","message":"No authorization header provided"}

# With token (should work if channel exists)
curl -X DELETE http://localhost:5003/api/channels/123 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Login Lockout
```bash
# 5 failed attempts will lock the account
for i in {1..6}; do
  curl -X POST http://localhost:5003/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"wrong"}'
done
```

## 📊 Security Monitoring

Check `/health` endpoint for security status:
```json
{
  "status": "ok",
  "security": {
    "rateLimiting": "enabled",
    "helmet": "enabled",
    "mongoSanitize": "enabled",
    "freeTierLimits": { ... }
  }
}
```

## 🌐 Deployment Notes

### Vercel (Frontend)
- CSP headers configured
- No sensitive data in client build
- Environment variables via Vercel dashboard

### Render.com (Backend)
- Set `NODE_ENV=production`
- Configure `JWT_SECRET` in environment
- Enable health checks at `/health`

### MongoDB Atlas
- IP whitelist configured
- Connection pooling (max 10 production, 5 dev)
- Automatic connection retry

## 🔧 Environment Variables

```env
# Server
PORT=5003
NODE_ENV=development
MONGO_URI=mongodb+srv://...
JWT_SECRET=your-256-bit-secret

# Client
VITE_API_BASE=http://localhost:5003
VITE_SERVER_PORT=5003

# Optional
MAX_CONCURRENT_USERS=50
```

## ✅ Security Checklist

- [x] JWT authentication implemented
- [x] Password hashing (bcrypt)
- [x] Rate limiting enabled
- [x] DDoS protection active
- [x] Security headers (Helmet)
- [x] NoSQL injection prevention
- [x] Parameter pollution protection
- [x] Request size limiting
- [x] Concurrent user tracking
- [x] Admin route protection
- [x] Login brute force protection
- [x] Audit logging
- [x] Free tier optimization

---

*Security implementation completed for DesiTV™ v1.0*
*Last updated: December 2024*
