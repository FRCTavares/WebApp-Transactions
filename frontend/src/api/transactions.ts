import { apiDelete, apiGet, apiPatchJson, apiPostJson, buildQuery } from './client'
import type {
  Transaction,
  TransactionCreatePayload,
  TransactionFilters,
  TransactionUpdatePayload,
} from '../types/api'

export function listTransactions(filters: TransactionFilters = {}) {
  return apiGet<Transaction[]>(`/api/transactions${buildQuery(filters)}`)
}

export function createTransaction(payload: TransactionCreatePayload) {
  return apiPostJson<Transaction>('/api/transactions', payload)
}

export function updateTransaction(transactionId: number, payload: TransactionUpdatePayload) {
  return apiPatchJson<Transaction>(`/api/transactions/${transactionId}`, payload)
}

export function deleteTransaction(transactionId: number) {
  return apiDelete(`/api/transactions/${transactionId}`)
}
