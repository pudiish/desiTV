# Vercel Deployment Setup Guide

## Required Environment Variables

The following environment variables **must** be set in Vercel for the application to work correctly:

### API Keys
- **GEMINI_API_KEY** or **google_ai**: Google Gemini API key for VJ Assistant chat
- **YOUTUBE_API_KEY**: YouTube Data API v3 key for video searches

### Database
- **MONGO_URI**: MongoDB connection string for database

### Security
- **JWT_SECRET**: Secret key for JWT token signing
- **ADMIN_USERNAME**: Admin portal username
- **ADMIN_PASSWORD**: Admin portal password

### Configuration
- **PORT**: Server port (default: 5000)
- **VITE_CLIENT_PORT**: Client dev port (default: 5173)
- **API_BASE_URL**: Base URL for API calls (e.g., https://desitv-api.onrender.com/)

### Optional
- **REDIS_URL**: Redis connection for caching
- **REDIS_FALLBACK_ENABLED**: Enable fallback when Redis unavailable (true/false)

## How to Set Environment Variables in Vercel

### Option 1: Via Vercel Dashboard

1. Go to your Vercel project: https://vercel.com/dashboard
2. Select your project (desiTV)
3. Click **Settings** tab
4. Navigate to **Environment Variables**
5. Add each variable:
   - **Name**: Variable name (e.g., `GEMINI_API_KEY`)
   - **Value**: The actual key value
   - **Select Environments**: Choose Production, Preview, or Development as needed
6. Click **Save**

### Option 2: Via Vercel CLI

```bash
vercel env add GEMINI_API_KEY
vercel env add YOUTUBE_API_KEY
vercel env add MONGO_URI
# ... etc
```

## Current Status

Your current `.env` file contains:
```
GEMINI_API_KEY=AIzaSyDby-PAVBCIHPs9YddyoO74GJJbWOgIPBk
YOUTUBE_API_KEY=AIzaSyAaUOFX1CCGSj_LcEoTSyMsnDyD5dl9tfw
```

These need to be added to Vercel's environment variables section.

## Troubleshooting

### AI responses failing in production
- Verify `GEMINI_API_KEY` or `google_ai` is set in Vercel
- Check the server logs in Vercel for warnings about missing API keys
- Ensure the API key is valid and has available quota

### YouTube searches not working
- Verify `YOUTUBE_API_KEY` is set
- Check YouTube API quota in Google Cloud Console
- Ensure the key has YouTube Data API v3 enabled

### API 404 errors
- Make sure the API base URL is correctly configured
- Verify all routes are deployed correctly
- Check that middleware is properly mounted

## Redeploy After Changes

After updating environment variables:
1. Push changes to main branch: `git push origin main`
2. Vercel will automatically redeploy
3. Or manually trigger: `vercel --prod`

## Monitoring

After deployment, you can:
- Monitor server logs in Vercel Dashboard → Deployments → Logs
- Check function performance and errors
- Review environment variable usage
- **Check diagnostic endpoint**: `https://your-domain.vercel.app/api/diagnostics`

## Detailed Troubleshooting

### If AI still not working on Vercel/Render after adding environment variables:

**Step 1: Check if environment variables are actually set**
```bash
# Visit this URL to see what's configured on the server:
https://your-deployed-domain/api/diagnostics
```

This will show you:
- Which API keys are configured
- Which environment variables are present
- The environment (production/development)

**Step 2: Verify on Render/Vercel Dashboard**
- Go to your project settings
- Check "Environment Variables" section
- Confirm `GEMINI_API_KEY` or `google_ai` is there
- Make sure the value is correct (should start with `AIzaSy...`)

**Step 3: Force redeploy after adding environment variables**

**For Vercel:**
- Just push a new commit: `git push origin main`
- Or click "Redeploy" in the Vercel dashboard

**For Render:**
- In Render dashboard, go to your service
- Click "Manual Deploy" → "Deploy latest commit"
- Wait for deployment to complete

**Step 4: Check server logs for errors**
- Look for `[Gemini]` log messages
- If it says "WARNING: No API key found", the environment variable isn't set correctly

### Common Issues

| Problem | Solution |
|---------|----------|
| `[Gemini] WARNING: No API key found` | Environment variable not set. Check dashboard settings |
| Environment variable set but still missing | Wait for deployment to complete and redeploy |
| `INVALID_ARGUMENT` error | API key is invalid or has a typo. Copy-paste from Google Cloud |
| `UNAUTHENTICATED` error | API key format is wrong. Should start with `AIzaSy...` |
| `PERMISSION_DENIED` error | API key doesn't have access to Gemini API. Enable it in Google Cloud |

### Quick Checklist

- [ ] Added `GEMINI_API_KEY` environment variable to Vercel/Render
- [ ] API key starts with `AIzaSy...`
- [ ] Redeployed application after adding environment variable
- [ ] Checked `/api/diagnostics` endpoint - shows `geminiConfigured: true`
- [ ] Verified in Vercel/Render logs - no "API key found" warnings
- [ ] Tested chat API with a simple query like "hi"
