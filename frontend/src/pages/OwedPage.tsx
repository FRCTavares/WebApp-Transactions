import { useEffect, useState } from 'react'
import {
  createOwedItem,
  deleteOwedItem,
  listOwedItems,
  updateOwedItem,
} from '../api/owed'
import { StatusMessage } from '../components/StatusMessage'
import type { OwedItem, OwedStatus } from '../types/api'
import { formatDate, formatMoney } from '../utils/format'

type OwedFormState = {
  person: string
  reason: string
  amountTotal: string
  amountPaid: string
  dueDate: string
  linkedTransactionId: string
  notes: string
}

const statusOptions: Array<{ value: '' | OwedStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
]

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

export function OwedPage() {
  const [items, setItems] = useState<OwedItem[]>([])
  const [statusFilter, setStatusFilter] = useState<'' | OwedStatus>('')
  const [form, setForm] = useState<OwedFormState>(getInitialFormState)
  const [editForm, setEditForm] = useState<OwedFormState>(getInitialFormState)
  const [editingItem, setEditingItem] = useState<OwedItem | null>(null)
  const [isCreateRowOpen, setIsCreateRowOpen] = useState(false)
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

  useEffect(() => {
    loadItems()
  }, [statusFilter])

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

  const activeItems = getActiveItems(items)
  const paidItems = getPaidItems(items)
  const cancelledItems = getCancelledItems(items)
  const totalStillOwed = getItemsTotal(activeItems, 'amount_remaining')
  const totalAlreadyReimbursed = getItemsTotal(items, 'amount_paid')
  const totalOriginalAmount = getItemsTotal(items, 'amount_total')

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Money Owed To Me</h1>
          <p className="muted small">
            Reimbursement tracker for things you paid for someone else.
          </p>
        </div>

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

      <StatusMessage error={error} message={message} />

      <div className="summary-grid">
        <article className="summary-card">
          <h2>Still owed to me</h2>
          <strong>{formatMoney(totalStillOwed.toFixed(2))}</strong>
        </article>

        <article className="summary-card">
          <h2>Already reimbursed</h2>
          <strong>{formatMoney(totalAlreadyReimbursed.toFixed(2))}</strong>
        </article>

        <article className="summary-card">
          <h2>Total original amount</h2>
          <strong>{formatMoney(totalOriginalAmount.toFixed(2))}</strong>
        </article>

        <article className="summary-card">
          <h2>Active owed items</h2>
          <strong>{activeItems.length}</strong>
        </article>
      </div>

      <div className="toolbar">
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as '' | OwedStatus)}
        >
          {statusOptions.map((option) => (
            <option key={option.value || 'all'} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <button type="button" onClick={() => loadItems()}>
          Refresh
        </button>

        <button type="button" onClick={() => setStatusFilter('')}>
          All
        </button>

        <button type="button" onClick={() => setStatusFilter('open')}>
          Open
        </button>

        <button type="button" onClick={() => setStatusFilter('partially_paid')}>
          Partially Paid
        </button>

        <button type="button" onClick={() => setStatusFilter('paid')}>
          Paid
        </button>
      </div>

      <div className="cards">
        <div className="card">
          <span>Open / partially paid</span>
          <strong>{activeItems.length}</strong>
        </div>
        <div className="card">
          <span>Paid</span>
          <strong>{paidItems.length}</strong>
        </div>
        <div className="card">
          <span>Cancelled</span>
          <strong>{cancelledItems.length}</strong>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Due</th>
              <th>Linked Tx</th>
              <th className="right">Total</th>
              <th className="right">Paid</th>
              <th className="right">Remaining</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isCreateRowOpen && (
              <tr className="inline-create-row">
                <td>
                  <input
                    className="table-input"
                    value={form.person}
                    onChange={(event) => updateForm('person', event.target.value)}
                    placeholder="Person"
                  />
                </td>
                <td>
                  <input
                    className="table-input"
                    value={form.reason}
                    onChange={(event) => updateForm('reason', event.target.value)}
                    placeholder="Reason"
                  />
                  <input
                    className="table-input table-input-secondary"
                    value={form.notes}
                    onChange={(event) => updateForm('notes', event.target.value)}
                    placeholder="Notes"
                  />
                </td>
                <td>open</td>
                <td>
                  <input
                    className="table-input"
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => updateForm('dueDate', event.target.value)}
                  />
                </td>
                <td>
                  <input
                    className="table-input"
                    type="number"
                    min="1"
                    step="1"
                    value={form.linkedTransactionId}
                    onChange={(event) => updateForm('linkedTransactionId', event.target.value)}
                    placeholder="Tx ID"
                  />
                </td>
                <td className="right">
                  <input
                    className="table-input right"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amountTotal}
                    onChange={(event) => updateForm('amountTotal', event.target.value)}
                    placeholder="0.00"
                  />
                </td>
                <td className="right">
                  <input
                    className="table-input right"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amountPaid}
                    onChange={(event) => updateForm('amountPaid', event.target.value)}
                    placeholder="0.00"
                  />
                </td>
                <td className="right">-</td>
                <td>
                  <div className="action-group">
                    <button type="button" className="primary-button" onClick={createItemFromForm}>
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setForm(getInitialFormState())
                        setIsCreateRowOpen(false)
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {items.length === 0 && !isCreateRowOpen ? (
              <tr>
                <td colSpan={9}>
                  <p className="muted">No owed items found.</p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                editingItem?.id === item.id ? (
                  <tr key={item.id} className="inline-edit-row">
                    <td>
                      <input
                        className="table-input"
                        value={editForm.person}
                        onChange={(event) => updateEditForm('person', event.target.value)}
                        placeholder="Person"
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        value={editForm.reason}
                        onChange={(event) => updateEditForm('reason', event.target.value)}
                        placeholder="Reason"
                      />
                      <input
                        className="table-input table-input-secondary"
                        value={editForm.notes}
                        onChange={(event) => updateEditForm('notes', event.target.value)}
                        placeholder="Notes"
                      />
                    </td>
                    <td>{item.status}</td>
                    <td>
                      <input
                        className="table-input"
                        type="date"
                        value={editForm.dueDate}
                        onChange={(event) => updateEditForm('dueDate', event.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="table-input"
                        type="number"
                        min="1"
                        step="1"
                        value={editForm.linkedTransactionId}
                        onChange={(event) => updateEditForm('linkedTransactionId', event.target.value)}
                        placeholder="Tx ID"
                      />
                    </td>
                    <td className="right">
                      <input
                        className="table-input right"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.amountTotal}
                        onChange={(event) => updateEditForm('amountTotal', event.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="right">
                      <input
                        className="table-input right"
                        type="number"
                        min="0"
                        step="0.01"
                        value={editForm.amountPaid}
                        onChange={(event) => updateEditForm('amountPaid', event.target.value)}
                        placeholder="0.00"
                      />
                    </td>
                    <td className="right">{formatMoney(item.amount_remaining)}</td>
                    <td>
                      <div className="action-group">
                        <button type="button" className="primary-button" onClick={saveEditFromForm}>
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(null)
                            setEditForm(getInitialFormState())
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={item.id}>
                    <td>{item.person}</td>
                    <td>
                      <div>{item.reason}</div>
                      {item.notes && <div className="muted small">{item.notes}</div>}
                    </td>
                    <td>{item.status}</td>
                    <td>{formatDate(item.due_date)}</td>
                    <td>{item.linked_transaction_id ?? '-'}</td>
                    <td className="right">{formatMoney(item.amount_total)}</td>
                    <td className="right">{formatMoney(item.amount_paid)}</td>
                    <td className="right">{formatMoney(item.amount_remaining)}</td>
                    <td>
                      <div className="action-group">
                        <button type="button" onClick={() => handleStartEdit(item)}>
                          Edit
                        </button>
                        {item.status !== 'paid' && item.status !== 'cancelled' && (
                          <button type="button" onClick={() => handleMarkPaid(item)}>
                            Mark Paid
                          </button>
                        )}
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => handleDelete(item)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
