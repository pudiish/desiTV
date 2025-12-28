const express = require('express');
const mongoose = require('mongoose');
const createCors = require('./middleware/cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load project root .env first (useful when running from project root),
// then load server/.env to allow overrides.
const rootEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) {
	dotenv.config({ path: rootEnv });
}
// Load server/.env if present (will override root values)
dotenv.config();

const app = express();

// ===== ENVIRONMENT =====
// All configuration comes from .env file - no hardcoded values
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5000; // Default to 5000 if not set
const CLIENT_PORT = process.env.VITE_CLIENT_PORT || 5173; // Default Vite port

// ===== SECURITY MIDDLEWARE =====
const { 
	securityMiddleware, 
	generalLimiter, 
	apiLimiter,
	connectionTracker,
	requestSizeLimit,
	FREE_TIER_LIMITS 
} = require('./middleware/security');

// Apply security middleware FIRST (before any other middleware)
// securityMiddleware is an array: [helmet, sanitize, hpp, logger]
securityMiddleware.forEach(middleware => {
	app.use(middleware);
});

// Connection tracker for free tier (track concurrent connections)
app.use(connectionTracker);

// Request size limit (1MB for free tier)
app.use(requestSizeLimit);

// General rate limiter (100 requests per 15 minutes per IP)
app.use(generalLimiter);

// ===== HTTPS ENFORCEMENT (Production Only) =====
// Redirect HTTP to HTTPS in production for security
if (isProduction) {
	app.use((req, res, next) => {
		// Check if request is already HTTPS
		// x-forwarded-proto is set by reverse proxies (Vercel, Render, etc.)
		const isSecure = req.secure || 
			req.header('x-forwarded-proto') === 'https' ||
			req.header('x-forwarded-proto') === 'https,' ||
			req.header('x-forwarded-proto')?.startsWith('https');
		
		if (!isSecure) {
			// Redirect to HTTPS
			const host = req.header('host') || req.hostname;
			const url = req.url;
			return res.redirect(301, `https://${host}${url}`);
		}
		
		next();
	});
}

// ===== CORS CONFIGURATION =====
// Get local network IP for logging
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
			/\.vercel\.app$/,  // Allow all Vercel deployments
			/\.onrender\.com$/, // Allow Render deployments
			process.env.CLIENT_URL, // Custom client URL if set
		].filter(Boolean)
		: [
			`http://localhost:${CLIENT_PORT}`, 
			'http://localhost:3000', 
			`http://127.0.0.1:${CLIENT_PORT}`,
			// Allow local network access (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
			/^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
			/^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
			/^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
		],
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(createCors(corsOptions));

// ===== MIDDLEWARE =====
app.use(express.json({ limit: '1mb' }));

// Request logging (only in development or if DEBUG is set)
if (!isProduction || process.env.DEBUG) {
	app.use((req, res, next) => {
		console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
		next();
	});
}

// ===== MONGODB CONNECTION =====
const mongoOptions = {
	useNewUrlParser: true,
	useUnifiedTopology: true,
	// Connection pool settings for production
	maxPoolSize: isProduction ? 10 : 5,
	minPoolSize: isProduction ? 2 : 1,
	serverSelectionTimeoutMS: 5000,
	socketTimeoutMS: 45000,
	// Retry settings
	retryWrites: true,
	retryReads: true,
};

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

// ===== CSRF PROTECTION =====
const { getCsrfToken, csrfProtection, csrfRefresh } = require('./middleware/csrf');

// CSRF token endpoint (must be before CSRF protection, excluded from rate limiting)
app.get('/api/csrf-token', getCsrfToken);

// Apply API rate limiter to all API routes (60 requests per minute)
// Rate limiting before CSRF to prevent abuse
app.use('/api', apiLimiter);

// Apply CSRF protection to all API routes (except GET, HEAD, OPTIONS)
app.use('/api', csrfProtection);

// Optional: Refresh CSRF token on successful requests
app.use('/api', csrfRefresh);

// Mount routes
app.use('/api/global-epoch', globalEpochRoutes);
app.use('/api/viewer-count', viewerCountRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/broadcast-state', broadcastStateRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/analytics', analyticsRoutes);

// health check with security stats
app.get('/health', (req, res) => res.json({ 
	status: 'ok',
	environment: isProduction ? 'production' : 'development',
	timestamp: new Date().toISOString(),
	security: {
		rateLimiting: 'enabled',
		helmet: 'enabled',
		mongoSanitize: 'enabled',
		freeTierLimits: FREE_TIER_LIMITS
	}
}));

// error handler (last middleware)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

