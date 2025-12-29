# 📺 DesiTV™

**Nostalgic retro TV streaming platform recreating authentic 2000s Indian television vibes**

DesiTV is a full-stack web application that brings back the nostalgic experience of watching Indian TV channels from the early 2000s. Built with modern web technologies, it features a realistic CRT TV interface, time-based programming schedules, and synchronized pseudolive streaming across all devices.

![DesiTV](https://img.shields.io/badge/DesiTV-Nostalgic%20TV%20Streaming-blue?style=for-the-badge)
![Version](https://img.shields.io/badge/version-2.0.0-orange?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-blue?style=for-the-badge)

---

## 📋 Version History

### v2.0.0 (December 2024) - Netflix-Level Architecture
- **Predictive Sync Engine**: Client-side position computation (90% API reduction)
- **WebSocket + SSE + HTTP**: Triple-fallback real-time sync
- **Delta Compression**: 90% bandwidth reduction
- **NTP-Style Clock Sync**: 5-sample multi-point synchronization
- **Adaptive Polling**: 30s synced → 1s critical drift
- **SSE Backpressure**: Message coalescing for slow clients
- **Connection Quality UI**: Real-time status indicator
- **Visibility-Based Sync**: Re-sync on tab wake (Spotify approach)
- **Adaptive Manifest TTL**: Based on shortest video duration

### v1.5.0 (December 2024) - Server-Authoritative Sync
- Server pre-computes all positions
- ETag/304 response caching
- Proportional rate correction (2%→15%)
- Redis ultra-optimization for free tier

### v1.0.0 (Initial Release)
- Basic CRT TV interface
- Global epoch synchronization
- Admin panel
- Channel management

---

## 🏗️ Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────────────┐
│                    SYNC ORCHESTRATOR (Master Controller)            │
├─────────────────────────────────────────────────────────────────────┤
│  Priority Failover:  WebSocket → SSE → Predictive → HTTP Polling   │
│  Features: NTP Clock Sync | Visibility Handler | Anomaly Detection │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   WebSocket   │    │     SSE       │    │  Predictive   │
│   (Primary)   │    │  (Fallback)   │    │   Engine      │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ • Bidirect    │    │ • Push-only   │    │ • ZERO API    │
│ • 5s sync     │    │ • Backpressure│    │ • Local math  │
│ • Delta comp  │    │ • Coalescing  │    │ • 90% savings │
└───────────────┘    └───────────────┘    └───────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         SERVER                                       │
├─────────────────────────────────────────────────────────────────────┤
│  • Server-authoritative position calculation                        │
│  • Binary search O(log n) video lookup                              │
│  • Pre-computed cumulative offsets                                  │
│  • ETag + 304 Not Modified support                                  │
│  • Delta compression for broadcasts                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   L1 Cache    │    │   L2 Cache    │    │   MongoDB     │
│  (In-Memory)  │    │   (Redis)     │    │  (Persistent) │
├───────────────┤    ├───────────────┤    ├───────────────┤
│ • ~0.1ms      │    │ • Compressed  │    │ • Channels    │
│ • TTL: 2s     │    │ • TTL: 5s     │    │ • Playlists   │
│ • Node.js Map │    │ • 25MB limit  │    │ • GlobalEpoch │
└───────────────┘    └───────────────┘    └───────────────┘
\`\`\`

---

## ✨ Features

### 🎬 Authentic TV Experience
- **CRT TV Interface**: Realistic retro TV frame with scanlines and static effects
- **Remote Control**: Interactive TV remote with channel navigation, volume control, and power button
- **Time-Based Programming**: Channels switch content based on time slots
- **Pseudolive Streaming**: Synchronized playback across all devices using global epoch

### 🔄 Netflix-Level Synchronization
- **Predictive Engine**: Client downloads manifest once, computes positions locally forever
- **Triple Fallback**: WebSocket → SSE → Predictive → HTTP (never fails)
- **NTP Clock Sync**: 5-sample measurement, discard outliers, average best 3
- **Proportional Correction**: 200ms-5s drift = rate adjust (0.85x-1.15x), >5s = seek
- **Delta Compression**: Only send position changes (20 bytes vs 500 bytes)
- **Visibility Sync**: Re-sync clock when tab becomes visible (Spotify's approach)

### 📊 Connection Quality
- **Real-time Status**: 🟢 Excellent | 🟢 Good | 🟡 Fair | 🟠 Poor | 🔴 Offline
- **Strategy Display**: Shows current sync method (WebSocket/SSE/Predictive/HTTP)
- **Drift Monitoring**: Tracks and displays sync drift in milliseconds
- **Confidence Score**: Shows how reliable the current sync state is

### 🎨 User Experience
- **Fullscreen Mode**: Immersive viewing experience
- **Responsive Design**: Optimized for desktop and mobile
- **Session Persistence**: Remembers last watched channel
- **Graceful Degradation**: Works even on slow connections

### 🔧 Admin Features
- **Channel Management**: Add, edit, and manage channels and videos
- **Category Organization**: Organize channels by categories
- **Cache Management**: Monitor and clear server-side caches
- **SSE Stats**: Monitor backpressure and connection health
- **System Metrics**: Health checks and performance monitoring

---

## 🛠️ Tech Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI library |
| Vite | 7.x | Build tool |
| Socket.io Client | 4.x | WebSocket client |
| TailwindCSS | 3.x | Styling |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Express.js | 4.x | Web framework |
| Socket.io | 4.x | WebSocket server |
| MongoDB | 6+ | Database |
| Redis | 7+ | Caching (optional) |

### Key Services
| Service | File | Purpose |
|---------|------|---------|
| SyncOrchestrator | \`client/src/services/sync/SyncOrchestrator.js\` | Master sync controller |
| PredictiveEngine | \`client/src/services/sync/PredictiveEngine.js\` | Client-side computation |
| SSEClient | \`client/src/services/sync/SSEClient.js\` | SSE fallback |
| liveStateService | \`server/services/liveStateService.js\` | Server-authoritative sync |
| sseController | \`server/controllers/sseController.js\` | SSE with backpressure |
| deltaCompression | \`server/utils/deltaCompression.js\` | Bandwidth optimization |

---

## 📋 Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **MongoDB** (v6 or higher)
- **Redis** (v7 or higher) - Optional, uses in-memory fallback

---

## 🚀 Installation

### 1. Clone the Repository

\`\`\`bash
git clone https://github.com/pudiish/desiTV.git
cd desiTV
\`\`\`

### 2. Install Dependencies

\`\`\`bash
# Root
npm install

# Server
cd server && npm install

# Client
cd ../client && npm install
\`\`\`

### 3. Environment Configuration

Create \`.env\` in server directory:

\`\`\`env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/desitv

# Redis (Optional)
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# Admin
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
\`\`\`

### 4. Start Development

\`\`\`bash
# From root directory
npm run dev
\`\`\`

- **Client**: http://localhost:5173
- **Server**: http://localhost:5000

---

## 🔌 API Endpoints

### Live State (v2.0)
| Endpoint | Method | Description |
|----------|--------|-------------|
| \`/api/live-state\` | GET | Get current sync state |
| \`/api/live-state/stream\` | GET | SSE stream (push-only) |
| \`/api/live-state/manifest\` | GET | Full playlist manifest |
| \`/api/live-state/manifest/full\` | GET | CDN-ready manifest |
| \`/api/live-state/manifest/light\` | GET | Minimal bandwidth manifest |
| \`/api/live-state/sse-stats\` | GET | SSE connection stats |
| \`/api/live-state/health\` | GET | Health check |

### Channels
| Endpoint | Method | Description |
|----------|--------|-------------|
| \`/api/channels\` | GET | Get all channels |
| \`/api/channels/:id\` | GET | Get channel by ID |
| \`/api/channels\` | POST | Create channel (admin) |
| \`/api/channels/:id\` | PUT | Update channel (admin) |
| \`/api/channels/:id\` | DELETE | Delete channel (admin) |

### Global Epoch
| Endpoint | Method | Description |
|----------|--------|-------------|
| \`/api/global-epoch\` | GET | Get global broadcast epoch |

---

## 📊 Performance Metrics

### Sync Precision
| Metric | Value |
|--------|-------|
| Clock Sync Accuracy | <50ms |
| Drift Tolerance | 200ms |
| Max Correction Rate | ±15% |
| Seek Threshold | >5s drift |

### API Efficiency
| Metric | Before | After |
|--------|--------|-------|
| API Calls/hour | 1,800 | ~10 |
| Bandwidth/sync | 500 bytes | 20-50 bytes |
| Cache Hit Rate | 60% | 95%+ |

### Connection Quality Thresholds
| Quality | RTT | Drift | Strategy |
|---------|-----|-------|----------|
| Excellent | <100ms | <200ms | WebSocket |
| Good | <300ms | <500ms | WebSocket/SSE |
| Fair | Any | <1s | Predictive |
| Poor | Any | >1s | HTTP Polling |

---

## 📁 Project Structure

\`\`\`
desiTV/
├── client/
│   └── src/
│       ├── components/          # React components
│       ├── hooks/
│       │   └── useConnectionQuality.js  # Connection status hook
│       ├── services/
│       │   ├── api/             # HTTP services
│       │   ├── socket/          # WebSocket client
│       │   └── sync/            # Sync engine (NEW)
│       │       ├── PredictiveEngine.js
│       │       ├── SSEClient.js
│       │       └── SyncOrchestrator.js
│       └── context/             # React contexts
├── server/
│   ├── controllers/
│   │   ├── liveStateController.js
│   │   └── sseController.js     # SSE with backpressure
│   ├── services/
│   │   └── liveStateService.js  # Server-authoritative
│   ├── socket/
│   │   └── index.js             # WebSocket server
│   ├── utils/
│   │   ├── cache.js             # Hybrid L1+L2 cache
│   │   ├── deltaCompression.js  # Delta protocol
│   │   └── manifestGenerator.js # CDN manifests
│   └── routes/
│       └── liveState.js         # Live state routes
└── docs/
\`\`\`

---

## 🔒 Security Features

- **Helmet.js** - Security HTTP headers
- **CORS** - Configured cross-origin access
- **Rate Limiting** - Abuse prevention
- **Input Sanitization** - MongoDB injection prevention
- **JWT Authentication** - Secure admin access
- **CSRF Protection** - Request forgery prevention

---

## 🗺️ Roadmap

- [x] WebSocket support for real-time updates
- [x] SSE fallback for proxy environments
- [x] Predictive client-side sync
- [x] Connection quality indicators
- [x] Delta compression
- [ ] User authentication and profiles
- [ ] Favorite channels and playlists
- [ ] Chromecast support
- [ ] PWA features
- [ ] Offline mode

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (\`git checkout -b feature/amazing-feature\`)
3. Commit your changes (\`git commit -m 'Add amazing feature'\`)
4. Push to the branch (\`git push origin feature/amazing-feature\`)
5. Open a Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 👤 Author

**Swarnapudi Ishwar**

- GitHub: [@pudiish](https://github.com/pudiish)
- Website: [pudiish.github.io/pudi](https://pudiish.github.io/pudi/)

---

## 🙏 Acknowledgments

- Inspired by the nostalgic 2000s Indian TV experience
- Architecture patterns from Netflix, Spotify, and Prime Video
- Built with modern web technologies for the best user experience

---

**Made with ❤️ for the nostalgic 2000s Indian TV experience**

*Power Dabaao Aur Shuru Karo!* 🔴
