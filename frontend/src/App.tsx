import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
import { useAuth } from './hooks/useAuth'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { usePresentationPreferences } from './hooks/usePresentationPreferences'
import { deleteCurrentAccount } from './api/account'
import type { User } from '@supabase/supabase-js'
import {
  getPageFromPath,
  getPathForPage,
  type Page,
} from './routing/appRoutes'

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

  const emailName = user?.email?.split('@')[0] ?? ''
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
  const location = useLocation()
  const navigate = useNavigate()
  const page = getPageFromPath(location.pathname)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isBackendWakeNoticeVisible, setIsBackendWakeNoticeVisible] = useState(false)
  const {
    clearLocalSession,
    isAuthConfigured,
    isAuthEnabled,
    isLoading,
    session,
    signInWithGoogle,
    signOut,
    user,
  } = useAuth()
  const presentation = usePresentationPreferences(!isAuthEnabled || Boolean(session))
  const isOnline = useOnlineStatus()
  const shouldShowGlobalPeriodSelector =
    page !== null
    && page !== 'import'
    && page !== 'categories'
    && page !== 'export'
    && page !== 'settings'
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

  useEffect(() => {
    if (location.pathname === '/') {
      navigate(getPathForPage('dashboard'), { replace: true })
    }
  }, [location.pathname, navigate])

  function handlePageChange(nextPage: Page) {
    navigate(getPathForPage(nextPage))
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

  async function handleDeleteAccount(confirmation: string) {
    setAuthError(null)
    await deleteCurrentAccount(confirmation)
    await clearLocalSession()
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

        <main className={`app-main app-main-${page ?? 'not-found'}`}>
          {shouldShowGlobalPeriodSelector && (
            <div className="global-topbar">
              <GlobalPeriodSelector />
            </div>
          )}

          {!isOnline && (
            <div className="backend-wake-notice offline-notice" role="status">
              <strong>You're offline</strong>
              <span>Showing the last data loaded on this device. New changes can't be saved until you're back online.</span>
            </div>
          )}

          {isBackendWakeNoticeVisible && page !== 'dashboard' && (
            <div className="backend-wake-notice" role="status">
              <strong>Loading data...</strong>
              <span>The backend may be waking up. This can take up to a minute.</span>
            </div>
          )}

          {page === null && location.pathname !== '/' && (
            <section className="app-page">
              <div className="page-header">
                <div className="page-title-block">
                  <p className="eyebrow">404</p>
                  <h1>Page not found</h1>
                  <p>The requested finance screen does not exist.</p>
                </div>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => handlePageChange('dashboard')}
                >
                  Return to dashboard
                </button>
              </div>
            </section>
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
              key={`${presentation.preferences.language}-${presentation.preferences.locale}-${presentation.preferences.currency}-${presentation.preferences.time_zone}-${presentation.preferences.date_format}`}
              isAuthEnabled={isAuthEnabled}
              displayName={displayName}
              accountEmail={user?.email ?? ''}
              onOpenImport={() => handlePageChange('import')}
              onOpenExport={() => handlePageChange('export')}
              onOpenCategories={() => handlePageChange('categories')}
              onSignOut={handleLogout}
              preferences={presentation.preferences}
              preferencesError={presentation.error}
              preferencesLoading={presentation.isLoading}
              onSavePreferences={presentation.save}
              onDeleteAccount={handleDeleteAccount}
            />
          )}
        </main>

        <AppMobileNav currentPage={page} onPageChange={handlePageChange} />
      </div>
    </PeriodProvider>
  )
}

export default App
