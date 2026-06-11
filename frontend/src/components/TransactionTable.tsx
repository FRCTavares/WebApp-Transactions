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
  return cashflowType.replace('_', ' ')
}

export function TransactionTable({
  transactions,
  createRow,
  editRow,
  onEdit,
  onDelete,
}: TransactionTableProps) {
  const showActions = Boolean(onEdit || onDelete || createRow || editRow)

  if (transactions.length === 0 && !createRow) {
    return <p className="muted">No transactions found.</p>
  }

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
              <td>{formatCashflowType(transaction.cashflow_type)}</td>
              <td>{transaction.category ?? '-'}</td>
              <td>{transaction.source}</td>
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
