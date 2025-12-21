import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: false, // Will use next available if 5173 is taken
  },
  build: {
    // Optimize chunk sizes for better caching and load performance
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime - rarely changes, cache well
          'vendor-react': ['react', 'react-dom'],
          // Animation library - large, cache separately
          'vendor-motion': ['framer-motion'],
          // Markdown rendering - only needed when viewing messages
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-slug'],
          // Radix UI components - used throughout, cache together
          'vendor-radix': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-select',
            '@radix-ui/react-popover',
            '@radix-ui/react-accordion',
            '@radix-ui/react-slot',
            '@radix-ui/react-visually-hidden'
          ],
          // Supabase client - used for auth/data
          'vendor-supabase': ['@supabase/supabase-js'],
          // Monitoring/analytics
          'vendor-monitoring': ['@sentry/react', 'web-vitals'],
        }
      }
    },
    // Warn if any chunk exceeds 500KB (reasonable target for code splitting)
    chunkSizeWarningLimit: 500,
    // Enable source maps for production debugging (optional, remove if not needed)
    sourcemap: false,
    // SECURITY: Remove console.log statements in production builds
    // This prevents sensitive information from appearing in browser console
    minify: 'esbuild',
    esbuildOptions: {
      drop: ['console', 'debugger'],
    },
  },
})
