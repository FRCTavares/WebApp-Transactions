import { useEffect, useState, type FormEvent } from 'react'
import { createOwedItem, createOwedPayment, listOwedItems } from '../api/owed'
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
import { CATEGORY_OPTIONS } from '../constants/categories'
import { TransactionTable, type TransactionTableRow } from '../components/TransactionTable'
import { TransactionDeleteDialog } from '../components/transactions/TransactionDeleteDialog'
import {
  TransactionOwedSplitDialog,
  type OwedSplitRowState,
} from '../components/transactions/TransactionOwedSplitDialog'
import { TransactionCreateOwedSection } from '../components/transactions/TransactionCreateOwedSection'
import { TransactionCreateRepaymentSection } from '../components/transactions/TransactionCreateRepaymentSection'
import { StatusMessage } from '../components/StatusMessage'
import { usePeriod } from '../context/PeriodContext'
import type { Direction, OwedItem, Transaction } from '../types/api'
import { formatMoney } from '../utils/format'
import {
  createOwedSplitRow,
  downloadBlob,
  getExportFilename,
  getFormStateFromTransaction,
  getInitialFilterState,
  getInitialFormState,
  getMonthDateRange,
  getRankedOwedPeople,
  getRankedTransactionCategories,
  getRemainingOwedAmount,
  getTransactionsForDisplay,
  parseMoneyInput,
  type ParsedCreateOwedRow,
  type ParsedRepaymentAllocation,
} from '../utils/transactionPageHelpers'

