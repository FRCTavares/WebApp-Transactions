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

type OwedCoverage = 'none' | 'partly' | 'fully'

function getOwedAmountTotal(transaction: TransactionTableRow) {
  return Number(transaction.owed_amount_total ?? '0')
}

function getOwedCoverage(transaction: TransactionTableRow): OwedCoverage {
  const transactionAmount = Number(transaction.amount)
  const owedAmountTotal = getOwedAmountTotal(transaction)

  if (!transaction.is_owed || owedAmountTotal <= 0 || transactionAmount <= 0) {
    return 'none'
  }

  if (owedAmountTotal >= transactionAmount - 0.0001) {
    return 'fully'
  }

  return 'partly'
}

function getOwedLabel(transaction: TransactionTableRow) {
  const coverage = getOwedCoverage(transaction)
  const personText = transaction.owed_person ? ` by ${transaction.owed_person}` : ''

  if (coverage === 'fully') {
    return `Fully owed${personText}`
  }

  if (coverage === 'partly') {
    return `Partly owed${personText}`
  }

  return null
}

function getOwedBadgeClassName(transaction: TransactionTableRow) {
  return getOwedCoverage(transaction) === 'fully'
    ? 'badge badge-owed-fully'
    : 'badge badge-owed-partial'
}

function getMobileCardClassName(transaction: TransactionTableRow) {
  const coverage = getOwedCoverage(transaction)

  if (coverage === 'fully') {
    return 'transaction-mobile-card transaction-mobile-card-fully-owed'
  }

  if (coverage === 'partly') {
    return 'transaction-mobile-card transaction-mobile-card-partly-owed'
  }

  return 'transaction-mobile-card'
}

function getDesktopRowClassName(transaction: TransactionTableRow) {
  const coverage = getOwedCoverage(transaction)

  if (coverage === 'fully') {
    return 'transaction-row transaction-row-fully-owed'
  }

  if (coverage === 'partly') {
    return 'transaction-row transaction-row-partly-owed'
  }

  return 'transaction-row'
}

function getRemainingOwedCapacity(transaction: TransactionTableRow) {
  const transactionAmount = Number(transaction.amount)
  const linkedOwedAmount = getOwedAmountTotal(transaction)

  return Math.max(transactionAmount - linkedOwedAmount, 0)
}

function canCreateOwedShare(transaction: TransactionTableRow) {
  return transaction.direction === 'out' && getRemainingOwedCapacity(transaction) > 0
}

function getOwedActionLabel(transaction: TransactionTableRow) {
  return transaction.is_owed ? 'Add owed' : 'Owed'
}

function getAmountDisplay(transaction: TransactionTableRow) {
  const transactionAmount = Number(transaction.amount)
  const owedAmountTotal = getOwedAmountTotal(transaction)
  const owedPaymentAllocatedAmount = Number(transaction.owed_payment_allocated_amount ?? '0')
  const shouldShowPersonalCost = (
    transaction.direction === 'out'
    && transaction.is_owed
    && owedAmountTotal > 0
    && transactionAmount > 0
  )
  const shouldShowRealIncome = (
    transaction.direction === 'in'
    && transaction.is_owed_payment
    && owedPaymentAllocatedAmount > 0
    && transactionAmount > 0
  )

  if (shouldShowPersonalCost) {
    return {
      mainAmount: Math.max(transactionAmount - owedAmountTotal, 0),
      referenceAmount: transaction.amount,
    }
  }

  if (shouldShowRealIncome) {
    return {
      mainAmount: Math.max(transactionAmount - owedPaymentAllocatedAmount, 0),
      referenceAmount: transaction.amount,
    }
  }

  return {
    mainAmount: transaction.amount,
    referenceAmount: null,
  }
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
            sortedTransactions.map((transaction) => {
              const amountDisplay = getAmountDisplay(transaction)

              return (
                <article
                  key={transaction.is_grouped ? `mobile-grouped-${transaction.dedupe_hash}` : `mobile-${transaction.id}`}
                  className={getMobileCardClassName(transaction)}
                >
                <div className="transaction-mobile-card-main">
                  <div>
                    <strong>{transaction.description}</strong>
                    <p>
                      {formatDate(transaction.date)}
                      {transaction.category ? ` · ${transaction.category}` : ''}
                    </p>
                  </div>
                  <div className="transaction-mobile-amount">
                    <strong>{formatMoney(amountDisplay.mainAmount, transaction.currency)}</strong>
                    {amountDisplay.referenceAmount !== null && (
                      <span className="muted small">
                        of {formatMoney(amountDisplay.referenceAmount, transaction.currency)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="transaction-mobile-card-meta">
                  <span className={getCashflowBadgeClass(transaction.cashflow_type)}>
                    {formatCashflowType(transaction.cashflow_type)}
                  </span>
                  {getOwedLabel(transaction) && (
                    <span className={getOwedBadgeClassName(transaction)}>
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
                        className="transaction-mobile-action transaction-action-edit"
                        onClick={() => onEdit(transaction)}
                      >
                        Edit
                      </button>
                    )}
                    {onMarkOwed && canCreateOwedShare(transaction) && (
                      <button
                        type="button"
                        className="transaction-mobile-action transaction-action-edit"
                        onClick={() => onMarkOwed(transaction)}
                        aria-label={`${getOwedActionLabel(transaction)} ${transaction.description}`}
                      >
                        {getOwedActionLabel(transaction)}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        className="transaction-mobile-action transaction-action-delete transaction-mobile-action-danger"
                        onClick={() => onDelete(transaction)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
                </article>
              )
            })
          )}
        </div>
      )}

      <div className={`content-card table-wrap transaction-desktop-table-wrap ${hasInlineForm ? 'transaction-table-has-inline-form' : ''}`}>
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
            const amountDisplay = getAmountDisplay(transaction)
            const customEditRow = editRow?.(transaction)

            if (customEditRow) {
              return customEditRow
            }

            return (
              <tr
                key={transaction.is_grouped ? `grouped-${transaction.dedupe_hash}` : transaction.id}
                className={getDesktopRowClassName(transaction)}
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
                  <div>
                    <div>{formatMoney(amountDisplay.mainAmount, transaction.currency)}</div>
                    {amountDisplay.referenceAmount !== null && (
                      <div className="muted small">
                        of {formatMoney(amountDisplay.referenceAmount, transaction.currency)}
                      </div>
                    )}
                  </div>
                </td>
                {showActions && (
                  <td>
                    <div className="action-group">
                      {!transaction.is_grouped && onEdit && (
                        <button
                          type="button"
                          className="transaction-row-action transaction-row-action-edit"
                          onClick={() => onEdit(transaction)}
                          aria-label={`Edit ${transaction.description}`}
                        >
                          Edit
                        </button>
                      )}
                      {!transaction.is_grouped && onMarkOwed && canCreateOwedShare(transaction) && (
                        <button
                          type="button"
                          className="transaction-row-action transaction-row-action-owed"
                          onClick={() => onMarkOwed(transaction)}
                          aria-label={`${getOwedActionLabel(transaction)} ${transaction.description}`}
                        >
                          {getOwedActionLabel(transaction)}
                        </button>
                      )}
                      {!transaction.is_grouped && onDelete && (
                        <button
                          type="button"
                          className="transaction-row-action transaction-row-action-delete"
                          onClick={() => onDelete(transaction)}
                          aria-label={`Delete ${transaction.description}`}
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
