import { useState } from 'react'
import type { FormEvent } from 'react'
import { DashboardPage } from './pages/DashboardPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { OwedPage } from './pages/OwedPage'
import { ImportPage } from './pages/ImportPage'
import { CategoryRulesPage } from './pages/CategoryRulesPage'
import { InvestmentsPage } from './pages/InvestmentsPage'
import { WealthPage } from './pages/WealthPage'
import { CleanupPage } from './pages/CleanupPage'
import { GlobalPeriodSelector } from './components/GlobalPeriodSelector'
import { PeriodProvider } from './context/PeriodContext'
import {
  clearAccessSession,
  getStoredAccessToken,
  getStoredUserEmail,
  storeAccessToken,
  storeUserEmail,
} from './api/client'

type Page = 'dashboard' | 'money-in' | 'money-out' | 'wealth' | 'investments' | 'owed' | 'cleanup' | 'import' | 'categories'

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
    ],
  },
]

function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [accessToken, setAccessToken] = useState(getStoredAccessToken)
  const [userEmail, setUserEmail] = useState(getStoredUserEmail)
  const [draftEmail, setDraftEmail] = useState(userEmail)
  const [draftToken, setDraftToken] = useState('')
  const shouldShowGlobalPeriodSelector = page !== 'import' && page !== 'categories'

  function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextEmail = draftEmail.trim().toLowerCase()
    const nextToken = draftToken.trim()

    if (!nextEmail || !nextToken) {
      return
    }

    storeUserEmail(nextEmail)
    storeAccessToken(nextToken)
    setUserEmail(nextEmail)
    setAccessToken(nextToken)
    setDraftToken('')
  }

  function handleLock() {
    clearAccessSession()
    setAccessToken('')
    setUserEmail('')
    setDraftEmail('')
    setDraftToken('')
  }

  if (!accessToken || !userEmail) {
    return (
      <div className="unlock-page">
        <form className="unlock-card" onSubmit={handleUnlock}>
          <p className="eyebrow">Local access gate</p>
          <h1>Unlock F - Transactions</h1>
          <p>
            Enter your allowed email and the app token configured on the backend.
            This is a temporary access bridge before real OAuth is added.
          </p>

          <label>
            <span>Email</span>
            <input
              autoFocus
              type="email"
              value={draftEmail}
              onChange={(event) => setDraftEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            <span>App token</span>
            <input
              type="password"
              value={draftToken}
              onChange={(event) => setDraftToken(event.target.value)}
              placeholder="Enter app token"
            />
          </label>

          <button type="submit">Unlock</button>
        </form>
      </div>
    )
  }

  return (
    <PeriodProvider>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2>F - Transactions</h2>
            <p>Local finance tracker</p>
            <button
              type="button"
              className="lock-button"
              onClick={handleLock}
            >
              Lock app
            </button>
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
        </main>
      </div>
    </PeriodProvider>
  )
}

export default App
