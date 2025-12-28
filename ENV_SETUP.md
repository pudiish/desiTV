# Environment Variables Setup Guide

## Quick Answer: Redis Password

**❌ NO, Redis password is NOT required for local Redis!**

- ✅ **Local Redis is FREE and OFFLINE** - runs on your machine
- ✅ **No password by default** - works out of the box
- ✅ **No internet needed** - completely local

**Password is ONLY needed for:**
- 🔒 Remote Redis (Redis Cloud, AWS, etc.)
- 🔒 Production servers with security enabled
- 🔒 If you manually enabled password protection

---

## ✅ Vercel + Render.com Compatibility

**YES! Your setup is fully compatible with Vercel and Render.com!**

- ✅ **Vercel** (Frontend): Already configured in `client/vercel.json`
- ✅ **Render.com** (Backend): Already configured in `server/render.yaml`
- ✅ **Redis**: Works with Render Redis, Redis Cloud, or Upstash
- ✅ **MongoDB**: Use MongoDB Atlas (free tier available)

**See `DEPLOYMENT_GUIDE.md` for complete deployment instructions!**

---

## Create `.env` File

Create a `.env` file in the project root (`/Users/ishwarswarnapudi/Desktop/DesiTV/desiTV/.env`) with:

```bash
# ============================================
# DesiTV™ Environment Configuration
# ============================================

# ============================================
# Server Configuration
# ============================================
PORT=5000
NODE_ENV=development

# ============================================
# MongoDB Configuration
# ============================================
MONGO_URI=mongodb://localhost:27017/desitv

# ============================================
# Redis Configuration
# ============================================
# Redis URL - Default is local Redis (no password needed)
REDIS_URL=redis://localhost:6379

# Redis Password - NOT REQUIRED for local Redis
# Only needed for remote Redis or if you enabled password protection
# Leave commented out for local Redis (default)
# REDIS_PASSWORD=

# Enable in-memory fallback if Redis is unavailable
# false = Use Redis only (will fail if Redis unavailable) - CURRENT SETTING
# true = Fallback to in-memory cache if Redis unavailable
REDIS_FALLBACK_ENABLED=false

# ============================================
# Security & Authentication
# ============================================
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SESSION_SECRET=your-super-secret-session-key-change-this-in-production

# ============================================
# CORS Configuration
# ============================================
CORS_ORIGIN=http://localhost:5173
```

---

## Quick Setup Commands

### 1. Create `.env` file:
```bash
cd /Users/ishwarswarnapudi/Desktop/DesiTV/desiTV
cat > .env << 'EOF'
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/desitv
REDIS_URL=redis://localhost:6379
REDIS_FALLBACK_ENABLED=false
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
SESSION_SECRET=your-super-secret-session-key-change-this-in-production
CORS_ORIGIN=http://localhost:5173
EOF
```

### 2. Verify Redis is running (no password needed):
```bash
redis-cli ping
# Should return: PONG
```

### 3. Start your server:
```bash
./start.sh
```

---

## Redis Password Explained

### Local Redis (Your Current Setup)
```bash
# ✅ This works - no password needed
REDIS_URL=redis://localhost:6379
# REDIS_PASSWORD=  ← Leave this commented out or don't set it
```

**Why no password?**
- Local Redis runs on your machine
- By default, Redis has no authentication
- It's only accessible from localhost
- Perfect for development!

### Remote Redis (When Password IS Needed)
```bash
# 🔒 For Redis Cloud, AWS ElastiCache, etc.
REDIS_URL=redis://your-redis-server.com:6379
REDIS_PASSWORD=your-actual-password-here
```

**When you need password:**
- Using Redis Cloud (free tier available)
- AWS ElastiCache
- DigitalOcean Managed Redis
- Any remote Redis server
- Production servers with security enabled

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `5000` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `MONGO_URI` | Yes | - | MongoDB connection string |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL |
| `REDIS_PASSWORD` | No | - | Redis password (only for remote/secure Redis) |
| `REDIS_FALLBACK_ENABLED` | No | `false` | Enable in-memory fallback |
| `JWT_SECRET` | Yes | - | JWT signing secret |
| `SESSION_SECRET` | Yes | - | Session encryption secret |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origin |

---

## Troubleshooting

### "Redis connection refused"
```bash
# Start Redis server
redis-server

# Or on macOS with Homebrew
brew services start redis
```

### "MongoDB connection failed"
```bash
# Start MongoDB
mongod

# Or on macOS with Homebrew
brew services start mongodb-community
```

### "Cannot find module 'redis'"
```bash
cd server
npm install redis
```

---

## Summary

✅ **For local development:**
- No Redis password needed
- Just set `REDIS_URL=redis://localhost:6379`
- Leave `REDIS_PASSWORD` commented out
- Redis is free and runs offline on your machine

🔒 **For production/remote:**
- Set `REDIS_PASSWORD` if using remote Redis
- Or if you manually enabled password protection

That's it! Your local Redis setup is simple and password-free! 🎉

