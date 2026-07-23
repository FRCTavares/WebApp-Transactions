import { apiDelete, apiGet, apiGetBlob, apiPatchJson, apiPostJson, buildQuery } from './client'
import type {
  ExistingTransactionOwedSplitCommandPayload,
  ExistingTransactionOwedSplitResponse,
  Transaction,
  TransactionCreatePayload,
  TransactionCreateWithOwedCommandPayload,
  TransactionDeletionPreview,
  TransactionFilters,
  TransactionLinkedOwedDeletionPayload,
  TransactionLinkedOwedDeletionResponse,
  TransactionUpdatePayload,
} from '../types/api'

export function listTransactions(filters: TransactionFilters = {}) {
  return apiGet<Transaction[]>(`/api/transactions${buildQuery(filters)}`)
}

export function exportTransactionsCsv(filters: TransactionFilters = {}) {
  return apiGetBlob(`/api/transactions/export${buildQuery(filters)}`)
}

export function createTransaction(payload: TransactionCreatePayload) {
  return apiPostJson<Transaction>('/api/transactions', payload)
}

export function createTransactionWithOwed(
  payload: TransactionCreateWithOwedCommandPayload,
) {
  return apiPostJson<Transaction>(
    '/api/transactions/commands/create-with-owed',
    payload,
  )
}

export function createOwedSplitForTransaction(
  transactionId: number,
  payload: ExistingTransactionOwedSplitCommandPayload,
) {
  return apiPostJson<ExistingTransactionOwedSplitResponse>(
    `/api/transactions/${transactionId}/commands/create-owed-split`,
    payload,
  )
}

export function getTransactionDeletionPreview(
  transactionId: number,
) {
  return apiGet<TransactionDeletionPreview>(
    `/api/transactions/${transactionId}/deletion-preview`,
  )
}

export function deleteTransactionWithLinkedOwed(
  transactionId: number,
  payload: TransactionLinkedOwedDeletionPayload,
) {
  return apiPostJson<TransactionLinkedOwedDeletionResponse>(
    `/api/transactions/${transactionId}/commands/delete-linked-owed`,
    payload,
  )
}

export function updateTransaction(transactionId: number, payload: TransactionUpdatePayload) {
  return apiPatchJson<Transaction>(`/api/transactions/${transactionId}`, payload)
}

export function deleteTransaction(transactionId: number) {
  return apiDelete(`/api/transactions/${transactionId}`)
}
