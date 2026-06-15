import { useEffect, useState } from 'react'
import { listTransactions } from '../api/transactions'
import { StatusMessage } from '../components/StatusMessage'
import { usePeriod } from '../context/PeriodContext'
import { TransactionTable } from '../components/TransactionTable'
import type { CashflowType, Transaction } from '../types/api'

type ReviewGroup = {
  title: string
  description: string
  transactions: Transaction[]
}
function getMonthDateRange(month: string) {
  if (!month) {
    return {
      dateFrom: '',
      dateTo: '',
    }
  }

  const [year, monthNumber] = month.split('-').map(Number)
  const monthText = String(monthNumber).padStart(2, '0')
  const lastDay = new Date(year, monthNumber, 0).getDate()
  const startDate = `${year}-${monthText}-01`
  const endDate = `${year}-${monthText}-${String(lastDay).padStart(2, '0')}`

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
  const { monthKey } = usePeriod()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function loadReviewTransactions() {
    setError(null)
    setMessage(null)

    const monthDateRange = getMonthDateRange(monthKey)

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
  }, [monthKey])

  const reviewGroups = getReviewGroups(transactions)
  const reviewItemCount = reviewGroups.reduce(
    (total, group) => total + group.transactions.length,
    0,
  )
  const groupsWithItems = reviewGroups.filter((group) => group.transactions.length > 0)

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Monthly Review</h1>
        </div>
      </div>

      <StatusMessage error={error} message={message} />

      <section className="panel-card">
        <div className="section-header">
          <div>
            <h2>Review snapshot</h2>
            <p className="muted small">
              Items that need cleanup or should be checked before trusting the month totals.
            </p>
          </div>
          <strong>{reviewItemCount}</strong>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Review area</th>
                <th>Description</th>
                <th className="right">Items</th>
              </tr>
            </thead>
            <tbody>
              {reviewGroups.map((group) => (
                <tr key={group.title}>
                  <td>
                    <strong>{group.title}</strong>
                  </td>
                  <td className="muted small">{group.description}</td>
                  <td className="right">
                    <strong>{group.transactions.length}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {groupsWithItems.length === 0 && (
          <p className="empty-state">All clear for this month. No review items found.</p>
        )}
      </section>

      {groupsWithItems.map((group) => (
        <section className="panel-card" key={group.title}>
          <div className="section-header">
            <div>
              <h2>{group.title}</h2>
              <p className="muted small">{group.description}</p>
            </div>
            <strong>{group.transactions.length}</strong>
          </div>

          <TransactionTable transactions={group.transactions} />
        </section>
      ))}
    </section>
  )
}
