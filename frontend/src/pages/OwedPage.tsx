import { useCallback, useEffect, useState } from 'react'
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
import { StatusMessage } from '../components/StatusMessage'
import type { OwedItem, OwedPaymentMethod, OwedStatusFilter, Transaction } from '../types/api'
import { formatMoney } from '../utils/format'


type PaymentFormState = {
  person: string
  amount: string
  paymentDate: string
  method: OwedPaymentMethod
  linkedTransactionId: string
  unallocatedCategory: string
  unallocatedNotes: string
  allocationAmounts: Record<string, string>
  notes: string
}


const UNALLOCATED_CATEGORY_OPTIONS = [
  { value: '', label: 'Not income / leave unclassified' },
  { value: 'Allowance', label: 'Allowance' },
  { value: 'Gift', label: 'Gift' },
  { value: 'Income', label: 'Income' },
  { value: 'Other', label: 'Other / not counted as income' },
]


function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

function getCurrentMonthKey() {
  return getTodayDate().slice(0, 7)
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)

  return date.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  })
}

function isItemInMonth(item: OwedItem, monthKey: string) {
  return item.created_at.slice(0, 7) === monthKey
}

function getInitialPaymentFormState(): PaymentFormState {
  return {
    person: '',
    amount: '',
    paymentDate: getTodayDate(),
    method: 'cash',
    linkedTransactionId: '',
    unallocatedCategory: '',
    unallocatedNotes: '',
    allocationAmounts: {},
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

function getPaymentAllocationItems(items: OwedItem[], person: string) {
  return items
    .filter((item) => item.person === person)
    .filter((item) => item.status === 'open' || item.status === 'partially_paid')
}

function getManualPaymentAllocations(paymentForm: PaymentFormState) {
  return Object.entries(paymentForm.allocationAmounts)
    .map(([owedItemId, amount]) => ({
      owed_item_id: Number(owedItemId),
      amount: Math.abs(Number(amount.replace(',', '.'))),
    }))
    .filter((allocation) => (
      Number.isInteger(allocation.owed_item_id) &&
      allocation.owed_item_id > 0 &&
      allocation.amount > 0 &&
      !Number.isNaN(allocation.amount)
    ))
    .map((allocation) => ({
      owed_item_id: allocation.owed_item_id,
      amount: allocation.amount.toFixed(2),
    }))
}

function getManualAllocationTotal(paymentForm: PaymentFormState) {
  return getManualPaymentAllocations(paymentForm).reduce(
    (total, allocation) => total + Number(allocation.amount),
    0,
  )
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
  const [paymentLinkedTransactions, setPaymentLinkedTransactions] = useState<Transaction[]>([])
  const [statusFilter, setStatusFilter] = useState<'' | OwedStatusFilter>('active')
  const [tableMonthFilter, setTableMonthFilter] = useState<'current' | 'all'>('all')
  const [form, setForm] = useState<OwedFormState>(getInitialFormState)
  const [editForm, setEditForm] = useState<OwedFormState>(getInitialFormState)
  const [editingItem, setEditingItem] = useState<OwedItem | null>(null)
  const [isCreateRowOpen, setIsCreateRowOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>(getInitialPaymentFormState)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dataWarning, setDataWarning] = useState<string | null>(null)
  const [isItemsLoading, setIsItemsLoading] = useState(true)

  const loadItems = useCallback((status = statusFilter) => {
    setError(null)
    setIsItemsLoading(true)

    listOwedItems({
      status: status || undefined,
      limit: 100,
    })
      .then(setItems)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load owed items')
      })
      .finally(() => {
        setIsItemsLoading(false)
      })
  }, [statusFilter])

  function loadLinkedTransactions() {
    listTransactions({
      direction: 'out',
      cashflow_type: 'expense',
      limit: 100,
    })
      .then(setLinkedTransactions)
      .catch(() => {
        setDataWarning((currentWarning) => {
          const warning = 'Linked money-out options could not be refreshed.'
          return currentWarning ? `${currentWarning} ${warning}` : warning
        })
      })
  }

  function loadPaymentLinkedTransactions() {
    listTransactions({
      direction: 'in',
      limit: 100,
    })
      .then(setPaymentLinkedTransactions)
      .catch(() => {
        setDataWarning((currentWarning) => {
          const warning = 'Money-in payment options could not be refreshed.'
          return currentWarning ? `${currentWarning} ${warning}` : warning
        })
      })
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadItems()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadItems])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDataWarning(null)
      loadLinkedTransactions()
      loadPaymentLinkedTransactions()
    }, 0)

    return () => window.clearTimeout(timeoutId)
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

  function updatePaymentPerson(person: string) {
    setPaymentForm((currentForm) => ({
      ...currentForm,
      person,
      allocationAmounts: {},
    }))
  }

  function updatePaymentAllocation(owedItemId: number, amount: string) {
    setPaymentForm((currentForm) => ({
      ...currentForm,
      allocationAmounts: {
        ...currentForm.allocationAmounts,
        [owedItemId]: amount,
      },
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

    let linkedTransactionId: number | null

    try {
      linkedTransactionId = parseLinkedTransactionId(paymentForm.linkedTransactionId)
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Invalid linked transaction ID.')
      return
    }

    const manualAllocations = getManualPaymentAllocations(paymentForm)
    const manualAllocationTotal = getManualAllocationTotal(paymentForm)

    if (manualAllocationTotal > amount) {
      setError('Allocated amount cannot exceed payment amount.')
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
        linked_transaction_id: linkedTransactionId,
        unallocated_category: paymentForm.unallocatedCategory || null,
        unallocated_notes: paymentForm.unallocatedNotes || null,
        allocations: manualAllocations.length > 0 ? manualAllocations : undefined,
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

    let linkedTransactionId: number | null

    try {
      linkedTransactionId = parseLinkedTransactionId(form.linkedTransactionId)
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Invalid linked transaction ID.')
      return
    }

    if (!form.person || !form.reason || !amountTotal) {
      setError('Person, description, and a positive total amount are required.')
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

    let linkedTransactionId: number | null

    try {
      linkedTransactionId = parseLinkedTransactionId(editForm.linkedTransactionId)
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Invalid linked transaction ID.')
      return
    }

    if (!editForm.person || !editForm.reason || !amountTotal) {
      setError('Person, description, and a positive total amount are required.')
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

  const currentMonthKey = getCurrentMonthKey()
  const visibleItems =
    tableMonthFilter === 'current'
      ? items.filter((item) => isItemInMonth(item, currentMonthKey))
      : items
  return (
    <section className="app-page owed-page owed-page-polished">
      <div className="page-header owed-page-header">
        <div className="page-title-block">
          <h1>Owed To Me</h1>
        </div>

        <div className="action-group">
          <button className="desktop-only" type="button" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button
            type="button"
            className="desktop-only"
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

      {dataWarning && (
        <p className="status status-info" role="status">
          {dataWarning}
        </p>
      )}

      <OwedStatusToolbar
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onRefresh={() => {
          setDataWarning(null)
          loadItems()
          loadLinkedTransactions()
          loadPaymentLinkedTransactions()
        }}
      />

      <div className="content-card panel-card owed-table-filter-card">
        <div>
          <h2>Owed items</h2>
          <p className="muted small">
            Showing {visibleItems.length} of {items.length} owed items.
          </p>
        </div>

        <div className="segmented-control">
          <button
            type="button"
            className={tableMonthFilter === 'current' ? 'active' : ''}
            onClick={() => setTableMonthFilter('current')}
          >
            {getMonthLabel(currentMonthKey)}
          </button>
          <button
            type="button"
            className={tableMonthFilter === 'all' ? 'active' : ''}
            onClick={() => setTableMonthFilter('all')}
          >
            All
          </button>
        </div>
      </div>

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
                  onChange={(event) => updatePaymentPerson(event.target.value)}
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

            <div className="form-row">
              <label>
                Linked Money In
                <select
                  value={paymentForm.linkedTransactionId}
                  onChange={(event) => updatePaymentForm('linkedTransactionId', event.target.value)}
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
                  onChange={(event) => updatePaymentForm('linkedTransactionId', event.target.value)}
                  placeholder="Optional"
                />
              </label>
            </div>

            <div className="form-row">
              <label>
                Unallocated category
                <select
                  value={paymentForm.unallocatedCategory}
                  onChange={(event) => updatePaymentForm('unallocatedCategory', event.target.value)}
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
                  onChange={(event) => updatePaymentForm('unallocatedNotes', event.target.value)}
                  placeholder="Grandma gave extra"
                />
              </label>
            </div>

            <label>
              Payment notes
              <textarea
                value={paymentForm.notes}
                onChange={(event) => updatePaymentForm('notes', event.target.value)}
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
                          onChange={(event) => updatePaymentAllocation(item.id, event.target.value)}
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

      {isItemsLoading && items.length === 0 ? (
        <p className="status status-info" role="status" aria-live="polite">
          Loading owed items...
        </p>
      ) : (
        <OwedItemsTable
          items={visibleItems}
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
      )}
    </section>
  )
}
