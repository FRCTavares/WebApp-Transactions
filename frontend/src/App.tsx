import { useEffect, useState } from 'react'
import { DashboardPage } from './pages/DashboardPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { OwedPage } from './pages/OwedPage'
import { ImportPage } from './pages/ImportPage'
import { CategoryRulesPage } from './pages/CategoryRulesPage'
import { InvestmentsPage } from './pages/InvestmentsPage'
import { WealthPage } from './pages/WealthPage'
import { ExportPage } from './pages/ExportPage'
import { SettingsPage } from './pages/SettingsPage'
import { GlobalPeriodSelector } from './components/GlobalPeriodSelector'
import { AppSidebar } from './components/AppSidebar'
import { PeriodProvider } from './context/PeriodContext'
import { useAuth } from './auth/AuthProvider'
import type { User } from '@supabase/supabase-js'

export type Page =
  | 'dashboard'
  | 'transactions'
  | 'wealth'
  | 'investments'
  | 'owed'
  | 'more'
  | 'import'
  | 'categories'
  | 'export'
  | 'settings'


function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return 'Good morning'
  }

  if (hour < 18) {
    return 'Good afternoon'
  }

  return 'Good evening'
}

function titleCaseName(value: string) {
  return value
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function getUserDisplayName(user: User | null) {
  const fullName = user?.user_metadata?.full_name
  const name = user?.user_metadata?.name
  const metadataName =
    typeof fullName === 'string'
      ? fullName
      : typeof name === 'string'
        ? name
        : ''

  if (metadataName.trim()) {
    return metadataName.trim().split(/\s+/)[0]
  }

  const emailName = user?.email?.split('@')[0] ?? 'Francisco'
  const fallbackName = titleCaseName(emailName).split(/\s+/)[0]

  return fallbackName || 'there'
}

function getUserAvatarUrl(user: User | null) {
  const avatarUrl = user?.user_metadata?.avatar_url
  const picture = user?.user_metadata?.picture

  if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
    return avatarUrl.trim()
  }

  if (typeof picture === 'string' && picture.trim()) {
    return picture.trim()
  }

  return null
}

const MOBILE_NAV_ITEMS: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Home' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'owed', label: 'Owed' },
  { id: 'wealth', label: 'Wealth' },
  { id: 'more', label: 'More' },
]

const MORE_RELATED_PAGES = new Set<Page>([
  'more',
  'import',
  'categories',
  'export',
  'settings',
  'investments',
])

function getMobileButtonClass(currentPage: Page, itemId: Page) {
  const isMoreActive = itemId === 'more' && MORE_RELATED_PAGES.has(currentPage)

  return currentPage === itemId || isMoreActive ? 'active' : ''
}

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [authError, setAuthError] = useState<string | null>(null)
  const [isBackendWakeNoticeVisible, setIsBackendWakeNoticeVisible] = useState(false)
  const {
    isAuthConfigured,
    isAuthEnabled,
    isLoading,
    session,
    signInWithGoogle,
    signOut,
    user,
  } = useAuth()
  const shouldShowGlobalPeriodSelector =
    page !== 'import' &&
    page !== 'categories' &&
    page !== 'export' &&
    page !== 'settings'
  const displayName = getUserDisplayName(user)
  const profileAvatarUrl = getUserAvatarUrl(user)
  const greeting = getGreeting()

  useEffect(() => {
    function handleSlowApiState(event: Event) {
      const customEvent = event as CustomEvent<{ isSlow: boolean }>
      setIsBackendWakeNoticeVisible(Boolean(customEvent.detail?.isSlow))
    }

    window.addEventListener('finance-api-slow-state', handleSlowApiState)

    return () => {
      window.removeEventListener('finance-api-slow-state', handleSlowApiState)
    }
  }, [])

  async function handleLogin() {
    setAuthError(null)

    try {
      await signInWithGoogle()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Login failed.')
    }
  }

  async function handleLogout() {
    setAuthError(null)

    try {
      await signOut()
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Logout failed.')
    }
  }

  if (isLoading) {
    return (
      <div className="unlock-page">
        <section className="unlock-card">
          <p className="eyebrow">Authentication</p>
          <h1>Loading session...</h1>
          <p>Checking your current login state.</p>
        </section>
      </div>
    )
  }

  if (isAuthEnabled && !isAuthConfigured) {
    return (
      <div className="unlock-page">
        <section className="unlock-card">
          <p className="eyebrow">Configuration missing</p>
          <h1>Supabase auth is not configured</h1>
          <p>
            Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before using Google login.
          </p>
        </section>
      </div>
    )
  }

  if (isAuthEnabled && !session) {
    return (
      <div className="unlock-page">
        <section className="unlock-card">
          <p className="eyebrow">Private finance tracker</p>
          <h1>Sign in to your finance dashboard</h1>
          <p>
            Use your allowed Google account to access your personal finance dashboard.
          </p>

          {authError && <p className="error-text">{authError}</p>}

          <button type="button" onClick={handleLogin}>
            Sign in with Google
          </button>
        </section>
      </div>
    )
  }

  return (
    <PeriodProvider>
      <div className="app-shell">
        <AppSidebar
          authError={authError}
          currentPage={page}
          displayName={displayName}
          isAuthEnabled={isAuthEnabled}
          profileAvatarUrl={profileAvatarUrl}
          onPageChange={setPage}
          onSignOut={handleLogout}
        />

        <main>
          {isBackendWakeNoticeVisible && page !== 'dashboard' && (
            <div className="backend-wake-notice" role="status">
              <strong>Loading data...</strong>
              <span>The backend may be waking up. This can take up to a minute.</span>
            </div>
          )}

          {shouldShowGlobalPeriodSelector && (
            <div className="global-topbar">
              <GlobalPeriodSelector />
            </div>
          )}

          {page === 'dashboard' && <DashboardPage greeting={greeting} displayName={displayName} />}
          {page === 'transactions' && <TransactionsPage />}
          {page === 'wealth' && <WealthPage onOpenInvestments={() => setPage('investments')} />}
          {page === 'investments' && <InvestmentsPage />}
          {page === 'owed' && <OwedPage />}
          {page === 'more' && (
            <section className="mobile-more-page">
              <h1>More</h1>

              <section className="mobile-more-section">
                <div className="mobile-more-section-header">
                  <h2>Finance</h2>
                  <p>Review and organise your money.</p>
                </div>
                <div className="mobile-more-actions">
                  <button type="button" onClick={() => setPage('investments')}>
                    Investments
                  </button>
                </div>
              </section>

              <section className="mobile-more-section">
                <div className="mobile-more-section-header">
                  <h2>Tools</h2>
                  <p>Import data and manage app configuration.</p>
                </div>
                <div className="mobile-more-actions">
                  <button type="button" onClick={() => setPage('import')}>
                    Import
                  </button>
                  <button type="button" onClick={() => setPage('settings')}>
                    Settings
                  </button>
                </div>
              </section>
            </section>
          )}
          {page === 'import' && <ImportPage />}
          {page === 'categories' && <CategoryRulesPage />}
          {page === 'export' && <ExportPage />}
          {page === 'settings' && (
            <SettingsPage
              isAuthEnabled={isAuthEnabled}
              displayName={displayName}
              onOpenImport={() => setPage('import')}
              onOpenExport={() => setPage('export')}
              onOpenCategories={() => setPage('categories')}
              onSignOut={handleLogout}
            />
          )}
        </main>

        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {MOBILE_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={getMobileButtonClass(page, item.id)}
              onClick={() => setPage(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </PeriodProvider>
  )
}

export default App
