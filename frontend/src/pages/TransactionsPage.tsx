import { useEffect, useState, type FormEvent } from 'react'
import { createOwedItem, createOwedPayment, listOwedItems, listOwedPayments } from '../api/owed'
import { createTransaction, deleteTransaction, exportTransactionsCsv, listTransactions, updateTransaction } from '../api/transactions'
import { TransactionFilters, type TransactionFilterState } from '../components/TransactionFilters'
import { TransactionForm, type TransactionFormState } from '../components/TransactionForm'
import { CATEGORY_OPTIONS } from '../constants/categories'
import { TransactionTable, type TransactionTableRow } from '../components/TransactionTable'
import { TransactionDeleteDialog } from '../components/transactions/TransactionDeleteDialog'
import { TransactionOwedSplitDialog, type OwedSplitRowState } from '../components/transactions/TransactionOwedSplitDialog'
import { TransactionCreateOwedSection } from '../components/transactions/TransactionCreateOwedSection'
import { TransactionCreateRepaymentSection } from '../components/transactions/TransactionCreateRepaymentSection'
import { TransactionEditDialog } from '../components/transactions/TransactionEditDialog'
import { StatusMessage } from '../components/StatusMessage'
import { usePeriod } from '../context/PeriodContext'
import type { Direction, OwedItem, Transaction } from '../types/api'
import { formatMoney } from '../utils/format'
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
  const [owedPaymentAvailableAmounts, setOwedPaymentAvailableAmounts] = useState<Record<number, string>>({})
  const [isCreatingOwedItem, setIsCreatingOwedItem] = useState(false)
  const [owedRows, setOwedRows] = useState<OwedSplitRowState[]>([])
  const [owedLeftoverItemsByPerson, setOwedLeftoverItemsByPerson] = useState<Record<string, OwedItem[]>>({})
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
      let createdCount = 0
      let paymentCount = 0

      const rowsByPerson = new Map<string, typeof parsedRows>()

      for (const row of parsedRows) {
        rowsByPerson.set(row.person, [...(rowsByPerson.get(row.person) ?? []), row])
      }

      for (const [person, personRows] of rowsByPerson.entries()) {
        const personAmount = personRows.reduce((total, row) => total + row.amount, 0)
        const owedItem = await createOwedItem({
          person,
          amount_total: personAmount.toFixed(2),
          amount_paid: '0.00',
          reason: owedDraftTransaction.description,
          status: 'open',
          due_date: null,
          linked_transaction_id: owedDraftTransaction.id,
          notes: null,
        })

        createdCount += 1

        let remainingPersonAmount = personAmount

        for (const row of personRows) {
          if (!row.linkedPaymentTransaction || remainingPersonAmount <= 0) {
            continue
          }

          const paymentAmount = Number(owedPaymentAvailableAmounts[row.linkedPaymentTransaction.id] ?? row.linkedPaymentTransaction.amount)
          const allocationAmount = Math.min(paymentAmount, row.amount, remainingPersonAmount)
          const extraAllocations = Object.entries(row.leftoverAllocations)
            .map(([owedItemId, amount]) => ({ owed_item_id: Number(owedItemId), amount: parseMoneyInput(amount) }))
            .filter((allocation) => allocation.amount > 0 && !Number.isNaN(allocation.amount))
          const extraAllocationAmount = extraAllocations.reduce((total, allocation) => total + allocation.amount, 0)
          const leftoverAmount = Math.max(paymentAmount - allocationAmount - extraAllocationAmount, 0)
          const allocations = [
            ...(allocationAmount > 0 ? [{ owed_item_id: owedItem.id, amount: allocationAmount.toFixed(2) }] : []),
            ...extraAllocations.map((allocation) => ({
              owed_item_id: allocation.owed_item_id,
              amount: allocation.amount.toFixed(2),
            })),
          ]

          await createOwedPayment({
            person,
            amount: paymentAmount.toFixed(2),
            payment_date: row.linkedPaymentTransaction.date,
            method: 'bank_transfer',
            currency: row.linkedPaymentTransaction.currency || 'EUR',
            notes: null,
            linked_transaction_id: row.linkedPaymentTransaction.id,
            unallocated_category: leftoverAmount > 0 ? row.unallocatedCategory || null : null,
            unallocated_notes: leftoverAmount > 0 ? row.unallocatedNotes || null : null,
            allocations: allocations.length > 0 ? allocations : undefined,
          })

          remainingPersonAmount -= allocationAmount
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
  const displayTransactions = getTransactionsForDisplay(transactions, selectedMonth, filters.showFullyOwed)
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

      <TransactionTable
        transactions={displayTransactions}
        onEdit={handleStartEdit}
        onDelete={handleDeleteTransaction}
        onMarkOwed={direction === 'out' ? openOwedDialog : undefined}
      />

      {editingTransaction && (
        <TransactionEditDialog
          transaction={editingTransaction}
          form={editForm}
          categoryOptions={categoryOptions}
          isSaving={isSavingEdit}
          onChange={updateEditForm}
          onSave={saveEditFromForm}
          onCancel={cancelEdit}
        />
      )}

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
          paymentAvailableAmounts={owedPaymentAvailableAmounts}
          isCreating={isCreatingOwedItem}
          onClose={closeOwedDialog}
          onAddRow={addOwedRow}
          onRemoveRow={removeOwedRow}
          onUpdateRow={updateOwedRow}
          onLeftoverAllocationChange={updateOwedLeftoverAllocation}
          leftoverItemsByPerson={owedLeftoverItemsByPerson}
          onCreate={createOwedItemsFromDialog}
          getRemainingOwedAmount={getRemainingOwedAmount}
          getSelectedPaymentTransaction={getSelectedOwedPaymentTransaction}
        />
      )}
    </section>
  )
}
