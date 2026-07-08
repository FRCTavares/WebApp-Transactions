import type { TransactionFilterState } from '../components/TransactionFilters'
import type { TransactionFormState } from '../components/TransactionForm'
import type { TransactionTableRow } from '../components/TransactionTable'
import type { OwedSplitRowState } from '../components/transactions/TransactionOwedSplitDialog'
import type { CashflowType, Direction, OwedItem, OwedPayment, Transaction } from '../types/api'

export function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

export function getDefaultDateForMonth(monthKey: string) {
  const today = getTodayDate()
  const todayMonth = today.slice(0, 7)

  if (monthKey === todayMonth) {
    return today
  }

  const [, , todayDayText] = today.split('-')
  const [year, monthNumber] = monthKey.split('-').map(Number)
  const todayDay = Number(todayDayText)
  const lastDay = new Date(year, monthNumber, 0).getDate()
  const selectedDay = Math.min(todayDay, lastDay)

  return `${monthKey}-${String(selectedDay).padStart(2, '0')}`
}

export function getMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, monthNumber - 1, 1)

  return date.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  })
}

export function getDefaultCashflowType(direction: Direction): CashflowType {
  return direction === 'in' ? 'income' : 'expense'
}

export function getInitialFormState(
  direction: Direction,
  selectedMonth = getTodayDate().slice(0, 7),
): TransactionFormState {
  return {
    date: getDefaultDateForMonth(selectedMonth),
    description: '',
    amount: '',
    cashflow_type: getDefaultCashflowType(direction),
    category: '',
    notes: '',
  }
}

export function getInitialFilterState(direction: Direction): TransactionFilterState {
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

export function getFormStateFromTransaction(transaction: Transaction): TransactionFormState {
  return {
    date: transaction.date,
    description: transaction.description,
    amount: transaction.amount,
    cashflow_type: transaction.cashflow_type,
    category: transaction.category ?? '',
    notes: transaction.notes ?? '',
  }
}

export function isTrading212Cashback(transaction: Transaction) {
  return (
    transaction.direction === 'in' &&
    transaction.source === 'trading212' &&
    transaction.description.toLowerCase() === 'spending cashback'
  )
}

export function getMonthEndDate(month: string) {
  const [year, monthNumber] = month.split('-').map(Number)
  return new Date(year, monthNumber, 0).toISOString().slice(0, 10)
}

export function getOwedSortRank(transaction: TransactionTableRow) {
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

export function sortTransactionsForDisplay(transactions: TransactionTableRow[]) {
  return [...transactions].sort((first, second) => {
    const owedRankDifference = getOwedSortRank(first) - getOwedSortRank(second)

    if (owedRankDifference !== 0) {
      return owedRankDifference
    }

    return second.date.localeCompare(first.date)
  })
}

export function getTransactionsForDisplay(
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

export function getMonthDateRange(month: string) {
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

export function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = objectUrl
  link.download = filename
  link.click()

  URL.revokeObjectURL(objectUrl)
}

export function getExportFilename(direction: Direction) {
  return direction === 'in' ? 'money-in-transactions.csv' : 'money-out-transactions.csv'
}

export function createOwedSplitRow({
  amount = '',
  notes = '',
  person = 'Mother',
}: {
  amount?: string
  notes?: string
  person?: string
} = {}): OwedSplitRowState {
  return {
    id: `${Date.now()}-${Math.random()}`,
    person,
    amount,
    linkedPaymentTransactionId: '',
    leftoverAllocations: {},
    unallocatedCategory: '',
    unallocatedNotes: '',
    notes,
  }
}

export function parseMoneyInput(value: string) {
  return Math.abs(Number(value.replace(',', '.')))
}

export type ParsedCreateOwedRow = {
  person: string
  amount: number
}

export type ParsedRepaymentAllocation = {
  owed_item_id: number
  amount: number
}

export function getRankedTransactionCategories(
  transactions: Transaction[],
  fallbackCategories: string[] = [],
) {
  const countsByCategory = new Map<string, { category: string; count: number }>()

  for (const category of fallbackCategories) {
    const trimmedCategory = category.trim()

    if (!trimmedCategory) {
      continue
    }

    countsByCategory.set(trimmedCategory.toLowerCase(), {
      category: trimmedCategory,
      count: 0,
    })
  }

  for (const transaction of transactions) {
    const category = transaction.category?.trim()

    if (!category) {
      continue
    }

    const key = category.toLowerCase()
    const current = countsByCategory.get(key)

    countsByCategory.set(key, {
      category: current?.category ?? category,
      count: (current?.count ?? 0) + 1,
    })
  }

  return Array.from(countsByCategory.values())
    .sort((first, second) => {
      const countDifference = second.count - first.count

      if (countDifference !== 0) {
        return countDifference
      }

      return first.category.localeCompare(second.category)
    })
    .map((entry) => entry.category)
}

export function getRankedOwedPeople(items: OwedItem[]) {
  const totalsByPerson = new Map<string, { person: string; total: number }>()

  for (const item of items) {
    const person = item.person.trim()

    if (!person) {
      continue
    }

    const key = person.toLowerCase()
    const current = totalsByPerson.get(key)
    const amount = Number(item.amount_total)

    totalsByPerson.set(key, {
      person: current?.person ?? person,
      total: (current?.total ?? 0) + (Number.isNaN(amount) ? 0 : amount),
    })
  }

  return Array.from(totalsByPerson.values())
    .sort((first, second) => {
      const amountDifference = second.total - first.total

      if (amountDifference !== 0) {
        return amountDifference
      }

      return first.person.localeCompare(second.person)
    })
    .map((entry) => entry.person)
}

export function getRemainingOwedAmount(transaction: TransactionTableRow) {
  const transactionAmount = Number(transaction.amount)
  const linkedOwedAmount = Number(transaction.owed_amount_total ?? '0')

  return Math.max(transactionAmount - linkedOwedAmount, 0)
}

export function getAvailablePaymentTransactions(
  transactions: Transaction[],
  payments: OwedPayment[],
) {
  const usedAmountByTransactionId = new Map<number, number>()

  for (const payment of payments) {
    if (payment.linked_transaction_id === null) {
      continue
    }

    usedAmountByTransactionId.set(
      payment.linked_transaction_id,
      (usedAmountByTransactionId.get(payment.linked_transaction_id) ?? 0) + Number(payment.amount),
    )
  }

  const availableAmountsById: Record<number, string> = {}

  const availableTransactions = transactions.filter((transaction) => {
    const usedAmount = usedAmountByTransactionId.get(transaction.id) ?? 0
    const availableAmount = Math.max(Number(transaction.amount) - usedAmount, 0)

    if (availableAmount <= 0.0001) {
      return false
    }

    availableAmountsById[transaction.id] = availableAmount.toFixed(2)
    return true
  })

  return {
    availableTransactions,
    availableAmountsById,
  }
}

