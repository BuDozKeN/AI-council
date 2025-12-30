import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from 'next-themes'
import { get, set, del } from 'idb-keyval'
import './styles/design-tokens.css' // Design system tokens - load FIRST
import './index.css'                // Global styles and accessibility
import './styles/tailwind.css'      // Tailwind utilities
import App from './App.jsx'
import { AuthProvider } from './AuthContext'
import { BusinessProvider, ConversationProvider, UIProvider } from './contexts'
import ErrorBoundary from './components/ErrorBoundary'
import { initWebVitals } from './utils/webVitals'
import { initSentry } from './utils/sentry'
import { initPWA } from './pwa'

// Initialize Sentry error tracking (before anything else)
initSentry()

// Initialize performance monitoring
initWebVitals()

// Initialize PWA service worker (with error handling)
initPWA()

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
})

// Create IndexedDB persister for offline-capable caching
// Uses idb-keyval for simple, fast IndexedDB access
const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (key: string) => {
      const value = await get(key)
      return value ?? null
    },
    setItem: async (key: string, value: string) => {
      await set(key, value)
    },
    removeItem: async (key: string) => {
      await del(key)
    },
  },
  // Cache key in IndexedDB
  key: 'axcouncil-query-cache',
  // Throttle writes to reduce IndexedDB pressure
  throttleTime: 1000,
})

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

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
              return query.state.status === 'success'
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
  </StrictMode>,
)
