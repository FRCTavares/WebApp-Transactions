import { useState } from 'react'
import { listOwedItems } from '../api/owed'
import type { OwedSplitRowState } from '../components/transactions/TransactionOwedSplitDialog'
import type { Direction, OwedItem } from '../types/api'
import { formatMoney } from '../utils/format'
import {
  createOwedSplitRow,
  getRankedOwedPeople,
  parseMoneyInput,
  type ParsedCreateOwedRow,
  type ParsedRepaymentAllocation,
} from '../utils/transactionPageHelpers'

/**
 * State and handlers for the two optional add-ons on the "new
 * transaction" form: splitting a Money Out transaction into owed items,
 * and allocating a Money In transaction against existing owed items as a
 * repayment. Split out of `TransactionsPage.tsx` (which was approaching
 * the project's 900-line soft limit) — these two features are only ever
 * touched together with the create form, never with the edit form or the
 * owed-split dialog.
 */
export function useCreateOwedAndRepayment({
  direction,
  onWarning,
  onError,
}: {
  direction: Direction
  onWarning: (message: string) => void
  onError: (message: string | null) => void
}) {
  const [isCreateOwedEnabled, setIsCreateOwedEnabled] = useState(false)
  const [createOwedRows, setCreateOwedRows] = useState<OwedSplitRowState[]>([])
  const [owedPersonOptions, setOwedPersonOptions] = useState<string[]>([])
  const [isCreateRepaymentEnabled, setIsCreateRepaymentEnabled] = useState(false)
  const [repaymentPerson, setRepaymentPerson] = useState('')
  const [repaymentPersonOptions, setRepaymentPersonOptions] = useState<string[]>([])
  const [repaymentItems, setRepaymentItems] = useState<OwedItem[]>([])
  const [repaymentAllocations, setRepaymentAllocations] = useState<Record<number, string>>({})
  const [repaymentUnallocatedCategory, setRepaymentUnallocatedCategory] = useState('')

  function resetCreateRepaymentState() {
    setIsCreateRepaymentEnabled(false)
    setRepaymentPerson('')
    setRepaymentPersonOptions([])
    setRepaymentItems([])
    setRepaymentAllocations({})
    setRepaymentUnallocatedCategory('')
  }

  function resetCreateOwedAndRepaymentState() {
    setIsCreateOwedEnabled(false)
    setCreateOwedRows([])
    resetCreateRepaymentState()
  }

  function loadOwedPersonOptions() {
    listOwedItems({ limit: 500 })
      .then((items) => {
        setOwedPersonOptions(getRankedOwedPeople(items))
      })
      .catch(() => {
        onWarning('Owed-person suggestions could not be refreshed.')
      })
  }

  function toggleCreateOwedEnabled(isEnabled: boolean, currentAmount: string) {
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
              amount: currentAmount,
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
        onWarning('Repayment-person suggestions could not be refreshed.')
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
        onError(caughtError instanceof Error ? caughtError.message : 'Failed to load owed items for payer')
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
      onError('Choose who paid you.')
      return null
    }

    const parsedAllocations = Object.entries(repaymentAllocations)
      .map(([owedItemId, amount]) => ({
        owed_item_id: Number(owedItemId),
        amount: parseMoneyInput(amount),
      }))
      .filter((allocation) => allocation.amount > 0 && !Number.isNaN(allocation.amount))

    if (parsedAllocations.length === 0) {
      onError('Allocate this Money In to at least one owed item.')
      return null
    }

    const allocationTotal = parsedAllocations.reduce(
      (total, allocation) => total + allocation.amount,
      0,
    )

    if (allocationTotal > transactionAmount + 0.0001) {
      onError('Allocated repayment amount cannot exceed the Money In amount.')
      return null
    }

    const invalidAllocation = parsedAllocations.find((allocation) => {
      const item = repaymentItems.find((candidate) => candidate.id === allocation.owed_item_id)

      return !item || allocation.amount > Number(item.amount_remaining) + 0.0001
    })

    if (invalidAllocation) {
      onError('Allocated amount cannot exceed the selected owed item remaining amount.')
      return null
    }

    return parsedAllocations
  }

  function getParsedCreateOwedRows(transactionAmount: number): ParsedCreateOwedRow[] | null {
    if (!isCreateOwedEnabled || direction !== 'out') {
      return []
    }

    if (createOwedRows.length === 0) {
      onError('Add at least one owed person.')
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
      onError('Each owed person needs a name and a positive owed amount.')
      return null
    }

    const totalOwedAmount = parsedRows.reduce((total, row) => total + row.amount, 0)

    if (totalOwedAmount > transactionAmount + 0.0001) {
      onError(
        `Total owed amount cannot exceed the transaction amount of ${formatMoney(
          transactionAmount.toFixed(2),
          'EUR',
        )}.`,
      )
      return null
    }

    return parsedRows
  }

  return {
    isCreateOwedEnabled,
    createOwedRows,
    owedPersonOptions,
    isCreateRepaymentEnabled,
    repaymentPerson,
    repaymentPersonOptions,
    repaymentItems,
    repaymentAllocations,
    repaymentUnallocatedCategory,
    setIsCreateOwedEnabled,
    setCreateOwedRows,
    setRepaymentUnallocatedCategory,
    resetCreateRepaymentState,
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
  }
}
