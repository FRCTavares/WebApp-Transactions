import { useEffect, useState } from 'react'
import {
  createOwedItem,
  createOwedPayment,
  deleteOwedItem,
  exportOwedItemsCsv,
  listOwedItems,
  updateOwedItem,
} from '../api/owed'
import { listTransactions } from '../api/transactions'
import { OwedItemsTable, type OwedFormState } from '../components/owed/OwedItemsTable'
import { OwedStatusToolbar } from '../components/owed/OwedStatusToolbar'
import { OwedSummaryCards } from '../components/owed/OwedSummaryCards'
import { StatusMessage } from '../components/StatusMessage'
import type { OwedItem, OwedPaymentMethod, OwedStatusFilter, Transaction } from '../types/api'
import { formatMoney } from '../utils/format'


type PaymentFormState = {
  person: string
  amount: string
  paymentDate: string
  method: OwedPaymentMethod
  notes: string
}


function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

function getInitialPaymentFormState(): PaymentFormState {
  return {
    person: '',
    amount: '',
    paymentDate: getTodayDate(),
    method: 'cash',
    notes: '',
  }
}

function getPaymentPeople(items: OwedItem[]) {
  return Array.from(new Set(
    items
      .filter((item) => item.status === 'open' || item.status === 'partially_paid')
      .map((item) => item.person),
  )).sort((first, second) => first.localeCompare(second))
}

function getAutoAllocationPreview(items: OwedItem[], person: string, amount: number) {
  let remaining = amount

  return items
    .filter((item) => item.person === person)
    .filter((item) => item.status === 'open' || item.status === 'partially_paid')
    .map((item) => {
      const allocationAmount = Math.min(remaining, Number(item.amount_remaining))
      remaining -= allocationAmount

      return {
        item,
        amount: allocationAmount,
      }
    })
    .filter((allocation) => allocation.amount > 0)
}

function getAllocationTotal(allocations: Array<{ amount: number }>) {
  return allocations.reduce((total, allocation) => total + allocation.amount, 0)
}

function getInitialFormState(): OwedFormState {
  return {
    person: '',
    reason: '',
    amountTotal: '',
    amountPaid: '',
    dueDate: '',
    linkedTransactionId: '',
    notes: '',
  }
}

function getFormStateFromItem(item: OwedItem): OwedFormState {
  return {
    person: item.person,
    reason: item.reason,
    amountTotal: item.amount_total,
    amountPaid: item.amount_paid,
    dueDate: item.due_date ?? '',
    linkedTransactionId: item.linked_transaction_id?.toString() ?? '',
    notes: item.notes ?? '',
  }
}

function getItemsTotal(items: OwedItem[], field: 'amount_total' | 'amount_paid' | 'amount_remaining') {
  return items.reduce((total, item) => total + Number(item[field]), 0)
}

function getActiveItems(items: OwedItem[]) {
  return items.filter(
    (item) => item.status === 'open' || item.status === 'partially_paid',
  )
}

function getPaidItems(items: OwedItem[]) {
  return items.filter((item) => item.status === 'paid')
}

function getCancelledItems(items: OwedItem[]) {
  return items.filter((item) => item.status === 'cancelled')
}

function parseLinkedTransactionId(value: string) {
  if (!value.trim()) {
    return null
  }

  const parsedValue = Number(value)

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error('Linked transaction ID must be a positive whole number.')
  }

  return parsedValue
}

function formatLinkedTransactionOption(transaction: Transaction) {
  return `#${transaction.id} | ${transaction.date} | ${transaction.description} | ${formatMoney(
    transaction.amount,
    transaction.currency,
  )}`
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = filename
  link.click()

  URL.revokeObjectURL(objectUrl)
}

