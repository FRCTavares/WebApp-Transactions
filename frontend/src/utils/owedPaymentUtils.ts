import type { OwedItem, OwedPaymentMethod, Transaction } from '../types/api'
import { formatMoney } from './format'

/**
 * Pure helpers for the "Record payment" modal on `OwedPage`. Split out
 * (along with the modal's JSX, see `RecordPaymentModal.tsx`) to keep
 * `OwedPage.tsx` under the project's 900-line soft limit.
 */

export type PaymentFormState = {
  person: string
  amount: string
  paymentDate: string
  method: OwedPaymentMethod
  allocationStopBeforeId: string
  linkedTransactionId: string
  unallocatedCategory: string
  unallocatedNotes: string
  allocationAmounts: Record<string, string>
  notes: string
}

export const UNALLOCATED_CATEGORY_OPTIONS = [
  { value: '', label: 'Not income / leave unclassified' },
  { value: 'Allowance', label: 'Allowance' },
  { value: 'Gift', label: 'Gift' },
  { value: 'Income', label: 'Income' },
  { value: 'Other', label: 'Other / not counted as income' },
]

export function getTodayDate() {
  return new Date().toISOString().slice(0, 10)
}

export function getInitialPaymentFormState(): PaymentFormState {
  return {
    person: '',
    amount: '',
    paymentDate: getTodayDate(),
    method: 'cash',
    allocationStopBeforeId: '',
    linkedTransactionId: '',
    unallocatedCategory: '',
    unallocatedNotes: '',
    allocationAmounts: {},
    notes: '',
  }
}

export function normalizePersonName(person: string) {
  return person.trim().replace(/\s+/g, ' ')
}

export function getPersonKey(person: string) {
  return normalizePersonName(person).toLocaleLowerCase()
}

export function comparePersonLabels(first: string, second: string) {
  const startsWithCapital = (name: string) => {
    const firstCharacter = name.charAt(0)
    return firstCharacter !== firstCharacter.toLocaleLowerCase()
  }
  const rankDifference = Number(!startsWithCapital(first)) - Number(!startsWithCapital(second))

  return rankDifference || first.localeCompare(second)
}

export function getPaymentPeople(items: OwedItem[]) {
  const peopleByKey = new Map<string, string>()

  for (const item of items) {
    if (item.status !== 'open' && item.status !== 'partially_paid') {
      continue
    }

    const name = normalizePersonName(item.person)
    const key = getPersonKey(name)
    const currentName = peopleByKey.get(key)

    // Prefer a tidily capitalized label when legacy values only vary by case.
    if (!currentName || comparePersonLabels(name, currentName) < 0) {
      peopleByKey.set(key, name)
    }
  }

  return Array.from(peopleByKey.values()).sort((first, second) => first.localeCompare(second))
}

export function getAutoAllocationPreview(
  items: OwedItem[],
  person: string,
  amount: number,
  stopBeforeId = '',
) {
  let remaining = amount
  const allocationItems = getPaymentAllocationItems(items, person)
  const stopIndex = stopBeforeId
    ? allocationItems.findIndex((item) => item.id === Number(stopBeforeId))
    : -1
  const eligibleItems = stopIndex >= 0
    ? allocationItems.slice(0, stopIndex)
    : allocationItems

  return eligibleItems
    .map((item) => {
      const allocationAmount = Math.min(remaining, Number(item.amount_remaining))
      remaining -= allocationAmount

      return {
        item,
        amount: allocationAmount,
      }
    })
    .filter((allocation) => allocation.amount > 0)
}

export function getPaymentAllocationItems(items: OwedItem[], person: string) {
  return items
    .filter((item) => getPersonKey(item.person) === getPersonKey(person))
    .filter((item) => item.status === 'open' || item.status === 'partially_paid')
    .toSorted((first, second) => (
      first.created_at.localeCompare(second.created_at) || first.id - second.id
    ))
}

export function getManualPaymentAllocations(paymentForm: PaymentFormState) {
  return Object.entries(paymentForm.allocationAmounts)
    .map(([owedItemId, amount]) => ({
      owed_item_id: Number(owedItemId),
      amount: Math.abs(Number(amount.replace(',', '.'))),
    }))
    .filter((allocation) => (
      Number.isInteger(allocation.owed_item_id) &&
      allocation.owed_item_id > 0 &&
      allocation.amount > 0 &&
      !Number.isNaN(allocation.amount)
    ))
    .map((allocation) => ({
      owed_item_id: allocation.owed_item_id,
      amount: allocation.amount.toFixed(2),
    }))
}

export function getManualAllocationTotal(paymentForm: PaymentFormState) {
  return getManualPaymentAllocations(paymentForm).reduce(
    (total, allocation) => total + Number(allocation.amount),
    0,
  )
}

export function getAllocationTotal(allocations: Array<{ amount: number }>) {
  return allocations.reduce((total, allocation) => total + allocation.amount, 0)
}

export function formatLinkedTransactionOption(transaction: Transaction) {
  return `#${transaction.id} | ${transaction.date} | ${transaction.description} | ${formatMoney(
    transaction.amount,
    transaction.currency,
  )}`
}
