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
    linkedTransactionId: '',
    unallocatedCategory: '',
    unallocatedNotes: '',
    allocationAmounts: {},
    notes: '',
  }
}

export function getPaymentPeople(items: OwedItem[]) {
  return Array.from(new Set(
    items
      .filter((item) => item.status === 'open' || item.status === 'partially_paid')
      .map((item) => item.person),
  )).sort((first, second) => first.localeCompare(second))
}

export function getAutoAllocationPreview(items: OwedItem[], person: string, amount: number) {
  let remaining = amount

  return items
    .filter((item) => item.person === person)
    .filter((item) => item.status === 'open' || item.status === 'partially_paid')
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
    .filter((item) => item.person === person)
    .filter((item) => item.status === 'open' || item.status === 'partially_paid')
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
