import { apiDelete, apiGet, apiGetBlob, apiPatchJson, apiPostJson, buildQuery } from './client'
import type {
  OwedItem,
  OwedItemCreatePayload,
  OwedItemFilters,
  OwedItemUpdatePayload,
  OwedPayment,
  OwedPaymentCreatePayload,
  OwedPaymentFilters,
} from '../types/api'

export function listOwedItems(filters: OwedItemFilters = {}) {
  return apiGet<OwedItem[]>(`/api/owed${buildQuery(filters)}`)
}

export function exportOwedItemsCsv(filters: OwedItemFilters = {}) {
  return apiGetBlob(`/api/owed/export${buildQuery(filters)}`)
}

export function createOwedItem(payload: OwedItemCreatePayload) {
  return apiPostJson<OwedItem>('/api/owed', payload)
}

export function updateOwedItem(owedItemId: number, payload: OwedItemUpdatePayload) {
  return apiPatchJson<OwedItem>(`/api/owed/${owedItemId}`, payload)
}

export function deleteOwedItem(owedItemId: number) {
  return apiDelete(`/api/owed/${owedItemId}`)
}


export function createOwedPayment(payload: OwedPaymentCreatePayload) {
  return apiPostJson<OwedPayment>('/api/owed/payments', payload)
}

export function listOwedPayments(filters: OwedPaymentFilters = {}) {
  return apiGet<OwedPayment[]>(`/api/owed/payments${buildQuery(filters)}`)
}
