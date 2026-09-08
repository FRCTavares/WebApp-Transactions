import { Receipt } from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableMessageRow,
  TableRow,
} from '../ui'
import { formatDate, formatMoney } from '../../utils/format'
import {
  getReasonText,
  getTransactionOwedAmount,
  getTransactionPersonalAmount,
} from '../../utils/dashboardTransactions'
import type { Transaction } from '../../types/api'

type CategoryDetailPanelProps = {
  category: string
  transactions: Transaction[]
  isLoading: boolean
  onClose: () => void
}

export function CategoryDetailPanel({
  category,
  transactions,
  isLoading,
  onClose,
}: CategoryDetailPanelProps) {
  return (
    <Card as="section" padding="md" className="category-detail-panel">
      <div className="category-detail-header">
        <div>
          <h3>{category} details</h3>
          <p className="muted small">Transactions behind the selected category.</p>
        </div>
        <Button size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      {isLoading ? (
        <Skeleton variant="text" lines={4} />
      ) : (
        <>
          <div className="dashboard-mobile-category-transactions">
            {transactions.map((transaction) => (
              <article
                key={transaction.id}
                className="dashboard-mobile-category-transaction"
              >
                <div className="dashboard-mobile-category-transaction-main">
                  <div>
                    <strong>{transaction.description}</strong>
                    <p>{formatDate(transaction.date)}</p>
                  </div>
                  <strong>
                    {formatMoney(getTransactionPersonalAmount(transaction).toFixed(2))}
                  </strong>
                </div>

                <div className="dashboard-mobile-category-transaction-meta">
                  {getTransactionOwedAmount(transaction) > 0 && (
                    <Badge tone="neutral" size="sm">
                      Owed {formatMoney(getTransactionOwedAmount(transaction).toFixed(2))}
                    </Badge>
                  )}
                  <span className="muted small">
                    Gross {formatMoney(transaction.amount)}
                  </span>
                </div>

                <p className="muted small">{getReasonText(transaction)}</p>
              </article>
            ))}

            {transactions.length === 0 && (
              <EmptyState
                size="sm"
                icon={Receipt}
                title="No transactions found for this category."
              />
            )}
          </div>

          <div className="dashboard-category-detail-table-wrap">
            <Table label={`${category} transactions`} minWidth="52rem">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Description</TableHeaderCell>
                  <TableHeaderCell align="right">Personal</TableHeaderCell>
                  <TableHeaderCell align="right">Owed</TableHeaderCell>
                  <TableHeaderCell align="right">Gross</TableHeaderCell>
                  <TableHeaderCell>Reason</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{formatDate(transaction.date)}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell align="right" numeric>
                      {formatMoney(getTransactionPersonalAmount(transaction).toFixed(2))}
                    </TableCell>
                    <TableCell align="right" numeric>
                      <span className="amount-muted">
                        {formatMoney(getTransactionOwedAmount(transaction).toFixed(2))}
                      </span>
                    </TableCell>
                    <TableCell align="right" numeric>
                      <span className="amount-muted">
                        {formatMoney(transaction.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="muted small">{getReasonText(transaction)}</span>
                      {transaction.owed_person && (
                        <Badge tone="neutral" size="sm">
                          owed by {transaction.owed_person}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}

                {transactions.length === 0 && (
                  <TableMessageRow colSpan={6}>
                    No transactions found for this category.
                  </TableMessageRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Card>
  )
}
