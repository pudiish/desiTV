# Deployment Checklist & Next Steps

## ✅ What's Been Done

1. **All changes committed** to local git repository
2. **Auto-deployment configured** in:
   - `server/render.yaml` - Render.com auto-deploys on push to `main`
   - `client/vercel.json` - Vercel auto-deploys on push to `main`

## 🔐 Push to GitHub (Required)

**You need to push manually** (authentication required):

```bash
cd /Users/ishwarswarnapudi/Desktop/DesiTV/desiTV
git push origin main
```

Or if you prefer to use SSH:
```bash
git remote set-url origin git@github.com:pudiish/desiTV.git
git push origin main
```

---

## 🚀 Auto-Deployment Setup

Once pushed to GitHub, deployments will trigger automatically:

### Render.com (Backend)
- ✅ **Auto-deploy**: Enabled in `render.yaml`
- ✅ **Trigger**: Push to `main` branch
- ⚠️ **Action Required**: Set environment variables in Render dashboard

### Vercel (Frontend)
- ✅ **Auto-deploy**: Enabled by default
- ✅ **Trigger**: Push to `main` branch
- ⚠️ **Action Required**: Set `VITE_API_BASE` environment variable

---

## 📋 Deployment Steps

### Step 1: Push to GitHub
```bash
git push origin main
```

### Step 2: Render.com Setup

1. **Go to [Render Dashboard](https://dashboard.render.com)**

2. **Create Redis Service** (if not exists):
   - Click **"New +"** → **"Redis"**
   - Name: `desitv-redis`
   - Plan: `Free` (or `Starter` for production)
   - Region: `Singapore`
   - Click **"Create Redis"**
   - Copy the **Internal Redis URL**

3. **Create/Update Web Service**:
   - Click **"New +"** → **"Web Service"**
   - Connect GitHub repo: `pudiish/desiTV`
   - Configure:
     - **Name**: `desitv-api`
     - **Root Directory**: `server`
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Plan**: `Free` or `Starter` ($7/mo)

4. **Set Environment Variables** in Render:
   ```bash
   NODE_ENV=production
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/desitv
   REDIS_URL=redis://red-xxxxx:6379  # From Redis service
   REDIS_FALLBACK_ENABLED=false
   JWT_SECRET=your-super-secret-jwt-key-min-32-chars
   SESSION_SECRET=your-super-secret-session-key-min-32-chars
   CORS_ORIGIN=https://your-app.vercel.app  # Set after Vercel deploy
   ```

5. **Deploy**: Click **"Create Web Service"**

### Step 3: Vercel Setup

1. **Go to [Vercel Dashboard](https://vercel.com/dashboard)**

2. **Import Project**:
   - Click **"Add New..."** → **"Project"**
   - Import `pudiish/desiTV` repository
   - Configure:
     - **Framework Preset**: `Vite`
     - **Root Directory**: `client`
     - **Build Command**: `npm run build`
     - **Output Directory**: `dist`

3. **Set Environment Variable**:
   ```bash
   VITE_API_BASE=https://desitv-api.onrender.com
   ```
   (Use your actual Render backend URL)

4. **Deploy**: Click **"Deploy"**

5. **Update Render CORS**:
   - Go back to Render dashboard
   - Update `CORS_ORIGIN` to your Vercel URL:
     ```bash
     CORS_ORIGIN=https://your-app.vercel.app
     ```

---

## 🔄 Auto-Deployment Flow

```
┌─────────────┐
│  Git Push   │
│  to main    │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│  Render.com │   │   Vercel    │
│  (Backend)  │   │  (Frontend) │
└─────────────┘   └─────────────┘
```

**Both platforms will automatically:**
1. Detect push to `main` branch
2. Pull latest code
3. Run build commands
4. Deploy new version

---

## ✅ Verification Checklist

After deployment:

- [ ] Render backend is running (check logs)
- [ ] Redis is connected (check logs for `[Redis] ✅ Connected`)
- [ ] Vercel frontend is deployed
- [ ] API calls work (check browser Network tab)
- [ ] No CORS errors
- [ ] Health endpoint works: `https://desitv-api.onrender.com/health`

---

## 📝 Environment Variables Reference

### Render.com (Backend)
| Variable | Required | Example |
|----------|----------|---------|
| `NODE_ENV` | Yes | `production` |
| `MONGO_URI` | Yes | `mongodb+srv://...` |
| `REDIS_URL` | Yes | `redis://red-xxx:6379` |
| `REDIS_FALLBACK_ENABLED` | No | `false` |
| `JWT_SECRET` | Yes | `min-32-chars` |
| `SESSION_SECRET` | Yes | `min-32-chars` |
| `CORS_ORIGIN` | Yes | `https://app.vercel.app` |

### Vercel (Frontend)
| Variable | Required | Example |
|----------|----------|---------|
| `VITE_API_BASE` | Yes | `https://api.onrender.com` |

---

## 🆘 Troubleshooting

### "Auto-deploy not working"
- ✅ Check GitHub webhook is connected in Render/Vercel
- ✅ Verify `main` branch is being pushed to
- ✅ Check deployment logs in dashboard

### "Build failed"
- ✅ Check build logs in Render/Vercel dashboard
- ✅ Verify all dependencies are in `package.json`
- ✅ Check Node.js version compatibility

### "Redis not connecting"
- ✅ Verify `REDIS_URL` is set correctly
- ✅ Check Redis service is running in Render
- ✅ Check firewall/network settings

---

## 📚 Documentation

- **Full Deployment Guide**: See `DEPLOYMENT_GUIDE.md`
- **Environment Setup**: See `ENV_SETUP.md`
- **Redis Setup**: See `server/REDIS_SETUP.md`

---

## 🎉 Next Steps

1. **Push to GitHub**: `git push origin main`
2. **Set up Render.com**: Follow Step 2 above
3. **Set up Vercel**: Follow Step 3 above
4. **Test**: Verify everything works
5. **Monitor**: Check logs for any issues

**Everything is ready! Just push and deploy!** 🚀

