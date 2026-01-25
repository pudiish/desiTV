# DesiTV - AI Coding Agent Instructions

**Project**: Nostalgic retro TV streaming platform (2000s Indian TV experience)  
**Tech Stack**: React 18, Express.js, MongoDB/JSON, Socket.io, Firebase Auth  
**Core Innovation**: Netflix-grade synchronized pseudolive streaming with triple-fallback sync architecture

---

## 🏗️ Architecture Overview

**Key Concept**: Global epoch-based synchronization ensures all devices play the same video at the same position, creating a shared TV experience.

### Multi-Layer Sync System (Never Fails)
1. **WebSocket** (Primary) – 5s sync interval with delta compression
2. **Server-Sent Events** (Fallback) – Backpressure handling for slow clients
3. **Predictive Engine** (Client-Side) – Computes positions locally forever (90% API reduction)
4. **HTTP Polling** (Ultimate Fallback) – 1s adaptive polling

**Position Calculation**: Server uses binary search (O(log n)) to find current video in playlist, then calculates offset from global epoch. Clients either poll or predict locally using manifest.

### Cache Architecture (L1→L2→DB)
- **L1**: In-memory Node.js Map (~0.1ms, TTL: 2s)
- **L2**: Redis (~5-50ms, TTL: 5s, compressed)
- **L3**: MongoDB/JSON files (persistent)

### Data Flow
```
Channel (MongoDB/JSON) → Minimized Channel (cached)
  → Playlist Selection (time-based) → Position Calculation
  → Delta Compression → Client (via WebSocket/SSE/HTTP)
```

---

## 📁 Critical Component Layout

### Server Structure
- **`server/services/`** – Business logic (channelService, liveStateService, sessionService)
- **`server/controllers/`** – Request handlers (connect services to routes)
- **`server/routes/`** – API endpoints (organized by domain)
- **`server/utils/positionCalculator.js`** – **CORE**: Global epoch → current video+offset calculation
- **`server/utils/deltaCompression.js`** – **CORE**: Netflix-style 90% bandwidth reduction
- **`server/utils/cacheWarmer.js`** – Pre-loads channels on startup, periodic refresh
- **`server/socket/index.js`** – WebSocket handlers for real-time sync
- **`server/middleware/security.js`** – Rate limiting, connection tracking (free-tier optimized)

### Client Structure
- **`client/src/pages/Home.jsx`** – Main TV viewing page
- **`client/src/services/checksumSync.js`** – **CORE**: Integrity validation protocol
- **`client/src/services/api/globalEpochService.js`** – Epoch fetching & NTP clock sync
- **`client/src/context/AuthContext.jsx`** – Firebase authentication
- **`client/src/components/`** – Retro TV frame, remote control, video player
- **`client/src/services/channelSync.js`** – Channel data fetching with checksums

---

## 🎯 Project-Specific Patterns

### 1. **Time-Based Playlists (Authentic 9XM Experience)**
Channels support 7 time slots with different content:
```javascript
// server/models/Channel.js structure
timeBasedPlaylists: {
  morning: [...],        // 6-9 AM: Devotional
  lateMorning: [...],    // 9-12 PM
  afternoon: [...],      // 12-3 PM
  evening: [...],        // 3-6 PM
  primeTime: [...],      // 6-9 PM: Bollywood (peak)
  night: [...],          // 9-12 AM
  lateNight: [...]       // 12-6 AM
}
```
Use **`server/utils/timeBasedPlaylist.js`** functions: `selectPlaylistForTime()`, `getCurrentTimeSlot()`.

### 2. **Global Epoch (Synchronized Playback)**
- Single source of truth for "current time" across all clients
- Stored in `globalEpoch.json` (or MongoDB if available)
- Updated every sync response; clients perform NTP-style sync (5 samples, discard outliers, average best 3)
- **Never store client time** – always use server epoch

### 3. **Checksum Protocol (Data Integrity)**
Every API response includes a checksum to detect stale data:
```javascript
// Server adds: { data: {...}, checksum: '...' }
// Client verifies before use via checksumSyncService
// If mismatch: re-fetch without cache
```
See `server/utils/checksum.js` and `client/src/services/checksumSync.js`.

### 4. **Cache Invalidation Strategy**
- **Partial invalidation**: Only clear affected channel cache when edited
- **Full invalidation**: Clear all channels + epoch when bulk operations
- Channel hash: last 6 chars of `_id.toString()` for cache key (e.g., `ch:a1b2c3`)
- Use `invalidateCache()` in services; never manually delete Redis keys

### 5. **JSON vs. MongoDB Fallback**
- **Source of truth**: JSON files (`channels.json`, `globalEpoch.json`)
- **MongoDB**: Optional, used for admin persistence if available
- **Utility readers**: `server/utils/channelJSONReader.js`, `server/utils/updateChannelsJSON.js`
- Always read from JSON in services; write to both JSON + MongoDB if schema available

