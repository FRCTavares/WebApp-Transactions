import { useMemo, useState, type ReactNode } from 'react'
import { Receipt } from 'lucide-react'
import type { Transaction } from '../types/api'
import { formatDate, formatMoney } from '../utils/format'
import { Badge, Button, EmptyState } from './ui'
import type { BadgeTone } from './ui'
import {
  formatCashflowType,
  formatSource,
  getCashflowTone,
} from '../utils/badgeLabels'

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

/* Fully covered reads as settled, partial as still outstanding. */
function getOwedCoverageTone(transaction: TransactionTableRow): BadgeTone {
  return getOwedCoverage(transaction) === 'fully' ? 'positive' : 'warning'
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
            <EmptyState
              size="sm"
              icon={Receipt}
              title="No transactions found."
              description="Adjust the filters above, or add a transaction to get started."
            />
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
                  <Badge tone={getCashflowTone(transaction.cashflow_type)} size="sm">
                    {formatCashflowType(transaction.cashflow_type)}
                  </Badge>
                  {getOwedLabel(transaction) && (
                    <Badge tone={getOwedCoverageTone(transaction)} size="sm">
                      {getOwedLabel(transaction)}
                    </Badge>
                  )}
                  {transaction.source && (
                    <Badge tone="neutral" size="sm">{formatSource(transaction.source)}</Badge>
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
                      <Button
                        type="button"
                        size="sm" fullWidth
                        onClick={() => onEdit(transaction)}
                      >
                        Edit
                      </Button>
                    )}
                    {onMarkOwed && canCreateOwedShare(transaction) && (
                      <Button
                        type="button"
                        size="sm" fullWidth
                        onClick={() => onMarkOwed(transaction)}
                        aria-label={`${getOwedActionLabel(transaction)} ${transaction.description}`}
                      >
                        {getOwedActionLabel(transaction)}
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        type="button"
                        size="sm" variant="danger" fullWidth
                        onClick={() => onDelete(transaction)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                )}
                </article>
              )
            })
          )}
        </div>
      )}

      {/* Deliberately no `content-card table-wrap` here. Both are legacy
          generic classes that the dark override sheets force to #1c1d21 with
          !important, which beat this page's own --transaction-surface and left
          the table a different shade from every other surface on the page.
          Neither contributed anything unique: `.transactions-page
          .transaction-desktop-table-wrap` already sets the border, radius,
          background and a 960px table min-width that overrode the generic
          920px. */}
      <div className={`transaction-desktop-table-wrap ${hasInlineForm ? 'transaction-table-has-inline-form' : ''}`}>
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
                <EmptyState
                  size="sm"
                  icon={Receipt}
                  title="No transactions found."
                  description="Adjust the filters above, or add a transaction to get started."
                />
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
                      <Badge
                        tone={transaction.owed_status === 'paid' ? 'positive' : 'warning'}
                        size="sm"
                      >
                        {getOwedLabel(transaction)}
                      </Badge>
                    )}
                  </div>
                  {/* Only show the raw description when it actually differs from
                      the description. Rendering it unconditionally printed every
                      row's text twice - the mobile card above already guards this
                      the same way. The grouped-row count still needs a home when
                      the raw description is suppressed. */}
                  {(transaction.raw_description !== transaction.description ||
                    transaction.grouped_count) && (
                    <div className="muted small">
                      {transaction.raw_description !== transaction.description
                        ? transaction.raw_description
                        : ''}
                      {transaction.grouped_count
                        ? `${
                            transaction.raw_description !== transaction.description ? ' · ' : ''
                          }${transaction.grouped_count} grouped rows`
                        : ''}
                    </div>
                  )}
                </td>
                <td>
                  <Badge tone={getCashflowTone(transaction.cashflow_type)} size="sm">
                    {formatCashflowType(transaction.cashflow_type)}
                  </Badge>
                </td>
                <td>
                  {transaction.category ? (
                    <Badge tone="neutral" size="sm">{transaction.category}</Badge>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  <Badge tone="neutral" size="sm">{formatSource(transaction.source)}</Badge>
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
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onEdit(transaction)}
                          aria-label={`Edit ${transaction.description}`}
                        >
                          Edit
                        </Button>
                      )}
                      {!transaction.is_grouped && onMarkOwed && canCreateOwedShare(transaction) && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => onMarkOwed(transaction)}
                          aria-label={`${getOwedActionLabel(transaction)} ${transaction.description}`}
                        >
                          {getOwedActionLabel(transaction)}
                        </Button>
                      )}
                      {!transaction.is_grouped && onDelete && (
                        <Button
                          type="button"
                          size="sm" variant="danger"
                          onClick={() => onDelete(transaction)}
                          aria-label={`Delete ${transaction.description}`}
                        >
                          Delete
                        </Button>
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