export function OwedPage() {
  const [items, setItems] = useState<OwedItem[]>([])
  const [linkedTransactions, setLinkedTransactions] = useState<Transaction[]>([])
  const [statusFilter, setStatusFilter] = useState<'' | OwedStatusFilter>('active')
  const [form, setForm] = useState<OwedFormState>(getInitialFormState)
  const [editForm, setEditForm] = useState<OwedFormState>(getInitialFormState)
  const [editingItem, setEditingItem] = useState<OwedItem | null>(null)
  const [isCreateRowOpen, setIsCreateRowOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(getInitialPaymentFormState)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function loadItems(status = statusFilter) {
    setError(null)

    listOwedItems({
      status: status || undefined,
      limit: 100,
    })
      .then(setItems)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load owed items')
      })
  }

  function loadLinkedTransactions() {
    listTransactions({
      direction: 'out',
      cashflow_type: 'expense',
      limit: 100,
    })
      .then(setLinkedTransactions)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load linked transaction options')
      })
  }

  useEffect(() => {
    loadItems()
  }, [statusFilter])

  useEffect(() => {
    loadLinkedTransactions()
  }, [])

  function updateForm(field: keyof OwedFormState, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function updateEditForm(field: keyof OwedFormState, value: string) {
    setEditForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function updateFormLinkedTransactionId(transactionId: string) {
    updateForm('linkedTransactionId', transactionId)
  }

  function updateEditFormLinkedTransactionId(transactionId: string) {
    updateEditForm('linkedTransactionId', transactionId)
  }


  function updatePaymentForm<K extends keyof PaymentFormState>(
    field: K,
    value: PaymentFormState[K],
  ) {
    setPaymentForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  async function recordPaymentFromForm() {
    setError(null)
    setMessage(null)

    const amount = Math.abs(Number(paymentForm.amount.replace(',', '.')))

    if (!paymentForm.person.trim()) {
      setError('Person is required.')
      return
    }

    if (!amount || Number.isNaN(amount)) {
      setError('Amount received must be a positive number.')
      return
    }

    if (!paymentForm.paymentDate) {
      setError('Payment date is required.')
      return
    }

    try {
      const payment = await createOwedPayment({
        person: paymentForm.person.trim(),
        amount: amount.toFixed(2),
        payment_date: paymentForm.paymentDate,
        method: paymentForm.method,
        currency: 'EUR',
        notes: paymentForm.notes || null,
      })

      setMessage(
        Number(payment.unallocated_amount) > 0
          ? `Payment recorded. ${formatMoney(payment.unallocated_amount)} left unallocated.`
          : 'Payment recorded.',
      )
      setPaymentForm(getInitialPaymentFormState())
      setIsPaymentModalOpen(false)
      loadItems()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to record payment')
    }
  }

  async function createItemFromForm() {
    setError(null)
    setMessage(null)

    const amountTotal = Math.abs(Number(form.amountTotal))
    const amountPaid = form.amountPaid ? Math.abs(Number(form.amountPaid)) : 0

    let linkedTransactionId: number | null = null

    try {
      linkedTransactionId = parseLinkedTransactionId(form.linkedTransactionId)
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Invalid linked transaction ID.')
      return
    }

    if (!form.person || !form.reason || !amountTotal) {
      setError('Person, reason, and a positive total amount are required.')
      return
    }

    if (amountPaid > amountTotal) {
      setError('Amount paid cannot be greater than total amount.')
      return
    }

    try {
      await createOwedItem({
        person: form.person,
        reason: form.reason,
        amount_total: amountTotal.toFixed(2),
        amount_paid: amountPaid.toFixed(2),
        due_date: form.dueDate || null,
        linked_transaction_id: linkedTransactionId,
        notes: form.notes || null,
      })

      setForm(getInitialFormState())
      setIsCreateRowOpen(false)
      setMessage('Owed item created.')
      loadItems()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create owed item')
    }
  }

  function handleStartEdit(item: OwedItem) {
    setEditingItem(item)
    setEditForm(getFormStateFromItem(item))
    setIsCreateRowOpen(false)
    setError(null)
    setMessage(null)
  }

  async function saveEditFromForm() {
    if (!editingItem) {
      return
    }

    setError(null)
    setMessage(null)

    const amountTotal = Math.abs(Number(editForm.amountTotal))
    const amountPaid = editForm.amountPaid ? Math.abs(Number(editForm.amountPaid)) : 0

    let linkedTransactionId: number | null = null

    try {
      linkedTransactionId = parseLinkedTransactionId(editForm.linkedTransactionId)
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Invalid linked transaction ID.')
      return
    }

    if (!editForm.person || !editForm.reason || !amountTotal) {
      setError('Person, reason, and a positive total amount are required.')
      return
    }

    if (amountPaid > amountTotal) {
      setError('Amount paid cannot be greater than total amount.')
      return
    }

    try {
      await updateOwedItem(editingItem.id, {
        person: editForm.person,
        reason: editForm.reason,
        amount_total: amountTotal.toFixed(2),
        amount_paid: amountPaid.toFixed(2),
        due_date: editForm.dueDate || null,
        linked_transaction_id: linkedTransactionId,
        notes: editForm.notes || null,
      })

      setEditingItem(null)
      setEditForm(getInitialFormState())
      setMessage('Owed item updated.')
      loadItems()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update owed item')
    }
  }

  async function handleMarkPaid(item: OwedItem) {
    setError(null)
    setMessage(null)

    try {
      await updateOwedItem(item.id, {
        amount_paid: item.amount_total,
      })
      setMessage('Owed item marked as paid.')
      loadItems()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update owed item')
    }
  }

  async function handleDelete(item: OwedItem) {
    const confirmed = window.confirm(`Delete owed item from "${item.person}" for ${item.amount_total} €?`)

    if (!confirmed) {
      return
    }

    setError(null)
    setMessage(null)

    try {
      await deleteOwedItem(item.id)
      setMessage('Owed item deleted.')

      if (editingItem?.id === item.id) {
        setEditingItem(null)
      }

      loadItems()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to delete owed item')
    }
  }

  async function handleExportCsv() {
    setError(null)
    setMessage(null)

    try {
      const blob = await exportOwedItemsCsv({
        status: statusFilter || undefined,
        limit: 50000,
      })

      downloadBlob(blob, 'owed-items.csv')
      setMessage('CSV export downloaded.')
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to export owed items')
    }
  }

  const activeItems = getActiveItems(items)
  const paidItems = getPaidItems(items)
  const cancelledItems = getCancelledItems(items)
  const totalStillOwed = getItemsTotal(activeItems, 'amount_remaining')
  const totalAlreadyReimbursed = getItemsTotal(items, 'amount_paid')
  const totalOriginalAmount = getItemsTotal(items, 'amount_total')

  return (
    <section className="owed-page">
      <div className="page-header">
        <div>
          <h1>Money Owed To Me</h1>
        </div>

        <div className="action-group">
          <button type="button" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setPaymentForm(getInitialPaymentFormState())
              setIsPaymentModalOpen(true)
            }}
          >
            Record Payment
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setEditingItem(null)
              setIsCreateRowOpen((isOpen) => !isOpen)
            }}
          >
            {isCreateRowOpen ? 'Close' : '+ Add'}
          </button>
        </div>
      </div>

      <StatusMessage error={error} message={message} />

      <OwedSummaryCards
        activeItems={activeItems}
        paidItems={paidItems}
        cancelledItems={cancelledItems}
        totalStillOwed={totalStillOwed}
        totalAlreadyReimbursed={totalAlreadyReimbursed}
        totalOriginalAmount={totalOriginalAmount}
      />

      <OwedStatusToolbar
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onRefresh={() => {
          loadItems()
          loadLinkedTransactions()
        }}
      />


      {isPaymentModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2>Record payment</h2>
                <p className="muted small">
                  Record cash, bank transfer, MB WAY, or other repayments.
                </p>
              </div>
              <button type="button" onClick={() => setIsPaymentModalOpen(false)}>
                Close
              </button>
            </div>

            <div className="form-row">
              <label>
                Person
                <select
                  value={paymentForm.person}
                  onChange={(event) => updatePaymentForm('person', event.target.value)}
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
                  onChange={(event) => updatePaymentForm('amount', event.target.value)}
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
                  onChange={(event) => updatePaymentForm('paymentDate', event.target.value)}
                />
              </label>

              <label>
                Method
                <select
                  value={paymentForm.method}
                  onChange={(event) =>
                    updatePaymentForm('method', event.target.value as OwedPaymentMethod)
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="mbway">MB WAY</option>
                  <option value="other">Other</option>
                </select>
              </label>
            </div>

            <label>
              Notes
              <textarea
                value={paymentForm.notes}
                onChange={(event) => updatePaymentForm('notes', event.target.value)}
                rows={3}
              />
            </label>

            {paymentForm.person && Number(paymentForm.amount) > 0 && (
              <div className="modal-transaction-summary">
                <div>
                  <strong>Auto-allocation preview</strong>
                  {getAutoAllocationPreview(
                    items,
                    paymentForm.person,
                    Math.abs(Number(paymentForm.amount)),
                  ).map((allocation) => (
                    <p key={allocation.item.id} className="muted small">
                      {allocation.item.reason}: {formatMoney(allocation.amount.toFixed(2))}
                    </p>
                  ))}
                </div>
                <span>
                  Leftover: {formatMoney((
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
              </div>
            )}

            <div className="modal-actions">
              <button type="button" onClick={() => setIsPaymentModalOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={recordPaymentFromForm}
              >
                Record payment
              </button>
            </div>
          </div>
        </div>
      )}

      <OwedItemsTable
        items={items}
        linkedTransactions={linkedTransactions}
        isCreateRowOpen={isCreateRowOpen}
        form={form}
        editForm={editForm}
        editingItem={editingItem}
        onCreateItem={createItemFromForm}
        onStartEdit={handleStartEdit}
        onSaveEdit={saveEditFromForm}
        onMarkPaid={handleMarkPaid}
        onDelete={handleDelete}
        onFormChange={updateForm}
        onEditFormChange={updateEditForm}
        onLinkedTransactionChange={updateFormLinkedTransactionId}
        onEditLinkedTransactionChange={updateEditFormLinkedTransactionId}
        onCancelCreate={() => {
          setForm(getInitialFormState())
          setIsCreateRowOpen(false)
        }}
        onCancelEdit={() => {
          setEditingItem(null)
          setEditForm(getInitialFormState())
        }}
        formatLinkedTransactionOption={formatLinkedTransactionOption}
      />
    </section>
  )
}
