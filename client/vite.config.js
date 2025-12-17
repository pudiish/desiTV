import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

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
    plugins: [react()],

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
          manualChunks: {
            // Split vendor chunks
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
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
