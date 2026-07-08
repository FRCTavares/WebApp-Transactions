import type { OwedItem, Transaction } from '../../types/api'
import { formatMoney } from '../../utils/format'
import type { TransactionTableRow } from '../TransactionTable'

export type OwedSplitRowState = {
  id: string
  person: string
  amount: string
  linkedPaymentTransactionId: string
  leftoverAllocations: Record<number, string>
  unallocatedCategory: string
  unallocatedNotes: string
  notes: string
}

const UNALLOCATED_CATEGORY_OPTIONS = [
  { value: '', label: 'Not income / leave unclassified' },
  { value: 'Allowance', label: 'Allowance' },
  { value: 'Gift', label: 'Gift' },
  { value: 'Income', label: 'Income' },
  { value: 'Other', label: 'Other / not counted as income' },
]

type TransactionOwedSplitDialogProps = {
  transaction: TransactionTableRow
  rows: OwedSplitRowState[]
  paymentTransactions: Transaction[]
  paymentAvailableAmounts: Record<number, string>
  isCreating: boolean
  onClose: () => void
  onAddRow: () => void
  onRemoveRow: (rowId: string) => void
  onUpdateRow: <K extends keyof OwedSplitRowState>(
    rowId: string,
    field: K,
    value: OwedSplitRowState[K],
  ) => void
  onLeftoverAllocationChange: (rowId: string, owedItemId: number, amount: string) => void
  leftoverItemsByPerson: Record<string, OwedItem[]>
  onCreate: () => void
  getRemainingOwedAmount: (transaction: TransactionTableRow) => number
  getSelectedPaymentTransaction: (row: OwedSplitRowState) => Transaction | null
}

function parseMoneyInput(value: string) {
  return Math.abs(Number(value.replace(',', '.')))
}

function getRowsTotal(rows: OwedSplitRowState[]) {
  return rows.reduce((total, row) => {
    const amount = parseMoneyInput(row.amount)

    if (!amount || Number.isNaN(amount)) {
      return total
    }

    return total + amount
  }, 0)
}

