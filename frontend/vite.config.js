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
        theme_color: '#4a90e2',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        icons: [
          // PNG icons for iOS/Android compatibility (required for apple-touch-icon)
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
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          // SVG icon for modern browsers (scalable)
          {
            src: 'favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
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
    // CSS code splitting - separate CSS per chunk for optimal caching
    cssCodeSplit: true,

    // Minify CSS aggressively in production
    cssMinify: 'lightningcss', // Faster than esbuild, better output

    // Optimize chunk sizes for better caching and load performance
    rollupOptions: {
      output: {
        // Separate CSS files by route/chunk for better caching
        assetFileNames: (assetInfo) => {
          // CSS files get content-hash for long-term caching
          if (assetInfo.name.endsWith('.css')) {
            return 'assets/css/[name].[hash].css';
          }
          return 'assets/[name].[hash].[ext]';
        },

        manualChunks(id) {
          // MyCompany tab CSS splitting - lazy-load tab-specific CSS
          // This reduces initial MyCompany bundle by ~100KB
          if (id.includes('/tabs/usage/') || id.includes('UsageTab')) {
            return 'usage-tab';
          }
          if (id.includes('/tabs/llm-hub/') || id.includes('LLMHubTab')) {
            return 'llm-hub-tab';
          }
          if (id.includes('/tabs/projects/') || id.includes('ProjectsTab')) {
            return 'projects-tab';
          }
          if (id.includes('/tabs/decisions/') || id.includes('DecisionsTab')) {
            return 'decisions-tab';
          }
          if (id.includes('/tabs/activity/') || id.includes('ActivityTab')) {
            return 'activity-tab';
          }
          if (id.includes('/tabs/playbooks/') || id.includes('PlaybooksTab')) {
            return 'playbooks-tab';
          }
          if (id.includes('/tabs/team/') || id.includes('TeamTab')) {
            return 'team-tab';
          }
          if (id.includes('/tabs/overview/') || id.includes('OverviewTab')) {
            return 'overview-tab';
          }

          // Deliberation stage CSS splitting - lazy-load stage-specific CSS
          // This reduces initial ChatInterface bundle by ~69KB
          if (id.includes('/stage1/') || id.includes('Stage1')) {
            return 'stage1';
          }
          if (id.includes('/stage2/') || id.includes('Stage2')) {
            return 'stage2';
          }
          if (id.includes('/stage3/') || id.includes('Stage3')) {
            return 'stage3';
          }

          // Vendor chunk splitting
          if (id.includes('node_modules')) {
            // Core React runtime - rarely changes, cache well
            if (id.includes('react') && !id.includes('react-markdown') && !id.includes('react-i18next') && !id.includes('react-router')) {
              return 'vendor-react';
            }
            // Router - needed early, cache separately
            if (id.includes('react-router-dom')) {
              return 'vendor-router';
            }
            // Animation library - large, cache separately
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            // Markdown rendering - only needed when viewing messages
            if (
              id.includes('react-markdown') ||
              id.includes('remark-gfm') ||
              id.includes('rehype-slug')
            ) {
              return 'vendor-markdown';
            }
            // i18n - internationalization, loaded on every page
            if (
              id.includes('i18next') ||
              id.includes('react-i18next') ||
              id.includes('i18next-browser-languagedetector')
            ) {
              return 'vendor-i18n';
            }
            // Command palette - large component, lazy loadable
            if (id.includes('cmdk')) {
              return 'vendor-cmdk';
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
            if (
              id.includes('@tanstack/react-query') ||
              id.includes('@tanstack/query-async-storage-persister') ||
              id.includes('@tanstack/react-query-persist-client')
            ) {
              return 'vendor-query';
            }
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
      // CSS tree-shaking - remove unused CSS
      treeShaking: true,
    },

    // Report compressed size for better bundle analysis
    reportCompressedSize: true,

    // Target modern browsers for smaller bundles
    target: 'es2020',
  },

  // CSS optimization configuration
  css: {
    devSourcemap: true, // Enable CSS sourcemaps in dev

    // PostCSS optimizations
    postcss: {
      plugins: [
        // Tailwind CSS v4 handles its own optimizations
        // Additional PostCSS plugins can be added here
      ],
    },

    // CSS preprocessor options (if using Sass/Less in future)
    preprocessorOptions: {},

    // Lightning CSS configuration for maximum optimization
    lightningcss: {
      // Minify options
      minify: true,

      // Target modern browsers (reduces polyfills)
      targets: {
        chrome: 90,
        firefox: 88,
        safari: 14,
        edge: 90,
      },

      // Draft syntax support (CSS nesting, etc.)
      drafts: {
        nesting: true,
        customMedia: true,
      },

      // Enable CSS modules tree-shaking
      unusedSymbols: [],
    },
  },
}));
