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
import type { CashflowType, Direction, Transaction } from '../types/api'
import { formatMoney } from '../utils/format'

type TransactionsPageProps = {
  direction: Direction
  title: string
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

function getDefaultCashflowType(direction: Direction): CashflowType {
  return direction === 'in' ? 'income' : 'expense'
}

function getInitialFormState(direction: Direction): TransactionFormState {
  return {
    date: getTodayDate(),
    description: '',
    amount: '',
    cashflow_type: getDefaultCashflowType(direction),
    category: '',
    subcategory: '',
    notes: '',
  }
}

function getInitialFilterState(direction: Direction): TransactionFilterState {
  return {
    search: '',
    category: '',
    source: '',
    cashflowType: getDefaultCashflowType(direction),
    month: '',
    dateFrom: '',
    dateTo: '',
  }
}

function getFormStateFromTransaction(transaction: Transaction): TransactionFormState {
  return {
    date: transaction.date,
    description: transaction.description,
    amount: transaction.amount,
    cashflow_type: transaction.cashflow_type,
    category: transaction.category ?? '',
    subcategory: transaction.subcategory ?? '',
    notes: transaction.notes ?? '',
  }
}

function getTransactionsTotal(transactions: Transaction[]) {
  return transactions.reduce((total, transaction) => total + Number(transaction.amount), 0)
}

function getMonthDateRange(month: string) {
  if (!month) {
    return {
      dateFrom: '',
      dateTo: '',
    }
  }

  const [year, monthNumber] = month.split('-').map(Number)
  const startDate = `${year}-${String(monthNumber).padStart(2, '0')}-01`
  const nextMonthDate = new Date(year, monthNumber, 1)
  const endDate = nextMonthDate.toISOString().slice(0, 10)

  return {
    dateFrom: startDate,
    dateTo: endDate,
  }
}

export function TransactionsPage({ direction, title }: TransactionsPageProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filters, setFilters] = useState<TransactionFilterState>(() =>
    getInitialFilterState(direction),
  )
  const [form, setForm] = useState<TransactionFormState>(() => getInitialFormState(direction))
  const [editForm, setEditForm] = useState<TransactionFormState>(() => getInitialFormState(direction))
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function loadTransactions(activeFilters = filters) {
    setError(null)

    const monthDateRange = getMonthDateRange(activeFilters.month)

    listTransactions({
      direction,
      cashflow_type: activeFilters.cashflowType || undefined,
      search: activeFilters.search || undefined,
      category: activeFilters.category || undefined,
      source: activeFilters.source || undefined,
      date_from: activeFilters.dateFrom || monthDateRange.dateFrom || undefined,
      date_to: activeFilters.dateTo || monthDateRange.dateTo || undefined,
      limit: 100,
    })
      .then(setTransactions)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load transactions')
      })
  }

  useEffect(() => {
    const initialFilters = getInitialFilterState(direction)

    setForm(getInitialFormState(direction))
    setEditForm(getInitialFormState(direction))
    setFilters(initialFilters)
    setEditingTransaction(null)
    setIsCreateFormOpen(false)
    loadTransactions(initialFilters)
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
    const initialFilters = getInitialFilterState(direction)
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
        cashflow_type: form.cashflow_type,
        source: 'manual',
        account: null,
        category: form.category || null,
        subcategory: form.subcategory || null,
        currency: 'EUR',
        merchant: null,
        notes: form.notes || null,
      })

      setForm(getInitialFormState(direction))
      setIsCreateFormOpen(false)
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
        amount: amount.toFixed(2),
        cashflow_type: editForm.cashflow_type,
        category: editForm.category || null,
        subcategory: editForm.subcategory || null,
        notes: editForm.notes || null,
      })

      setEditingTransaction(null)
      setEditForm(getInitialFormState(direction))
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

  const transactionTotal = getTransactionsTotal(transactions)

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p className="muted small">
            {transactions.length} transactions · {formatMoney(transactionTotal)} total
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() => setIsCreateFormOpen((isOpen) => !isOpen)}
        >
          {isCreateFormOpen ? 'Close' : '+ Add'}
        </button>
      </div>

      {isCreateFormOpen && (
        <TransactionForm
          title={`New ${title} Transaction`}
          form={form}
          submitLabel="Add"
          direction={direction}
          onSubmit={handleCreateTransaction}
          onChange={updateForm}
          onCancel={() => setIsCreateFormOpen(false)}
        />
      )}

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
