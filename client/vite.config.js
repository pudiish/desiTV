import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '')
  const isProduction = mode === 'production'
  
  return {
    plugins: [react()],
    
    // Development server config
    server: {
      port: parseInt(env.VITE_CLIENT_PORT) || 5173,
      host: true, // Allow external connections
      proxy: {
        // Proxy API calls to local server in development
        '/api': {
          target: env.VITE_API_BASE || 'http://localhost:5002',
          changeOrigin: true,
          secure: false,
        },
        '/health': {
          target: env.VITE_API_BASE || 'http://localhost:5002',
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
            'youtube': ['react-youtube'],
          },
        },
      },
      // Reduce chunk size warnings threshold
      chunkSizeWarningLimit: 500,
    },
    
    // Define global constants
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __IS_PRODUCTION__: isProduction,
    },
    
    // Preview server (for testing production build locally)
    preview: {
      port: 4173,
      host: true,
    },
  }
})
