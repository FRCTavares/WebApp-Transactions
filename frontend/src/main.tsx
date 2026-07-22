import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
/* ---------------------------------------------------------------------------
   STYLE IMPORT MANIFEST - the order below is significant. Do not reorder or
   alphabetise.

     1. font    self-hosted, must precede anything declaring Inter
     2. tokens  primitives -> semantic -> dark. Definitions must precede any
                consumer, and dark must override semantic.
     3. app     everything else, in its historical order (see the warning).

   Before this manifest existed, index.css @imported 29 sheets, main.tsx
   imported 7 more, and shell.css - 701 lines defining :root, body, .app-shell
   and .sidebar - was reachable only through an @import buried on line 1 of
   dashboard.css. Dark mode rendered correctly purely because the override
   sheets happened to land last in source order.

   WARNING: the group 3 order below is load-bearing and is NOT yet the order it
   should be. theme-dark.css and theme-dark-overrides.css patch components by
   specificity rather than by role, so moving them breaks dark mode. Likewise
   shell.css still loads from inside dashboard.css, which places the global app
   chrome partway through index.css's cascade. Both are corrected in Phase 2/5,
   once the sheets they fight with consume semantic tokens. Reordering them now
   would change rendering, which is exactly what Phase 1 must not do.
   --------------------------------------------------------------------------- */

import '@fontsource-variable/inter'

import './styles/tokens/primitives.css'
import './styles/tokens/semantic.css'
import './styles/tokens/dark.css'

import './index.css'
import './styles/theme.css'
import './styles/theme-dark.css'
import './styles/theme-dark-overrides.css'
import './styles/settings.css'
import './styles/charts.css'
import './styles/privacy.css'
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