export function TransactionOwedSplitDialog({
  transaction,
  rows,
  paymentTransactions,
  paymentAvailableAmounts,
  isCreating,
  onClose,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  onLeftoverAllocationChange,
  leftoverItemsByPerson,
  onCreate,
  getRemainingOwedAmount,
  getSelectedPaymentTransaction,
}: TransactionOwedSplitDialogProps) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-card transaction-owed-split-dialog">
        <div className="modal-header">
          <div>
            <h2>Split owed expense</h2>
            <p className="muted small">
              Add who owes part of this expense. Optionally link matching Money In repayments now.
            </p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-transaction-summary">
          <strong>{transaction.description}</strong>
          <span>{formatMoney(transaction.amount, transaction.currency)}</span>
        </div>

        <p className="muted small">
          Already linked: {formatMoney(
            transaction.owed_amount_total ?? '0.00',
            transaction.currency,
          )}. Remaining available: {formatMoney(
            getRemainingOwedAmount(transaction).toFixed(2),
            transaction.currency,
          )}. Current split total: {formatMoney(
            getRowsTotal(rows).toFixed(2),
            transaction.currency,
          )}.
        </p>

        {rows.map((row, index) => {
          const linkedPaymentTransaction = getSelectedPaymentTransaction(row)
          const rowAmount = parseMoneyInput(row.amount)
          const paymentAmount = linkedPaymentTransaction
            ? Number(paymentAvailableAmounts[linkedPaymentTransaction.id] ?? linkedPaymentTransaction.amount)
            : 0
          const allocationAmount = linkedPaymentTransaction
            ? Math.min(paymentAmount, rowAmount || 0)
            : 0
          const leftoverAmount = linkedPaymentTransaction
            ? Math.max(paymentAmount - allocationAmount, 0)
            : 0
          const personKey = row.person.trim().toLowerCase()
          const leftoverItems = leftoverItemsByPerson[personKey] ?? []
          const leftoverAllocatedAmount = Object.values(row.leftoverAllocations).reduce(
            (total, value) => {
              const amount = parseMoneyInput(value)

              if (!amount || Number.isNaN(amount)) {
                return total
              }

              return total + amount
            },
            0,
          )
          const finalLeftoverAmount = Math.max(leftoverAmount - leftoverAllocatedAmount, 0)

          return (
            <div key={row.id} className="modal-transaction-summary">
              <div>
                <strong>Person {index + 1}</strong>
                <p className="muted small">
                  Owed allocation for this expense.
                </p>
              </div>

              <div className="form-row">
                <label>
                  Person
                  <input
                    value={row.person}
                    onChange={(event) => onUpdateRow(row.id, 'person', event.target.value)}
                    placeholder="Mother"
                  />
                </label>

                <label>
                  Amount owed
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount}
                    onChange={(event) => onUpdateRow(row.id, 'amount', event.target.value)}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Matching Money In
                  <select
                    value={row.linkedPaymentTransactionId}
                    onChange={(event) =>
                      onUpdateRow(row.id, 'linkedPaymentTransactionId', event.target.value)
                    }
                  >
                    <option value="">No repayment selected</option>
                    {paymentTransactions.map((paymentTransaction) => (
                      <option key={paymentTransaction.id} value={paymentTransaction.id}>
                        #{paymentTransaction.id} | {paymentTransaction.date} | {paymentTransaction.description} | {formatMoney(
                          paymentAvailableAmounts[paymentTransaction.id] ?? paymentTransaction.amount,
                          paymentTransaction.currency,
                        )} available
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Leftover category
                  <select
                    value={row.unallocatedCategory}
                    onChange={(event) =>
                      onUpdateRow(row.id, 'unallocatedCategory', event.target.value)
                    }
                    disabled={!linkedPaymentTransaction || leftoverAmount <= 0}
                  >
                    {UNALLOCATED_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value || 'empty'} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="muted small">
                    Only use this if money remains after paying other owed items.
                  </span>
                </label>
              </div>

              {linkedPaymentTransaction && (
                <p className="muted small">
                  Payment {formatMoney(paymentAmount.toFixed(2), linkedPaymentTransaction.currency)}
                  {' '}→ this expense {formatMoney(allocationAmount.toFixed(2), linkedPaymentTransaction.currency)}
                  {' '}→ other owed items {formatMoney(leftoverAllocatedAmount.toFixed(2), linkedPaymentTransaction.currency)}
                  {' '}→ leftover {formatMoney(finalLeftoverAmount.toFixed(2), linkedPaymentTransaction.currency)}
                </p>
              )}

              {linkedPaymentTransaction && leftoverAmount > 0 && (
                <div className="transaction-repayment-expenses">
                  <p className="transaction-repayment-section-label">
                    Use leftover for other owed items
                  </p>

                  {leftoverItems.length === 0 ? (
                    <p className="muted small">
                      No other active owed items found for this person.
                    </p>
                  ) : (
                    leftoverItems.map((item) => (
                      <div key={item.id} className="transaction-repayment-expense-row">
                        <div className="transaction-repayment-expense-copy">
                          <strong>{item.reason}</strong>
                          <span>Remaining {formatMoney(item.amount_remaining, transaction.currency)}</span>
                        </div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          max={item.amount_remaining}
                          value={row.leftoverAllocations[item.id] ?? ''}
                          onChange={(event) =>
                            onLeftoverAllocationChange(row.id, item.id, event.target.value)
                          }
                          placeholder="0.00"
                          aria-label={`Leftover amount for ${item.reason}`}
                        />
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="form-row">
                <label>
                  Notes
                  <textarea
                    value={row.notes}
                    onChange={(event) => onUpdateRow(row.id, 'notes', event.target.value)}
                    rows={3}
                  />
                </label>

                <label>
                  Leftover notes
                  <textarea
                    value={row.unallocatedNotes}
                    onChange={(event) =>
                      onUpdateRow(row.id, 'unallocatedNotes', event.target.value)
                    }
                    rows={3}
                    disabled={!linkedPaymentTransaction || leftoverAmount <= 0}
                    placeholder="Extra was a gift"
                  />
                </label>
              </div>

              {rows.length > 1 && (
                <button type="button" className="danger-button" onClick={() => onRemoveRow(row.id)}>
                  Remove person
                </button>
              )}
            </div>
          )
        })}

        <div className="modal-actions">
          <button type="button" onClick={onAddRow}>
            + Add person
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onCreate}
            disabled={isCreating}
          >
            {isCreating ? 'Creating...' : 'Create owed split'}
          </button>
        </div>
      </div>
    </div>
  )
}
