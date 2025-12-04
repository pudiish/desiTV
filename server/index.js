const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
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
const isProduction = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 5002;

// ===== CORS CONFIGURATION =====
const corsOptions = {
	origin: isProduction 
		? [
			/\.vercel\.app$/,  // Allow all Vercel deployments
			/\.onrender\.com$/, // Allow Render deployments
			process.env.CLIENT_URL, // Custom client URL if set
		].filter(Boolean)
		: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
	credentials: true,
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
	allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

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

app.use('/api/channels', channelRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/broadcast-state', broadcastStateRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/monitoring', monitoringRoutes);

// health check
app.get('/health', (req, res) => res.json({ 
	status: 'ok',
	environment: isProduction ? 'production' : 'development',
	timestamp: new Date().toISOString()
}));

// error handler (last middleware)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

app.get('/', (req, res) => res.send('DesiTV™ API running'));

// ===== DATABASE CONNECTION & SERVER START =====
mongoose.connect(process.env.MONGO_URI, mongoOptions)
	.then(() => {
		console.log(`[DesiTV™] MongoDB connected (${isProduction ? 'production' : 'development'})`);
		const server = app.listen(PORT, () => {
			console.log(`[DesiTV™] Server listening on port ${PORT}`);
			if (!isProduction) {
				console.log(`[DesiTV™] Local: http://localhost:${PORT}`);
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
		const shutdown = async (signal) => {
			console.log('Received', signal, 'shutting down server...');
			try {
				await mongoose.disconnect();
				server.close(() => {
					console.log('Server closed');
					process.exit(0);
				});
			} catch (e) {
				console.error('Error during shutdown', e);
				process.exit(1);
			}
		};

		process.on('SIGINT', () => shutdown('SIGINT'));
		process.on('SIGTERM', () => shutdown('SIGTERM'));
		process.once('SIGUSR2', () => shutdown('SIGUSR2'));
	})
	.catch(err => console.error('Mongo connection error', err));
