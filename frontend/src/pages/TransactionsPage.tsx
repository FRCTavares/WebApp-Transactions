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
import { TransactionDeleteDialog } from '../components/transactions/TransactionDeleteDialog'
import {
  TransactionOwedSplitDialog,
  type OwedSplitRowState,
} from '../components/transactions/TransactionOwedSplitDialog'
import { StatusMessage } from '../components/StatusMessage'
import { usePeriod } from '../context/PeriodContext'
import type { CashflowType, Direction, Transaction } from '../types/api'
import { formatMoney } from '../utils/format'


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


export function TransactionsPage() {
  const { monthKey } = usePeriod()
  const [direction, setDirection] = useState<Direction>('out')
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
  const [deleteDraftTransaction, setDeleteDraftTransaction] = useState<Transaction | null>(null)
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false)

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

  function handleDeleteTransaction(transaction: Transaction) {
    setDeleteDraftTransaction(transaction)
  }

  async function confirmDeleteTransaction() {
    if (!deleteDraftTransaction || isDeletingTransaction) {
      return
    }

    setError(null)
    setMessage(null)
    setIsDeletingTransaction(true)

    try {
      await deleteTransaction(deleteDraftTransaction.id)
      setMessage('Transaction deleted.')

      if (editingTransaction?.id === deleteDraftTransaction.id) {
        setEditingTransaction(null)
      }

      setDeleteDraftTransaction(null)
      loadTransactions()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to delete transaction')
    } finally {
      setIsDeletingTransaction(false)
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

  return (
    <section className={`app-page transactions-page transactions-page-${direction}`}>
      <div className="page-header transactions-page-header">
        <div className="page-title-block">
          <h1>{direction === 'in' ? 'Money In' : 'Money Out'}</h1>
          <div className="transaction-direction-switch" aria-label="Transaction direction">
            <button
              type="button"
              className={direction === 'out' ? 'active' : undefined}
              onClick={() => setDirection('out')}
            >
              Money Out
            </button>
            <button
              type="button"
              className={direction === 'in' ? 'active' : undefined}
              onClick={() => setDirection('in')}
            >
              Money In
            </button>
          </div>
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

      {deleteDraftTransaction && (
        <TransactionDeleteDialog
          transaction={deleteDraftTransaction}
          isDeleting={isDeletingTransaction}
          onCancel={() => setDeleteDraftTransaction(null)}
          onConfirm={confirmDeleteTransaction}
        />
      )}

      {owedDraftTransaction && (
        <TransactionOwedSplitDialog
          transaction={owedDraftTransaction}
          rows={owedRows}
          paymentTransactions={owedPaymentTransactions}
          isCreating={isCreatingOwedItem}
          onClose={closeOwedDialog}
          onAddRow={addOwedRow}
          onRemoveRow={removeOwedRow}
          onUpdateRow={updateOwedRow}
          onCreate={createOwedItemsFromDialog}
          getRemainingOwedAmount={getRemainingOwedAmount}
          getSelectedPaymentTransaction={getSelectedOwedPaymentTransaction}
        />
      )}
    </section>
  )
}
