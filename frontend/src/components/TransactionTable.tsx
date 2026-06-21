import { useMemo, useState, type ReactNode } from 'react'
import type { Transaction } from '../types/api'
import { formatDate, formatMoney } from '../utils/format'

export type TransactionTableRow = Transaction & {
  is_grouped?: boolean
  grouped_count?: number
}

type TransactionTableProps = {
  transactions: TransactionTableRow[]
  createRow?: ReactNode
  editRow?: (transaction: TransactionTableRow) => ReactNode
  onEdit?: (transaction: TransactionTableRow) => void
  onDelete?: (transaction: TransactionTableRow) => void
  onMarkOwed?: (transaction: TransactionTableRow) => void
}

type SortField = 'date' | 'amount'
type SortDirection = 'asc' | 'desc'

function formatCashflowType(cashflowType: string) {
  return cashflowType.replaceAll('_', ' ')
}

function getCashflowBadgeClass(cashflowType: string) {
  return `badge badge-${cashflowType.replaceAll('_', '-')}`
}

function getOwedLabel(transaction: TransactionTableRow) {
  const personText = transaction.owed_person ? ` by ${transaction.owed_person}` : ''

  if (transaction.owed_status === 'paid') {
    return `Paid${personText}`
  }

  if (transaction.owed_status === 'partially_paid') {
    return `Part paid${personText}`
  }

  if (transaction.owed_status === 'open') {
    return `Owed${personText}`
  }

  return null
}

export function TransactionTable({
  transactions,
  createRow,
  editRow,
  onEdit,
  onDelete,
  onMarkOwed,
}: TransactionTableProps) {
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const showActions = Boolean(onEdit || onDelete || onMarkOwed || createRow || editRow)

  function toggleSort(nextSortField: SortField) {
    if (sortField === nextSortField) {
      setSortDirection((currentDirection) => currentDirection === 'asc' ? 'desc' : 'asc')
      return
    }

    setSortField(nextSortField)
    setSortDirection('asc')
  }

  function getSortLabel(field: SortField) {
    if (sortField !== field) {
      return '↕'
    }

    return sortDirection === 'asc' ? '↑' : '↓'
  }

  const sortedTransactions = useMemo(() => {
    if (!sortField) {
      return transactions
    }

    return [...transactions].sort((firstTransaction, secondTransaction) => {
      const firstValue = sortField === 'date'
        ? new Date(firstTransaction.date).getTime()
        : Number(firstTransaction.amount)
      const secondValue = sortField === 'date'
        ? new Date(secondTransaction.date).getTime()
        : Number(secondTransaction.amount)

      const comparison = firstValue - secondValue

      if (comparison === 0) {
        return firstTransaction.id - secondTransaction.id
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [transactions, sortField, sortDirection])

  const hasInlineForm = Boolean(createRow)

  return (
    <>
      {!hasInlineForm && (
        <div className="transaction-mobile-list">
          {sortedTransactions.length === 0 ? (
            <p className="muted">No transactions found.</p>
          ) : (
            sortedTransactions.map((transaction) => (
              <article
                key={transaction.is_grouped ? `mobile-grouped-${transaction.dedupe_hash}` : `mobile-${transaction.id}`}
                className="transaction-mobile-card"
              >
                <div className="transaction-mobile-card-main">
                  <div>
                    <strong>{transaction.description}</strong>
                    <p>
                      {formatDate(transaction.date)}
                      {transaction.category ? ` · ${transaction.category}` : ''}
                    </p>
                  </div>
                  <span>{formatMoney(transaction.amount, transaction.currency)}</span>
                </div>

                <div className="transaction-mobile-card-meta">
                  <span className={getCashflowBadgeClass(transaction.cashflow_type)}>
                    {formatCashflowType(transaction.cashflow_type)}
                  </span>
                  {getOwedLabel(transaction) && (
                    <span className={`badge ${
                      transaction.owed_status === 'paid'
                        ? 'badge-owed-paid'
                        : 'badge-owed-open'
                    }`}>
                      {getOwedLabel(transaction)}
                    </span>
                  )}
                  {transaction.source && (
                    <span className="badge badge-source">{transaction.source}</span>
                  )}
                </div>

                {transaction.raw_description && transaction.raw_description !== transaction.description && (
                  <p className="transaction-mobile-raw muted small">
                    {transaction.raw_description}
                  </p>
                )}

                {showActions && !transaction.is_grouped && (
                  <div className="transaction-mobile-actions">
                    {onEdit && (
                      <button
                        type="button"
                        className="transaction-mobile-action"
                        onClick={() => onEdit(transaction)}
                      >
                        Edit
                      </button>
                    )}
                    {!transaction.is_owed && onMarkOwed && transaction.direction === 'out' && (
                      <button
                        type="button"
                        className="transaction-mobile-action"
                        onClick={() => onMarkOwed(transaction)}
                      >
                        Owed
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        className="transaction-mobile-action transaction-mobile-action-danger"
                        onClick={() => onDelete(transaction)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      )}

      <div className={`table-wrap transaction-desktop-table-wrap ${hasInlineForm ? 'transaction-table-has-inline-form' : ''}`}>
        <table>
        <thead>
          <tr>
            <th>
              <button
                type="button"
                className="table-sort-button"
                onClick={() => toggleSort('date')}
              >
                Date <span>{getSortLabel('date')}</span>
              </button>
            </th>
            <th>Description</th>
            <th>Type</th>
            <th>Category</th>
            <th>Source</th>
            <th className="right">
              <button
                type="button"
                className="table-sort-button table-sort-button-right"
                onClick={() => toggleSort('amount')}
              >
                Amount <span>{getSortLabel('amount')}</span>
              </button>
            </th>
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

          {sortedTransactions.map((transaction) => {
            const customEditRow = editRow?.(transaction)

            if (customEditRow) {
              return customEditRow
            }

            return (
              <tr
                key={transaction.is_grouped ? `grouped-${transaction.dedupe_hash}` : transaction.id}
                className="transaction-row"
              >
                <td>{formatDate(transaction.date)}</td>
                <td>
                  <div className="transaction-description-line">
                    <span>{transaction.description}</span>
                    {getOwedLabel(transaction) && (
                      <span className={`badge ${
                        transaction.owed_status === 'paid'
                          ? 'badge-owed-paid'
                          : 'badge-owed-open'
                      }`}>
                        {getOwedLabel(transaction)}
                      </span>
                    )}
                  </div>
                  <div className="muted small">
                    {transaction.raw_description}
                    {transaction.grouped_count ? ` · ${transaction.grouped_count} grouped rows` : ''}
                  </div>
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
                      {!transaction.is_grouped && onEdit && (
                        <button type="button" onClick={() => onEdit(transaction)}>
                          Edit
                        </button>
                      )}
                      {!transaction.is_grouped && !transaction.is_owed && onMarkOwed && transaction.direction === 'out' && (
                        <button type="button" onClick={() => onMarkOwed(transaction)}>
                          Owed
                        </button>
                      )}
                      {!transaction.is_grouped && onDelete && (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => onDelete(transaction)}
                        >
                          Delete
                        </button>
                      )}
                      {transaction.is_grouped && (
                        <span className="muted small">Grouped</span>
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
    </>
  )
}
