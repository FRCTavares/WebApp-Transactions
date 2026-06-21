import { useEffect, useState } from 'react'
import { DashboardPage } from './pages/DashboardPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { OwedPage } from './pages/OwedPage'
import { ImportPage } from './pages/ImportPage'
import { CategoryRulesPage } from './pages/CategoryRulesPage'
import { InvestmentsPage } from './pages/InvestmentsPage'
import { WealthPage } from './pages/WealthPage'
import { CleanupPage } from './pages/CleanupPage'
import { ExportPage } from './pages/ExportPage'
import { GlobalPeriodSelector } from './components/GlobalPeriodSelector'
import { PeriodProvider } from './context/PeriodContext'
import { useAuth } from './auth/AuthProvider'
import type { User } from '@supabase/supabase-js'
import type { Direction } from './types/api'

type Page = 'dashboard' | 'transactions' | 'money-in' | 'money-out' | 'wealth' | 'investments' | 'owed' | 'more' | 'cleanup' | 'import' | 'categories' | 'export'

const NAV_GROUPS: { title: string; items: { id: Page; label: string }[] }[] = [
  {
    title: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'cleanup', label: 'Monthly Review' },
    ],
  },
  {
    title: 'Money',
    items: [
      { id: 'money-in', label: 'Money In' },
      { id: 'money-out', label: 'Money Out' },
      { id: 'wealth', label: 'Wealth' },
      { id: 'investments', label: 'Investments' },
      { id: 'owed', label: 'Money Owed To Me' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { id: 'import', label: 'Import CSV/XLSX' },
      { id: 'categories', label: 'Categories / Rules' },
      { id: 'export', label: 'Export / Backup' },
    ],
  },
]

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

  const emailName = user?.email?.split('@')[0] ?? 'there'
  const fallbackName = titleCaseName(emailName).split(/\s+/)[0]

  return fallbackName || 'there'
}

const MOBILE_NAV_ITEMS: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Home' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'owed', label: 'Owed' },
  { id: 'wealth', label: 'Wealth' },
  { id: 'more', label: 'More' },
]

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [mobileTransactionDirection, setMobileTransactionDirection] =
    useState<Direction>('out')
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
  const shouldShowGlobalPeriodSelector = page !== 'import' && page !== 'categories' && page !== 'export'
  const displayName = getUserDisplayName(user)
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
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="account-summary">
              <p className="account-greeting">Profile</p>
              <p className="account-subtitle">
                {isAuthEnabled ? 'Signed in' : 'Local mode'}
              </p>
            </div>
            {isAuthEnabled && (
              <button
                type="button"
                className="lock-button"
                onClick={handleLogout}
              >
                Sign out
              </button>
            )}
            {authError && <p className="error-text">{authError}</p>}
          </div>

          <nav className="sidebar-nav">
            {NAV_GROUPS.map((group) => (
              <section key={group.title} className="nav-group">
                <h3>{group.title}</h3>
                <div className="nav-items">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={page === item.id ? 'active' : ''}
                      onClick={() => setPage(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </nav>
        </aside>

        <main>
          {isBackendWakeNoticeVisible && (
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
          {page === 'transactions' && (
            <section>
              <div className="mobile-segmented-control" aria-label="Transaction direction">
                <button
                  type="button"
                  className={mobileTransactionDirection === 'in' ? 'active' : ''}
                  onClick={() => setMobileTransactionDirection('in')}
                >
                  Money In
                </button>
                <button
                  type="button"
                  className={mobileTransactionDirection === 'out' ? 'active' : ''}
                  onClick={() => setMobileTransactionDirection('out')}
                >
                  Money Out
                </button>
              </div>
              <TransactionsPage
                direction={mobileTransactionDirection}
                title={mobileTransactionDirection === 'in' ? 'Money In' : 'Money Out'}
              />
            </section>
          )}
          {page === 'money-in' && <TransactionsPage direction="in" title="Money In" />}
          {page === 'money-out' && <TransactionsPage direction="out" title="Money Out" />}
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
                  <button type="button" onClick={() => setPage('cleanup')}>
                    Monthly Review
                  </button>
                  <button type="button" onClick={() => setPage('categories')}>
                    Categories / Rules
                  </button>
                </div>
              </section>

              <section className="mobile-more-section">
                <div className="mobile-more-section-header">
                  <h2>Data</h2>
                  <p>Import, export, and back up records.</p>
                </div>
                <div className="mobile-more-actions">
                  <button type="button" onClick={() => setPage('import')}>
                    Import CSV/XLSX
                  </button>
                  <button type="button" onClick={() => setPage('export')}>
                    Export / Backup
                  </button>
                </div>
              </section>

              <section className="mobile-more-section">
                <div className="mobile-more-section-header">
                  <h2>Account</h2>
                  <p>
                    {isAuthEnabled ? `Signed in as ${displayName}.` : 'Local mode.'}
                  </p>
                </div>
                {isAuthEnabled && (
                  <div className="mobile-more-actions">
                    <button
                      type="button"
                      className="mobile-more-danger"
                      onClick={handleLogout}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </section>
            </section>
          )}
          {page === 'cleanup' && <CleanupPage />}
          {page === 'import' && <ImportPage />}
          {page === 'categories' && <CategoryRulesPage />}
          {page === 'export' && <ExportPage />}
        </main>

        <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
          {MOBILE_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={page === item.id ? 'active' : ''}
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
