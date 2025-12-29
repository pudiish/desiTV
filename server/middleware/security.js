/**
 * Security Middleware for DesiTV™
 * 
 * Provides:
 * - Rate limiting (DDoS protection)
 * - Request sanitization
 * - Security headers (Helmet)
 * - Traffic management for free tier limits
 * 
 * Free Tier Limits:
 * - Vercel: 100GB bandwidth/month, 100k function invocations
 * - Render: 750 hours/month, 100GB bandwidth
 * - MongoDB Atlas: 512MB storage, 100 connections
 */

const { createRateLimiter } = require('./rateLimiter');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

// ===== RATE LIMITING CONFIGURATION =====
// Optimized for free tier limits
// Note: Using default keyGenerator which handles IPv6 properly

/**
 * General rate limiter - prevents DDoS and excessive API calls
 * 1000 requests per 15 minutes per IP (safe for testing)
 * Production: Reduce to 500 for tighter security
 */
const generalLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes (testing, reduce for production)
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
    retryAfter: 900
  },
  // Skip rate limiting for health checks and static assets
  skip: (req) => req.path === '/health' || req.path.startsWith('/assets'),
  // Use IP from request
  keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown'
});

/**
 * Strict rate limiter for auth endpoints
 * Safe for testing: 30 attempts per 15 minutes (2 per minute)
 * Production: Reduce to 5-10 attempts for security
 */
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 login attempts (safe for testing, reduce for production)
  message: {
    error: 'Too many login attempts',
    message: 'Account temporarily locked. Try again in 15 minutes.',
    retryAfter: 900
  },
  keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown'
});

/**
 * API rate limiter - OPTIMIZED FOR FREE TIER
 * Reduced to prevent excessive load on free tier resources
 */
const apiLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 300, // Reduced from 600 - free tier optimization (still allows 5 req/sec)
  message: {
    error: 'API rate limit exceeded',
    message: 'Too many API requests. Please slow down.',
    retryAfter: 60
  },
  // Skip internal monitoring endpoints and global-epoch from rate limiting
  // global-epoch never changes and is heavily cached, safe to exclude
  skip: (req) => 
    req.path.includes('/monitoring/') || 
    req.path.includes('/broadcast-state/') ||
    req.path === '/global-epoch' || 
    req.path.startsWith('/global-epoch'),
  keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown'
});

/**
 * Admin route rate limiter
 * 30 requests per minute (admin operations should be less frequent)
 */
const adminLimiter = createRateLimiter({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: {
    error: 'Admin rate limit exceeded',
    message: 'Too many admin requests.',
    retryAfter: 60
  },
  keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown'
});

// ===== SECURITY HEADERS (HELMET) =====
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.youtube.com", "https://s.ytimg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["https://www.youtube.com", "https://www.youtube-nocookie.com"],
      connectSrc: ["'self'", "https://www.googleapis.com"],
      mediaSrc: ["'self'", "https:", "blob:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for YouTube embeds
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Add Strict-Transport-Security header for HTTPS enforcement
  strictTransportSecurity: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
});

// ===== REQUEST SANITIZATION =====
/**
 * Sanitize MongoDB queries to prevent NoSQL injection
 */
const sanitizeRequest = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`[Security] Sanitized key "${key}" in request from ${req.ip}`);
  }
});

/**
 * Prevent HTTP Parameter Pollution
 */
const preventParamPollution = hpp({
  whitelist: ['tags', 'category'] // Allow arrays for these params
});

// ===== CONCURRENT USER LIMITER =====
// OPTIMIZED FOR FREE TIER: Increased capacity with efficient tracking
// Free tier can handle 80-100 users with optimized connection pooling
const activeConnections = new Map();
// Increased default to 80 (free tier optimized, was 50)
const MAX_CONCURRENT_USERS = parseInt(process.env.MAX_CONCURRENT_USERS) || 80;

