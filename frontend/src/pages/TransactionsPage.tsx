import { TransactionsPageView } from '../components/transactions/TransactionsPageView'
import { useEffect, useState, type FormEvent } from 'react'
import { listOwedItems, listOwedPayments } from '../api/owed'
import {
  createOwedSplitForTransaction,
  createTransactionWithOwed,
  deleteTransaction,
  exportTransactionsCsv,
  listTransactions,
  updateTransaction,
} from '../api/transactions'
import type { TransactionFilterState } from '../components/TransactionFilters'
import type { TransactionFormState } from '../components/TransactionForm'
import { listTransactionCategories } from '../api/transactionCategories'
import type { TransactionTableRow } from '../components/TransactionTable'
import type { OwedSplitRowState } from '../components/transactions/TransactionOwedSplitDialog'
import { usePeriod } from '../hooks/usePeriod'
import type {
  Direction,
  OwedItem,
  Transaction,
  TransactionCategory,
} from '../types/api'
import { formatMoney } from '../utils/format'
import {
  buildCreateTransactionWithOwedPayload,
  buildExistingTransactionOwedSplitPayload,
} from '../utils/transactionFinancialCommandPayloads'
import {
  createOwedSplitRow,
  downloadBlob,
  getAvailablePaymentTransactions,
  getExportFilename,
  getFormStateFromTransaction,
  getInitialFilterState,
  getInitialFormState,
  getMonthDateRange,
  getRankedOwedPeople,
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
  const [owedPaymentAvailableAmounts, setOwedPaymentAvailableAmounts] = useState<Record<number, string>>({})
  const [isCreatingOwedItem, setIsCreatingOwedItem] = useState(false)
  const [owedRows, setOwedRows] = useState<OwedSplitRowState[]>([])
  const [owedLeftoverItemsByPerson, setOwedLeftoverItemsByPerson] = useState<Record<string, OwedItem[]>>({})
  const [isCreateOwedEnabled, setIsCreateOwedEnabled] = useState(false)
  const [createOwedRows, setCreateOwedRows] = useState<OwedSplitRowState[]>([])
  const [owedPersonOptions, setOwedPersonOptions] = useState<string[]>([])
  const [categoryOptions, setCategoryOptions] = useState<TransactionCategory[]>([])
  const [isCreateRepaymentEnabled, setIsCreateRepaymentEnabled] = useState(false)
  const [repaymentPerson, setRepaymentPerson] = useState('')
  const [repaymentPersonOptions, setRepaymentPersonOptions] = useState<string[]>([])
  const [repaymentItems, setRepaymentItems] = useState<OwedItem[]>([])
  const [repaymentAllocations, setRepaymentAllocations] = useState<Record<number, string>>({})
  const [repaymentUnallocatedCategory, setRepaymentUnallocatedCategory] = useState('')
  const [deleteDraftTransaction, setDeleteDraftTransaction] = useState<Transaction | null>(null)
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

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
    const timeoutId = window.setTimeout(() => {
      const initialFilters = getInitialFilterState(direction)
      const monthDateRange = getMonthDateRange(monthKey)

      setForm(getInitialFormState(direction, monthKey))
      setEditForm(getInitialFormState(direction, monthKey))
      setFilters(initialFilters)
      setEditingTransaction(null)
      setIsCreateFormOpen(false)
      setIsCreateOwedEnabled(false)
      setCreateOwedRows([])
      resetCreateRepaymentState()

      listTransactions({
        direction,
        date_from: monthDateRange.dateFrom || undefined,
        date_to: monthDateRange.dateTo || undefined,
        limit: 500,
      })
        .then(setTransactions)
        .catch((caughtError: unknown) => {
          setError(caughtError instanceof Error ? caughtError.message : 'Failed to load transactions')
        })

      listTransactionCategories({ active_only: true, limit: 500 })
        .then(setCategoryOptions)
        .catch(() => setCategoryOptions([]))
    }, 0)

    return () => window.clearTimeout(timeoutId)
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
    listTransactionCategories({ active_only: true, limit: 500 })
      .then(setCategoryOptions)
      .catch(() => setCategoryOptions([]))
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

  function updateFilters(field: keyof TransactionFilterState, value: string | boolean) {
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
      await createTransactionWithOwed(
        buildCreateTransactionWithOwedPayload({
          form,
          direction,
          amount,
          owedRows: parsedCreateOwedRows,
          isRepaymentEnabled: isCreateRepaymentEnabled,
          repaymentPerson,
          repaymentAllocations: parsedRepaymentAllocations,
          repaymentUnallocatedCategory,
        }),
      )

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
  }

  function cancelEdit() {
    setEditingTransaction(null)
    setEditForm(getInitialFormState(direction, monthKey))
  }

  async function saveEditFromForm() {
    if (!editingTransaction || isSavingEdit) {
      return
    }

    setError(null)
    setMessage(null)

    const amount = Math.abs(Number(editForm.amount))

    if (!editForm.date || !editForm.description || !amount) {
      setError('Date, description, and positive amount are required.')
      return
    }

    setIsSavingEdit(true)

    try {
      await updateTransaction(editingTransaction.id, {
        date: editForm.date,
        description: editForm.description,
        amount: amount.toFixed(2),
        cashflow_type: editForm.cashflow_type,
        category: editForm.category || null,
        notes: editForm.notes || null,
      })

      cancelEdit()
      setMessage('Transaction updated.')
      loadTransactions()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update transaction')
    } finally {
      setIsSavingEdit(false)
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

    Promise.all([
      listTransactions({
        direction: 'in',
        date_from: filters.dateFrom || monthDateRange.dateFrom || undefined,
        date_to: filters.dateTo || monthDateRange.dateTo || undefined,
        limit: 500,
      }),
      listOwedPayments({ limit: 500 }),
    ])
      .then(([moneyInRows, owedPayments]) => {
        const { availableTransactions, availableAmountsById } = getAvailablePaymentTransactions(moneyInRows, owedPayments)

        setOwedPaymentTransactions(availableTransactions)
        setOwedPaymentAvailableAmounts(availableAmountsById)
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load money in options')
      })
  }

  function openOwedDialog(transaction: TransactionTableRow) {
    const remainingOwedAmount = getRemainingOwedAmount(transaction)

    setError(null)
    setMessage(null)
    setOwedDraftTransaction(transaction)
    setOwedRows([createOwedSplitRow({
      amount: remainingOwedAmount.toFixed(2),
      notes: transaction.raw_description || transaction.description,
    })])
    loadOwedPaymentTransactionsForDialog()
  }

  function closeOwedDialog() {
    setOwedDraftTransaction(null)
    setOwedRows([])
    setOwedPaymentTransactions([])
    setOwedPaymentAvailableAmounts({})
    setOwedLeftoverItemsByPerson({})
  }

  function loadOwedLeftoverItemsForPerson(person: string) {
    const trimmedPerson = person.trim()

    if (!trimmedPerson) {
      return
    }

    const personKey = trimmedPerson.toLowerCase()

    listOwedItems({ status: 'active', person: trimmedPerson, limit: 500 })
      .then((items) => {
        setOwedLeftoverItemsByPerson((currentItems) => ({
          ...currentItems,
          [personKey]: items.filter((item) => item.linked_transaction_id !== owedDraftTransaction?.id),
        }))
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load other owed items for this person')
      })
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

    if (field === 'person') {
      loadOwedLeftoverItemsForPerson(String(value))
    }
  }

  function updateOwedLeftoverAllocation(rowId: string, owedItemId: number, amount: string) {
    setOwedRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              leftoverAllocations: {
                ...row.leftoverAllocations,
                [owedItemId]: amount,
              },
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

    for (const row of parsedRows) {
      if (!row.linkedPaymentTransaction) {
        continue
      }

      const paymentAmount = Number(owedPaymentAvailableAmounts[row.linkedPaymentTransaction.id] ?? row.linkedPaymentTransaction.amount)
      const currentAllocationAmount = Math.min(paymentAmount, row.amount)
      const availableLeftoverAmount = Math.max(paymentAmount - currentAllocationAmount, 0)
      const personKey = row.person.toLowerCase()
      const availableItems = owedLeftoverItemsByPerson[personKey] ?? []
      const leftoverAllocations = Object.entries(row.leftoverAllocations)
        .map(([owedItemId, amount]) => ({ owed_item_id: Number(owedItemId), amount: parseMoneyInput(amount) }))
        .filter((allocation) => allocation.amount > 0 && !Number.isNaN(allocation.amount))
      const leftoverAllocationTotal = leftoverAllocations.reduce((total, allocation) => total + allocation.amount, 0)

      if (leftoverAllocationTotal > availableLeftoverAmount + 0.0001) {
        setError('Leftover allocations cannot exceed the selected Money In leftover amount.')
        return
      }

      const invalidAllocation = leftoverAllocations.find((allocation) => {
        const item = availableItems.find((candidate) => candidate.id === allocation.owed_item_id)
        return !item || allocation.amount > Number(item.amount_remaining) + 0.0001
      })
      if (invalidAllocation) {
        setError('Leftover allocation cannot exceed the selected owed item remaining amount.')
        return
      }
    }
    setError(null)
    setMessage(null)
    setIsCreatingOwedItem(true)
    try {
      const result = await createOwedSplitForTransaction(
        owedDraftTransaction.id,
        buildExistingTransactionOwedSplitPayload({
          rows: parsedRows,
          paymentAvailableAmounts: owedPaymentAvailableAmounts,
        }),
      )

      setMessage(
        result.payments_created > 0
          ? `${result.owed_items_created} owed item${
              result.owed_items_created === 1 ? '' : 's'
            } created and ${result.payments_created} payment${
              result.payments_created === 1 ? '' : 's'
            } recorded.`
          : `${result.owed_items_created} owed item${
              result.owed_items_created === 1 ? '' : 's'
            } created.`,
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
  const displayTransactions = getTransactionsForDisplay(
    transactions, selectedMonth, filters.showFullyOwed,
  )

  const viewProps = {
    direction, error, message, filters, categoryOptions, form, editForm,
    transactions: displayTransactions,
    editingTransaction, deleteDraftTransaction, owedDraftTransaction,
    isCreateFormOpen, isCreateOwedEnabled, createOwedRows, owedPersonOptions,
    isCreateRepaymentEnabled, repaymentPerson, repaymentPersonOptions,
    repaymentItems, repaymentAllocations, repaymentUnallocatedCategory,
    isSavingEdit, isDeletingTransaction, owedRows, owedPaymentTransactions,
    owedPaymentAvailableAmounts, owedLeftoverItemsByPerson, isCreatingOwedItem,
    onDirectionChange: setDirection,
    onExportCsv: handleExportCsv,
    onResetCreateForm: resetCreateFormState,
    onSetCreateFormOpen: setIsCreateFormOpen,
    onSetDeleteDraftTransaction: setDeleteDraftTransaction,
    onFilterChange: updateFilters,
    onApplyFilters: () => loadTransactions(),
    onClearFilters: clearFilters,
    onCreateSubmit: handleCreateTransactionSubmit,
    onFormChange: updateForm,
    onToggleCreateOwed: toggleCreateOwedEnabled,
    onAddCreateOwedRow: addCreateOwedRow,
    onRemoveCreateOwedRow: removeCreateOwedRow, onUpdateCreateOwedRow: updateCreateOwedRow,
    onToggleCreateRepayment: toggleCreateRepaymentEnabled,
    onRepaymentPersonChange: updateRepaymentPerson,
    onRepaymentAllocationChange: updateRepaymentAllocation,
    onRepaymentUnallocatedCategoryChange: setRepaymentUnallocatedCategory,
    onStartEdit: handleStartEdit, onDelete: handleDeleteTransaction,
    onMarkOwed: openOwedDialog,
    onEditFormChange: updateEditForm,
    onSaveEdit: saveEditFromForm,
    onCancelEdit: cancelEdit,
    onCancelDelete: () => setDeleteDraftTransaction(null),
    onConfirmDelete: confirmDeleteTransaction,
    onCloseOwedDialog: closeOwedDialog,
    onAddOwedRow: addOwedRow, onRemoveOwedRow: removeOwedRow,
    onUpdateOwedRow: updateOwedRow,
    onOwedLeftoverAllocationChange: updateOwedLeftoverAllocation,
    onCreateOwedItems: createOwedItemsFromDialog,
    getRemainingOwedAmount,
    getSelectedOwedPaymentTransaction,
  }

  return <TransactionsPageView {...viewProps} />
}
