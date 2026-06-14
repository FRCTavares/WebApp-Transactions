import { useEffect, useState } from 'react'
import { createOwedItem, listOwedItems } from '../api/owed'
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
import { TransactionTable, type TransactionTableRow } from '../components/TransactionTable'
import { StatusMessage } from '../components/StatusMessage'
import type { CashflowType, Direction, OwedItem, Transaction } from '../types/api'
import { formatMoney } from '../utils/format'

type TransactionsPageProps = {
  direction: Direction
  title: string
}

type OwedFromTransactionFormState = {
  person: string
  amount: string
  alreadyPaid: boolean
  notes: string
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

function getCurrentMonth() {
  return getTodayDate().slice(0, 7)
}

function getMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1, 1)

  return date.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  })
}

function shiftMonth(month: string, offset: number) {
  const [year, monthNumber] = month.split('-').map(Number)
  const shiftedDate = new Date(year, monthNumber - 1 + offset, 1)
  const shiftedYear = shiftedDate.getFullYear()
  const shiftedMonth = String(shiftedDate.getMonth() + 1).padStart(2, '0')

  return `${shiftedYear}-${shiftedMonth}`
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
    month: getCurrentMonth(),
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

function isTrading212Cashback(transaction: Transaction) {
  return (
    transaction.direction === 'in' &&
    transaction.source === 'trading212' &&
    transaction.description.toLowerCase() === 'spending cashback'
  )
}

function getMonthEndDate(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(year, monthNumber, 0).toISOString().slice(0, 10)
}

function getOwedStatusByTransactionId(owedItems: OwedItem[]) {
  const statusByTransactionId = new Map<number, OwedItem['status']>()

  for (const item of owedItems) {
    if (!item.linked_transaction_id || item.status === 'cancelled') {
      continue
    }

    statusByTransactionId.set(item.linked_transaction_id, item.status)
  }

  return statusByTransactionId
}

function applyOwedStatus(
  transactions: TransactionTableRow[],
  owedItems: OwedItem[],
): TransactionTableRow[] {
  const statusByTransactionId = getOwedStatusByTransactionId(owedItems)

  return transactions.map((transaction) => ({
    ...transaction,
    owed_status: statusByTransactionId.get(transaction.id),
  }))
}

function getOwedSortRank(transaction: TransactionTableRow) {
  if (!transaction.owed_status) {
    return 0
  }

  if (transaction.owed_status === 'open' || transaction.owed_status === 'partially_paid') {
    return 1
  }

  if (transaction.owed_status === 'paid') {
    return 2
  }

  return 3
}

function sortTransactionsForDisplay(transactions: TransactionTableRow[]) {
  return [...transactions].sort((first, second) => {
    const owedRankDifference = getOwedSortRank(first) - getOwedSortRank(second)

    if (owedRankDifference !== 0) {
      return owedRankDifference
    }

    return second.date.localeCompare(first.date)
  })
}

function getTransactionsForDisplay(
  transactions: Transaction[],
  selectedMonth: string,
  owedItems: OwedItem[],
): TransactionTableRow[] {
  const cashbackRows = transactions.filter(isTrading212Cashback)

  if (cashbackRows.length <= 1) {
    return sortTransactionsForDisplay(applyOwedStatus(transactions, owedItems))
  }

  const cashbackTotal = cashbackRows.reduce(
    (total, transaction) => total + Number(transaction.amount),
    0,
  )

  const cashbackRow: TransactionTableRow = {
    ...cashbackRows[0],
    id: -1,
    date: getMonthEndDate(selectedMonth),
    description: `Trading 212 cashback - ${getMonthLabel(selectedMonth)}`,
    raw_description: 'Monthly grouped cashback',
    amount: cashbackTotal.toFixed(2),
    category: cashbackRows[0].category ?? 'Cashback',
    notes: `${cashbackRows.length} cashback rows grouped for display`,
    is_grouped: true,
    grouped_count: cashbackRows.length,
    dedupe_hash: `grouped-trading212-cashback-${selectedMonth}`,
  }

  return sortTransactionsForDisplay(
    applyOwedStatus(
      [
        ...transactions.filter((transaction) => !isTrading212Cashback(transaction)),
        cashbackRow,
      ],
      owedItems,
    ),
  )
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
  const [owedItems, setOwedItems] = useState<OwedItem[]>([])
  const [filters, setFilters] = useState<TransactionFilterState>(() =>
    getInitialFilterState(direction),
  )
  const [form, setForm] = useState<TransactionFormState>(() => getInitialFormState(direction))
  const [editForm, setEditForm] = useState<TransactionFormState>(() => getInitialFormState(direction))
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [owedDraftTransaction, setOwedDraftTransaction] = useState<TransactionTableRow | null>(null)
  const [owedForm, setOwedForm] = useState<OwedFromTransactionFormState>({
    person: 'Mother',
    amount: '',
    alreadyPaid: false,
    notes: '',
  })

  function loadOwedItems() {
    listOwedItems({
      limit: 500,
    })
      .then(setOwedItems)
      .catch(() => undefined)
  }

  function loadTransactions(activeFilters = filters) {
    setError(null)

    const selectedMonth = activeFilters.month || getCurrentMonth()
    const monthDateRange = getMonthDateRange(selectedMonth)

    listTransactions({
      direction,
      cashflow_type: activeFilters.cashflowType || undefined,
      search: activeFilters.search || undefined,
      category: activeFilters.category || undefined,
      source: activeFilters.source || undefined,
      date_from: activeFilters.dateFrom || monthDateRange.dateFrom || undefined,
      date_to: activeFilters.dateTo || monthDateRange.dateTo || undefined,
      limit: 500,
    })
      .then(setTransactions)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load transactions')
      })
  }

  async function handleExportCsv() {
    setError(null)
    setMessage(null)

    const selectedMonth = filters.month || getCurrentMonth()
    const monthDateRange = getMonthDateRange(selectedMonth)

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
    loadOwedItems()
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

  function selectMonth(month: string) {
    const safeMonth = month || getCurrentMonth()

    const nextFilters = {
      ...filters,
      month: safeMonth,
      dateFrom: '',
      dateTo: '',
    }

    setFilters(nextFilters)
    loadTransactions(nextFilters)
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

  function openOwedDialog(transaction: TransactionTableRow) {
    setError(null)
    setMessage(null)
    setOwedDraftTransaction(transaction)
    setOwedForm({
      person: 'Mother',
      amount: transaction.amount,
      alreadyPaid: false,
      notes: transaction.raw_description,
    })
  }

  function closeOwedDialog() {
    setOwedDraftTransaction(null)
    setOwedForm({
      person: 'Mother',
      amount: '',
      alreadyPaid: false,
      notes: '',
    })
  }

  function updateOwedForm<K extends keyof OwedFromTransactionFormState>(
    field: K,
    value: OwedFromTransactionFormState[K],
  ) {
    setOwedForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  async function createOwedItemFromDialog() {
    if (!owedDraftTransaction) {
      return
    }

    const amount = Math.abs(Number(owedForm.amount.replace(',', '.')))

    if (!owedForm.person.trim()) {
      setError('Person is required.')
      return
    }

    if (!amount || Number.isNaN(amount)) {
      setError('Amount owed must be a positive number.')
      return
    }

    setError(null)
    setMessage(null)

    try {
      await createOwedItem({
        person: owedForm.person.trim(),
        amount_total: amount.toFixed(2),
        amount_paid: owedForm.alreadyPaid ? amount.toFixed(2) : '0.00',
        reason: owedDraftTransaction.description,
        status: owedForm.alreadyPaid ? 'paid' : 'open',
        due_date: null,
        linked_transaction_id: owedDraftTransaction.id,
        notes: owedForm.notes || null,
      })

      setMessage(
        owedForm.alreadyPaid
          ? 'Paid owed item created from transaction.'
          : 'Open owed item created from transaction.',
      )
      closeOwedDialog()
      loadOwedItems()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create owed item')
    }
  }

  const transactionTotal = getTransactionsTotal(transactions)
  const selectedMonth = filters.month || getCurrentMonth()
  const displayTransactions = getTransactionsForDisplay(transactions, selectedMonth, owedItems)

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

      <div className="month-navigator" aria-label="Transaction month navigation">
        <button type="button" onClick={() => selectMonth(shiftMonth(selectedMonth, -1))}>
          ‹ Previous
        </button>

        <div className="month-navigator-current">
          <strong>{getMonthLabel(selectedMonth)}</strong>
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => selectMonth(event.target.value)}
            aria-label="Selected transaction month"
          />
        </div>

        <button type="button" onClick={() => selectMonth(shiftMonth(selectedMonth, 1))}>
          Next ›
        </button>

        <button type="button" onClick={() => selectMonth(getCurrentMonth())}>
          Today
        </button>
      </div>

      <TransactionFilters
        filters={filters}
        onChange={updateFilters}
        onApply={() => loadTransactions()}
        onClear={clearFilters}
      />

      <TransactionTable
        transactions={displayTransactions}
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
              <td className="actions-cell">
                <div className="table-action-group">
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
              <td className="actions-cell">
                <div className="table-action-group">
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
        onMarkOwed={direction === 'out' ? openOwedDialog : undefined}
      />

      {owedDraftTransaction && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2>Create owed item</h2>
                <p className="muted small">
                  Link this expense to Money Owed To Me.
                </p>
              </div>
              <button type="button" onClick={closeOwedDialog}>
                Close
              </button>
            </div>

            <div className="modal-transaction-summary">
              <strong>{owedDraftTransaction.description}</strong>
              <span>{formatMoney(owedDraftTransaction.amount, owedDraftTransaction.currency)}</span>
            </div>

            <div className="form-row">
              <label>
                Person
                <input
                  value={owedForm.person}
                  onChange={(event) => updateOwedForm('person', event.target.value)}
                  placeholder="Mother"
                />
              </label>

              <label>
                Amount owed
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={owedForm.amount}
                  onChange={(event) => updateOwedForm('amount', event.target.value)}
                />
              </label>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={owedForm.alreadyPaid}
                onChange={(event) => updateOwedForm('alreadyPaid', event.target.checked)}
              />
              Already reimbursed
            </label>

            <label>
              Notes
              <textarea
                value={owedForm.notes}
                onChange={(event) => updateOwedForm('notes', event.target.value)}
                rows={3}
              />
            </label>

            <div className="modal-actions">
              <button type="button" onClick={closeOwedDialog}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={createOwedItemFromDialog}
              >
                Create owed item
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
