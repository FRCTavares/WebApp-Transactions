import { TransactionsPageView } from '../components/transactions/TransactionsPageView'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  createTransactionWithOwed,
  deleteTransaction,
  deleteTransactionWithLinkedOwed,
  exportTransactionsCsv,
  getTransactionDeletionPreview,
  listTransactions,
  updateTransaction,
} from '../api/transactions'
import type { TransactionFilterState } from '../components/TransactionFilters'
import type { TransactionFormState } from '../components/TransactionForm'
import { listTransactionCategories } from '../api/transactionCategories'
import { usePeriod } from '../hooks/usePeriod'
import { useOwedSplitDialog } from '../hooks/useOwedSplitDialog'
import { useCreateOwedAndRepayment } from '../hooks/useCreateOwedAndRepayment'
import type {
  Direction,
  Transaction,
  TransactionCategory,
  TransactionDeletionPreview,
  TransactionLinkedOwedDeletionStrategy,
} from '../types/api'
import { buildCreateTransactionWithOwedPayload } from '../utils/transactionFinancialCommandPayloads'
import {
  downloadBlob,
  getExportFilename,
  getFormStateFromTransaction,
  getInitialFilterState,
  getInitialFormState,
  getMonthDateRange,
  getRemainingOwedAmount,
  getTransactionsForDisplay,
} from '../utils/transactionPageHelpers'
import { buildTransactionFilterUrl, getFiltersFromUrl } from '../utils/transactionFilterUrl'

