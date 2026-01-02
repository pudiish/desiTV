# Environment Setup Guide

## Overview
DesiTV uses environment variables for configuration. These are loaded from `.env` files at project startup.

## Environment File Hierarchy

The application loads environment variables in this order:
1. **Root `.env`** - Primary configuration file (committed to git, with secrets redacted)
2. **`server/.env`** - Server-specific overrides (should mirror root values for consistency)
3. **Shell environment** - Can override all the above

### Root `.env` (Project Root)
Location: `/desiTV/.env`

Contains all critical configuration:
```
MONGO_URI=mongodb+srv://...
JWT_SECRET=...
ADMIN_USERNAME=admin
ADMIN_PASSWORD=...
YOUTUBE_API_KEY=...
GOOGLE_AI_KEY=...
VITE_CLIENT_PORT=5173
PORT=5000
REDIS_URL=redis://localhost:6379
REDIS_FALLBACK_ENABLED=true
```

### Server `.env`
Location: `/desiTV/server/.env`

Should mirror critical variables from root:
```
GOOGLE_AI_KEY=AIzaSyDby-PAVBCIHPs9YddyoO74GJJbWOgIPBk
```

## Loading Environment Variables

### Via start.sh (Recommended)
```bash
./start.sh
```

The `start.sh` script:
1. Sources the root `.env` file
2. Exports all variables to the shell environment
3. Verifies all critical variables are set
4. Starts development servers with environment inherited

**Benefits:**
- Automatic dependency checking
- Port conflict resolution
- Environment verification before startup
- Fallback defaults for development

### Via npm scripts directly
```bash
npm run dev
```

The server automatically loads environment variables via `dotenv` package.

## Critical Environment Variables

These must be set for full functionality:

| Variable | Purpose | Required | Default |
|----------|---------|----------|---------|
| `MONGO_URI` | MongoDB connection | Yes | None |
| `GOOGLE_AI_KEY` | Gemini AI API key | Yes | None |
| `YOUTUBE_API_KEY` | YouTube Data API key | Yes | None |
| `JWT_SECRET` | Session signing | Yes | None |
| `ADMIN_USERNAME` | Admin login | Yes | None |
| `ADMIN_PASSWORD` | Admin password | Yes | None |
| `PORT` | Server port | No | 5000 |
| `VITE_CLIENT_PORT` | Client dev port | No | 5173 |
| `REDIS_URL` | Redis connection | No | redis://localhost:6379 |

## Troubleshooting

### Chat Returns "not sure" for All Queries
**Symptom:** Even "hello" or "play a song" return generic response

**Cause:** `GOOGLE_AI_KEY` not loaded properly

**Solution:**
1. Verify `GOOGLE_AI_KEY` is set in `.env`:
   ```bash
   grep GOOGLE_AI_KEY .env
   ```

2. Check server is loading it:
   ```bash
   # In server logs, look for:
   # [Gemini] ✅ API Key loaded: AIzaSyDby...
   ```

3. Restart server:
   ```bash
   pkill -f "node.*index.js"
   ./start.sh
   ```

### Port Already in Use
**Symptom:** Address already in use error

**Solution:** `start.sh` automatically handles this:
- Detects conflicting processes
- Finds alternative ports
- Updates `.env` with new ports
- Shows access URLs

### Missing Environment Variables
**Symptom:** Server fails to start with "Cannot read property of undefined"

**Solution:**
1. Check `.env` exists:
   ```bash
   ls -la .env
   ```

2. Update with missing variables:
   ```bash
   # Edit .env and add:
   MONGO_URI=your_mongodb_uri
   GOOGLE_AI_KEY=your_api_key
   # etc...
   ```

3. Restart: `./start.sh`

### Different Behavior Between Local and Production
**Cause:** Environment variable mismatch

**Solution:**
1. Verify all vars set in Vercel/Render:
   ```bash
   # For Vercel
   vercel env list
   
   # For Render
   # Dashboard > Settings > Environment
   ```

2. Match production vars to local `.env`

3. Ensure `GOOGLE_AI_KEY` is set in both places (not `GEMINI_API_KEY`)

## Variable Naming Consistency

⚠️ **Important:** Use consistent names across all files:

**CORRECT:**
- `.env`: `GOOGLE_AI_KEY=...`
- `server/.env`: `GOOGLE_AI_KEY=...`
- Code: `process.env.GOOGLE_AI_KEY`

**WRONG:**
- `.env`: `GOOGLE_AI_KEY=...`
- `server/.env`: `GEMINI_API_KEY=...` ← Inconsistent name!

## Development Workflow

### First Time Setup
```bash
# 1. Copy template (if needed)
cp .env.example .env

# 2. Add your API keys
nano .env

# 3. Start with automatic setup
./start.sh
```

### Day-to-Day Development
```bash
# Start servers (env vars auto-loaded)
./start.sh

# Or if servers already running:
npm run dev
```

### Debugging Environment Issues
```bash
# Check what's loaded
env | grep -E "MONGO|GOOGLE|YOUTUBE|REDIS|PORT"

# Verify from start.sh
./start.sh --verbose

# Check specific var
echo $GOOGLE_AI_KEY
```

## Vercel/Render Deployment

### Environment Variables to Set

**Vercel Dashboard:**
1. Project Settings → Environment Variables
2. Add these in Production environment:
   - `MONGO_URI`
   - `GOOGLE_AI_KEY`
   - `YOUTUBE_API_KEY`
   - `JWT_SECRET`
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `REDIS_URL`

**Render Dashboard:**
1. Service Settings → Environment
2. Add the same variables

### Verification
```bash
# Render shows env vars in service logs
# Vercel shows via: vercel env list

# Monitor server startup logs for:
# [Gemini] ✅ API Key loaded: AIzaSyDby...
```

## Security Notes

⚠️ **Never commit sensitive values:**
- API keys
- Database URIs  
- Passwords
- Secrets

✅ **Safe practices:**
- `.env` has defaults/placeholders (commented out)
- Actual values loaded from system environment
- Use `.env.example` for documentation
- Rotate API keys regularly

## File References

- [Root .env](.env) - Main configuration
- [Server .env](server/.env) - Server-specific config
- [start.sh](start.sh) - Startup script with env verification
- [Environment Detection](client/src/config/environment.js) - How frontend detects API URL
