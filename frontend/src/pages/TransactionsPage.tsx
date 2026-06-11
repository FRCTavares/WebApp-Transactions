import { useEffect, useState } from 'react'
import {
  createTransaction,
  deleteTransaction,
  exportTransactionsCsv,
  listTransactions,
  updateTransaction,
} from '../api/transactions'
import {
  TransactionFilters,
  type TransactionFilterState,
} from '../components/TransactionFilters'
import type { TransactionFormState } from '../components/TransactionForm'
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
  const monthText = String(monthNumber).padStart(2, '0')
  const lastDay = new Date(year, monthNumber, 0).getDate()
  const startDate = `${year}-${monthText}-01`
  const endDate = `${year}-${monthText}-${String(lastDay).padStart(2, '0')}`

  return {
    dateFrom: startDate,
    dateTo: endDate,
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = filename
  link.click()

  URL.revokeObjectURL(objectUrl)
}

function getExportFilename(direction: Direction) {
  return direction === 'in' ? 'money-in-transactions.csv' : 'money-out-transactions.csv'
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

  async function handleExportCsv() {
    setError(null)
    setMessage(null)

    const monthDateRange = getMonthDateRange(filters.month)

    try {
      const blob = await exportTransactionsCsv({
        direction,
        cashflow_type: filters.cashflowType || undefined,
        search: filters.search || undefined,
        category: filters.category || undefined,
        source: filters.source || undefined,
        date_from: filters.dateFrom || monthDateRange.dateFrom || undefined,
        date_to: filters.dateTo || monthDateRange.dateTo || undefined,
        limit: 50000,
      })

      downloadBlob(blob, getExportFilename(direction))
      setMessage('CSV export downloaded.')
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to export transactions')
    }
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

  async function createTransactionFromForm() {
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
    setIsCreateFormOpen(false)
    setError(null)
    setMessage(null)
  }

  async function saveEditFromForm() {
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

        <div className="action-group">
          <button type="button" onClick={handleExportCsv}>
            Export CSV
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => setIsCreateFormOpen((isOpen) => !isOpen)}
          >
            {isCreateFormOpen ? 'Close' : '+ Add'}
          </button>
        </div>
      </div>

      <StatusMessage error={error} message={message} />

      <TransactionFilters
        filters={filters}
        onChange={updateFilters}
        onApply={() => loadTransactions()}
        onClear={clearFilters}
      />

      <TransactionTable
        transactions={transactions}
        createRow={
          isCreateFormOpen ? (
            <tr className="inline-create-row">
              <td>
                <input
                  className="table-input"
                  type="date"
                  value={form.date}
                  onChange={(event) => updateForm('date', event.target.value)}
                />
              </td>
              <td>
                <input
                  className="table-input"
                  value={form.description}
                  onChange={(event) => updateForm('description', event.target.value)}
                  placeholder="Description"
                />
                <input
                  className="table-input table-input-secondary"
                  value={form.notes}
                  onChange={(event) => updateForm('notes', event.target.value)}
                  placeholder="Notes"
                />
              </td>
              <td>
                <select
                  className="table-input"
                  value={form.cashflow_type}
                  onChange={(event) => updateForm('cashflow_type', event.target.value)}
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="internal_transfer">Internal Transfer</option>
                  <option value="investment">Investment</option>
                  <option value="reimbursement">Reimbursement</option>
                  <option value="reimbursed_expense">Reimbursed Expense</option>
                </select>
              </td>
              <td>
                <input
                  className="table-input"
                  value={form.category}
                  onChange={(event) => updateForm('category', event.target.value)}
                  placeholder="Category"
                />
                <input
                  className="table-input table-input-secondary"
                  value={form.subcategory}
                  onChange={(event) => updateForm('subcategory', event.target.value)}
                  placeholder="Subcategory"
                />
              </td>
              <td>manual</td>
              <td className="right">
                <input
                  className="table-input right"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => updateForm('amount', event.target.value)}
                  placeholder="0.00"
                />
              </td>
              <td>
                <div className="action-group">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={createTransactionFromForm}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm(getInitialFormState(direction))
                      setIsCreateFormOpen(false)
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          ) : null
        }
        editRow={(transaction) =>
          editingTransaction?.id === transaction.id ? (
            <tr key={transaction.id} className="inline-edit-row">
              <td>
                <input
                  className="table-input"
                  type="date"
                  value={editForm.date}
                  onChange={(event) => updateEditForm('date', event.target.value)}
                />
              </td>
              <td>
                <input
                  className="table-input"
                  value={editForm.description}
                  onChange={(event) => updateEditForm('description', event.target.value)}
                  placeholder="Description"
                />
                <input
                  className="table-input table-input-secondary"
                  value={editForm.notes}
                  onChange={(event) => updateEditForm('notes', event.target.value)}
                  placeholder="Notes"
                />
              </td>
              <td>
                <select
                  className="table-input"
                  value={editForm.cashflow_type}
                  onChange={(event) => updateEditForm('cashflow_type', event.target.value)}
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="internal_transfer">Internal Transfer</option>
                  <option value="investment">Investment</option>
                  <option value="reimbursement">Reimbursement</option>
                  <option value="reimbursed_expense">Reimbursed Expense</option>
                </select>
              </td>
              <td>
                <input
                  className="table-input"
                  value={editForm.category}
                  onChange={(event) => updateEditForm('category', event.target.value)}
                  placeholder="Category"
                />
                <input
                  className="table-input table-input-secondary"
                  value={editForm.subcategory}
                  onChange={(event) => updateEditForm('subcategory', event.target.value)}
                  placeholder="Subcategory"
                />
              </td>
              <td>{transaction.source}</td>
              <td className="right">
                <input
                  className="table-input right"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.amount}
                  onChange={(event) => updateEditForm('amount', event.target.value)}
                  placeholder="0.00"
                />
              </td>
              <td>
                <div className="action-group">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={saveEditFromForm}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTransaction(null)
                      setEditForm(getInitialFormState(direction))
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          ) : null
        }
        onEdit={handleStartEdit}
        onDelete={handleDeleteTransaction}
      />
    </section>
  )
}
