/**
 * DesiTV Server - MongoDB + Cache + WebSocket Architecture
 * 
 * Architecture:
 * - MongoDB Atlas as source of truth
 * - In-memory cache for fast reads
 * - WebSocket for real-time client updates
 */

const express = require('express');
const mongoose = require('mongoose');
const createCors = require('./middleware/cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const compression = require('compression');

// Load environment variables
const rootEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}
dotenv.config();

const app = express();

// Environment configuration
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000;
const CLIENT_PORT = process.env.VITE_CLIENT_PORT || 5173;

// Security middleware
const { 
  securityMiddleware, 
  generalLimiter, 
  apiLimiter,
  connectionTracker,
  requestSizeLimit,
  FREE_TIER_LIMITS 
} = require('./middleware/security');

// Apply security middleware first
securityMiddleware.forEach(middleware => {
  app.use(middleware);
});

// HTTP compression
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
  threshold: 1024,
}));

app.use(connectionTracker);
app.use(requestSizeLimit);
app.use(generalLimiter);

// HTTPS enforcement in production
if (isProduction) {
  app.use((req, res, next) => {
    const isSecure = req.secure || 
      req.header('x-forwarded-proto') === 'https' ||
      req.header('x-forwarded-proto') === 'https,' ||
      req.header('x-forwarded-proto')?.startsWith('https');
    
    if (!isSecure) {
      const host = req.header('host') || req.hostname;
      return res.redirect(301, `https://${host}${req.url}`);
    }
    
    next();
  });
}

// CORS configuration
const getLocalIP = () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
};

const corsOptions = {
  origin: isProduction 
    ? [
      process.env.CLIENT_URL,
      process.env.CORS_ORIGIN,
      /^https:\/\/(desi-?tv|desitv)[^.]*\.vercel\.app$/,
      /^https:\/\/(desi-?tv|desitv)[^.]*\.onrender\.com$/,
    ].filter(Boolean)
    : [
      `http://localhost:${CLIENT_PORT}`, 
      'http://localhost:3000', 
      `http://127.0.0.1:${CLIENT_PORT}`,
      /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
      /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
    ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
};
app.use(createCors(corsOptions));

// Middleware
app.use(express.json({ limit: '1mb' }));

// Request logging
if (!isProduction || process.env.DEBUG) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// Routes
const channelRoutes = require('./routes/channels');
const authRoutes = require('./routes/auth');
const categoriesRoutes = require('./routes/categories');
const youtubeRoutes = require('./routes/youtube');
const broadcastStateRoutes = require('./routes/broadcastState');
const sessionRoutes = require('./routes/session');
const monitoringRoutes = require('./routes/monitoring');
const analyticsRoutes = require('./routes/analytics');
const globalEpochRoutes = require('./routes/globalEpoch');
const viewerCountRoutes = require('./routes/viewerCount');
const liveStateRoutes = require('./routes/liveState');
const chatRoutes = require('./routes/chat');

// CSRF protection
const { getCsrfToken, csrfProtection, csrfRefresh } = require('./middleware/csrf');

app.get('/api/csrf-token', getCsrfToken);
app.use('/api', apiLimiter);
app.use('/api', csrfProtection);
app.use('/api', csrfRefresh);

// Mount routes
app.use('/api/global-epoch', globalEpochRoutes);
app.use('/api/live-state', liveStateRoutes);
app.use('/api/viewer-count', viewerCountRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/broadcast-state', broadcastStateRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/health', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ 
    status: 'ok',
    environment: isProduction ? 'production' : 'development',
    timestamp: new Date().toISOString(),
    mongodb: mongoStatus,
    security: {
      rateLimiting: 'enabled',
      helmet: 'enabled',
      mongoSanitize: 'enabled',
      freeTierLimits: FREE_TIER_LIMITS
    }
  });
});

// Diagnostics endpoint
app.get('/api/diagnostics', async (req, res) => {
  const ChannelDataService = require('./services/ChannelDataService');
  const stats = await ChannelDataService.getStats().catch(() => ({}));
  
  res.json({
    environment: isProduction ? 'production' : 'development',
    nodeVersion: process.version,
    mongodb: {
      connected: mongoose.connection.readyState === 1,
      host: mongoose.connection.host || 'not connected'
    },
    dataService: stats,
    apiKeys: {
      googleAiConfigured: !!process.env.GOOGLE_AI_KEY,
      youtubeConfigured: !!process.env.YOUTUBE_API_KEY,
      mongoConfigured: !!process.env.MONGO_URI
    },
    timestamp: new Date().toISOString()
  });
});

