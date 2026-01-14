import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { visualizer } from 'rollup-plugin-visualizer';
import path from 'path';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Bundle analyzer - only in analyze mode
    mode === 'analyze' &&
      visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: [
        'favicon.svg',
        'favicon-32x32.png',
        'favicon-16x16.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'AxCouncil - Strategic AI Advisory Platform',
        short_name: 'AxCouncil',
        description: 'Multi-model AI advisory platform for strategic decision making',
        theme_color: '#f97316',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'favicon-32x32.png',
            sizes: '32x32',
            type: 'image/png',
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Force clean update - clear old caches on activate
        cleanupOutdatedCaches: true,
        // Enable navigation preload for faster page loads
        navigationPreload: true,
        // Cache strategies for different resource types
        runtimeCaching: [
          {
            // Cache Google Fonts stylesheets
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            // Cache Google Fonts webfont files
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
          {
            // Cache static assets (hashed files from Vite)
            urlPattern: /\/assets\/.*\.(js|css|woff2?)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year (immutable)
              },
            },
          },
          {
            // Cache images with StaleWhileRevalidate
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            // Network-first for API requests (auth required, always need fresh data)
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 5, // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
        // Don't precache everything - just the app shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Skip waiting to activate new SW immediately
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: false, // Will use next available if 5173 is taken
    proxy: {
      // Proxy API requests to backend - bypasses CORS in development
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Log proxy requests for debugging
            console.log(
              '[Proxy]',
              req.method,
              req.url,
              '-> Authorization:',
              req.headers.authorization ? 'present' : 'missing'
            );
          });
        },
      },
      '/health': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Optimize chunk sizes for better caching and load performance
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks - third-party libraries
          if (id.includes('node_modules')) {
            // Core React runtime - rarely changes, cache well
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react';
            }
            // Animation library - large, cache separately
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            // Markdown rendering - only needed when viewing messages
            if (id.includes('react-markdown') || id.includes('remark-gfm') || id.includes('rehype-slug')) {
              return 'vendor-markdown';
            }
            // Recharts - data visualization, lazy load with UsageTab
            if (id.includes('recharts')) {
              return 'vendor-recharts';
            }
            // Radix UI components - used throughout, cache together
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
            // Monitoring/analytics
            if (id.includes('@sentry/react') || id.includes('web-vitals')) {
              return 'vendor-monitoring';
            }
            // Supabase client - auth/database, changes rarely
            if (id.includes('@supabase/supabase-js')) {
              return 'vendor-supabase';
            }
            // TanStack Query - data fetching/caching layer
            if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query')) {
              return 'vendor-query';
            }
            // i18next - internationalization
            if (id.includes('i18next') || id.includes('react-i18next')) {
              return 'vendor-i18n';
            }
            // React Hook Form
            if (id.includes('react-hook-form') || id.includes('@hookform')) {
              return 'vendor-forms';
            }
            // Lucide icons - large icon library
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }

          // Route-based code splitting - split by major features
          if (id.includes('/src/components/chat/')) {
            return 'route-chat';
          }
          if (id.includes('/src/components/mycompany/')) {
            return 'route-mycompany';
          }
          if (id.includes('/src/components/onboarding/')) {
            return 'route-onboarding';
          }
          if (id.includes('/src/components/Stage1') || id.includes('/src/components/Stage2') || id.includes('/src/components/Stage3')) {
            return 'route-stages';
          }
        },
      },
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
}));
