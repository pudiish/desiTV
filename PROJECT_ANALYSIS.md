# DesiTV™ Project Analysis

## 📋 Project Overview

**DesiTV™** is a nostalgic retro TV streaming platform that recreates the 2000s Indian television experience. It provides a pseudo-live broadcast system where all users watching the same channel see synchronized content, simulating real TV viewing.

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 + Vite
- **Backend**: Express.js + Node.js
- **Database**: MongoDB (Mongoose)
- **Authentication**: JWT-based auth system
- **Video**: YouTube API integration via react-youtube

### Project Structure

```
desiTV/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── admin/         # Admin dashboard components
│   │   ├── components/     # TV UI components (TVFrame, TVRemote, etc.)
│   │   ├── pages/         # Route pages (Home, Landing, Admin)
│   │   ├── services/      # API clients, state management
│   │   ├── hooks/         # Custom React hooks
│   │   ├── utils/         # Utilities (Cache, Session, Broadcast State)
│   │   └── monitoring/    # Health monitoring modules
│   └── public/            # Static assets (sounds, images)
│
├── server/                # Express API server
│   ├── routes/            # API endpoints
│   ├── models/            # MongoDB schemas
│   ├── middleware/        # Security, auth, error handling
│   └── utils/             # Server utilities
│
└── start.sh               # Development server launcher
```

## 🔑 Key Features

### 1. **Pseudo-Live Broadcast System**
- Synchronized viewing across all users
- Broadcast state managed via `BroadcastState` model
- Continuous playlist playback with epoch-based timing
- Session recovery to resume where user left off

### 2. **Retro TV UI**
- CRT effects and scanlines
- Static noise effects
- Authentic TV sounds (shutdown, static)
- TV frame with remote control interface
- Channel menu overlay

### 3. **Channel Management**
- Multiple channels (9XM, SAB TV, MTV, etc.)
- Category-based filtering
- Video playlists per channel
- YouTube video integration

### 4. **Admin Dashboard**
- Protected admin routes with JWT auth
- Channel management (CRUD operations)
- Video management
- System monitoring and health checks
- Broadcast state monitoring
- Cache management
- API health monitoring

### 5. **Session Management**
- User session persistence in MongoDB
- Resume playback from last position
- Session cleanup and recovery

### 6. **Security Features**
- Helmet.js for security headers
- Rate limiting (general + API-specific)
- MongoDB injection protection
- Request size limits
- Connection tracking for free tier limits
- CORS configuration

## 📡 API Routes

### Public Routes
- `GET /health` - Health check endpoint
- `GET /api/channels` - List all channels
- `GET /api/categories` - Get channel categories
- `GET /api/broadcast-state` - Get current broadcast state
- `GET /api/session` - Get user session
- `POST /api/session` - Save user session

### Protected Routes (Admin)
- `POST /api/auth/login` - Admin login
- `POST /api/auth/logout` - Admin logout
- `GET /api/auth/verify` - Verify JWT token
- `GET /api/monitoring/*` - System monitoring endpoints

### YouTube Routes
- `GET /api/youtube/*` - YouTube API proxy endpoints

## 🗄️ Database Models

### Channel
- `name`: Channel name (unique)
- `playlistStartEpoch`: Start time for playlist
- `items`: Array of video objects (title, youtubeId, duration, etc.)

### BroadcastState
- Tracks current broadcast position across channels
- Manages synchronized playback state

### UserSession
- Stores user playback state
- Enables session recovery

### Admin
- Admin user credentials
- JWT-based authentication

## 🎨 Frontend Components

### Core Components
- **TVFrame**: Main TV display with video player
- **TVRemote**: Remote control interface
- **TVMenuV2**: Channel selection menu
- **CategoryList**: Channel category filter
- **StaticEffect**: TV static overlay
- **BufferingOverlay**: Loading states

### Pages
- **Landing**: Welcome/landing page
- **Home**: Main TV viewing experience
- **AdminLogin**: Admin authentication
- **AdminDashboard**: Admin control panel

### State Management
- **HybridStateManager**: Manages broadcast state
- **CacheManager**: Client-side caching
- **SessionManager**: Session persistence
- **BroadcastStateManager**: Broadcast synchronization

## 🔧 Configuration

### Environment Variables (.env)
- `MONGO_URI`: MongoDB connection string (required)
- `JWT_SECRET`: JWT signing secret (required)
- `PORT`: Server port (default: 5002)
- `VITE_CLIENT_PORT`: Client dev port (default: 5173)
- `ADMIN_USERNAME`: Default admin username (optional)
- `ADMIN_PASSWORD`: Default admin password (optional)

### Development Setup
- Uses `concurrently` to run client + server
- Vite dev server with hot reload
- Nodemon for server auto-restart
- Network access enabled (0.0.0.0 binding)

## 🚀 Deployment

### Supported Platforms
- **Vercel**: Frontend deployment
- **Render.com**: Backend API (render.yaml included)
- MongoDB Atlas or local MongoDB

### Build Process
1. `npm run build` - Builds React frontend
2. `npm start` - Starts production server

## 📊 Monitoring & Health

- Health check endpoint (`/health`)
- Component health monitoring
- API health tracking
- Cache monitoring
- Error aggregation
- Metrics collection

## 🎯 Key Design Patterns

1. **Singleton Pattern**: Environment config, module manager
2. **Observer Pattern**: Broadcast state updates
3. **Factory Pattern**: Module initialization
4. **Middleware Pattern**: Express middleware chain
5. **Context API**: React AuthContext for auth state

## 🔐 Security Implementation

- Helmet.js security headers
- Rate limiting (100 req/15min general, 60 req/min API)
- MongoDB sanitization
- HTTP Parameter Pollution protection
- Request size limits (1MB)
- Connection tracking
- JWT token authentication
- CORS with network access support

## 📝 Development Notes

- All configuration via `.env` (no hardcoded values)
- Supports local network access for mobile testing
- Session persistence for seamless experience
- Broadcast synchronization for pseudo-live experience
- Comprehensive error handling and logging

## 🎬 User Experience Flow

1. **Landing Page** → Welcome screen with project info
2. **TV View** → Main viewing experience
   - Power on/off
   - Channel navigation
   - Volume control
   - Menu access
3. **Admin Dashboard** → Protected admin interface
   - Channel management
   - System monitoring
   - Video management

---

**Created**: 2025-01-27
**Version**: 1.0.0
**Author**: Swarnapudi Ishwar (PudiIsh)