// Error handler
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

app.get('/', (req, res) => res.send('DesiTV™ API running (MongoDB + WebSocket)'));

// ============================================
// SERVER STARTUP
// ============================================

(async () => {
  const HOST = process.env.HOST || '0.0.0.0';
  
  // Connect to MongoDB
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error('╔═══════════════════════════════════════════════════════════════╗');
    console.error('║  ❌ MONGO_URI environment variable is required!               ║');
    console.error('║                                                               ║');
    console.error('║  Please set MONGO_URI in your .env file:                      ║');
    console.error('║  MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/desitv ║');
    console.error('╚═══════════════════════════════════════════════════════════════╝');
    process.exit(1);
  }

  console.log('[DesiTV] Connecting to MongoDB...');
  try {
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('[DesiTV] ✅ MongoDB connected');
    
    // Auto-migrate if database is empty
    const Channel = require('./models/Channel');
    const channelCount = await Channel.countDocuments();
    
    if (channelCount === 0) {
      console.log('[DesiTV] 📥 Database is empty, checking for JSON data to migrate...');
      
      const jsonPaths = [
        path.resolve(__dirname, '../channels.json'),
        path.resolve(__dirname, '../client/public/data/channels.json')
      ];
      
      for (const jsonPath of jsonPaths) {
        if (fs.existsSync(jsonPath)) {
          try {
            const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            if (jsonData.channels && jsonData.channels.length > 0) {
              console.log(`[DesiTV] Found ${jsonData.channels.length} channels in JSON, migrating...`);
              
              const ChannelDataService = require('./services/ChannelDataService');
              const result = await ChannelDataService.importFromJSON(jsonData);
              
              console.log(`[DesiTV] ✅ Migrated ${result.imported} channels`);
              break;
            }
          } catch (err) {
            console.warn(`[DesiTV] Could not parse ${jsonPath}:`, err.message);
          }
        }
      }
    } else {
      console.log(`[DesiTV] 📊 Found ${channelCount} channels in MongoDB`);
    }
    
  } catch (err) {
    console.error('[DesiTV] ❌ MongoDB connection failed:', err.message);
    console.error('[DesiTV] Please check your MONGO_URI and network connection');
    process.exit(1);
  }

  // Create HTTP server
  const http = require('http');
  const server = http.createServer(app);
  
  // Initialize Socket.io
  const { initializeSocket, getSocketStats } = require('./socket');
  initializeSocket(server, corsOptions);
  
  // Socket stats endpoint
  app.get('/api/socket-stats', (req, res) => {
    res.json(getSocketStats());
  });
  
  // Start server
  server.listen(PORT, HOST, () => {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                    DesiTV Server Started                       ║');
    console.log('╠═══════════════════════════════════════════════════════════════╣');
    console.log(`║  🌐 Server:    http://${HOST}:${PORT}`.padEnd(66) + '║');
    console.log(`║  📦 MongoDB:   Connected`.padEnd(66) + '║');
    console.log(`║  🔌 WebSocket: Enabled (real-time updates)`.padEnd(66) + '║');
    console.log(`║  💾 Cache:     In-memory + Redis (if available)`.padEnd(66) + '║');
    if (!isProduction) {
      const localIP = getLocalIP();
      console.log(`║  🏠 Local:     http://localhost:${PORT}`.padEnd(66) + '║');
      console.log(`║  📡 Network:   http://${localIP}:${PORT}`.padEnd(66) + '║');
    }
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('');
  });

  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
      process.exit(1);
    }
    console.error('Server error:', err);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[DesiTV] Received ${signal}, shutting down gracefully...`);
    
    try {
      // Close socket connections
      const { shutdown: shutdownSocket } = require('./socket');
      shutdownSocket();
      
      // Close MongoDB connection
      await mongoose.connection.close();
      console.log('[DesiTV] MongoDB disconnected');
      
      // Close HTTP server
      server.close(() => {
        console.log('[DesiTV] Server closed');
        process.exit(0);
      });
      
      // Force exit after 10 seconds
      setTimeout(() => {
        console.error('[DesiTV] Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    } catch (e) {
      console.error('[DesiTV] Error during shutdown:', e);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
})();
