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

  // Clean up expired tokens periodically
  if (tokenStore.size > 1000) {
    cleanupExpiredTokens();
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

