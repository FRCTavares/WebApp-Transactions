import type { Transaction } from '../types/api'

export function getTransactionOwedAmount(transaction: Transaction) {
  return Number(transaction.owed_amount_total ?? 0)
}

export function getTransactionPersonalAmount(transaction: Transaction) {
  return Number(transaction.amount) - getTransactionOwedAmount(transaction)
}

export function isFullyOwedTransaction(transaction: Transaction) {
  const transactionAmount = Number(transaction.amount)
  const owedAmount = getTransactionOwedAmount(transaction)

  return (
    transaction.direction === 'out'
    && transaction.is_owed
    && transactionAmount > 0
    && owedAmount >= transactionAmount - 0.0001
  )
}

/** Signed personal amount for a recent-activity row: negative for spending. */
export function getRecentTransactionAmount(transaction: Transaction) {
  const personal = getTransactionPersonalAmount(transaction)

  return transaction.direction === 'out' ? -personal : personal
}

export function getReasonText(transaction: Transaction) {
  if (transaction.notes) {
    return transaction.notes
  }

  if (
    transaction.raw_description
    && transaction.raw_description !== transaction.description
  ) {
    return transaction.raw_description
  }

  return transaction.description
}

/**
 * The reason line only earns its space when it says something the description
 * does not. With no notes and a raw_description equal to the description, the
 * fallback above returns the description itself, which rendered every recent
 * transaction twice ("Prenda de Anos Ze / Prenda de Anos Ze").
 */
export function getSecondaryReasonText(transaction: Transaction) {
  const reason = getReasonText(transaction)

  return reason === transaction.description ? null : reason
}

export function getCategoryLabel(transaction: Transaction) {
  return transaction.category || 'Uncategorised'
}