const connectionTracker = (req, res, next) => {
  const clientId = req.headers['x-forwarded-for']?.split(',')[0] || 
                   req.headers['x-real-ip'] || 
                   req.ip;
  
  // OPTIMIZED: Clean up old connections more aggressively (older than 2 minutes)
  // Reduces memory usage and allows more concurrent users
  const now = Date.now();
  const CLEANUP_THRESHOLD = 2 * 60 * 1000; // 2 minutes (reduced from 5)
  for (const [id, timestamp] of activeConnections.entries()) {
    if (now - timestamp > CLEANUP_THRESHOLD) {
      activeConnections.delete(id);
    }
  }
  
  // Update or add connection
  activeConnections.set(clientId, now);
  
  // OPTIMIZED: More lenient check - allow existing users to continue
  // Only block truly new users when at capacity
  if (activeConnections.size > MAX_CONCURRENT_USERS) {
    // Find if this is a new user (not seen in last 30 seconds)
    const existingTimestamp = activeConnections.get(clientId);
    if (!existingTimestamp || now - existingTimestamp > 30000) {
      // Only block if connection is truly new (30s threshold)
      return res.status(503).json({
        error: 'Server at capacity',
        message: 'Too many users. Please try again later.',
        currentUsers: activeConnections.size,
        maxUsers: MAX_CONCURRENT_USERS
      });
    }
  }
  
  next();
};

// ===== REQUEST SIZE LIMITER =====
const requestSizeLimiter = (maxSize = '1mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxBytes = parseSize(maxSize);
    
    if (contentLength > maxBytes) {
      return res.status(413).json({
        error: 'Payload too large',
        message: `Request body exceeds ${maxSize} limit`,
        maxSize: maxSize
      });
    }
    next();
  };
};

function parseSize(size) {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = size.toLowerCase().match(/^(\d+)(b|kb|mb|gb)?$/);
  if (!match) return 1024 * 1024; // Default 1MB
  return parseInt(match[1]) * (units[match[2]] || 1);
}

// ===== SECURITY LOGGING =====
const securityLogger = (req, res, next) => {
  // Log suspicious requests
  const suspicious = [
    req.path.includes('..'),
    req.path.includes('<script'),
    req.path.includes('SELECT'),
    req.path.includes('DROP'),
    /\$[a-z]+/i.test(JSON.stringify(req.body || {})),
  ];
  
  if (suspicious.some(s => s)) {
    console.warn(`[Security] Suspicious request from ${req.ip}: ${req.method} ${req.path}`);
  }
  
  next();
};

// ===== COMBINED SECURITY MIDDLEWARE =====
/**
 * Combined security middleware for easy application
 * Applies: Helmet, Sanitization, HPP in order
 */
const securityMiddleware = [
  helmetConfig,
  sanitizeRequest,
  preventParamPollution,
  securityLogger
];

// ===== FREE TIER LIMITS DOCUMENTATION =====
// OPTIMIZED FOR FREE TIER - All limits set to maximize capacity
const FREE_TIER_LIMITS = {
  maxConcurrentUsers: MAX_CONCURRENT_USERS, // 80 (optimized from 50)
  maxDailyRequests: 50000, // Increased estimate (with caching, can handle more)
  maxRequestSize: '1mb',
  rateLimits: {
    general: '500 requests per 15 minutes', // Optimized
    auth: '30 attempts per 15 minutes',
    api: '300 requests per minute', // Optimized
    admin: '30 requests per minute'
  },
  optimizations: {
    mongoPoolSize: 5, // Reduced for free tier efficiency
    redisMemory: '22MB', // Increased from 20MB (more aggressive)
    cacheTTL: 'Extended for fewer DB queries',
    compression: 'More aggressive (512B threshold)',
    keyShortening: 'Ultra-short keys (saves ~30 bytes per key)'
  }
};

// ===== EXPORTS =====
module.exports = {
  // Rate limiters
  generalLimiter,
  authLimiter,
  apiLimiter,
  adminLimiter,
  
  // Combined security middleware array
  securityMiddleware,
  
  // Individual security middleware
  helmetConfig,
  sanitizeRequest,
  preventParamPollution,
  
  // Traffic management
  connectionTracker,
  connectionLimiter: connectionTracker, // Alias for backward compatibility
  requestSizeLimiter,
  requestSizeLimit: requestSizeLimiter('1mb'), // Pre-configured 1MB limit
  
  // Logging
  securityLogger,
  
  // Stats
  getActiveConnections: () => activeConnections.size,
  MAX_CONCURRENT_USERS,
  FREE_TIER_LIMITS
};
