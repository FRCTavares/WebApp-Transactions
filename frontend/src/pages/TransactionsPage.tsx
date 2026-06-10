import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../api/transactions'
import { CategorySelect } from '../components/CategorySelect'
import { TransactionTable } from '../components/TransactionTable'
import { StatusMessage } from '../components/StatusMessage'
import type { Direction, Transaction } from '../types/api'

type TransactionsPageProps = {
  direction: Direction
  title: string
}

type FormState = {
  date: string
  description: string
  amount: string
  category: string
  subcategory: string
  notes: string
}

type FilterState = {
  search: string
  category: string
  source: string
  dateFrom: string
  dateTo: string
}

const sourceOptions = [
  { value: '', label: 'All sources' },
  { value: 'manual', label: 'Manual' },
  { value: 'revolut', label: 'Revolut' },
  { value: 'activobank', label: 'ActivoBank' },
  { value: 'trading212', label: 'Trading 212' },
]

function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

function getInitialFormState(): FormState {
  return {
    date: getTodayDate(),
    description: '',
    amount: '',
    category: '',
    subcategory: '',
    notes: '',
  }
}

function getInitialFilterState(): FilterState {
  return {
    search: '',
    category: '',
    source: '',
    dateFrom: '',
    dateTo: '',
  }
}

function getFormStateFromTransaction(transaction: Transaction): FormState {
  return {
    date: transaction.date,
    description: transaction.description,
    amount: transaction.amount,
    category: transaction.category ?? '',
    subcategory: transaction.subcategory ?? '',
    notes: transaction.notes ?? '',
  }
}

