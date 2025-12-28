# Deployment Guide: Vercel + Render.com

This guide covers deploying DesiTV™ to **Vercel (frontend)** and **Render.com (backend)** with Redis support.

---

## Architecture Overview

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Vercel        │         │   Render.com     │         │  MongoDB     │
│   (Frontend)    │ ──────> │   (Backend API)  │ ──────> │  Atlas       │
│   React/Vite    │         │   Node.js/Express│         │  (Cloud)     │
└─────────────────┘         └──────────────────┘         └──────────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │   Render Redis   │
                            │   (or External)  │
                            └──────────────────┘
```

---

## Part 1: Render.com Backend Setup

### Step 1: Create Redis Service (Recommended)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Redis"**
3. Configure:
   - **Name**: `desitv-redis`
   - **Plan**: `Free` (25MB, 10 connections) or `Starter` ($10/mo for production)
   - **Region**: `Singapore` (closest to India)
4. Click **"Create Redis"**
5. Copy the **Internal Redis URL** (looks like `redis://red-xxxxx:6379`)

### Step 2: Deploy Backend API

1. **Connect Repository**:
   - Go to Render Dashboard
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository
   - Select the repository

2. **Configure Service**:
   - **Name**: `desitv-api`
   - **Root Directory**: `server`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free` (spins down after 15min) or `Starter` ($7/mo, always-on)

3. **Environment Variables** (in Render Dashboard):
   ```bash
   NODE_ENV=production
   PORT=10000  # Render assigns this automatically
   
   # MongoDB (use MongoDB Atlas - free tier available)
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/desitv
   
   # Redis (from Step 1 - Internal URL)
   REDIS_URL=redis://red-xxxxx:6379
   # OR use external Redis (Redis Cloud, Upstash):
   # REDIS_URL=redis://username:password@redis-xxxxx.cloud.redislabs.com:12345
   # REDIS_PASSWORD=your-password
   
   # Redis Configuration
   REDIS_FALLBACK_ENABLED=false  # Use Redis only in production
   
   # Security
   JWT_SECRET=your-super-secret-jwt-key-min-32-chars
   SESSION_SECRET=your-super-secret-session-key-min-32-chars
   
   # CORS (your Vercel frontend URL)
   CORS_ORIGIN=https://your-app.vercel.app
   ```

4. **Deploy**: Click **"Create Web Service"**

### Step 3: Get Backend URL

After deployment, you'll get a URL like:
```
https://desitv-api.onrender.com
```

**Note**: Free tier spins down after 15min of inactivity. First request may take 30-60s to wake up.

---

## Part 2: Vercel Frontend Setup

### Step 1: Deploy to Vercel

1. **Connect Repository**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click **"Add New..."** → **"Project"**
   - Import your GitHub repository

2. **Configure Project**:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Environment Variables**:
   ```bash
   VITE_API_BASE=https://desitv-api.onrender.com
   ```

4. **Deploy**: Click **"Deploy"**

### Step 2: Update vercel.json (Already Configured)

The `client/vercel.json` is already configured to:
- Rewrite `/api/*` requests to your Render backend
- Set proper security headers
- Handle SPA routing

**No changes needed** - it's already set up! ✅

---

## Part 3: Redis Options

### Option A: Render Redis (Recommended for Render.com)

✅ **Pros**:
- Free tier available (25MB)
- Automatic connection string
- Same network (faster)
- No password needed

❌ **Cons**:
- Limited to 25MB on free tier
- Only accessible from Render services

**Setup**: Already configured in `render.yaml` ✅

### Option B: Redis Cloud (Recommended for Production)

✅ **Pros**:
- 30MB free tier
- Global distribution
- Works with Vercel + Render
- Better performance

❌ **Cons**:
- Requires password
- External service

**Setup**:
1. Sign up at [Redis Cloud](https://redis.com/try-free/)
2. Create a free database
3. Get connection string: `redis://default:password@host:port`
4. Set in Render:
   ```bash
   REDIS_URL=redis://default:password@host:port
   REDIS_PASSWORD=password
   ```

### Option C: Upstash (Recommended for Vercel)

✅ **Pros**:
- Serverless Redis
- Perfect for Vercel serverless functions
- 10K commands/day free
- Global edge network

❌ **Cons**:
- Rate limits on free tier
- Better for serverless than long-running servers

**Setup**:
1. Sign up at [Upstash](https://upstash.com/)
2. Create Redis database
3. Get REST API URL (for serverless) or Redis URL
4. Set in Render:
   ```bash
   REDIS_URL=redis://default:password@host:port
   REDIS_PASSWORD=password
   ```

---

## Part 4: MongoDB Setup

### MongoDB Atlas (Free Tier)

1. Sign up at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster (M0 - 512MB)
3. Create database user
4. Whitelist Render IP: `0.0.0.0/0` (or specific Render IPs)
5. Get connection string:
   ```
   mongodb+srv://username:password@cluster.mongodb.net/desitv
   ```
6. Set in Render:
   ```bash
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/desitv
   ```

---

## Environment Variables Summary

### Render.com (Backend)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `NODE_ENV` | Yes | `production` | |
| `PORT` | Auto | `10000` | Auto-assigned by Render |
| `MONGO_URI` | Yes | `mongodb+srv://...` | MongoDB Atlas |
| `REDIS_URL` | Yes | `redis://red-xxx:6379` | Render Redis or external |
| `REDIS_PASSWORD` | No | - | Only if using external Redis |
| `REDIS_FALLBACK_ENABLED` | No | `false` | Use Redis only |
| `JWT_SECRET` | Yes | `min-32-chars` | Generate secure random |
| `SESSION_SECRET` | Yes | `min-32-chars` | Generate secure random |
| `CORS_ORIGIN` | Yes | `https://app.vercel.app` | Your Vercel URL |

### Vercel (Frontend)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `VITE_API_BASE` | Yes | `https://api.onrender.com` | Your Render backend URL |

---

## Testing Deployment

### 1. Test Backend Health
```bash
curl https://desitv-api.onrender.com/health
# Should return: {"status":"ok"}
```

### 2. Test Redis Connection
Check Render logs for:
```
[Redis] ✅ Connected and ready
[Cache] ✅ Now using Redis cache only (fallback disabled)
```

### 3. Test Frontend
Visit your Vercel URL and check:
- API calls work (check Network tab)
- No CORS errors
- Redis caching works (check backend logs)

---

## Troubleshooting

### "Redis connection refused"
- ✅ Check `REDIS_URL` is set correctly
- ✅ If using Render Redis, use **Internal URL** (starts with `redis://red-`)
- ✅ If using external Redis, check password and firewall

### "MongoDB connection failed"
- ✅ Check `MONGO_URI` format
- ✅ Whitelist Render IPs in MongoDB Atlas
- ✅ Verify database user credentials

### "CORS errors"
- ✅ Set `CORS_ORIGIN` to your exact Vercel URL (with `https://`)
- ✅ Check backend logs for CORS errors

### "Slow first request on Render"
- ✅ Normal for free tier (spins down after 15min)
- ✅ Upgrade to Starter plan ($7/mo) for always-on

### "Redis not connecting"
- ✅ Check `REDIS_FALLBACK_ENABLED=false` (should fail if Redis unavailable)
- ✅ Set `REDIS_FALLBACK_ENABLED=true` temporarily to debug
- ✅ Check Redis service is running in Render dashboard

---

## Cost Estimate

### Free Tier (Development)
- **Vercel**: Free (unlimited)
- **Render Web**: Free (spins down after 15min)
- **Render Redis**: Free (25MB)
- **MongoDB Atlas**: Free (512MB)
- **Total**: $0/month ✅

### Production Tier
- **Vercel**: Free (or Pro $20/mo for team features)
- **Render Web**: $7/mo (Starter - always-on)
- **Render Redis**: $10/mo (Starter - 100MB) or use Redis Cloud free
- **MongoDB Atlas**: Free (M0) or $9/mo (M2)
- **Total**: ~$17-26/month

---

## Quick Deploy Checklist

- [ ] MongoDB Atlas cluster created
- [ ] Render Redis service created (or external Redis configured)
- [ ] Render backend deployed with all env vars
- [ ] Vercel frontend deployed with `VITE_API_BASE`
- [ ] CORS_ORIGIN set to Vercel URL
- [ ] Health check endpoint working
- [ ] Redis connection confirmed in logs
- [ ] Frontend can reach backend API

---

## Support

- **Render Docs**: https://render.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Redis Cloud**: https://redis.com/try-free/
- **MongoDB Atlas**: https://www.mongodb.com/cloud/atlas

---

**Your setup is already compatible!** ✅ Just add the environment variables in Render and Vercel dashboards.

