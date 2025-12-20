/**
 * Custom CORS Middleware
 * Replaces cors package with lightweight implementation
 * 
 * Features:
 * - Configurable origins
 * - Credentials support
 * - Method and header filtering
 * - Preflight request handling
 */

function createCors(options = {}) {
  const {
    origin = true, // true = allow all, string/array/regex = specific origins
    credentials = false,
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization'],
    exposedHeaders = [],
    maxAge = 86400 // 24 hours
  } = options

  /**
   * Check if origin is allowed
   */
  function isOriginAllowed(originHeader, allowedOrigin) {
    if (!originHeader) return false
    
    // Allow all
    if (allowedOrigin === true) return true
    
    // String match
    if (typeof allowedOrigin === 'string') {
      return originHeader === allowedOrigin
    }
    
    // Array of strings/regexes
    if (Array.isArray(allowedOrigin)) {
      return allowedOrigin.some(allowed => {
        if (typeof allowed === 'string') {
          return originHeader === allowed
        }
        if (allowed instanceof RegExp) {
          return allowed.test(originHeader)
        }
        return false
      })
    }
    
    // Regex
    if (allowedOrigin instanceof RegExp) {
      return allowedOrigin.test(originHeader)
    }
    
    // Function
    if (typeof allowedOrigin === 'function') {
      return allowedOrigin(originHeader)
    }
    
    return false
  }

  /**
   * CORS middleware
   */
  return (req, res, next) => {
    const originHeader = req.headers.origin
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      // Check if origin is allowed
      if (isOriginAllowed(originHeader, origin)) {
        res.setHeader('Access-Control-Allow-Origin', originHeader)
        
        if (credentials) {
          res.setHeader('Access-Control-Allow-Credentials', 'true')
        }
        
        res.setHeader('Access-Control-Allow-Methods', methods.join(', '))
        res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '))
        
        if (exposedHeaders.length > 0) {
          res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '))
        }
        
        res.setHeader('Access-Control-Max-Age', maxAge.toString())
      }
      
      res.status(204).end()
      return
    }
    
    // Handle actual requests
    if (isOriginAllowed(originHeader, origin)) {
      res.setHeader('Access-Control-Allow-Origin', originHeader)
      
      if (credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true')
      }
      
      if (exposedHeaders.length > 0) {
        res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '))
      }
    }
    
    next()
  }
}

module.exports = createCors

