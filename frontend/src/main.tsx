import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ThemeProvider } from 'next-themes';
import { get, set, del } from 'idb-keyval';
import './styles/design-tokens.css'; // Design system tokens - load FIRST
import './index.css'; // Global styles and accessibility
import './styles/tailwind.css'; // Tailwind utilities
import App from './App.jsx';
import { AuthProvider } from './AuthContext';
import { BusinessProvider, ConversationProvider, UIProvider } from './contexts';
import ErrorBoundary from './components/ErrorBoundary';
import { initWebVitals } from './utils/webVitals';
import { initSentry } from './utils/sentry';
import { initPWA } from './pwa';

// Handle Vite CSS/JS preload errors from stale chunks after deployments
// When a new version is deployed, old cached JS may reference CSS/JS files that no longer exist
// This gracefully handles the error and triggers a page reload to get fresh assets
window.addEventListener(
  'error',
  (event) => {
    const target = event.target as HTMLElement | null;

    // Check if it's a link element (CSS/modulepreload) that failed to load
    if (target?.tagName === 'LINK') {
      const linkEl = target as HTMLLinkElement;
      const href = linkEl.href;
      // Only handle /assets/ chunk failures (Vite's hashed chunks)
      if (href?.includes('/assets/')) {
        console.warn('[Stale asset detected] Reloading to get fresh assets:', href);
        // Prevent the error from being reported to Sentry
        event.preventDefault();
        event.stopImmediatePropagation();
        // Force reload without cache to get fresh assets
        window.location.reload();
        return;
      }
    }

    // Also catch script load errors for JS chunks
    if (target?.tagName === 'SCRIPT') {
      const scriptEl = target as HTMLScriptElement;
      const src = scriptEl.src;
      if (src?.includes('/assets/')) {
        console.warn('[Stale script detected] Reloading to get fresh assets:', src);
        event.preventDefault();
        event.stopImmediatePropagation();
        window.location.reload();
        return;
      }
    }
  },
  true
); // Use capture phase to catch before Sentry

// Handle Vite's preload error event (catches dynamic import failures)
window.addEventListener('vite:preloadError', (event: Event) => {
  const preloadEvent = event as CustomEvent<{ message?: string }>;
  const message = preloadEvent.detail?.message || 'Unknown preload error';
  console.warn('[Vite preload error] Reloading to get fresh assets:', message);
  event.preventDefault();
  event.stopImmediatePropagation();
  window.location.reload();
});

// Handle unhandled promise rejections (catches async import failures)
window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const error = event.reason;
  const errorMessage = error?.message || String(error) || '';

  // Check if this is a CSS/chunk preload failure
  if (
    errorMessage.includes('Unable to preload CSS') ||
    errorMessage.includes('Failed to fetch dynamically') ||
    errorMessage.includes('dynamically imported module') ||
    errorMessage.includes('/assets/')
  ) {
    console.warn('[Chunk load failure] Reloading to get fresh assets:', errorMessage);
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.reload();
  }
});

// Initialize Sentry error tracking (before anything else)
initSentry();

// Initialize performance monitoring
initWebVitals();

// Initialize PWA service worker (with error handling)
initPWA();

// Configure TanStack Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 60 * 24, // 24 hours (extended for persistence)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Create IndexedDB persister for offline-capable caching
// Uses idb-keyval for simple, fast IndexedDB access
const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (key: string) => {
      const value = await get(key);
      return value ?? null;
    },
    setItem: async (key: string, value: string) => {
      await set(key, value);
    },
    removeItem: async (key: string) => {
      await del(key);
    },
  },
  // Cache key in IndexedDB
  key: 'axcouncil-query-cache',
  // Throttle writes to reduce IndexedDB pressure
  throttleTime: 1000,
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          // Only persist queries older than 1 second (avoid caching in-flight)
          dehydrateOptions: {
            shouldDehydrateQuery: (query) => {
              // Only persist successful queries
              return query.state.status === 'success';
            },
          },
          // Maximum age of cached data: 24 hours
          maxAge: 1000 * 60 * 60 * 24,
        }}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <BusinessProvider>
              <ConversationProvider>
                <UIProvider>
                  <App />
                </UIProvider>
              </ConversationProvider>
            </BusinessProvider>
          </AuthProvider>
        </ThemeProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);
