import { defineConfig } from 'vitest/config'
import path from 'path'

// Rooted at the repo, not client/, so shared/ is covered too.
export default defineConfig({
  test: {
    include: ['shared/**/*.test.js', 'client/src/**/*.test.{js,jsx}'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
})
