/**
 * Error Handler Middleware
 * Handles all unhandled errors and sends appropriate responses
 * In production, can integrate with error tracking services
 */

// Simple error tracking (can be extended with Sentry server SDK)
const trackError = (error, context = {}) => {
  const errorInfo = {
    message: error.message || String(error),
    stack: error.stack,
    name: error.name,
    context: context,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  };

  // Log to console (in production, can send to error tracking service)
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with Sentry server SDK or other error tracking
    // For now, structured logging
    console.error('[Server Error]', JSON.stringify(errorInfo, null, 2));
  } else {
    // Development: Full error details
    console.error('[Server Error]', errorInfo);
  }
};

module.exports = function errorHandler (err, req, res, next) {
  // Track the error
  trackError(err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Determine status code
  const status = err && err.status ? err.status : 500;
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' && status === 500
    ? 'Server error'
    : (err && err.message ? err.message : 'Server error');

  res.status(status).json({ 
    message: message,
    ...(process.env.NODE_ENV !== 'production' && { 
      stack: err.stack,
      details: err 
    })
  });
}
