import { useEffect, useState } from 'react'
import { listTransactions } from '../api/transactions'
import { StatusMessage } from '../components/StatusMessage'
import { TransactionTable } from '../components/TransactionTable'
import type { CashflowType, Transaction } from '../types/api'

type ReviewGroup = {
  title: string
  description: string
  transactions: Transaction[]
}

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7)
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

function filterByCashflowType(transactions: Transaction[], cashflowType: CashflowType) {
  return transactions.filter((transaction) => transaction.cashflow_type === cashflowType)
}

function getUncategorisedTransactions(transactions: Transaction[]) {
  return transactions.filter((transaction) => transaction.category === null)
}

function getPossibleMessyTransactions(transactions: Transaction[]) {
  return transactions.filter((transaction) => {
    const amount = Number(transaction.amount)
    const description = transaction.description.trim()

    return (
      description.length < 3 ||
      amount <= 0 ||
      transaction.raw_description.trim().length === 0 ||
      transaction.category === null
    )
  })
}

function getReviewGroups(transactions: Transaction[]): ReviewGroup[] {
  return [
    {
      title: 'Uncategorised',
      description: 'Transactions without a category. These should usually be cleaned first.',
      transactions: getUncategorisedTransactions(transactions),
    },
    {
      title: 'Internal Transfers',
      description: 'Own-account movements excluded from normal income and expense totals.',
      transactions: filterByCashflowType(transactions, 'internal_transfer'),
    },
    {
      title: 'Investments',
      description: 'Investment movements excluded from normal Money In and Money Out.',
      transactions: filterByCashflowType(transactions, 'investment'),
    },
    {
      title: 'Reimbursements',
      description: 'Money received back from someone else.',
      transactions: filterByCashflowType(transactions, 'reimbursement'),
    },
    {
      title: 'Reimbursed Expenses',
      description: 'Expenses you paid but expect to be reimbursed for.',
      transactions: filterByCashflowType(transactions, 'reimbursed_expense'),
    },
    {
      title: 'Possible Messy Items',
      description: 'Items with missing category, weak descriptions, missing raw description, or invalid amount.',
      transactions: getPossibleMessyTransactions(transactions),
    },
  ]
}

export function CleanupPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [month, setMonth] = useState(getCurrentMonth)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function loadReviewTransactions() {
    setError(null)
    setMessage(null)

    const monthDateRange = getMonthDateRange(month)

    listTransactions({
      date_from: monthDateRange.dateFrom || undefined,
      date_to: monthDateRange.dateTo || undefined,
      limit: 500,
    })
      .then(setTransactions)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load review transactions')
      })
  }

  useEffect(() => {
    loadReviewTransactions()
  }, [])

  const reviewGroups = getReviewGroups(transactions)
  const reviewItemCount = reviewGroups.reduce(
    (total, group) => total + group.transactions.length,
    0,
  )

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Monthly Review</h1>
          <p className="muted small">
            {transactions.length} transactions loaded · {reviewItemCount} items to review
          </p>
        </div>

        <button type="button" onClick={loadReviewTransactions}>
          Refresh
        </button>
      </div>

      <StatusMessage error={error} message={message} />

      <div className="filter-panel compact-filter-panel">
        <div className="form-row">
          <label>
            Month
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </label>
        </div>

        <div className="action-group">
          <button type="button" onClick={loadReviewTransactions}>
            Load Month
          </button>
          <button
            type="button"
            onClick={() => {
              setMonth(getCurrentMonth())
            }}
          >
            Current Month
          </button>
        </div>
      </div>

      <div className="summary-grid">
        {reviewGroups.map((group) => (
          <article className="summary-card" key={group.title}>
            <h2>{group.title}</h2>
            <strong>{group.transactions.length}</strong>
          </article>
        ))}
      </div>

      {reviewGroups.map((group) => (
        <section className="review-section" key={group.title}>
          <div className="section-header">
            <div>
              <h2>{group.title}</h2>
              <p className="muted small">{group.description}</p>
            </div>
            <strong>{group.transactions.length}</strong>
          </div>

          {group.transactions.length === 0 ? (
            <p className="muted">No items in this group.</p>
          ) : (
            <TransactionTable transactions={group.transactions} />
          )}
        </section>
      ))}
    </section>
  )
}
