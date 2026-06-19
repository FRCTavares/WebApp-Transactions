import { useState } from 'react'
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

type Page = 'dashboard' | 'money-in' | 'money-out' | 'wealth' | 'investments' | 'owed' | 'cleanup' | 'import' | 'categories' | 'export'

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

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [authError, setAuthError] = useState<string | null>(null)
  const {
    isAuthConfigured,
    isLoading,
    session,
    signInWithGoogle,
    signOut,
    user,
  } = useAuth()
  const shouldShowGlobalPeriodSelector = page !== 'import' && page !== 'categories' && page !== 'export'

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

  if (!isAuthConfigured) {
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

  if (!session) {
    return (
      <div className="unlock-page">
        <section className="unlock-card">
          <p className="eyebrow">Private finance tracker</p>
          <h1>Sign in to F - Transactions</h1>
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
            <h2>F - Transactions</h2>
            <p>{user?.email ?? 'Signed in'}</p>
            <button
              type="button"
              className="lock-button"
              onClick={handleLogout}
            >
              Sign out
            </button>
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
          {shouldShowGlobalPeriodSelector && (
            <div className="global-topbar">
              <GlobalPeriodSelector />
            </div>
          )}

          {page === 'dashboard' && <DashboardPage />}
          {page === 'money-in' && <TransactionsPage direction="in" title="Money In" />}
          {page === 'money-out' && <TransactionsPage direction="out" title="Money Out" />}
          {page === 'wealth' && <WealthPage />}
          {page === 'investments' && <InvestmentsPage />}
          {page === 'owed' && <OwedPage />}
          {page === 'cleanup' && <CleanupPage />}
          {page === 'import' && <ImportPage />}
          {page === 'categories' && <CategoryRulesPage />}
          {page === 'export' && <ExportPage />}
        </main>
      </div>
    </PeriodProvider>
  )
}

export default App
