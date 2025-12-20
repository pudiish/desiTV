/**
 * Jest Setup for Server Tests
 */

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/test'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key'
process.env.PORT = process.env.PORT || '5000'

// Suppress console logs in tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   error: jest.fn(),
//   warn: jest.fn(),
// }

