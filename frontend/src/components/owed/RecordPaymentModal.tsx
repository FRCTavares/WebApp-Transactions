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
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-payment-title"
        tabIndex={-1}
      >
        <div className="modal-header">
          <div>
            <h2 id="record-payment-title">Record payment</h2>
            <p className="muted small">
              Record cash, bank transfer, MB WAY, or other repayments.
            </p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="form-row">
          <label>
            Person
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

        <div className="form-row">
          <label>
            Linked Money In
            <select
              value={paymentForm.linkedTransactionId}
              onChange={(event) => onUpdateField('linkedTransactionId', event.target.value)}
            >
              <option value="">No linked money in transaction</option>
              {paymentLinkedTransactions.map((transaction) => (
                <option key={transaction.id} value={transaction.id}>
                  {formatLinkedTransactionOption(transaction)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Manual Money In Tx ID
            <input
              type="number"
              min="1"
              step="1"
              value={paymentForm.linkedTransactionId}
              onChange={(event) => onUpdateField('linkedTransactionId', event.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>

        <div className="form-row">
          <label>
            Unallocated category
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
            <span className="muted small">
              Use Allowance, Gift, or Income when leftover money should count as money in.
            </span>
          </label>

          <label>
            Unallocated notes
            <input
              value={paymentForm.unallocatedNotes}
              onChange={(event) => onUpdateField('unallocatedNotes', event.target.value)}
              placeholder="Grandma gave extra"
            />
          </label>
        </div>

        <label>
          Payment notes
          <textarea
            value={paymentForm.notes}
            onChange={(event) => onUpdateField('notes', event.target.value)}
            rows={3}
          />
        </label>

        {paymentForm.person && Number(paymentForm.amount) > 0 && (
          <div className="modal-transaction-summary">
            <div>
              <strong>Choose owed items to pay</strong>
              <p className="muted small">
                Leave all amounts blank to auto-allocate oldest first.
              </p>

              {getPaymentAllocationItems(items, paymentForm.person).length === 0 ? (
                <p className="muted small">No open owed items for this person.</p>
              ) : (
                getPaymentAllocationItems(items, paymentForm.person).map((item) => (
                  <label key={item.id}>
                    {item.reason} · remaining {formatMoney(item.amount_remaining)}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={item.amount_remaining}
                      value={paymentForm.allocationAmounts[item.id] ?? ''}
                      onChange={(event) => onUpdateAllocation(item.id, event.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                ))
              )}
            </div>

            {getManualPaymentAllocations(paymentForm).length > 0 ? (
              <span>
                Leftover: {formatMoney((
                  Math.abs(Number(paymentForm.amount)) -
                  getManualAllocationTotal(paymentForm)
                ).toFixed(2))}
              </span>
            ) : (
              <span>
                Auto leftover: {formatMoney((
                  Math.abs(Number(paymentForm.amount)) -
                  getAllocationTotal(
                    getAutoAllocationPreview(
                      items,
                      paymentForm.person,
                      Math.abs(Number(paymentForm.amount)),
                    ),
                  )
                ).toFixed(2))}
              </span>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={onSubmit}
          >
            Record payment
          </button>
        </div>
      </div>
    </div>
  )
}
