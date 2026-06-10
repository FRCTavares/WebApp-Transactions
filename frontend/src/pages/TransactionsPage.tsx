import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createTransaction,
  deleteTransaction,
  listTransactions,
  updateTransaction,
} from '../api/transactions'
import {
  TransactionFilters,
  type TransactionFilterState,
} from '../components/TransactionFilters'
import {
  TransactionForm,
  type TransactionFormState,
} from '../components/TransactionForm'
import { TransactionTable } from '../components/TransactionTable'
import { StatusMessage } from '../components/StatusMessage'
import type { Direction, Transaction } from '../types/api'

type TransactionsPageProps = {
  direction: Direction
  title: string
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

function getInitialFormState(): TransactionFormState {
  return {
    date: getTodayDate(),
    description: '',
    amount: '',
    category: '',
    subcategory: '',
    notes: '',
  }
}

function getInitialFilterState(): TransactionFilterState {
  return {
    search: '',
    category: '',
    source: '',
    dateFrom: '',
    dateTo: '',
  }
}

function getFormStateFromTransaction(transaction: Transaction): TransactionFormState {
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
  const [filters, setFilters] = useState<TransactionFilterState>(getInitialFilterState)
  const [form, setForm] = useState<TransactionFormState>(getInitialFormState)
  const [editForm, setEditForm] = useState<TransactionFormState>(getInitialFormState)
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

  function updateForm(field: keyof TransactionFormState, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function updateFilters(field: keyof TransactionFilterState, value: string) {
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

  function updateEditForm(field: keyof TransactionFormState, value: string) {
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

      <TransactionForm
        title="Add Manual Transaction"
        form={form}
        submitLabel="Add"
        direction={direction}
        onSubmit={handleCreateTransaction}
        onChange={updateForm}
      />

      {editingTransaction && (
        <TransactionForm
          title="Edit Transaction"
          form={editForm}
          submitLabel="Save Changes"
          editingTransactionId={editingTransaction.id}
          onSubmit={handleSaveEdit}
          onChange={updateEditForm}
          onCancel={() => setEditingTransaction(null)}
        />
      )}

      <StatusMessage error={error} message={message} />

      <TransactionFilters
        filters={filters}
        onChange={updateFilters}
        onApply={() => loadTransactions()}
        onClear={clearFilters}
      />

      <TransactionTable
        transactions={transactions}
        onEdit={handleStartEdit}
        onDelete={handleDeleteTransaction}
      />
    </section>
  )
}
