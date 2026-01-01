/**
 * CSRF Protection Middleware
 * 
 * Prevents Cross-Site Request Forgery attacks by requiring tokens
 * for state-changing requests (POST, PUT, DELETE, PATCH)
 * 
 * Implementation:
 * - Token stored in session/cookie
 * - Token sent in header (X-CSRF-Token)
 * - Validated on state-changing requests
 */

const crypto = require('crypto');

// In-memory token store (for stateless operation)
// In production, consider using Redis or session store
const tokenStore = new Map();
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
const MAX_TOKEN_STORE_SIZE = 10000; // Maximum tokens to store
const CLEANUP_INTERVAL = 60 * 60 * 1000; // Cleanup every hour

// Start periodic cleanup
let cleanupIntervalId = null;

function startPeriodicCleanup() {
  if (cleanupIntervalId) return;
  cleanupIntervalId = setInterval(cleanupExpiredTokens, CLEANUP_INTERVAL);
  // Don't prevent Node.js from exiting
  if (cleanupIntervalId.unref) cleanupIntervalId.unref();
}

function stopPeriodicCleanup() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

// Start cleanup on module load
startPeriodicCleanup();

/**
 * Generate a secure random CSRF token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Store token with expiry
 */
function storeToken(token, req) {
  const clientId = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const key = `${clientId}-${token}`;
  
  tokenStore.set(key, {
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + TOKEN_EXPIRY
  });

  // Clean up if store exceeds max size
  if (tokenStore.size > MAX_TOKEN_STORE_SIZE) {
    cleanupExpiredTokens();
    // If still over limit after cleanup, remove oldest entries
    if (tokenStore.size > MAX_TOKEN_STORE_SIZE) {
      const entriesToRemove = tokenStore.size - MAX_TOKEN_STORE_SIZE + 100; // Remove extra 100 for buffer
      let removed = 0;
      for (const key of tokenStore.keys()) {
        if (removed >= entriesToRemove) break;
        tokenStore.delete(key);
        removed++;
      }
    }
  }
}

/**
 * Clean up expired tokens
 */
function cleanupExpiredTokens() {
  const now = Date.now();
  for (const [key, data] of tokenStore.entries()) {
    if (data.expiresAt < now) {
      tokenStore.delete(key);
    }
  }
}

/**
 * Validate CSRF token
 */
function validateToken(token, req) {
  if (!token) return false;

  const clientId = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const key = `${clientId}-${token}`;
  const stored = tokenStore.get(key);

  if (!stored) return false;

  // Check expiry
  if (stored.expiresAt < Date.now()) {
    tokenStore.delete(key);
    return false;
  }

  return true;
}

/**
 * Get CSRF token endpoint handler
 * Returns a new CSRF token for the client
 */
function getCsrfToken(req, res) {
  const token = generateToken();
  storeToken(token, req);

  // Set token in response header
  res.setHeader('X-CSRF-Token', token);

  res.json({
    success: true,
    token: token,
    expiresIn: TOKEN_EXPIRY
  });
}

/**
 * CSRF validation middleware
 * Validates token on state-changing requests
 */
function csrfProtection(req, res, next) {
  // Skip CSRF for safe methods (GET, HEAD, OPTIONS)
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Skip CSRF for token endpoint itself
  if (req.path === '/api/csrf-token') {
    return next();
  }

  // Skip CSRF for read-only data endpoints (POST used for body params)
  // Note: req.path here is relative to where middleware is mounted
  const readOnlyEndpoints = [
    '/youtube/metadata',
    '/analytics',
    '/viewer-count',
    '/chat'  // Chat has its own rate limiting
  ];
  if (readOnlyEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
    return next();
  }

  // Get token from header
  const token = req.headers['x-csrf-token'] || req.headers['csrf-token'];

  if (!token) {
    return res.status(403).json({
      error: 'CSRF token missing',
      message: 'CSRF token is required for this request'
    });
  }

  // Validate token
  if (!validateToken(token, req)) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'CSRF token is invalid or expired'
    });
  }

  // Token is valid, proceed
  next();
}

/**
 * CSRF token refresh middleware (optional)
 * Automatically refreshes token on successful requests
 */
function csrfRefresh(req, res, next) {
  // Only refresh on successful state-changing requests
  const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (stateChangingMethods.includes(req.method)) {
    // Store original json function
    const originalJson = res.json.bind(res);
    
    // Override json to refresh token after successful response
    res.json = function(data) {
      // Only refresh if request was successful (2xx status)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const newToken = generateToken();
        storeToken(newToken, req);
        res.setHeader('X-CSRF-Token', newToken);
      }
      return originalJson(data);
    };
  }
  
  next();
}

module.exports = {
  getCsrfToken,
  csrfProtection,
  csrfRefresh,
  generateToken,
  validateToken
};

