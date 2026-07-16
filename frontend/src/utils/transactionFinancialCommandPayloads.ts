import type { TransactionFormState } from '../components/TransactionForm'
import type {
  Direction,
  ExistingTransactionOwedSplitCommandPayload,
  Transaction,
  TransactionCreateWithOwedCommandPayload,
} from '../types/api'
import {
  parseMoneyInput,
  type ParsedCreateOwedRow,
  type ParsedRepaymentAllocation,
} from './transactionPageHelpers'

type BuildCreateCommandOptions = {
  form: TransactionFormState
  direction: Direction
  amount: number
  owedRows: ParsedCreateOwedRow[]
  isRepaymentEnabled: boolean
  repaymentPerson: string
  repaymentAllocations: ParsedRepaymentAllocation[]
  repaymentUnallocatedCategory: string
}

type ParsedExistingOwedRow = {
  id: string
  person: string
  amount: number
  linkedPaymentTransactionId: string
  linkedPaymentTransaction: Transaction | null
  leftoverAllocations: Record<number, string>
  unallocatedCategory: string
  unallocatedNotes: string
  notes: string
}

type BuildExistingSplitOptions = {
  rows: ParsedExistingOwedRow[]
  paymentAvailableAmounts: Record<number, string>
}

export function buildCreateTransactionWithOwedPayload({
  form,
  direction,
  amount,
  owedRows,
  isRepaymentEnabled,
  repaymentPerson,
  repaymentAllocations,
  repaymentUnallocatedCategory,
}: BuildCreateCommandOptions): TransactionCreateWithOwedCommandPayload {
  const allocatedAmount = repaymentAllocations.reduce(
    (total, allocation) => total + allocation.amount,
    0,
  )
  const leftoverAmount = Math.max(amount - allocatedAmount, 0)

  return {
    transaction: {
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
    },
    owed_items: owedRows.map((row) => ({
      person: row.person,
      amount_total: row.amount.toFixed(2),
      amount_paid: '0.00',
      reason: form.description,
      status: 'open',
      due_date: null,
      notes: null,
    })),
    owed_payment:
      direction === 'in' && isRepaymentEnabled
        ? {
            person: repaymentPerson.trim(),
            amount: amount.toFixed(2),
            payment_date: form.date,
            method: 'bank_transfer',
            currency: 'EUR',
            notes: form.notes || null,
            unallocated_category:
              leftoverAmount > 0
                ? repaymentUnallocatedCategory || null
                : null,
            unallocated_notes: null,
            allocations: repaymentAllocations.map((allocation) => ({
              owed_item_id: allocation.owed_item_id,
              amount: allocation.amount.toFixed(2),
            })),
          }
        : null,
  }
}

export function buildExistingTransactionOwedSplitPayload({
  rows,
  paymentAvailableAmounts,
}: BuildExistingSplitOptions): ExistingTransactionOwedSplitCommandPayload {
  return {
    rows: rows.map((row) => {
      if (!row.linkedPaymentTransaction) {
        return {
          person: row.person,
          amount: row.amount.toFixed(2),
        }
      }

      const paymentTransaction = row.linkedPaymentTransaction
      const paymentAmount = Number(
        paymentAvailableAmounts[paymentTransaction.id]
          ?? paymentTransaction.amount,
      )
      const currentAllocationAmount = Math.min(
        paymentAmount,
        row.amount,
      )
      const extraAllocations = Object.entries(row.leftoverAllocations)
        .map(([owedItemId, allocationAmount]) => ({
          owed_item_id: Number(owedItemId),
          amount: parseMoneyInput(allocationAmount),
        }))
        .filter(
          (allocation) =>
            allocation.amount > 0
            && !Number.isNaN(allocation.amount),
        )
      const extraAllocationAmount = extraAllocations.reduce(
        (total, allocation) => total + allocation.amount,
        0,
      )
      const leftoverAmount = Math.max(
        paymentAmount
          - currentAllocationAmount
          - extraAllocationAmount,
        0,
      )

      return {
        person: row.person,
        amount: row.amount.toFixed(2),
        payment: {
          linked_transaction_id: paymentTransaction.id,
          payment_date: paymentTransaction.date,
          amount: paymentAmount.toFixed(2),
          currency: paymentTransaction.currency || 'EUR',
          method: 'bank_transfer',
          notes: null,
          unallocated_category:
            leftoverAmount > 0
              ? row.unallocatedCategory || null
              : null,
          unallocated_notes:
            leftoverAmount > 0
              ? row.unallocatedNotes || null
              : null,
          extra_allocations: extraAllocations.map((allocation) => ({
            owed_item_id: allocation.owed_item_id,
            amount: allocation.amount.toFixed(2),
          })),
        },
      }
    }),
  }
}