export function TransactionsPage() {
  const { monthKey } = usePeriod()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialSearchParamsRef = useRef(searchParams)
  const deletePreviewRequestIdRef = useRef(0)
  const [direction, setDirection] = useState<Direction>(() =>
    searchParams.get('direction') === 'in' ? 'in' : 'out',
  )
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [filters, setFilters] = useState<TransactionFilterState>(() =>
    getFiltersFromUrl(searchParams),
  )
  const [form, setForm] = useState<TransactionFormState>(() => getInitialFormState(direction, monthKey))
  const [editForm, setEditForm] = useState<TransactionFormState>(() => getInitialFormState(direction, monthKey))
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dataWarning, setDataWarning] = useState<string | null>(null)
  const [isTransactionsLoading, setIsTransactionsLoading] = useState(true)
  const [categoryOptions, setCategoryOptions] = useState<TransactionCategory[]>([])
  const [deleteDraftTransaction, setDeleteDraftTransaction] = useState<Transaction | null>(null)
  const [deletePreview, setDeletePreview] = useState<TransactionDeletionPreview | null>(null)
  const [deletePreviewError, setDeletePreviewError] = useState<string | null>(null)
  const [isDeletePreviewLoading, setIsDeletePreviewLoading] = useState(false)
  const [isDeletingTransaction, setIsDeletingTransaction] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  const {
    isCreateOwedEnabled,
    createOwedRows,
    owedPersonOptions,
    isCreateRepaymentEnabled,
    repaymentPerson,
    repaymentPersonOptions,
    repaymentItems,
    repaymentAllocations,
    repaymentUnallocatedCategory,
    setRepaymentUnallocatedCategory,
    resetCreateOwedAndRepaymentState,
    toggleCreateOwedEnabled,
    updateCreateOwedRow,
    addCreateOwedRow,
    removeCreateOwedRow,
    toggleCreateRepaymentEnabled,
    updateRepaymentPerson,
    updateRepaymentAllocation,
    getParsedCreateRepaymentAllocations,
    getParsedCreateOwedRows,
  } = useCreateOwedAndRepayment({
    direction,
    onWarning: (warning) => setDataWarning(warning),
    onError: setError,
  })

  const {
    owedDraftTransaction,
    owedPaymentTransactions,
    owedPaymentAvailableAmounts,
    isCreatingOwedItem,
    owedRows,
    owedLeftoverItemsByPerson,
    openOwedDialog,
    closeOwedDialog,
    updateOwedRow,
    updateOwedLeftoverAllocation,
    addOwedRow,
    removeOwedRow,
    getSelectedOwedPaymentTransaction,
    createOwedItemsFromDialog,
  } = useOwedSplitDialog({
    filters,
    monthKey,
    onError: setError,
    onMessage: setMessage,
    reloadTransactions: () => loadTransactions(),
  })

  function loadTransactions(activeFilters = filters) {
    setError(null)
    setIsTransactionsLoading(true)

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
      .finally(() => {
        setIsTransactionsLoading(false)
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
      const initialFilters = getFiltersFromUrl(initialSearchParamsRef.current)
      const monthDateRange = getMonthDateRange(monthKey)

      setForm(getInitialFormState(direction, monthKey))
      setEditForm(getInitialFormState(direction, monthKey))
      setFilters(initialFilters)
      setError(null)
      setDataWarning(null)
      setIsTransactionsLoading(true)
      setEditingTransaction(null)
      setIsCreateFormOpen(false)
      deletePreviewRequestIdRef.current += 1
      setDeleteDraftTransaction(null)
      setDeletePreview(null)
      setDeletePreviewError(null)
      setIsDeletePreviewLoading(false)
      resetCreateOwedAndRepaymentState()

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
        .finally(() => {
          setIsTransactionsLoading(false)
        })

      listTransactionCategories({ active_only: true, limit: 500 })
        .then(setCategoryOptions)
        .catch(() => {
          setDataWarning('Category options could not be refreshed.')
        })
    }, 0)

    return () => window.clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, monthKey])

  function updateForm(field: keyof TransactionFormState, value: string) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }))
  }

  function resetCreateFormState() {
    setForm(getInitialFormState(direction, monthKey))
    resetCreateOwedAndRepaymentState()
  }

  function loadCategoryOptions() {
    listTransactionCategories({ active_only: true, limit: 500 })
      .then(setCategoryOptions)
      .catch(() => {
        setDataWarning('Category options could not be refreshed.')
      })
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
    setSearchParams(direction === 'in' ? { direction: 'in' } : {}, { replace: true })
    loadTransactions(initialFilters)
  }

  function applyFilters() {
    const nextParams = buildTransactionFilterUrl(filters, direction)
    setSearchParams(nextParams, { replace: true })
    loadTransactions(filters)
  }

  function changeDirection(nextDirection: Direction) {
    setDirection(nextDirection)
    const nextParams = new URLSearchParams(searchParams)
    if (nextDirection === 'in') nextParams.set('direction', 'in')
    else nextParams.delete('direction')
    setSearchParams(nextParams, { replace: true })
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

  function closeDeleteDialog() {
    deletePreviewRequestIdRef.current += 1
    setDeleteDraftTransaction(null)
    setDeletePreview(null)
    setDeletePreviewError(null)
    setIsDeletePreviewLoading(false)
  }

  async function handleDeleteTransaction(transaction: Transaction) {
    const requestId = deletePreviewRequestIdRef.current + 1
    deletePreviewRequestIdRef.current = requestId

    setDeleteDraftTransaction(transaction)
    setDeletePreview(null)
    setDeletePreviewError(null)
    setIsDeletePreviewLoading(true)
    setError(null)
    setMessage(null)

    try {
      const preview = await getTransactionDeletionPreview(
        transaction.id,
      )

      if (deletePreviewRequestIdRef.current !== requestId) {
        return
      }

      setDeletePreview(preview)
    } catch (caughtError: unknown) {
      if (deletePreviewRequestIdRef.current !== requestId) {
        return
      }

      setDeletePreviewError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to inspect linked owed records',
      )
    } finally {
      if (deletePreviewRequestIdRef.current === requestId) {
        setIsDeletePreviewLoading(false)
      }
    }
  }

  async function confirmDeleteTransaction(
    strategy: TransactionLinkedOwedDeletionStrategy | null,
    replacementPerson: string | null,
  ) {
    if (
      !deleteDraftTransaction ||
      !deletePreview ||
      isDeletingTransaction
    ) {
      return
    }

    if (
      !deletePreview.normal_delete_allowed &&
      strategy === null
    ) {
      setDeletePreviewError(
        'Choose how to handle the linked owed obligations.',
      )
      return
    }

    if (
      strategy === 'preserve_owed' &&
      !replacementPerson?.trim()
    ) {
      setDeletePreviewError(
        'Choose who should owe you after deletion.',
      )
      return
    }

    setError(null)
    setMessage(null)
    setDeletePreviewError(null)
    setIsDeletingTransaction(true)

    try {
      if (deletePreview.normal_delete_allowed) {
        await deleteTransaction(deleteDraftTransaction.id)
        setMessage('Transaction deleted.')
      } else if (strategy !== null) {
        await deleteTransactionWithLinkedOwed(
          deleteDraftTransaction.id,
          {
            strategy,
            expected_owed_item_ids:
              deletePreview.linked_owed_items.map(
                (item) => item.id,
              ),
            expected_relationship_version:
              deletePreview.relationship_version,
            ...(strategy === 'preserve_owed'
              ? {
                  replacement_person:
                    replacementPerson?.trim() ?? '',
                }
              : {}),
          },
        )

        setMessage(
          strategy === 'preserve_owed'
            ? 'Transaction deleted and owed obligations preserved.'
            : 'Transaction and linked owed obligations deleted.',
        )
      }

      if (editingTransaction?.id === deleteDraftTransaction.id) {
        setEditingTransaction(null)
      }

      closeDeleteDialog()
      loadTransactions()
    } catch (caughtError: unknown) {
      setDeletePreviewError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to delete transaction',
      )
    } finally {
      setIsDeletingTransaction(false)
    }
  }

  const selectedMonth = filters.month || monthKey
  const displayTransactions = getTransactionsForDisplay(
    transactions, selectedMonth, filters.showFullyOwed,
  )

  const viewProps = {
    direction, error, message, dataWarning, isTransactionsLoading,
    filters, categoryOptions, form, editForm,
    transactions: displayTransactions,
    editingTransaction, deleteDraftTransaction, deletePreview,
    deletePreviewError, isDeletePreviewLoading, owedDraftTransaction,
    isCreateFormOpen, isCreateOwedEnabled, createOwedRows, owedPersonOptions,
    isCreateRepaymentEnabled, repaymentPerson, repaymentPersonOptions,
    repaymentItems, repaymentAllocations, repaymentUnallocatedCategory,
    isSavingEdit, isDeletingTransaction, owedRows, owedPaymentTransactions,
    owedPaymentAvailableAmounts, owedLeftoverItemsByPerson, isCreatingOwedItem,
    onDirectionChange: changeDirection,
    onExportCsv: handleExportCsv,
    onResetCreateForm: resetCreateFormState,
    onSetCreateFormOpen: setIsCreateFormOpen,
    onFilterChange: updateFilters,
    onApplyFilters: applyFilters,
    onClearFilters: clearFilters,
    onCreateSubmit: handleCreateTransactionSubmit,
    onFormChange: updateForm,
    onToggleCreateOwed: (isEnabled: boolean) => toggleCreateOwedEnabled(isEnabled, form.amount),
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
    onCancelDelete: closeDeleteDialog,
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
