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
  const serverPort = parseInt(env.PORT) || parseInt(env.VITE_SERVER_PORT) || 5003
  const clientPort = parseInt(env.VITE_CLIENT_PORT) || 5173
  
  console.log(`[Vite] Server port: ${serverPort}, Client port: ${clientPort}`)
  
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
    },
    
    // Development server config
    server: {
      port: clientPort,
      host: '0.0.0.0', // Allow network access
      headers: {
        'Referrer-Policy': 'origin-when-cross-origin',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-Content-Type-Options': 'nosniff',
      },
      proxy: {
        // Proxy API calls to local server in development
        '/api': {
          target: `http:// localhost:${serverPort}`,
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: `http:// localhost:${serverPort}`,
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
      },
    },
    
    // Preview server (for testing production build locally)
    preview: {
      port: 4173,
      host: true,
    },
  }
})
