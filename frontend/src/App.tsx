import { useEffect, useState } from 'react'
import { DashboardPage } from './pages/DashboardPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { OwedPage } from './pages/OwedPage'
import { ImportPage } from './pages/ImportPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { InvestmentsPage } from './pages/InvestmentsPage'
import { WealthPage } from './pages/WealthPage'
import { ExportPage } from './pages/ExportPage'
import { SettingsPage } from './pages/SettingsPage'
import { GlobalPeriodSelector } from './components/GlobalPeriodSelector'
import { AppSidebar } from './components/AppSidebar'
import { AppMobileNav } from './components/AppMobileNav'
import { AppMobileMorePage } from './components/AppMobileMorePage'
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

const PAGE_STORAGE_KEY = 'finance-current-page'

const APP_PAGES: Page[] = [
  'dashboard',
  'transactions',
  'wealth',
  'investments',
  'owed',
  'more',
  'import',
  'categories',
  'export',
  'settings',
]

function getInitialPage(): Page {
  const storedPage = window.localStorage.getItem(PAGE_STORAGE_KEY)

  return APP_PAGES.includes(storedPage as Page) ? storedPage as Page : 'dashboard'
}

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

function App() {
  const [page, setPage] = useState<Page>(getInitialPage)
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

  function handlePageChange(nextPage: Page) {
    setPage(nextPage)
    window.localStorage.setItem(PAGE_STORAGE_KEY, nextPage)
  }

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
          onPageChange={handlePageChange}
          onSignOut={handleLogout}
        />

        <main className={`app-main app-main-${page}`}>
          {shouldShowGlobalPeriodSelector && (
            <div className="global-topbar">
              <GlobalPeriodSelector />
            </div>
          )}

          {isBackendWakeNoticeVisible && page !== 'dashboard' && (
            <div className="backend-wake-notice" role="status">
              <strong>Loading data...</strong>
              <span>The backend may be waking up. This can take up to a minute.</span>
            </div>
          )}

          {page === 'dashboard' && <DashboardPage greeting={greeting} displayName={displayName} />}
          {page === 'transactions' && <TransactionsPage />}
          {page === 'wealth' && <WealthPage onOpenInvestments={() => handlePageChange('investments')} />}
          {page === 'investments' && <InvestmentsPage />}
          {page === 'owed' && <OwedPage />}
          {page === 'more' && (
            <AppMobileMorePage
              isAuthEnabled={isAuthEnabled}
              onOpenCategories={() => handlePageChange('categories')}
              onOpenExport={() => handlePageChange('export')}
              onOpenImport={() => handlePageChange('import')}
              onOpenInvestments={() => handlePageChange('investments')}
              onOpenSettings={() => handlePageChange('settings')}
              onSignOut={handleLogout}
            />
          )}
          {page === 'import' && <ImportPage />}
          {page === 'categories' && <CategoriesPage />}
          {page === 'export' && <ExportPage />}
          {page === 'settings' && (
            <SettingsPage
              isAuthEnabled={isAuthEnabled}
              displayName={displayName}
              onOpenImport={() => handlePageChange('import')}
              onOpenExport={() => handlePageChange('export')}
              onOpenCategories={() => handlePageChange('categories')}
              onSignOut={handleLogout}
            />
          )}
        </main>

        <AppMobileNav currentPage={page} onPageChange={handlePageChange} />
      </div>
    </PeriodProvider>
  )
}

export default App
