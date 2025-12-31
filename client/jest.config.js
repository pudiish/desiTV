/**
 * Jest Configuration for Client Tests
 */

export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }]
      ]
    }]
  },
  testMatch: [
    '**/__tests__*.(js|jsx)',
    '**/*.(test|spec).(js|jsx)'
  ],
  // Performance optimizations
  maxWorkers: '50%', // Use half of available CPUs
  testTimeout: 5000, // 5 second timeout per test
  // Skip coverage by default (faster)
  collectCoverage: false,
  // Only collect coverage when explicitly requested
  collectCoverageFrom: [
    'src*.{js,jsx}',
    '!src*.stories.{js,jsx}',
    '!src/main.jsx',
    '!srcindex.js',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  transformIgnorePatterns: [
    'node_modules/(?!(ogl)/)'
  ],
  // Cache configuration for faster subsequent runs
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache'
}

