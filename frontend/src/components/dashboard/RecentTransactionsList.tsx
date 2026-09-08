import { Receipt } from 'lucide-react'
import { Card, EmptyState } from '../ui'
import { formatDate, formatMoney } from '../../utils/format'
import {
  getCategoryLabel,
  getRecentTransactionAmount,
  getSecondaryReasonText,
} from '../../utils/dashboardTransactions'
import type { Transaction } from '../../types/api'

type RecentTransactionsListProps = {
  transactions: Transaction[]
  monthLabel: string
}

export function RecentTransactionsList({
  transactions,
  monthLabel,
}: RecentTransactionsListProps) {
  return (
    <Card as="section" padding="md" className="dashboard-recent-panel">
      <div className="dashboard-panel-header">
        <div>
          <h2>Recent transactions</h2>
          <p>Latest spending in {monthLabel}</p>
        </div>
      </div>

      <div className="dashboard-recent-list">
        {transactions.map((transaction) => {
          const amount = getRecentTransactionAmount(transaction)
          const secondary = getSecondaryReasonText(transaction)

          return (
            <article key={transaction.id} className="dashboard-recent-row">
              <div className="dashboard-recent-main">
                <strong>{transaction.description}</strong>
                <span className="dashboard-recent-meta">
                  <span className="dashboard-recent-category">
                    {getCategoryLabel(transaction)}
                  </span>
                  <span>{formatDate(transaction.date)}</span>
                  {secondary && <span className="dashboard-recent-reason">· {secondary}</span>}
                </span>
              </div>
              <strong
                className={`dashboard-recent-amount ${
                  amount < 0 ? 'is-negative' : 'is-positive'
                }`}
              >
                {formatMoney(amount.toFixed(2))}
              </strong>
            </article>
          )
        })}

        {transactions.length === 0 && (
          <EmptyState
            size="sm"
            icon={Receipt}
            title="No recent spending found for this month."
            description="Spending you record this month will appear here."
          />
        )}
      </div>
    </Card>
  )
}