### 6. **Free-Tier Rate Limiting (Render/Vercel)**
- Connection tracking via `middleware/security.js`
- Adaptive sync intervals based on connection quality
- Message coalescing in SSE to prevent backpressure hangs
- See `FREE_TIER_LIMITS` config for thresholds

---

## 🔧 Developer Workflows

### Local Development
```bash
# Start both dev servers (concurrent)
./start.sh

# Or manually:
cd server && npm run dev    # Starts on port 5000
cd client && npm run dev    # Starts on port 5173

# With --restart flag (kills existing processes)
./start.sh --restart
```

### Building & Deployment
```bash
# Build client (creates dist/)
npm run build

# Server runs as: node server/index.js
# Client deployed as static assets from dist/

# Environment variables (loaded from root .env, then server/.env)
NODE_ENV=production
PORT=5000
MONGODB_URI=...
REDIS_URL=...
CLIENT_URL=https://desitv.vercel.app
```

### Testing
```bash
# Server tests
cd server && npm run test          # Single run
npm run test:watch                 # Watch mode
npm run test:coverage              # Coverage report

# Client tests
cd client && npm test
```

### Database & Cache
```bash
# Seed channels
cd server && node scripts/seed.js

# Migrate to MongoDB (if available)
npm run migrate

# Clear server caches
curl -X POST http://localhost:5000/api/live-state/clear-cache

# Warm cache on startup (auto-runs on boot)
node server/utils/cacheWarmer.js
```

---

## ⚠️ Critical "Gotchas" & Conventions

1. **Never block on client time** – Use `globalEpochService.getCurrentEpoch()` for all timestamp needs
2. **Manifest TTL varies by content** – Shortest video duration determines manifest refresh (see `liveStateService.js`)
3. **Delta compression breaks on video change** – Full state sent when `videoIndex` differs
4. **NTP clock sync must happen before playback** – Check `ntp.samples.length >= 3` in `globalEpochService.js`
5. **Admin routes require authentication** – Firebase token required; protected via `ProtectedRoute` wrapper
6. **Channel mutations invalidate all related caches** – Use service methods, never direct cache edits
7. **Free-tier connection drops** – Implement exponential backoff; sync engine auto-recovers via fallback chain
8. **Visibility API behavior** – Client re-syncs when tab becomes visible (Spotify pattern in `checksumSync.js`)

---

## 🔄 Key Service Flows

### Position Calculation Flow
1. Client requests `/api/live-state?channelId=...`
2. Server: Find channel → Select time-based playlist → Binary search video → Calculate offset
3. Apply delta compression (90% bandwidth savings)
4. Return: `{ videoId, position, remaining, manifest }`
5. Client: Cache manifest, compute future positions locally

### Real-Time Sync Flow
1. WebSocket connects; server emits sync state every 5s
2. Client receives delta; updates position
3. If drift detected (>5s): Proportional rate correction (0.85x–1.15x playback rate)
4. If WebSocket fails: Automatic fallback to SSE → Predictive → HTTP polling
5. Message coalescing prevents SSE backpressure hangs

### Authentication Flow
1. User logs in via Firebase (UI)
2. Client stores token; passes in `Authorization: Bearer <token>` header
3. Server validates via `authMiddleware.js` (Firebase Admin SDK)
4. Token refresh auto-handled by `AuthContext.jsx`
5. Admin routes protected by `ProtectedRoute` component

---

## 📊 Performance Baselines

- **Position calculation**: O(log n) binary search, ~1-5ms
- **Cache hit rate**: L1 (in-memory) 80%+, L2 (Redis) 60%+
- **Bandwidth reduction**: Delta compression 90% vs. full state
- **Sync latency**: WebSocket 100-500ms, Predictive 0ms (local calculation)
- **Manifest size**: ~50-100 bytes per video (JSON minimization)

---

## 🛠️ When Modifying Key Systems

### Adding a New Sync Channel
1. Update `/api/liveState` route with new handler
2. Register in sync orchestrator (server/socket/index.js)
3. Add client listener in Home.jsx or sync service
4. Test with `start.sh --restart` + browser dev tools (Network tab)

### Changing Position Calculation
1. Always modify **server** first; clients must remain backward-compatible
2. Update `positionCalculator.js` + cache invalidation in `cacheWarmer.js`
3. Bump manifest version if breaking change
4. Clear all caches before deploying

### Adding New Channel Metadata
1. Update Channel schema (`server/models/Channel.js`)
2. Minimization function (`server/utils/cacheWarmer.js` → `minimizeChannel()`)
3. Checksum validation in sync protocol
4. Test with `npm run test` (server)

---

## 📚 Essential References

- **README.md**: v2.0 architecture, feature overview
- **package.json scripts**: Common dev commands
- **start.sh**: Detailed startup process, dependency checks
- **server/jest.config.js**: Test configuration, timeouts (5s)
- **.env template**: See server/package.json for required vars
