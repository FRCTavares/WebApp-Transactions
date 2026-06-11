import type { ReactNode } from 'react'
import type { Transaction } from '../types/api'
import { formatDate, formatMoney } from '../utils/format'

type TransactionTableProps = {
  transactions: Transaction[]
  createRow?: ReactNode
  editRow?: (transaction: Transaction) => ReactNode
  onEdit?: (transaction: Transaction) => void
  onDelete?: (transaction: Transaction) => void
}

function formatCashflowType(cashflowType: string) {
  return cashflowType.replaceAll('_', ' ')
}

function getCashflowBadgeClass(cashflowType: string) {
  return `badge badge-${cashflowType.replaceAll('_', '-')}`
}

export function TransactionTable({
  transactions,
  createRow,
  editRow,
  onEdit,
  onDelete,
}: TransactionTableProps) {
  const showActions = Boolean(onEdit || onDelete || createRow || editRow)

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Type</th>
            <th>Category</th>
            <th>Source</th>
            <th className="right">Amount</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {createRow}

          {transactions.length === 0 && !createRow && (
            <tr>
              <td colSpan={showActions ? 7 : 6}>
                <p className="muted">No transactions found.</p>
              </td>
            </tr>
          )}

          {transactions.map((transaction) => {
            const customEditRow = editRow?.(transaction)

            if (customEditRow) {
              return customEditRow
            }

            return (
              <tr key={transaction.id}>
                <td>{formatDate(transaction.date)}</td>
                <td>
                  <div>{transaction.description}</div>
                  <div className="muted small">{transaction.raw_description}</div>
                </td>
                <td>
                  <span className={getCashflowBadgeClass(transaction.cashflow_type)}>
                    {formatCashflowType(transaction.cashflow_type)}
                  </span>
                </td>
                <td>
                  {transaction.category ? (
                    <span className="badge badge-neutral">{transaction.category}</span>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  <span className="badge badge-source">{transaction.source}</span>
                </td>
                <td className="right">
                  {formatMoney(transaction.amount, transaction.currency)}
                </td>
                {showActions && (
                  <td>
                    <div className="action-group">
                      {onEdit && (
                        <button type="button" onClick={() => onEdit(transaction)}>
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => onDelete(transaction)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
