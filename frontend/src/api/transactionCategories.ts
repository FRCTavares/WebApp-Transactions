import {
  apiDelete,
  apiGet,
  apiPatchJson,
  apiPostJson,
  buildQuery,
} from './client'
import type {
  CashflowType,
  Direction,
  TransactionCategory,
} from '../types/api'

export type TransactionCategoryFilters = {
  active_only?: boolean
  direction?: Direction
  cashflow_type?: CashflowType
  limit?: number
  offset?: number
}

export type TransactionCategoryCreatePayload = {
  name: string
  direction: Direction
  cashflow_type: CashflowType
  is_active?: boolean
  sort_order?: number
}

export type TransactionCategoryUpdatePayload = {
  name?: string
  direction?: Direction
  cashflow_type?: CashflowType
  is_active?: boolean
  sort_order?: number
}

export function listTransactionCategories(
  filters: TransactionCategoryFilters = {},
) {
  return apiGet<TransactionCategory[]>(
    `/api/transaction-categories${buildQuery(filters)}`,
  )
}

export function createTransactionCategory(
  payload: TransactionCategoryCreatePayload,
) {
  return apiPostJson<TransactionCategory>(
    '/api/transaction-categories',
    payload,
  )
}

export function updateTransactionCategory(
  categoryId: number,
  payload: TransactionCategoryUpdatePayload,
) {
  return apiPatchJson<TransactionCategory>(
    `/api/transaction-categories/${categoryId}`,
    payload,
  )
}

export function deleteTransactionCategory(categoryId: number) {
  return apiDelete(`/api/transaction-categories/${categoryId}`)
}

export type TransactionCategoryUsage = {
  transaction_count: number
}

export type TransactionCategoryReplaceDeleteResult = {
  deleted_category_id: number
  replacement_category_id: number
  transactions_updated: number
}

export function getTransactionCategoryUsage(categoryId: number) {
  return apiGet<TransactionCategoryUsage>(
    `/api/transaction-categories/${categoryId}/usage`,
  )
}

export function replaceAndDeleteTransactionCategory(
  categoryId: number,
  replacementCategoryId: number,
) {
  return apiPostJson<TransactionCategoryReplaceDeleteResult>(
    `/api/transaction-categories/${categoryId}/replace-and-delete`,
    {
      replacement_category_id: replacementCategoryId,
    },
  )
}

export type TransactionCategoryMigrationTransaction = {
  id: number
  date: string
  description: string
  raw_description: string
  merchant: string | null
  source: string
  account: string | null
  amount: string
  currency: string
}

export type TransactionCategoryMigrationPreview = {
  category: TransactionCategory
  transactions: TransactionCategoryMigrationTransaction[]
  replacement_categories: TransactionCategory[]
}

export type TransactionCategoryMigrationApplyPayload = {
  transaction_assignments: Array<{
    transaction_id: number
    replacement_category_id: number
  }>
}

export type TransactionCategoryMigrationApplyResult = {
  deleted_category_id: number
  transactions_updated: number
}

export function getTransactionCategoryMigrationPreview(
  categoryId: number,
) {
  return apiGet<TransactionCategoryMigrationPreview>(
    `/api/transaction-categories/${categoryId}/migration-preview`,
  )
}

export function applyTransactionCategoryMigration(
  categoryId: number,
  payload: TransactionCategoryMigrationApplyPayload,
) {
  return apiPostJson<TransactionCategoryMigrationApplyResult>(
    `/api/transaction-categories/${categoryId}/apply-migration`,
    payload,
  )
}