export function TransactionsPage({ direction, title }: TransactionsPageProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filters, setFilters] = useState<FilterState>(getInitialFilterState)
  const [form, setForm] = useState<FormState>(getInitialFormState)
  const [editForm, setEditForm] = useState<FormState>(getInitialFormState)
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function loadTransactions(activeFilters = filters) {
    setError(null)

    listTransactions({
      direction,
      search: activeFilters.search || undefined,
      category: activeFilters.category || undefined,
      source: activeFilters.source || undefined,
      date_from: activeFilters.dateFrom || undefined,
      date_to: activeFilters.dateTo || undefined,
      limit: 100,
    })
      .then(setTransactions)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load transactions')
      })
  }

  useEffect(() => {
    loadTransactions()
  }, [direction])

  function updateForm(field: keyof FormState, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function updateFilters(field: keyof FilterState, value: string) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [field]: value,
    }))
  }

  function clearFilters() {
    const initialFilters = getInitialFilterState()
    setFilters(initialFilters)
    loadTransactions(initialFilters)
  }

  function updateEditForm(field: keyof FormState, value: string) {
    setEditForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  async function handleCreateTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)

    const amount = Math.abs(Number(form.amount))

    if (!form.date || !form.description || !amount) {
      setError('Date, description, and positive amount are required.')
      return
    }

    try {
      await createTransaction({
        date: form.date,
        description: form.description,
        raw_description: form.description,
        amount: amount.toFixed(2),
        direction,
        source: 'manual',
        account: null,
        category: form.category || null,
        subcategory: form.subcategory || null,
        currency: 'EUR',
        merchant: null,
        notes: form.notes || null,
      })

      setForm(getInitialFormState())
      setMessage('Transaction created.')
      loadTransactions()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create transaction')
    }
  }

  function handleStartEdit(transaction: Transaction) {
    setEditingTransaction(transaction)
    setEditForm(getFormStateFromTransaction(transaction))
    setError(null)
    setMessage(null)
  }

  async function handleSaveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!editingTransaction) {
      return
    }

    setError(null)
    setMessage(null)

    const amount = Math.abs(Number(editForm.amount))

    if (!editForm.date || !editForm.description || !amount) {
      setError('Date, description, and positive amount are required.')
      return
    }

    try {
      await updateTransaction(editingTransaction.id, {
        date: editForm.date,
        description: editForm.description,
        raw_description: editForm.description,
        amount: amount.toFixed(2),
        category: editForm.category || null,
        subcategory: editForm.subcategory || null,
        notes: editForm.notes || null,
      })

      setEditingTransaction(null)
      setEditForm(getInitialFormState())
      setMessage('Transaction updated.')
      loadTransactions()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update transaction')
    }
  }

  async function handleDeleteTransaction(transaction: Transaction) {
    const confirmed = window.confirm(
      `Delete transaction "${transaction.description}" for ${transaction.amount} ${transaction.currency}?`,
    )

    if (!confirmed) {
      return
    }

    setError(null)
    setMessage(null)

    try {
      await deleteTransaction(transaction.id)
      setMessage('Transaction deleted.')

      if (editingTransaction?.id === transaction.id) {
        setEditingTransaction(null)
      }

      loadTransactions()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to delete transaction')
    }
  }

  return (
    <section>
      <h1>{title}</h1>

      <form className="manual-form" onSubmit={handleCreateTransaction}>
        <h2>Add Manual Transaction</h2>

        <div className="form-row">
          <label>
            Date
            <input
              type="date"
              value={form.date}
              onChange={(event) => updateForm('date', event.target.value)}
            />
          </label>

          <label>
            Description
            <input
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
              placeholder="Description"
            />
          </label>

          <label>
            Amount
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(event) => updateForm('amount', event.target.value)}
              placeholder="0.00"
            />
          </label>
        </div>

        <div className="form-row">
          <CategorySelect
            label="Category"
            value={form.category}
            onChange={(value) => updateForm('category', value)}
          />

          <label>
            Subcategory
            <input
              value={form.subcategory}
              onChange={(event) => updateForm('subcategory', event.target.value)}
              placeholder="Optional"
            />
          </label>

          <label>
            Notes
            <input
              value={form.notes}
              onChange={(event) => updateForm('notes', event.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>

        <button type="submit">Add {direction === 'in' ? 'Money In' : 'Money Out'}</button>
      </form>

      {editingTransaction && (
        <form className="manual-form" onSubmit={handleSaveEdit}>
          <h2>Edit Transaction</h2>
          <p className="muted small">
            Editing transaction #{editingTransaction.id}
          </p>

          <div className="form-row">
            <label>
              Date
              <input
                type="date"
                value={editForm.date}
                onChange={(event) => updateEditForm('date', event.target.value)}
              />
            </label>

            <label>
              Description
              <input
                value={editForm.description}
                onChange={(event) => updateEditForm('description', event.target.value)}
              />
            </label>

            <label>
              Amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={editForm.amount}
                onChange={(event) => updateEditForm('amount', event.target.value)}
              />
            </label>
          </div>

          <div className="form-row">
            <CategorySelect
              label="Category"
              value={editForm.category}
              onChange={(value) => updateEditForm('category', value)}
            />

            <label>
              Subcategory
              <input
                value={editForm.subcategory}
                onChange={(event) => updateEditForm('subcategory', event.target.value)}
              />
            </label>

            <label>
              Notes
              <input
                value={editForm.notes}
                onChange={(event) => updateEditForm('notes', event.target.value)}
              />
            </label>
          </div>

          <div className="action-group">
            <button type="submit">Save Changes</button>
            <button type="button" onClick={() => setEditingTransaction(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <StatusMessage error={error} message={message} />

      <div className="filter-panel">
        <h2>Filters</h2>

        <div className="form-row">
          <label>
            Search
            <input
              value={filters.search}
              onChange={(event) => updateFilters('search', event.target.value)}
              placeholder="Search description"
            />
          </label>

          <CategorySelect
            label="Category"
            value={filters.category}
            onChange={(value) => updateFilters('category', value)}
          />

          <label>
            Source
            <select
              value={filters.source}
              onChange={(event) => updateFilters('source', event.target.value)}
            >
              {sourceOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-row">
          <label>
            Date From
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilters('dateFrom', event.target.value)}
            />
          </label>

          <label>
            Date To
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilters('dateTo', event.target.value)}
            />
          </label>
        </div>

        <div className="action-group">
          <button type="button" onClick={() => loadTransactions()}>
            Apply Filters
          </button>
          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      </div>

      <TransactionTable
        transactions={transactions}
        onEdit={handleStartEdit}
        onDelete={handleDeleteTransaction}
      />
    </section>
  )
}
