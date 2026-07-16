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
