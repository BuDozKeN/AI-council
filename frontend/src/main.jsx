import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'           // Existing vanilla CSS
import './styles/tailwind.css' // Tailwind (preflight disabled - safe to coexist)
import App from './App.jsx'
import { AuthProvider } from './AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import { initWebVitals } from './utils/webVitals'

// Initialize performance monitoring
initWebVitals()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
