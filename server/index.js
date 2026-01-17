const express = require('express');
const mongoose = require('mongoose');
const createCors = require('./middleware/cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const compression = require('compression');
const { warmChannelsList, startPeriodicWarming } = require('./utils/cacheWarmer');

// Load project root .env first (useful when running from project root),
// then load server/.env to allow overrides.
const rootEnv = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(rootEnv)) {
	dotenv.config({ path: rootEnv });
}
// Load server/.env if present (will override root values)
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
			/\.vercel\.app$/,  // Allow all Vercel deployments
			/\.onrender\.com$/, // Allow Render deployments
			process.env.CLIENT_URL, // Custom client URL if set
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
	allowedHeaders: ['Content-Type', 'Authorization'],
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

// MongoDB connection options (useNewUrlParser/useUnifiedTopology removed - deprecated in Mongoose 7+)
const mongoOptions = {
	maxPoolSize: isProduction ? 5 : 3,
	minPoolSize: 1,
	serverSelectionTimeoutMS: 5000,
	socketTimeoutMS: 30000,
	retryWrites: true,
	retryReads: true,
	maxIdleTimeMS: 30000,
	connectTimeoutMS: 10000,
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
const liveStateRoutes = require('./routes/liveState'); // Admin/debugging only - clients calculate locally
const chatRoutes = require('./routes/chat'); // 🤖 DesiAgent chatbot

// CSRF protection
const { getCsrfToken, csrfProtection, csrfRefresh } = require('./middleware/csrf');

app.get('/api/csrf-token', getCsrfToken);
app.use('/api', apiLimiter);
app.use('/api', csrfProtection);
app.use('/api', csrfRefresh);

// Mount routes
app.use('/api/global-epoch', globalEpochRoutes);
app.use('/api/live-state', liveStateRoutes); // Admin/debugging only - clients use BroadcastStateManager
app.use('/api/viewer-count', viewerCountRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/broadcast-state', broadcastStateRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/chat', chatRoutes); // 🤖 DesiAgent chatbot

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

// Diagnostic endpoint - check API key configuration
app.get('/api/diagnostics', (req, res) => {
	const diagnostics = {
		environment: isProduction ? 'production' : 'development',
		nodeVersion: process.version,
		apiKeys: {
			googleAiConfigured: !!process.env.GOOGLE_AI_KEY,
			youtubeConfigured: !!process.env.YOUTUBE_API_KEY,
			mongoConfigured: !!process.env.MONGO_URI
		},
		envVarsPresent: {
			GOOGLE_AI_KEY: !!process.env.GOOGLE_AI_KEY,
			YOUTUBE_API_KEY: !!process.env.YOUTUBE_API_KEY,
			MONGO_URI: !!process.env.MONGO_URI
		},
		timestamp: new Date().toISOString()
	};
	res.json(diagnostics);
});

// error handler (last middleware)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

app.get('/', (req, res) => res.send('DesiTV™ API running'));

// Route to manually trigger JSON regeneration (pipeline mode - on-demand)
// This is the primary way to update channels.json after MongoDB changes
app.post('/api/regenerate-json', async (req, res) => {
	try {
		const dbConnectionManager = require('./utils/dbConnection');
		
		// Ensure MongoDB is connected (lazy connection)
		if (!dbConnectionManager.isReady()) {
			console.log('[Server] Connecting to MongoDB for JSON regeneration...');
			await dbConnectionManager.connect(process.env.MONGO_URI, {
				maxPoolSize: 3,
				minPoolSize: 1,
				serverSelectionTimeoutMS: 5000,
			});
		}
		
		const { regenerateChannelsJSON } = require('./utils/generateJSON');
		const result = await regenerateChannelsJSON();
		
		res.json({ 
			success: true, 
			message: `JSON regenerated with ${result.channels.length} channels`,
			channelsCount: result.channels.length,
			version: result.version,
			generatedAt: result.generatedAt
		});
	} catch (error) {
		console.error('[Server] Error regenerating JSON:', error);
		res.status(500).json({ 
			success: false, 
			message: error.message 
		});
	}
});

// Database connection and server start
const dbConnectionManager = require('./utils/dbConnection');

// Pipeline-only mode: MongoDB connection is lazy (only when needed)
// Server starts without requiring MongoDB, reducing cold start time
dbConnectionManager.onConnection(async () => {
	console.log(`[DesiTV] MongoDB connected (${isProduction ? 'production' : 'development'})`);
	
	// Pipeline-only: Only generate JSON if it doesn't exist (first-time setup)
	// Otherwise, JSON is generated on-demand via /api/regenerate-json
	try {
		const { isJSONEmptyOrInvalid, ensureChannelsJSON } = require('./utils/generateJSON');
		const needsJSON = await isJSONEmptyOrInvalid();
		
		if (needsJSON) {
			console.log('[DesiTV] channels.json missing or invalid, generating from MongoDB...');
			const jsonData = await ensureChannelsJSON();
			console.log(`[DesiTV] ✅ channels.json generated with ${jsonData.channels.length} channels`);
		} else {
			console.log('[DesiTV] ✅ channels.json exists - pipeline mode (no auto-generation)');
		}
	} catch (jsonErr) {
		console.warn('[DesiTV] JSON check failed (non-critical):', jsonErr.message);
	}
	
	// Removed automatic warmups - server stays cold until needed
	// Cache warming happens on-demand when admin operations occur
	console.log('[DesiTV] Server in pipeline-only mode - MongoDB connected but server stays cold');
});

dbConnectionManager.connect(process.env.MONGO_URI, mongoOptions)
	.then(async () => {
		const HOST = process.env.HOST || '0.0.0.0';
		
		// Create HTTP server
		const http = require('http');
		const server = http.createServer(app);
		
		// Initialize Socket.io (chat only - sync removed)
		const { initializeSocket, getSocketStats } = require('./socket');
		initializeSocket(server, corsOptions);
		
		// Socket stats endpoint (chat connections only)
		app.get('/api/socket-stats', (req, res) => {
			res.json(getSocketStats());
		});
		
		server.listen(PORT, HOST, () => {
			console.log(`[DesiTV] Server listening on ${HOST}:${PORT}`);
			console.log(`[DesiTV] WebSocket enabled (chat only)`);
			console.log(`[DesiTV] Sync: Pure client-side calculation`);
			if (!isProduction) {
				const localIP = getLocalIP();
				console.log(`[DesiTV] Local:   http://localhost:${PORT}`);
				console.log(`[DesiTV] Network: http://${localIP}:${PORT}`);
			}
		});

		server.on('error', (err) => {
			if (err && err.code === 'EADDRINUSE') {
				console.error(`Port ${PORT} is already in use. Make sure no other process is listening on this port.`);
				process.exit(1);
			}
			console.error('Server error:', err);
		});

		const shutdown = async (signal, exitCode = 0) => {
			console.log('Received', signal, 'shutting down server...');
			try {
				server.close(() => {
					console.log('Server closed');
					
					if (signal === 'SIGUSR2') {
						setTimeout(() => process.exit(0), 100);
					} else {
						dbConnectionManager.disconnect().then(() => {
							process.exit(exitCode);
						}).catch((e) => {
							console.error('Error disconnecting DB:', e);
							process.exit(1);
						});
					}
				});
				
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
		process.once('SIGUSR2', () => {
			shutdown('SIGUSR2');
		});
	})
	.catch(err => {
		console.error('[DesiTV] Failed to start server:', err.message);
		console.error('[DesiTV] Database connection will retry automatically...');
	});

