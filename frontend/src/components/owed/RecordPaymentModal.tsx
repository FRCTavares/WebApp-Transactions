import type { RefObject } from 'react'
import type { OwedItem, OwedPaymentMethod, Transaction } from '../../types/api'
import { formatMoney } from '../../utils/format'
import {
  UNALLOCATED_CATEGORY_OPTIONS,
  formatLinkedTransactionOption,
  getAllocationTotal,
  getAutoAllocationPreview,
  getManualAllocationTotal,
  getManualPaymentAllocations,
  getPaymentAllocationItems,
  getPaymentPeople,
  type PaymentFormState,
} from '../../utils/owedPaymentUtils'
import { Button } from '../ui'

function getPaymentAmount(value: string) {
  return Math.abs(Number(value.replace(',', '.')))
}

/**
 * The "Record payment" modal on `OwedPage`. Split out (along with its
 * pure helpers, see `utils/owedPaymentUtils.ts`) to keep `OwedPage.tsx`
 * under the project's 900-line soft limit.
 */
export function RecordPaymentModal({
  dialogRef,
  items,
  paymentLinkedTransactions,
  paymentForm,
  onClose,
  onUpdateField,
  onUpdatePerson,
  onUpdateAllocation,
  onSubmit,
  isSubmitting,
}: {
  dialogRef: RefObject<HTMLDivElement | null>
  items: OwedItem[]
  paymentLinkedTransactions: Transaction[]
  paymentForm: PaymentFormState
  onClose: () => void
  onUpdateField: <K extends keyof PaymentFormState>(field: K, value: PaymentFormState[K]) => void
  onUpdatePerson: (person: string) => void
  onUpdateAllocation: (owedItemId: number, amount: string) => void
  onSubmit: () => void
  isSubmitting?: boolean
}) {
  const amount = getPaymentAmount(paymentForm.amount)
  const automaticAllocations = getAutoAllocationPreview(
    items,
    paymentForm.person,
    amount,
    paymentForm.allocationStopBeforeId,
  )
  const paymentAllocationItems = getPaymentAllocationItems(items, paymentForm.person)
  const manualAllocationTotal = getManualAllocationTotal(paymentForm)
  const hasManualAllocations = getManualPaymentAllocations(paymentForm).length > 0
  const allocatedAmount = hasManualAllocations
    ? manualAllocationTotal
    : getAllocationTotal(automaticAllocations)
  const leftoverAmount = Math.max(amount - allocatedAmount, 0)
  const fullyPaidCount = automaticAllocations.filter(
    ({ item, amount: allocationAmount }) => allocationAmount >= Number(item.amount_remaining),
  ).length

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="modal-card record-payment-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-payment-title"
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <p className="record-payment-eyebrow">Repayment received</p>
            <h2 id="record-payment-title">Record payment</h2>
            <p className="muted small">
              Enter the cash received and we’ll settle the oldest open items automatically.
            </p>
          </div>
          <Button type="button" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="form-row">
          <label>
            Who paid you?
            <select
              value={paymentForm.person}
              onChange={(event) => onUpdatePerson(event.target.value)}
            >
              <option value="">Choose person</option>
              {getPaymentPeople(items).map((person) => (
                <option key={person} value={person}>
                  {person}
                </option>
              ))}
            </select>
          </label>

          <label>
            Amount received
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={paymentForm.amount}
              onChange={(event) => onUpdateField('amount', event.target.value)}
              placeholder="0.00"
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Payment date
            <input
              type="date"
              value={paymentForm.paymentDate}
              onChange={(event) => onUpdateField('paymentDate', event.target.value)}
            />
          </label>

          <label>
            Method
            <select
              value={paymentForm.method}
              onChange={(event) =>
                onUpdateField('method', event.target.value as OwedPaymentMethod)
              }
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="mbway">MB WAY</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>

        {paymentForm.person && paymentAllocationItems.length > 0 && (
          <label className="record-payment-boundary" htmlFor="allocation-stop-before">
            Automatic payment ends before
            <select
              id="allocation-stop-before"
              aria-label="Automatic payment ends before"
              value={paymentForm.allocationStopBeforeId}
              onChange={(event) => onUpdateField('allocationStopBeforeId', event.target.value)}
            >
              <option value="">No limit — use oldest items first</option>
              {paymentAllocationItems.map((item, index) => (
                <option key={item.id} value={item.id}>
                  {index + 1}. Before {item.reason} ({formatMoney(item.amount_remaining)})
                </option>
              ))}
            </select>
            <span className="muted small">
              Choose an item to keep it and everything after it separate. For example, choose
              “Before Japan Flights” to pay the earlier items only.
            </span>
          </label>
        )}

        {paymentForm.person && amount > 0 && (
          <section className="modal-transaction-summary record-payment-plan" aria-live="polite">
            <div>
              <strong>{hasManualAllocations ? 'Custom payment plan' : 'Automatic payment plan'}</strong>
              <p className="muted small">
                {hasManualAllocations
                  ? 'Only the amounts entered below will be applied.'
                  : 'Oldest open items are paid first.'}
              </p>
              {automaticAllocations.length === 0 ? (
                <p className="muted small">No open owed items for this person.</p>
              ) : !hasManualAllocations && (
                <ul className="record-payment-plan-items">
                  {automaticAllocations.map(({ item, amount: allocationAmount }) => (
                    <li key={item.id}>
                      <span>{item.reason}</span>
                      <strong>{formatMoney(allocationAmount.toFixed(2))}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {!hasManualAllocations && fullyPaidCount > 0 && (
                <p className="muted small">
                  {fullyPaidCount} item{fullyPaidCount === 1 ? '' : 's'} will be fully paid.
                </p>
              )}
            </div>
            <strong>{formatMoney(allocatedAmount.toFixed(2))}</strong>
            {leftoverAmount > 0 && (
              <p className="record-payment-leftover">
                {formatMoney(leftoverAmount.toFixed(2))} left unallocated
              </p>
            )}
          </section>
        )}

        {paymentForm.person && amount > 0 && paymentAllocationItems.length > 0 && (
          <details className="record-payment-details">
            <summary>Adjust which items are paid</summary>
            <p className="muted small">
              Optional. Entering any amount replaces the automatic plan with your custom plan.
            </p>
            <div className="record-payment-allocation-list">
              {paymentAllocationItems.map((item) => (
                <label key={item.id}>
                  <span>
                    {item.reason}
                    <small>Remaining {formatMoney(item.amount_remaining)}</small>
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    max={item.amount_remaining}
                    value={paymentForm.allocationAmounts[item.id] ?? ''}
                    onChange={(event) => onUpdateAllocation(item.id, event.target.value)}
                    placeholder="0.00"
                    aria-label={`Amount to apply to ${item.reason}`}
                  />
                </label>
              ))}
            </div>
          </details>
        )}

        {paymentForm.person && amount > 0 && leftoverAmount > 0 && (
          <details className="record-payment-details">
            <summary>Classify the leftover (optional)</summary>
            <div className="form-row">
              <label>
                Category
                <select
                  value={paymentForm.unallocatedCategory}
                  onChange={(event) => onUpdateField('unallocatedCategory', event.target.value)}
                >
                  {UNALLOCATED_CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value || 'empty'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Note
                <input
                  value={paymentForm.unallocatedNotes}
                  onChange={(event) => onUpdateField('unallocatedNotes', event.target.value)}
                  placeholder="Extra cash"
                />
              </label>
            </div>
          </details>
        )}

        <details className="record-payment-details">
          <summary>Add a note or link a Money In transaction</summary>
          <label>
            Linked Money In
            <select
              value={paymentForm.linkedTransactionId}
              onChange={(event) => onUpdateField('linkedTransactionId', event.target.value)}
            >
              <option value="">No linked Money In transaction</option>
              {paymentLinkedTransactions.map((transaction) => (
                <option key={transaction.id} value={transaction.id}>
                  {formatLinkedTransactionOption(transaction)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Payment note
            <textarea
              value={paymentForm.notes}
              onChange={(event) => onUpdateField('notes', event.target.value)}
              rows={2}
              placeholder="Optional"
            />
          </label>
        </details>

        <div className="modal-actions">
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={onSubmit}
            loading={isSubmitting}
          >
            {isSubmitting ? 'Recording payment' : 'Record payment'}
          </Button>
        </div>
      </div>
    </div>
  )
}
