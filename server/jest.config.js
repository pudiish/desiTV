/**
 * Jest Configuration for Server Tests
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.js',
    '**/*.(test|spec).js'
  ],
  // Performance optimizations
  maxWorkers: '50%', // Use half of available CPUs
  testTimeout: 5000, // 5 second timeout per test
  // Skip coverage by default (faster)
  collectCoverage: false,
  collectCoverageFrom: [
    '**/*.js',
    '!node_modules/**',
    '!coverage/**',
    '!jest.config.js',
    '!index.js'
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  // Cache configuration for faster subsequent runs
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  // Force exit after tests complete (prevents hanging from intervals)
  forceExit: true,
  // Detect open handles that prevent Jest from exiting
  detectOpenHandles: false
}

