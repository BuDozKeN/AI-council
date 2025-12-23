import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'           // Existing vanilla CSS
import './styles/tailwind.css' // Tailwind (preflight disabled - safe to coexist)
import App from './App.jsx'
import { AuthProvider } from './AuthContext'
import { BusinessProvider, ConversationProvider, UIProvider } from './contexts'
import ErrorBoundary from './components/ErrorBoundary'
import { initWebVitals } from './utils/webVitals'
import { initSentry } from './utils/sentry'

// Initialize Sentry error tracking (before anything else)
initSentry()

// Initialize performance monitoring
initWebVitals()

// Configure TanStack Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30,   // 30 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BusinessProvider>
            <ConversationProvider>
              <UIProvider>
                <App />
              </UIProvider>
            </ConversationProvider>
          </BusinessProvider>
        </AuthProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
