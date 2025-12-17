/**
 * Jest Setup File
 * Runs before each test file
 */

import '@testing-library/jest-dom'

// Mock import.meta for Vite (Jest doesn't support import.meta natively)
// This is set up before any components that use import.meta.env
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        MODE: 'test',
        DEV: false,
        PROD: false,
        VITE_SENTRY_DSN: undefined
      }
    }
  },
  writable: true,
  configurable: true
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.sessionStorage = sessionStorageMock

// Mock fetch
global.fetch = jest.fn()

// Mock YouTube IFrame API
global.window.YT = {
  Player: jest.fn(),
  PlayerState: {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5
  }
}

// Suppress console errors in tests (optional)
// global.console = {
//   ...console,
//   error: jest.fn(),
//   warn: jest.fn(),
// }

