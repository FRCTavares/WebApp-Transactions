import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/theme.css'
import './styles/theme-dark.css'
import './styles/theme-dark-overrides.css'
import './styles/settings.css'
import './styles/charts.css'
import './styles/investments-dark.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
)

// The caching strategy is network-first (falling back to cache only when a
// fetch fails), so this is safe to register in dev too - normal edits are
// served fresh over the network; only a genuine offline scenario reads from
// cache. That keeps local offline testing consistent with production.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Offline support is a progressive enhancement; failing to register
      // should never block the app from working online.
    })
  })
}
