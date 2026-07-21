import { Plus } from 'lucide-react'
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
import { RecordPaymentModal } from '../components/owed/RecordPaymentModal'
import { StatusMessage } from '../components/StatusMessage'
import { Button, PageHeader, SegmentedControl } from '../components/ui'
import { useDialogAccessibility } from '../hooks/useDialogAccessibility'
import type { OwedItem, OwedStatusFilter, Transaction } from '../types/api'
import { formatMoney, formatMonthLabel } from '../utils/format'
import {
  formatLinkedTransactionOption,
  getInitialPaymentFormState,
  getManualAllocationTotal,
  getManualPaymentAllocations,
  getTodayDate,
  type PaymentFormState,
} from '../utils/owedPaymentUtils'

function getCurrentMonthKey() {
  return getTodayDate().slice(0, 7)
}

function getMonthLabel(monthKey: string) {
  return formatMonthLabel(monthKey)
}

function isItemInMonth(item: OwedItem, monthKey: string) {
  return item.created_at.slice(0, 7) === monthKey
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
  const closePaymentModal = useCallback(() => setIsPaymentModalOpen(false), [])
  const paymentDialogRef = useDialogAccessibility<HTMLDivElement>({
    onClose: closePaymentModal,
    isOpen: isPaymentModalOpen,
  })

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
      setError(
        `Reduce allocations by ${formatMoney((manualAllocationTotal - amount).toFixed(2))}. `
        + `The payment is ${formatMoney(amount.toFixed(2))}, but allocations total ${formatMoney(manualAllocationTotal.toFixed(2))}.`,
      )
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
      <PageHeader
        title="Owed To Me"
        actions={(
          <>
            <Button className="desktop-only" size="sm" type="button" onClick={handleExportCsv}>
              Export CSV
            </Button>
            <Button
              type="button"
              size="sm"
              className="desktop-only"
              onClick={() => {
                setPaymentForm(getInitialPaymentFormState())
                setIsPaymentModalOpen(true)
              }}
            >
              Record Payment
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isCreateRowOpen ? 'secondary' : 'primary'}
              iconLeft={isCreateRowOpen ? undefined : Plus}
              onClick={() => {
                setEditingItem(null)
                setIsCreateRowOpen((isOpen) => !isOpen)
              }}
            >
              {isCreateRowOpen ? 'Close' : 'Add'}
            </Button>
          </>
        )}
      />

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

        <SegmentedControl
          label="Owed items period"
          size="sm"
          value={tableMonthFilter}
          onChange={setTableMonthFilter}
          options={[
            { value: 'current', label: getMonthLabel(currentMonthKey) },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {isPaymentModalOpen && (
        <RecordPaymentModal
          dialogRef={paymentDialogRef}
          items={items}
          paymentLinkedTransactions={paymentLinkedTransactions}
          paymentForm={paymentForm}
          onClose={closePaymentModal}
          onUpdateField={updatePaymentForm}
          onUpdatePerson={updatePaymentPerson}
          onUpdateAllocation={updatePaymentAllocation}
          onSubmit={recordPaymentFromForm}
        />
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