app.get('/', (req, res) => res.send('DesiTV™ API running'));

// Route to manually trigger JSON regeneration (useful for client fallback)
app.post('/api/regenerate-json', async (req, res) => {
	try {
		const { ensureChannelsJSON } = require('./utils/generateJSON');
		const result = await ensureChannelsJSON();
		res.json({ 
			success: true, 
			message: `JSON regenerated with ${result.channels.length} channels`,
			channelsCount: result.channels.length 
		});
	} catch (error) {
		console.error('[Server] Error regenerating JSON:', error);
		res.status(500).json({ 
			success: false, 
			message: error.message 
		});
	}
});

// ===== DATABASE CONNECTION & SERVER START =====
const dbConnectionManager = require('./utils/dbConnection');

// Register connection callback
dbConnectionManager.onConnection(async () => {
	console.log(`[DesiTV™] MongoDB connected (${isProduction ? 'production' : 'development'})`);
	
	// Ensure channels.json exists and is populated from MongoDB
	try {
		const { ensureChannelsJSON } = require('./utils/generateJSON');
		const jsonData = await ensureChannelsJSON();
		console.log(`[DesiTV™] channels.json ready with ${jsonData.channels.length} channels`);
	} catch (jsonErr) {
		console.warn('[DesiTV™] Warning: Failed to ensure channels.json:', jsonErr.message);
		console.warn('[DesiTV™] Server will continue, but JSON may need manual regeneration');
	}
});

// Start database connection with retry logic
dbConnectionManager.connect(process.env.MONGO_URI, mongoOptions)
	.then(async () => {
		// Bind to 0.0.0.0 to allow network access
		const HOST = process.env.HOST || '0.0.0.0';
		const server = app.listen(PORT, HOST, () => {
			console.log(`[DesiTV™] Server listening on ${HOST}:${PORT}`);
			if (!isProduction) {
				const localIP = getLocalIP();
				console.log(`[DesiTV™] Local:   http://localhost:${PORT}`);
				console.log(`[DesiTV™] Network: http://${localIP}:${PORT}`);
			}
		});

		server.on('error', (err) => {
			if (err && err.code === 'EADDRINUSE') {
				console.error(`Port ${PORT} is already in use. Make sure no other process is listening on this port.`);
				process.exit(1);
			}
			console.error('Server error:', err);
		});

		// Graceful shutdown helpers for nodemon and signals
		const shutdown = async (signal, exitCode = 0) => {
			console.log('Received', signal, 'shutting down server...');
			try {
				// Close server first (stop accepting new connections)
				server.close(() => {
					console.log('Server closed');
					
					// For SIGUSR2 (nodemon restart), don't disconnect MongoDB
					// Let nodemon handle the restart and MongoDB will reconnect
					if (signal === 'SIGUSR2') {
						// Nodemon expects the process to exit, but we've closed the server
						// The connection manager will handle reconnection on restart
						setTimeout(() => process.exit(0), 100);
					} else {
						// For other signals, fully disconnect
						dbConnectionManager.disconnect().then(() => {
							process.exit(exitCode);
						}).catch((e) => {
							console.error('Error disconnecting DB:', e);
							process.exit(1);
						});
					}
				});
				
				// Force close after 10 seconds if graceful shutdown fails
				setTimeout(() => {
					console.error('Forced shutdown after timeout');
					if (signal !== 'SIGUSR2') {
						dbConnectionManager.disconnect().finally(() => {
							process.exit(1);
						});
					} else {
						process.exit(0);
					}
				}, 10000);
			} catch (e) {
				console.error('Error during shutdown', e);
				process.exit(1);
			}
		};

		process.on('SIGINT', () => shutdown('SIGINT'));
		process.on('SIGTERM', () => shutdown('SIGTERM'));
		// SIGUSR2 is used by nodemon for restart - handle gracefully
		process.once('SIGUSR2', () => {
			shutdown('SIGUSR2');
		});
	})
	.catch(err => {
		console.error('[DesiTV™] ❌ Failed to start server:', err.message);
		console.error('[DesiTV™] Database connection will retry automatically...');
		// Don't exit - let the connection manager handle retries
		// Server can still start and serve static JSON fallback
	});

// Graceful shutdown - cleanup Redis cache
process.on('SIGINT', async () => {
	const cache = require('./utils/cache');
	if (cache && typeof cache.destroy === 'function') {
		await cache.destroy();
	}
});

process.on('SIGTERM', async () => {
	const cache = require('./utils/cache');
	if (cache && typeof cache.destroy === 'function') {
		await cache.destroy();
	}
});
