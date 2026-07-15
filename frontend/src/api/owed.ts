import { apiDelete, apiGet, apiGetBlob, apiPatchJson, apiPostJson, buildQuery } from './client'
import { invalidateHistoricalData } from '../utils/historicalDataCache'
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
    .then((result) => {
      invalidateHistoricalData()
      return result
    })
}

export function updateOwedItem(owedItemId: number, payload: OwedItemUpdatePayload) {
  return apiPatchJson<OwedItem>(`/api/owed/${owedItemId}`, payload)
    .then((result) => {
      invalidateHistoricalData()
      return result
    })
}

export function deleteOwedItem(owedItemId: number) {
  return apiDelete(`/api/owed/${owedItemId}`)
    .then((result) => {
      invalidateHistoricalData()
      return result
    })
}


export function createOwedPayment(payload: OwedPaymentCreatePayload) {
  return apiPostJson<OwedPayment>('/api/owed/payments', payload)
    .then((result) => {
      invalidateHistoricalData()
      return result
    })
}

export function listOwedPayments(filters: OwedPaymentFilters = {}) {
  return apiGet<OwedPayment[]>(`/api/owed/payments${buildQuery(filters)}`)
}
