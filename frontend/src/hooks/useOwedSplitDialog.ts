import { useState } from 'react'
import { listOwedItems, listOwedPayments } from '../api/owed'
import { createOwedSplitForTransaction, listTransactions } from '../api/transactions'
import type { TransactionTableRow } from '../components/TransactionTable'
import type { OwedSplitRowState } from '../components/transactions/TransactionOwedSplitDialog'
import type { OwedItem, Transaction } from '../types/api'
import { formatMoney } from '../utils/format'
import { buildExistingTransactionOwedSplitPayload } from '../utils/transactionFinancialCommandPayloads'
import {
  createOwedSplitRow,
  getAvailablePaymentTransactions,
  getMonthDateRange,
  getRemainingOwedAmount,
  parseMoneyInput,
} from '../utils/transactionPageHelpers'

/**
 * State and handlers for the "mark as owed" split dialog on
 * `TransactionsPage`. Split out (which was approaching the project's
 * 900-line soft limit) into its own hook — this dialog's state (the
 * draft transaction, its owed rows, linked Money In options, and
 * per-person leftover items) is only ever touched together.
 */
export function useOwedSplitDialog({
  filters,
  monthKey,
  onError,
  onMessage,
  reloadTransactions,
}: {
  filters: { month: string; dateFrom: string; dateTo: string }
  monthKey: string
  onError: (message: string | null) => void
  onMessage: (message: string | null) => void
  reloadTransactions: () => void
}) {
  const [owedDraftTransaction, setOwedDraftTransaction] = useState<TransactionTableRow | null>(null)
  const [owedPaymentTransactions, setOwedPaymentTransactions] = useState<Transaction[]>([])
  const [owedPaymentAvailableAmounts, setOwedPaymentAvailableAmounts] = useState<Record<number, string>>({})
  const [isCreatingOwedItem, setIsCreatingOwedItem] = useState(false)
  const [owedRows, setOwedRows] = useState<OwedSplitRowState[]>([])
  const [owedLeftoverItemsByPerson, setOwedLeftoverItemsByPerson] = useState<Record<string, OwedItem[]>>({})

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
        onError(caughtError instanceof Error ? caughtError.message : 'Failed to load money in options')
      })
  }

  function openOwedDialog(transaction: TransactionTableRow) {
    const remainingOwedAmount = getRemainingOwedAmount(transaction)

    onError(null)
    onMessage(null)
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
        onError(caughtError instanceof Error ? caughtError.message : 'Failed to load other owed items for this person')
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
      onError('Add at least one owed person.')
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
      onError('Each owed person needs a name and a positive owed amount.')
      return
    }

    const totalOwedAmount = parsedRows.reduce((total, row) => total + row.amount, 0)
    const remainingOwedAmount = getRemainingOwedAmount(owedDraftTransaction)

    if (totalOwedAmount > remainingOwedAmount + 0.0001) {
      onError(
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
        onError('Leftover allocations cannot exceed the selected Money In leftover amount.')
        return
      }

      const invalidAllocation = leftoverAllocations.find((allocation) => {
        const item = availableItems.find((candidate) => candidate.id === allocation.owed_item_id)
        return !item || allocation.amount > Number(item.amount_remaining) + 0.0001
      })
      if (invalidAllocation) {
        onError('Leftover allocation cannot exceed the selected owed item remaining amount.')
        return
      }
    }
    onError(null)
    onMessage(null)
    setIsCreatingOwedItem(true)
    try {
      const result = await createOwedSplitForTransaction(
        owedDraftTransaction.id,
        buildExistingTransactionOwedSplitPayload({
          rows: parsedRows,
          paymentAvailableAmounts: owedPaymentAvailableAmounts,
        }),
      )

      onMessage(
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
      reloadTransactions()
    } catch (caughtError: unknown) {
      onError(caughtError instanceof Error ? caughtError.message : 'Failed to create owed split')
    } finally {
      setIsCreatingOwedItem(false)
    }
  }

  return {
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
  }
}
