import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'           // Existing vanilla CSS
import './styles/tailwind.css' // Tailwind (preflight disabled - safe to coexist)
import App from './App.jsx'
import { AuthProvider } from './AuthContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
