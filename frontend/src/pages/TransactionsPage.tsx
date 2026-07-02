import { useEffect, useState, type FormEvent } from 'react'
import { createOwedItem, createOwedPayment } from '../api/owed'
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
import { TransactionForm, type TransactionFormState } from '../components/TransactionForm'
import { CategorySelect } from '../components/CategorySelect'
import { TransactionTable, type TransactionTableRow } from '../components/TransactionTable'
import { StatusMessage } from '../components/StatusMessage'
import { usePeriod } from '../context/PeriodContext'
import type { CashflowType, Direction, Transaction } from '../types/api'
import { formatMoney } from '../utils/format'

type TransactionsPageProps = {
  direction: Direction
  title: string
}

type OwedSplitRowState = {
  id: string
  person: string
  amount: string
  linkedPaymentTransactionId: string
  unallocatedCategory: string
  unallocatedNotes: string
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
function getMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1, 1)

  return date.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  })
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

function getOwedSortRank(transaction: TransactionTableRow) {
  if (!transaction.is_owed || transaction.owed_status === 'cancelled') {
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
): TransactionTableRow[] {
  const cashbackRows = transactions.filter(isTrading212Cashback)

  if (cashbackRows.length <= 1) {
    return sortTransactionsForDisplay(transactions)
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

  return sortTransactionsForDisplay([
    ...transactions.filter((transaction) => !isTrading212Cashback(transaction)),
    cashbackRow,
  ])
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

function createOwedSplitRow({
  amount = '',
  notes = '',
}: {
  amount?: string
  notes?: string
} = {}): OwedSplitRowState {
  return {
    id: `${Date.now()}-${Math.random()}`,
    person: 'Mother',
    amount,
    linkedPaymentTransactionId: '',
    unallocatedCategory: '',
    unallocatedNotes: '',
    notes,
  }
}

function parseMoneyInput(value: string) {
  return Math.abs(Number(value.replace(',', '.')))
}

function getRemainingOwedAmount(transaction: TransactionTableRow) {
  const transactionAmount = Number(transaction.amount)
  const linkedOwedAmount = Number(transaction.owed_amount_total ?? '0')

  return Math.max(transactionAmount - linkedOwedAmount, 0)
}

function getOwedRowsTotal(rows: OwedSplitRowState[]) {
  return rows.reduce((total, row) => {
    const amount = parseMoneyInput(row.amount)

    if (!amount || Number.isNaN(amount)) {
      return total
    }

    return total + amount
  }, 0)
}

export function TransactionsPage({ direction, title }: TransactionsPageProps) {
  const { monthKey } = usePeriod()
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
  const [owedDraftTransaction, setOwedDraftTransaction] = useState<TransactionTableRow | null>(null)
  const [owedPaymentTransactions, setOwedPaymentTransactions] = useState<Transaction[]>([])
  const [isCreatingOwedItem, setIsCreatingOwedItem] = useState(false)
  const [owedRows, setOwedRows] = useState<OwedSplitRowState[]>([])

  function loadTransactions(activeFilters = filters) {
    setError(null)

    const selectedMonth = activeFilters.month || monthKey
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

    const selectedMonth = filters.month || monthKey
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


  function handleCreateTransactionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void createTransactionFromForm()
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

  function loadOwedPaymentTransactionsForDialog() {
    const selectedMonthForDialog = filters.month || monthKey
    const monthDateRange = getMonthDateRange(selectedMonthForDialog)

    listTransactions({
      direction: 'in',
      date_from: filters.dateFrom || monthDateRange.dateFrom || undefined,
      date_to: filters.dateTo || monthDateRange.dateTo || undefined,
      limit: 500,
    })
      .then(setOwedPaymentTransactions)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load money in options')
      })
  }

  function openOwedDialog(transaction: TransactionTableRow) {
    const remainingOwedAmount = getRemainingOwedAmount(transaction)

    setError(null)
    setMessage(null)
    setOwedDraftTransaction(transaction)
    setOwedRows([
      createOwedSplitRow({
        amount: remainingOwedAmount.toFixed(2),
        notes: transaction.raw_description || transaction.description,
      }),
    ])
    loadOwedPaymentTransactionsForDialog()
  }

  function closeOwedDialog() {
    setOwedDraftTransaction(null)
    setOwedRows([])
    setOwedPaymentTransactions([])
  }

  function updateOwedRow<K extends keyof OwedSplitRowState>(
    rowId: string,
    field: K,
    value: OwedSplitRowState[K],
  ) {
    setOwedRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              [field]: value,
            }
          : row,
      ),
    )
  }

  function addOwedRow() {
    setOwedRows((currentRows) => [
      ...currentRows,
      createOwedSplitRow({
        notes: owedDraftTransaction?.raw_description || owedDraftTransaction?.description || '',
      }),
    ])
  }

  function removeOwedRow(rowId: string) {
    setOwedRows((currentRows) => {
      if (currentRows.length <= 1) {
        return currentRows
      }

      return currentRows.filter((row) => row.id !== rowId)
    })
  }

  function getSelectedOwedPaymentTransaction(row: OwedSplitRowState) {
    if (!row.linkedPaymentTransactionId) {
      return null
    }

    return (
      owedPaymentTransactions.find(
        (transaction) => transaction.id.toString() === row.linkedPaymentTransactionId,
      ) ?? null
    )
  }

  async function createOwedItemsFromDialog() {
    if (!owedDraftTransaction || isCreatingOwedItem) {
      return
    }

    if (owedRows.length === 0) {
      setError('Add at least one owed person.')
      return
    }

    const parsedRows = owedRows.map((row) => ({
      ...row,
      person: row.person.trim(),
      amount: parseMoneyInput(row.amount),
      linkedPaymentTransaction: getSelectedOwedPaymentTransaction(row),
    }))

    const invalidRow = parsedRows.find(
      (row) => !row.person || !row.amount || Number.isNaN(row.amount),
    )

    if (invalidRow) {
      setError('Each owed person needs a name and a positive owed amount.')
      return
    }

    const totalOwedAmount = parsedRows.reduce((total, row) => total + row.amount, 0)
    const remainingOwedAmount = getRemainingOwedAmount(owedDraftTransaction)

    if (totalOwedAmount > remainingOwedAmount + 0.0001) {
      setError(
        `Total owed amount cannot exceed the remaining available amount of ${formatMoney(
          remainingOwedAmount.toFixed(2),
          owedDraftTransaction.currency,
        )}.`,
      )
      return
    }

    setError(null)
    setMessage(null)
    setIsCreatingOwedItem(true)

    try {
      let createdCount = 0
      let paymentCount = 0

      for (const row of parsedRows) {
        const owedItem = await createOwedItem({
          person: row.person,
          amount_total: row.amount.toFixed(2),
          amount_paid: '0.00',
          reason: owedDraftTransaction.description,
          status: 'open',
          due_date: null,
          linked_transaction_id: owedDraftTransaction.id,
          notes: row.notes || null,
        })

        createdCount += 1

        if (row.linkedPaymentTransaction) {
          const paymentAmount = Number(row.linkedPaymentTransaction.amount)
          const allocationAmount = Math.min(paymentAmount, row.amount)
          const leftoverAmount = Math.max(paymentAmount - allocationAmount, 0)

          await createOwedPayment({
            person: row.person,
            amount: paymentAmount.toFixed(2),
            payment_date: row.linkedPaymentTransaction.date,
            method: 'bank_transfer',
            currency: row.linkedPaymentTransaction.currency || 'EUR',
            notes: row.notes || null,
            linked_transaction_id: row.linkedPaymentTransaction.id,
            unallocated_category: leftoverAmount > 0 ? row.unallocatedCategory || null : null,
            unallocated_notes: leftoverAmount > 0 ? row.unallocatedNotes || null : null,
            allocations: allocationAmount > 0
              ? [
                  {
                    owed_item_id: owedItem.id,
                    amount: allocationAmount.toFixed(2),
                  },
                ]
              : undefined,
          })

          paymentCount += 1
        }
      }

      setMessage(
        paymentCount > 0
          ? `${createdCount} owed item${createdCount === 1 ? '' : 's'} created and ${paymentCount} payment${paymentCount === 1 ? '' : 's'} recorded.`
          : `${createdCount} owed item${createdCount === 1 ? '' : 's'} created.`,
      )
      closeOwedDialog()
      loadTransactions()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create owed split')
    } finally {
      setIsCreatingOwedItem(false)
    }
  }

  const selectedMonth = filters.month || monthKey
  const displayTransactions = getTransactionsForDisplay(transactions, selectedMonth)
  const categoryOptions = transactions
    .map((transaction) => transaction.category)
    .filter((category): category is string => Boolean(category))
  const subcategoryOptions = transactions
    .map((transaction) => transaction.subcategory)
    .filter((subcategory): subcategory is string => Boolean(subcategory))

  return (
    <section className="app-page transactions-page">
      <div className="page-header transactions-page-header">
        <div className="page-title-block">
          <h1>{title}</h1>
        </div>

        <div className="action-group">
          <button className="desktop-only" type="button" onClick={handleExportCsv}>
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

      {isCreateFormOpen ? (
        <TransactionForm
          title={`Add ${direction === 'in' ? 'Money In' : 'Money Out'}`}
          form={form}
          submitLabel="Save"
          direction={direction}
          onSubmit={handleCreateTransactionSubmit}
          onChange={updateForm}
          onCancel={() => {
            setForm(getInitialFormState(direction))
            setIsCreateFormOpen(false)
          }}
        />
      ) : null}

      <TransactionTable
        transactions={displayTransactions}
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
                <CategorySelect
                  value={editForm.category}
                  onChange={(value) => updateEditForm('category', value)}
                  options={categoryOptions}
                  placeholder="Category"
                />
                <CategorySelect
                  value={editForm.subcategory}
                  onChange={(value) => updateEditForm('subcategory', value)}
                  options={subcategoryOptions}
                  placeholder="Subcategory"
                  className="table-input-secondary"
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
                <h2>Split owed expense</h2>
                <p className="muted small">
                  Add who owes part of this expense. Optionally link matching Money In repayments now.
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

            <p className="muted small">
              Already linked: {formatMoney(
                owedDraftTransaction.owed_amount_total ?? '0.00',
                owedDraftTransaction.currency,
              )}. Remaining available: {formatMoney(
                getRemainingOwedAmount(owedDraftTransaction).toFixed(2),
                owedDraftTransaction.currency,
              )}. Current split total: {formatMoney(
                getOwedRowsTotal(owedRows).toFixed(2),
                owedDraftTransaction.currency,
              )}.
            </p>

            {owedRows.map((row, index) => {
              const linkedPaymentTransaction = getSelectedOwedPaymentTransaction(row)
              const rowAmount = parseMoneyInput(row.amount)
              const paymentAmount = linkedPaymentTransaction
                ? Number(linkedPaymentTransaction.amount)
                : 0
              const allocationAmount = linkedPaymentTransaction
                ? Math.min(paymentAmount, rowAmount || 0)
                : 0
              const leftoverAmount = linkedPaymentTransaction
                ? Math.max(paymentAmount - allocationAmount, 0)
                : 0

              return (
                <div key={row.id} className="modal-transaction-summary">
                  <div>
                    <strong>Person {index + 1}</strong>
                    <p className="muted small">
                      Owed allocation for this expense.
                    </p>
                  </div>

                  <div className="form-row">
                    <label>
                      Person
                      <input
                        value={row.person}
                        onChange={(event) => updateOwedRow(row.id, 'person', event.target.value)}
                        placeholder="Mother"
                      />
                    </label>

                    <label>
                      Amount owed
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.amount}
                        onChange={(event) => updateOwedRow(row.id, 'amount', event.target.value)}
                      />
                    </label>
                  </div>

                  <div className="form-row">
                    <label>
                      Matching Money In
                      <select
                        value={row.linkedPaymentTransactionId}
                        onChange={(event) =>
                          updateOwedRow(row.id, 'linkedPaymentTransactionId', event.target.value)
                        }
                      >
                        <option value="">No repayment selected</option>
                        {owedPaymentTransactions.map((transaction) => (
                          <option key={transaction.id} value={transaction.id}>
                            #{transaction.id} | {transaction.date} | {transaction.description} | {formatMoney(
                              transaction.amount,
                              transaction.currency,
                            )}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Leftover category
                      <select
                        value={row.unallocatedCategory}
                        onChange={(event) =>
                          updateOwedRow(row.id, 'unallocatedCategory', event.target.value)
                        }
                        disabled={!linkedPaymentTransaction || leftoverAmount <= 0}
                      >
                        {UNALLOCATED_CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value || 'empty'} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span className="muted small">
                        Use Allowance, Gift, or Income if extra money should count as Money In.
                      </span>
                    </label>
                  </div>

                  {linkedPaymentTransaction && (
                    <p className="muted small">
                      Payment {formatMoney(paymentAmount.toFixed(2), linkedPaymentTransaction.currency)}
                      {' '}→ allocated {formatMoney(allocationAmount.toFixed(2), linkedPaymentTransaction.currency)}
                      {' '}→ leftover {formatMoney(leftoverAmount.toFixed(2), linkedPaymentTransaction.currency)}
                    </p>
                  )}

                  <div className="form-row">
                    <label>
                      Notes
                      <textarea
                        value={row.notes}
                        onChange={(event) => updateOwedRow(row.id, 'notes', event.target.value)}
                        rows={3}
                      />
                    </label>

                    <label>
                      Leftover notes
                      <textarea
                        value={row.unallocatedNotes}
                        onChange={(event) =>
                          updateOwedRow(row.id, 'unallocatedNotes', event.target.value)
                        }
                        rows={3}
                        disabled={!linkedPaymentTransaction || leftoverAmount <= 0}
                        placeholder="Extra was a gift"
                      />
                    </label>
                  </div>

                  {owedRows.length > 1 && (
                    <button type="button" className="danger-button" onClick={() => removeOwedRow(row.id)}>
                      Remove person
                    </button>
                  )}
                </div>
              )
            })}

            <div className="modal-actions">
              <button type="button" onClick={addOwedRow}>
                + Add person
              </button>
              <button type="button" onClick={closeOwedDialog}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={createOwedItemsFromDialog}
                disabled={isCreatingOwedItem}
              >
                {isCreatingOwedItem ? 'Creating...' : 'Create owed split'}
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  )
}
