import { useEffect, useState } from 'react'
import { exportTransactionsCsv, listTransactions } from '../api/transactions'
import { StatusMessage } from '../components/StatusMessage'
import { TransactionTable } from '../components/TransactionTable'
import type { Transaction } from '../types/api'
import { formatMoney } from '../utils/format'

function getTransactionsTotal(transactions: Transaction[]) {
  return transactions.reduce((total, transaction) => total + Number(transaction.amount), 0)
}

function getInvestmentIncomeTotal(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.direction === 'in')
    .reduce((total, transaction) => total + Number(transaction.amount), 0)
}

function getInvestmentOutflowTotal(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => transaction.direction === 'out')
    .reduce((total, transaction) => total + Number(transaction.amount), 0)
}

function getMonthDateRange(month: string) {
  if (!month) {
    return {
      dateFrom: '',
      dateTo: '',
    }
  }

  const [year, monthNumber] = month.split('-').map(Number)
  const startDate = `${year}-${String(monthNumber).padStart(2, '0')}-01`
  const nextMonthDate = new Date(year, monthNumber, 1)
  const endDate = nextMonthDate.toISOString().slice(0, 10)

  return {
    dateFrom: startDate,
    dateTo: endDate,
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = filename
  link.click()

  URL.revokeObjectURL(objectUrl)
}

function getActiveFilterCount(values: string[]) {
  return values.filter(Boolean).length
}

export function InvestmentsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [search, setSearch] = useState('')
  const [month, setMonth] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [source, setSource] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function loadInvestments() {
    setError(null)
    setMessage(null)

    const monthDateRange = getMonthDateRange(month)

    listTransactions({
      cashflow_type: 'investment',
      search: search || undefined,
      source: source || undefined,
      date_from: dateFrom || monthDateRange.dateFrom || undefined,
      date_to: dateTo || monthDateRange.dateTo || undefined,
      limit: 100,
    })
      .then(setTransactions)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load investments')
      })
  }

  useEffect(() => {
    loadInvestments()
  }, [])

  function clearFilters() {
    setSearch('')
    setMonth('')
    setDateFrom('')
    setDateTo('')
    setSource('')

    listTransactions({
      cashflow_type: 'investment',
      limit: 100,
    })
      .then(setTransactions)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load investments')
      })
  }

  async function handleExportCsv() {
    setError(null)
    setMessage(null)

    const monthDateRange = getMonthDateRange(month)

    try {
      const blob = await exportTransactionsCsv({
        cashflow_type: 'investment',
        search: search || undefined,
        source: source || undefined,
        date_from: dateFrom || monthDateRange.dateFrom || undefined,
        date_to: dateTo || monthDateRange.dateTo || undefined,
        limit: 50000,
      })

      downloadBlob(blob, 'investment-transactions.csv')
      setMessage('CSV export downloaded.')
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to export investments')
    }
  }

  const total = getTransactionsTotal(transactions)
  const inflowTotal = getInvestmentIncomeTotal(transactions)
  const outflowTotal = getInvestmentOutflowTotal(transactions)
  const activeFilterCount = getActiveFilterCount([search, month, dateFrom, dateTo, source])

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Investments</h1>
          <p className="muted small">
            {transactions.length} investment transactions · {formatMoney(total.toFixed(2))} total movements
          </p>
        </div>

        <div className="action-group">
          <button type="button" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button type="button" onClick={loadInvestments}>
            Refresh
          </button>
        </div>
      </div>

      <StatusMessage error={error} message={message} />

      <div className="summary-grid">
        <article className="summary-card">
          <h2>Total investment movements</h2>
          <strong>{formatMoney(total.toFixed(2))}</strong>
        </article>

        <article className="summary-card">
          <h2>Investment inflows</h2>
          <strong>{formatMoney(inflowTotal.toFixed(2))}</strong>
        </article>

        <article className="summary-card">
          <h2>Investment outflows</h2>
          <strong>{formatMoney(outflowTotal.toFixed(2))}</strong>
        </article>
      </div>

      <details className="filter-panel compact-filter-panel">
        <summary>
          <span>Filters</span>
          {activeFilterCount > 0 && (
            <span className="filter-count">{activeFilterCount} active</span>
          )}
        </summary>

        <div className="form-row">
          <label>
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search description"
            />
          </label>

          <label>
            Source
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="">All sources</option>
              <option value="manual">Manual</option>
              <option value="revolut">Revolut</option>
              <option value="activobank">ActivoBank</option>
              <option value="trading212">Trading 212</option>
            </select>
          </label>

          <label>
            Month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>

          <label>
            Date From
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </label>

          <label>
            Date To
            <input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </label>
        </div>

        <div className="action-group">
          <button type="button" onClick={loadInvestments}>
            Apply Filters
          </button>
          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      </details>

      <p className="muted">
        Showing transactions marked as investment. These are excluded from normal Money In and Money Out.
      </p>

      <TransactionTable transactions={transactions} />
    </section>
  )
}
