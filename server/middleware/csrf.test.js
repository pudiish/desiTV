/**
 * Tests for CSRF Protection Middleware
 */

const { csrfProtection, getCsrfToken, generateToken, validateToken } = require('./csrf');

describe('CSRF Protection Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'POST',
      path: '/api/chat/message',
      ip: '127.0.0.1',
      headers: {}
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };
    next = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Safe methods (GET, HEAD, OPTIONS)', () => {
    it('should allow GET requests without CSRF token', () => {
      req.method = 'GET';
      req.path = '/api/chat/suggestions';

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow HEAD requests without CSRF token', () => {
      req.method = 'HEAD';
      req.path = '/api/chat/suggestions';

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow OPTIONS requests without CSRF token', () => {
      req.method = 'OPTIONS';
      req.path = '/api/chat/message';

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('POST /chat/message requires CSRF protection', () => {
    it('should reject POST /chat/message without CSRF token', () => {
      req.method = 'POST';
      req.path = '/api/chat/message';
      req.headers = {};

      csrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'CSRF token missing',
        message: 'CSRF token is required for this request'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject POST /chat/message with invalid CSRF token', () => {
      req.method = 'POST';
      req.path = '/api/chat/message';
      req.headers = {
        'x-csrf-token': 'invalid-token'
      };

      csrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid CSRF token',
        message: 'CSRF token is invalid or expired'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow POST /chat/message with valid CSRF token', () => {
      req.method = 'POST';
      req.path = '/api/chat/message';
      req.ip = '127.0.0.1'; // Ensure same IP is used
      
      // First, get a token which will store it (using same req object for IP matching)
      getCsrfToken(req, res);
      const storedToken = res.json.mock.calls[0][0].token;
      
      // Reset mocks
      res.status.mockClear();
      res.json.mockClear();
      next.mockClear();
      
      // Now use the stored token with the same IP
      req.headers = {
        'x-csrf-token': storedToken
      };

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should accept CSRF token from csrf-token header (alternative header name)', () => {
      req.method = 'POST';
      req.path = '/api/chat/message';
      req.ip = '127.0.0.1'; // Ensure same IP is used
      
      // Get a valid token
      getCsrfToken(req, res);
      const storedToken = res.json.mock.calls[0][0].token;
      
      // Reset mocks
      res.status.mockClear();
      res.json.mockClear();
      next.mockClear();
      
      // Use alternative header name
      req.headers = {
        'csrf-token': storedToken
      };

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('CSRF token endpoint exemption', () => {
    it('should allow requests to /api/csrf-token without token', () => {
      req.method = 'POST';
      req.path = '/api/csrf-token';
      req.headers = {};

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('GET /chat/suggestions is exempted (safe method)', () => {
    it('should allow GET /chat/suggestions without CSRF token', () => {
      req.method = 'GET';
      req.path = '/api/chat/suggestions';
      req.headers = {};

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow GET /chat/suggestions even with query parameters', () => {
      req.method = 'GET';
      req.path = '/api/chat/suggestions?sessionId=test123';
      req.headers = {};

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Read-only endpoints exemption', () => {
    it('should allow POST to /youtube/metadata without CSRF token', () => {
      req.method = 'POST';
      req.path = '/api/youtube/metadata';
      req.headers = {};

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow POST to /analytics without CSRF token', () => {
      req.method = 'POST';
      req.path = '/api/analytics';
      req.headers = {};

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow POST to /viewer-count without CSRF token', () => {
      req.method = 'POST';
      req.path = '/api/viewer-count';
      req.headers = {};

      csrfProtection(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Write methods are protected', () => {
    it('should reject PUT requests without CSRF token', () => {
      req.method = 'PUT';
      req.path = '/api/some-endpoint';
      req.headers = {};

      csrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject DELETE requests without CSRF token', () => {
      req.method = 'DELETE';
      req.path = '/api/some-endpoint';
      req.headers = {};

      csrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject PATCH requests without CSRF token', () => {
      req.method = 'PATCH';
      req.path = '/api/some-endpoint';
      req.headers = {};

      csrfProtection(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});

describe('getCsrfToken', () => {
  let req, res;

  beforeEach(() => {
    req = {
      ip: '127.0.0.1',
      headers: {}
    };
    res = {
      setHeader: jest.fn(),
      json: jest.fn()
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should generate and return a CSRF token', () => {
    getCsrfToken(req, res);

    expect(res.setHeader).toHaveBeenCalledWith('X-CSRF-Token', expect.any(String));
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      token: expect.any(String),
      expiresIn: expect.any(Number)
    });
    expect(res.json.mock.calls[0][0].token).toBeTruthy();
    expect(res.json.mock.calls[0][0].token.length).toBeGreaterThan(0);
  });
});

describe('validateToken', () => {
  let req;

  beforeEach(() => {
    req = {
      ip: '127.0.0.1',
      headers: {}
    };
  });

  it('should return false for null token', () => {
    expect(validateToken(null, req)).toBe(false);
  });

  it('should return false for undefined token', () => {
    expect(validateToken(undefined, req)).toBe(false);
  });

  it('should return false for non-existent token', () => {
    expect(validateToken('non-existent-token', req)).toBe(false);
  });
});

