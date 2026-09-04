import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(({ mode }) => {
  // Load env file from parent directory (project root) where .env lives
  const projectRoot = path.resolve(__dirname, '..')
  const env = loadEnv(mode, projectRoot, '')
  const isProduction = mode === 'production'
  
  // Get ports from environment variables with sensible defaults
  const serverPort = parseInt(env.PORT) || parseInt(env.VITE_SERVER_PORT) || 5000
  const clientPort = parseInt(env.VITE_CLIENT_PORT) || 5173
  
  // Auto-map GOOGLE_AI_KEY to VITE_GOOGLE_AI_KEY if not explicitly set
  // This allows using GOOGLE_AI_KEY in .env without duplication
  const googleAiKey = env.VITE_GOOGLE_AI_KEY || env.GOOGLE_AI_KEY || ''
  
  console.log(`[Vite] Server port: ${serverPort}, Client port: ${clientPort}`)
  if (googleAiKey) {
    console.log(`[Vite] Google AI Key loaded: ${googleAiKey.substring(0, 10)}...`)
  } else {
    console.warn(`[Vite] ⚠️  GOOGLE_AI_KEY not found in .env - chat will not work`)
  }
  
  return {
    plugins: [
      react(),
      // Bundle analyzer - generates stats.html in dist folder
      visualizer({
        filename: './dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
        template: 'treemap', // 'sunburst' | 'treemap' | 'network'
      }),
    ],

    // No React-to-Preact aliasing; using standard React/ReactDOM

    // Make env vars available to client code
    define: {
      'import.meta.env.VITE_SERVER_PORT': JSON.stringify(serverPort.toString()),
      'import.meta.env.VITE_GOOGLE_AI_KEY': JSON.stringify(googleAiKey),
    },
    
    // Development server config
    server: {
      port: clientPort,
      host: '0.0.0.0', // Allow network access
      fs: {
        // shared/ lives outside client/, so the dev server must be allowed to read it
        allow: [path.resolve(__dirname, '..')],
      },
      headers: {
        'Referrer-Policy': 'origin-when-cross-origin',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
      },
      proxy: {
        // Proxy API calls to local server in development
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
          secure: false,
        }
      }
    },
    
    // Build optimizations
    build: {
      outDir: 'dist',
      sourcemap: !isProduction,
      minify: isProduction ? 'esbuild' : false,
      // Chunk splitting for better caching
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // Split vendor chunks
            if (id.includes('node_modules')) {
              // React core
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
                return 'react-vendor';
              }
              // UI libraries
              if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('class-variance-authority')) {
                return 'ui-vendor';
              }
              // Other vendor code
              return 'vendor';
            }
            // Split large components
            if (id.includes('/components/TVMenuV2') || id.includes('/components/TVSurvey')) {
              return 'tv-components';
            }
            if (id.includes('/admin/')) {
              return 'admin';
            }
          },
        },
      },
      // Reduce chunk size warnings threshold
      chunkSizeWarningLimit: 500,
    },
    // Resolve configuration - using standard React (no Preact aliasing)
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, '../shared'),
      },
    },
    
    // Preview server (for testing production build locally)
    preview: {
      port: 4173,
      host: true,
    },
  }
})
