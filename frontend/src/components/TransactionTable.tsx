import type { Transaction } from '../types/api'
import { formatDate, formatMoney } from '../utils/format'

type TransactionTableProps = {
  transactions: Transaction[]
  onEdit?: (transaction: Transaction) => void
  onDelete?: (transaction: Transaction) => void
}

export function TransactionTable({ transactions, onEdit, onDelete }: TransactionTableProps) {
  const showActions = Boolean(onEdit || onDelete)

  if (transactions.length === 0) {
    return <p className="muted">No transactions found.</p>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Source</th>
            <th className="right">Amount</th>
            {showActions && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{formatDate(transaction.date)}</td>
              <td>
                <div>{transaction.description}</div>
                <div className="muted small">{transaction.raw_description}</div>
              </td>
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
          ))}
        </tbody>
      </table>
    </div>
  )
}
