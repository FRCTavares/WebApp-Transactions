import { useState } from 'react'
import { DashboardPage } from './pages/DashboardPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { OwedPage } from './pages/OwedPage'
import { ImportPage } from './pages/ImportPage'
import { CategoryRulesPage } from './pages/CategoryRulesPage'
import { InvestmentsPage } from './pages/InvestmentsPage'

type Page = 'dashboard' | 'money-in' | 'money-out' | 'investments' | 'owed' | 'import' | 'categories'

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'money-in', label: 'Money In' },
  { id: 'money-out', label: 'Money Out' },
  { id: 'investments', label: 'Investments' },
  { id: 'owed', label: 'Money Owed To Me' },
  { id: 'import', label: 'Import CSV/XLSX' },
  { id: 'categories', label: 'Categories / Rules' },
]

function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h2>F - Transactions</h2>
        <nav>
          {NAV_ITEMS.map((item) => (
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
      </aside>

      <main>
        {page === 'dashboard' && <DashboardPage />}
        {page === 'money-in' && <TransactionsPage direction="in" title="Money In" />}
        {page === 'money-out' && <TransactionsPage direction="out" title="Money Out" />}
        {page === 'investments' && <InvestmentsPage />}
        {page === 'owed' && <OwedPage />}
        {page === 'import' && <ImportPage />}
        {page === 'categories' && <CategoryRulesPage />}
      </main>
    </div>
  )
}

export default App
