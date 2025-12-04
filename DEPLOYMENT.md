# DesiTV™ Deployment Guide
## Local, Vercel + Render.com Setup

---

## 🏠 Local Development Setup

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- npm or yarn

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/pudiish/desiTV.git
cd desiTV

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env with your values
# MONGO_URI=mongodb://localhost:27017/desitv
# JWT_SECRET=your-secret-key
# PORT=5002

# 4. Install dependencies
npm install
cd server && npm install
cd ../client && npm install
cd ..

# 5. Start development servers
npm run dev
```

### Local URLs
- **Frontend**: http://localhost:5173
- **API**: http://localhost:5002
- **Health Check**: http://localhost:5002/health

---

## ☁️ Production Deployment

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION SETUP                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Vercel (Frontend)          Render (Backend)               │
│   ┌─────────────────┐        ┌─────────────────┐           │
│   │                 │        │                 │           │
│   │  React + Vite   │───────▶│  Express API    │           │
│   │  Static Files   │  /api  │  Node.js        │           │
│   │                 │        │                 │           │
│   └─────────────────┘        └────────┬────────┘           │
│                                       │                     │
│                              ┌────────▼────────┐           │
│                              │                 │           │
│                              │  MongoDB Atlas  │           │
│                              │  (Database)     │           │
│                              │                 │           │
│                              └─────────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: MongoDB Atlas Setup 🗄️

1. **Create Account**: [mongodb.com/atlas](https://www.mongodb.com/atlas)

2. **Create Free Cluster**:
   - Provider: AWS
   - Region: **Mumbai (ap-south-1)** for India
   - Tier: M0 (Free)

3. **Database Access**:
   - Click **Database Access** → **Add New User**
   - Username: `desitv-user`
   - Password: Auto-generate (save this!)
   - Role: Read and write to any database

4. **Network Access**:
   - Click **Network Access** → **Add IP Address**
   - Click **"Allow Access from Anywhere"** (0.0.0.0/0)

5. **Get Connection String**:
   - Click **Connect** → **Connect your application**
   - Copy: `mongodb+srv://desitv-user:<password>@cluster.xxxxx.mongodb.net/desitv`
   - Replace `<password>` with your actual password

---

## Step 2: Deploy Backend to Render 🖥️

### Option A: Via Dashboard

1. Go to [render.com](https://render.com) → Sign up with GitHub

2. Click **New** → **Web Service**

3. Connect repository: `pudiish/desiTV`

4. Configure:
   ```
   Name:           desitv-api
   Region:         Singapore
   Branch:         main
   Root Directory: server
   Runtime:        Node
   Build Command:  npm install
   Start Command:  npm start
   Instance Type:  Free
   ```

5. Environment Variables:
   ```
   MONGO_URI     = mongodb+srv://user:pass@cluster.mongodb.net/desitv
   JWT_SECRET    = [click Generate]
   PORT          = 10000
   NODE_ENV      = production
   ```

6. Click **Create Web Service**

7. Note your URL: `https://desitv-api.onrender.com`

### Option B: Via render.yaml (Blueprint)

The `server/render.yaml` file is pre-configured. Just:
1. Connect your repo on Render
2. Select "Blueprint" deployment
3. Add your `MONGO_URI` manually

---

## Step 3: Deploy Frontend to Vercel ⚡

### Option A: Via Dashboard

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub

2. Click **Add New** → **Project**

3. Import `pudiish/desiTV`

4. Configure:
   ```
   Framework:         Vite
   Root Directory:    client
   Build Command:     npm run build
   Output Directory:  dist
   ```

5. Environment Variables:
   ```
   VITE_API_BASE = https://desitv-api.onrender.com
   ```

6. Click **Deploy**

### Option B: Via CLI

```bash
cd client
npx vercel

# Follow prompts, then:
vercel env add VITE_API_BASE
# Enter: https://desitv-api.onrender.com
# Select: Production, Preview, Development

# Deploy to production
vercel --prod
```

---

## Step 4: Configure Vercel Rewrites

The `client/vercel.json` is pre-configured to:
- Rewrite `/api/*` to your Render backend
- Cache static assets for 1 year
- Add security headers

**Update the API URL**:
```json
{
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "https://YOUR-APP.onrender.com/api/$1"
    }
  ]
}
```

---

## 🔧 Environment Variables Reference

### Server (.env)
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGO_URI` | ✅ | - | MongoDB connection string |
| `JWT_SECRET` | ✅ | - | Secret for JWT tokens |
| `PORT` | ❌ | 5002 | Server port |
| `NODE_ENV` | ❌ | development | Environment mode |
| `CLIENT_URL` | ❌ | - | Custom client URL for CORS |

### Client (Vercel Environment)
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_BASE` | ✅ | - | Backend API URL |
| `VITE_DEBUG` | ❌ | false | Enable debug logging |

---

## 🆓 Keep Render Awake (Free Tier)

Render free tier sleeps after 15 minutes of inactivity.

### Solution: Use cron-job.org (Free)

1. Go to [cron-job.org](https://cron-job.org)
2. Create free account
3. Add new cron job:
   - **URL**: `https://desitv-api.onrender.com/health`
   - **Schedule**: Every 14 minutes
   - **Method**: GET

This keeps your API awake 24/7!

---

## 📊 Performance Optimizations

### Server-Side
- ✅ In-memory caching for channels (30s TTL)
- ✅ MongoDB connection pooling (10 connections)
- ✅ Lean queries (`.lean()`) for read operations
- ✅ Request logging only in development

### Client-Side
- ✅ Code splitting (vendor chunks)
- ✅ Longer intervals in production (less API calls)
- ✅ Session save debouncing
- ✅ Asset caching headers (1 year)

---

## 🔍 Troubleshooting

### API not responding
1. Check Render dashboard for deployment status
2. View logs: Render → Your Service → Logs
3. Verify `MONGO_URI` is correct
4. Check Network Access in MongoDB Atlas

### Frontend can't reach API
1. Verify `VITE_API_BASE` in Vercel environment
2. Check `vercel.json` rewrites
3. Redeploy after changing env vars

### Cold Start Issues
1. First request after sleep = 30-50 seconds
2. Use cron-job.org to prevent sleep
3. Or upgrade to Render Starter ($7/mo)

### CORS Errors
1. Check server CORS config allows your domain
2. Add your Vercel URL to `CLIENT_URL` env var
3. Ensure requests use the correct protocol (https)

---

## 💰 Cost Summary

| Service | Free Tier | Paid Option |
|---------|-----------|-------------|
| **Vercel** | 100GB bandwidth | Pro $20/mo |
| **Render** | 750 hrs/mo (sleeps) | Starter $7/mo |
| **MongoDB Atlas** | 512MB storage | M10 $57/mo |
| **Total** | **$0/month** | **$7-27/mo** |

---

## 🚀 Quick Checklist

- [ ] MongoDB Atlas cluster created
- [ ] Database user created with password
- [ ] Network access set to 0.0.0.0/0
- [ ] Connection string copied
- [ ] Render Web Service deployed
- [ ] Render environment variables set
- [ ] Vercel project created
- [ ] Vercel environment variables set
- [ ] vercel.json API URL updated
- [ ] cron-job.org ping setup (optional)
- [ ] Test end-to-end functionality

---

**DesiTV™** - Made with ❤️ by Swarnapudi Ishwar (PudiIsh)

*"Relive the 2000s. One Channel at a Time."*
