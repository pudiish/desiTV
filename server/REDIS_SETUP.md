# Redis Setup Guide

## Quick Start

Redis is **optional** - the system works perfectly without it using in-memory cache.

However, for production scale and better performance, Redis is recommended.

## Installation

### macOS (Homebrew)
```bash
brew install redis
brew services start redis
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install redis-server
sudo systemctl start redis
```

### Using Docker
```bash
docker run -d -p 6379:6379 --name redis redis:latest
```

## Configuration

### Environment Variables

Add to `.env` file in project root (or copy from `.env.example`):

```bash
# Redis URL (defaults to redis://localhost:6379)
REDIS_URL=redis://localhost:6379

# Redis Password - NOT REQUIRED for local Redis
# Only needed for:
# - Remote Redis servers (Redis Cloud, AWS ElastiCache, etc.)
# - Local Redis with password protection enabled
# For local Redis without password (default), leave this commented out
# REDIS_PASSWORD=

# Enable in-memory fallback if Redis is unavailable (default: false)
# Set to 'true' to enable fallback, 'false' to use Redis only
REDIS_FALLBACK_ENABLED=false
```

### About Redis Password

**For Local Redis (Default Setup):**
- ✅ **NO password required** - Local Redis runs without authentication by default
- ✅ **Free and offline** - Runs on your machine, no internet needed
- ✅ **No configuration needed** - Just install and run `redis-server`

**When Password IS Required:**
- 🔒 **Remote Redis** (Redis Cloud, AWS ElastiCache, DigitalOcean, etc.)
- 🔒 **Production servers** with security enabled
- 🔒 **Local Redis with password protection** (if you manually enabled `requirepass` in redis.conf)

**Summary:** For local development, you don't need `REDIS_PASSWORD` at all! Just leave it commented out or don't set it.

### Fallback Mode

- **`REDIS_FALLBACK_ENABLED=false`** (default): Use Redis only. If Redis is unavailable, cache operations will fail. This ensures you always use Redis for consistency.
- **`REDIS_FALLBACK_ENABLED=true`**: Enable in-memory fallback. If Redis is unavailable, the system will automatically use in-memory cache as a backup.

## Verification

1. Check if Redis is running:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. Check server logs:
   - **With fallback disabled (default)**: `[Cache] ✅ Using Redis cache only (fallback disabled)`
   - **With fallback enabled**: `[Cache] ✅ Using Redis cache with in-memory fallback`
   - **If Redis not available and fallback disabled**: `[Cache] ❌ Redis not available and fallback is disabled!` (server will fail)
   - **If Redis not available and fallback enabled**: `[Cache] Using in-memory cache (Redis not available, fallback active)`

## Benefits of Redis

- **Distributed caching**: Shared cache across multiple server instances
- **Persistence**: Cache survives server restarts (if configured)
- **Better performance**: Faster than in-memory for large datasets
- **Scalability**: Handles millions of keys efficiently

## Without Redis

The system automatically falls back to in-memory cache:
- Works perfectly for single-server deployments
- No additional setup required
- All features work the same way
- Cache is lost on server restart (acceptable for most use cases)

## Troubleshooting

### "Cannot find module 'redis'"
**Solution**: Install redis package:
```bash
cd server
npm install redis
```

### "Connection refused"
**Solution**: Make sure Redis server is running:
```bash
redis-cli ping
```

### "Max reconnection attempts reached"
**Solution**: Check Redis server status and network connectivity