export function TransactionsPage() {
  const { monthKey } = usePeriod()
  const [direction, setDirection] = useState<Direction>('out')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filters, setFilters] = useState<TransactionFilterState>(() =>
    getInitialFilterState(direction),
  )
  const [form, setForm] = useState<TransactionFormState>(() => getInitialFormState(direction, monthKey))
  const [editForm, setEditForm] = useState<TransactionFormState>(() => getInitialFormState(direction, monthKey))
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [owedDraftTransaction, setOwedDraftTransaction] = useState<TransactionTableRow | null>(null)
  const [owedPaymentTransactions, setOwedPaymentTransactions] = useState<Transaction[]>([])
  const [isCreatingOwedItem, setIsCreatingOwedItem] = useState(false)
  const [owedRows, setOwedRows] = useState<OwedSplitRowState[]>([])
  const [isCreateOwedEnabled, setIsCreateOwedEnabled] = useState(false)
  const [createOwedRows, setCreateOwedRows] = useState<OwedSplitRowState[]>([])
  const [owedPersonOptions, setOwedPersonOptions] = useState<string[]>([])
  const [categoryOptions, setCategoryOptions] = useState<string[]>([])
  const [isCreateRepaymentEnabled, setIsCreateRepaymentEnabled] = useState(false)
  const [repaymentPerson, setRepaymentPerson] = useState('')
  const [repaymentPersonOptions, setRepaymentPersonOptions] = useState<string[]>([])
  const [repaymentItems, setRepaymentItems] = useState<OwedItem[]>([])
  const [repaymentAllocations, setRepaymentAllocations] = useState<Record<number, string>>({})
  const [repaymentUnallocatedCategory, setRepaymentUnallocatedCategory] = useState('')
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

    setForm(getInitialFormState(direction, monthKey))
    setEditForm(getInitialFormState(direction, monthKey))
    setFilters(initialFilters)
    setEditingTransaction(null)
    setIsCreateFormOpen(false)
    setIsCreateOwedEnabled(false)
    setCreateOwedRows([])
    resetCreateRepaymentState()
    loadTransactions(initialFilters)
    loadCategoryOptions()
  }, [direction, monthKey])

  function updateForm(field: keyof TransactionFormState, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function resetCreateRepaymentState() {
    setIsCreateRepaymentEnabled(false)
    setRepaymentPerson('')
    setRepaymentPersonOptions([])
    setRepaymentItems([])
    setRepaymentAllocations({})
    setRepaymentUnallocatedCategory('')
  }

  function resetCreateFormState() {
    setForm(getInitialFormState(direction, monthKey))
    setIsCreateOwedEnabled(false)
    setCreateOwedRows([])
    resetCreateRepaymentState()
  }

  function loadCategoryOptions() {
    Promise.all([
      listTransactions({ direction: 'in', limit: 500 }),
      listTransactions({ direction: 'out', limit: 500 }),
    ])
      .then(([moneyInRows, moneyOutRows]) => {
        setCategoryOptions(getRankedTransactionCategories([...moneyInRows, ...moneyOutRows], CATEGORY_OPTIONS))
      })
      .catch(() => setCategoryOptions(CATEGORY_OPTIONS))
  }

  function loadOwedPersonOptions() {
    listOwedItems({ limit: 500 })
      .then((items) => {
        setOwedPersonOptions(getRankedOwedPeople(items))
      })
      .catch(() => {
        setOwedPersonOptions([])
      })
  }

  function toggleCreateOwedEnabled(isEnabled: boolean) {
    setIsCreateOwedEnabled(isEnabled)

    if (!isEnabled) {
      setCreateOwedRows([])
      return
    }

    loadOwedPersonOptions()
    setCreateOwedRows((currentRows) =>
      currentRows.length > 0
        ? currentRows
        : [
            createOwedSplitRow({
              person: '',
              amount: form.amount,
            }),
          ],
    )
  }

  function updateCreateOwedRow<K extends keyof OwedSplitRowState>(
    rowId: string,
    field: K,
    value: OwedSplitRowState[K],
  ) {
    setCreateOwedRows((currentRows) =>
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

  function addCreateOwedRow() {
    setCreateOwedRows((currentRows) => [
      ...currentRows,
      createOwedSplitRow({
        person: '',
      }),
    ])
  }

  function removeCreateOwedRow(rowId: string) {
    setCreateOwedRows((currentRows) => currentRows.filter((row) => row.id !== rowId))
  }

  function loadRepaymentPersonOptions() {
    listOwedItems({ status: 'active', limit: 500 })
      .then((items) => {
        const people = Array.from(
          new Set(items.map((item) => item.person.trim()).filter(Boolean)),
        ).sort((first, second) => first.localeCompare(second))

        setRepaymentPersonOptions(people)
      })
      .catch(() => {
        setRepaymentPersonOptions([])
      })
  }

  function loadRepaymentItemsForPerson(person: string) {
    if (!person.trim()) {
      setRepaymentItems([])
      return
    }

    listOwedItems({ status: 'active', person: person.trim(), limit: 500 })
      .then(setRepaymentItems)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load owed items for payer')
      })
  }

  function toggleCreateRepaymentEnabled(isEnabled: boolean) {
    setIsCreateRepaymentEnabled(isEnabled)

    if (!isEnabled) {
      setRepaymentPerson('')
      setRepaymentItems([])
      setRepaymentAllocations({})
      setRepaymentUnallocatedCategory('')
      return
    }

    loadRepaymentPersonOptions()
  }

  function updateRepaymentPerson(person: string) {
    setRepaymentPerson(person)
    setRepaymentAllocations({})
    loadRepaymentItemsForPerson(person)
  }

  function updateRepaymentAllocation(owedItemId: number, amount: string) {
    setRepaymentAllocations((currentAllocations) => ({
      ...currentAllocations,
      [owedItemId]: amount,
    }))
  }

  function getParsedCreateRepaymentAllocations(
    transactionAmount: number,
  ): ParsedRepaymentAllocation[] | null {
    if (!isCreateRepaymentEnabled || direction !== 'in') {
      return []
    }

    if (!repaymentPerson.trim()) {
      setError('Choose who paid you.')
      return null
    }

    const parsedAllocations = Object.entries(repaymentAllocations)
      .map(([owedItemId, amount]) => ({
        owed_item_id: Number(owedItemId),
        amount: parseMoneyInput(amount),
      }))
      .filter((allocation) => allocation.amount > 0 && !Number.isNaN(allocation.amount))

    if (parsedAllocations.length === 0) {
      setError('Allocate this Money In to at least one owed item.')
      return null
    }

    const allocationTotal = parsedAllocations.reduce(
      (total, allocation) => total + allocation.amount,
      0,
    )

    if (allocationTotal > transactionAmount + 0.0001) {
      setError('Allocated repayment amount cannot exceed the Money In amount.')
      return null
    }

    const invalidAllocation = parsedAllocations.find((allocation) => {
      const item = repaymentItems.find((candidate) => candidate.id === allocation.owed_item_id)

      return !item || allocation.amount > Number(item.amount_remaining) + 0.0001
    })

    if (invalidAllocation) {
      setError('Allocated amount cannot exceed the selected owed item remaining amount.')
      return null
    }

    return parsedAllocations
  }

  function getParsedCreateOwedRows(transactionAmount: number): ParsedCreateOwedRow[] | null {
    if (!isCreateOwedEnabled || direction !== 'out') {
      return []
    }

    if (createOwedRows.length === 0) {
      setError('Add at least one owed person.')
      return null
    }

    const parsedRows = createOwedRows.map((row) => ({
      person: row.person.trim(),
      amount: parseMoneyInput(row.amount),
    }))

    const invalidRow = parsedRows.find(
      (row) => !row.person || !row.amount || Number.isNaN(row.amount),
    )

    if (invalidRow) {
      setError('Each owed person needs a name and a positive owed amount.')
      return null
    }

    const totalOwedAmount = parsedRows.reduce((total, row) => total + row.amount, 0)

    if (totalOwedAmount > transactionAmount + 0.0001) {
      setError(
        `Total owed amount cannot exceed the transaction amount of ${formatMoney(
          transactionAmount.toFixed(2),
          'EUR',
        )}.`,
      )
      return null
    }

    return parsedRows
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

    const parsedCreateOwedRows = getParsedCreateOwedRows(amount)

    if (parsedCreateOwedRows === null) {
      return
    }

    const parsedRepaymentAllocations = getParsedCreateRepaymentAllocations(amount)

    if (parsedRepaymentAllocations === null) {
      return
    }

    try {
      const createdTransaction = await createTransaction({
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

      for (const row of parsedCreateOwedRows) {
        await createOwedItem({
          person: row.person,
          amount_total: row.amount.toFixed(2),
          amount_paid: '0.00',
          reason: form.description,
          status: 'open',
          due_date: null,
          linked_transaction_id: createdTransaction.id,
          notes: null,
        })
      }

      if (direction === 'in' && isCreateRepaymentEnabled) {
        const allocatedAmount = parsedRepaymentAllocations.reduce(
          (total, allocation) => total + allocation.amount,
          0,
        )
        const leftoverAmount = Math.max(amount - allocatedAmount, 0)

        await createOwedPayment({
          person: repaymentPerson.trim(),
          amount: amount.toFixed(2),
          payment_date: form.date,
          method: 'bank_transfer',
          currency: 'EUR',
          notes: form.notes || null,
          linked_transaction_id: createdTransaction.id,
          unallocated_category: leftoverAmount > 0 ? repaymentUnallocatedCategory || null : null,
          unallocated_notes: null,
          allocations: parsedRepaymentAllocations.map((allocation) => ({
            owed_item_id: allocation.owed_item_id,
            amount: allocation.amount.toFixed(2),
          })),
        })
      }

      resetCreateFormState()
      setIsCreateFormOpen(false)
      setMessage(
        direction === 'in' && isCreateRepaymentEnabled
          ? 'Transaction created and owed payment recorded.'
          : parsedCreateOwedRows.length > 0
            ? `Transaction created with ${parsedCreateOwedRows.length} owed split${parsedCreateOwedRows.length === 1 ? '' : 's'}.`
            : 'Transaction created.',
      )
      loadTransactions()
      loadCategoryOptions()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create transaction or owed split')
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

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
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
      setEditForm(getInitialFormState(direction, monthKey))
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
          notes: null,
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
            notes: null,
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
            onClick={() => {
              if (isCreateFormOpen) {
                resetCreateFormState()
                setIsCreateFormOpen(false)
                return
              }

              setIsCreateFormOpen(true)
            }}
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
          categoryOptions={categoryOptions}
          onCancel={() => {
            resetCreateFormState()
            setIsCreateFormOpen(false)
          }}
        >
          {direction === 'out' ? (
            <TransactionCreateOwedSection
              isEnabled={isCreateOwedEnabled}
              rows={createOwedRows}
              transactionAmount={form.amount}
              personOptions={owedPersonOptions}
              currency="EUR"
              onToggle={toggleCreateOwedEnabled}
              onAddRow={addCreateOwedRow}
              onRemoveRow={removeCreateOwedRow}
              onUpdateRow={updateCreateOwedRow}
            />
          ) : (
            <TransactionCreateRepaymentSection
              isEnabled={isCreateRepaymentEnabled}
              person={repaymentPerson}
              personOptions={repaymentPersonOptions}
              items={repaymentItems}
              allocations={repaymentAllocations}
              transactionAmount={form.amount}
              unallocatedCategory={repaymentUnallocatedCategory}
              currency="EUR"
              onToggle={toggleCreateRepaymentEnabled}
              onPersonChange={updateRepaymentPerson}
              onAllocationChange={updateRepaymentAllocation}
              onUnallocatedCategoryChange={setRepaymentUnallocatedCategory}
            />
          )}
        </TransactionForm>
      ) : null}

      {editingTransaction ? (
        <TransactionForm
          title={`Edit ${direction === 'in' ? 'Money In' : 'Money Out'}`}
          form={editForm}
          submitLabel="Save"
          direction={direction}
          editingTransactionId={editingTransaction.id}
          onSubmit={(event) => {
            event.preventDefault()
            void saveEditFromForm()
          }}
          onChange={updateEditForm}
          categoryOptions={categoryOptions}
          onCancel={() => {
            setEditingTransaction(null)
            setEditForm(getInitialFormState(direction, monthKey))
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
                  <option value="transfer">Transfer</option>
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
                      setEditForm(getInitialFormState(direction, monthKey))
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
