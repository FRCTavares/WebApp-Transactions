import { apiDelete, apiGet, apiPatchJson, apiPostJson, buildQuery } from './client'
import { invalidateHistoricalData } from '../utils/historicalDataCache'
import type {
  WealthAccount,
  WealthAccountCreatePayload,
  WealthAccountFilters,
  WealthAccountUpdatePayload,
  WealthMonthlyTotal,
  WealthSnapshot,
  WealthSnapshotCreatePayload,
  WealthSnapshotFilters,
  WealthSnapshotUpdatePayload,
  WealthSummary,
} from '../types/api'

export function listWealthAccounts(filters: WealthAccountFilters = {}) {
  return apiGet<WealthAccount[]>(`/api/wealth/accounts${buildQuery(filters)}`)
}

export function createWealthAccount(payload: WealthAccountCreatePayload) {
  return apiPostJson<WealthAccount>('/api/wealth/accounts', payload).then((result) => {
    invalidateHistoricalData()
    return result
  })
}

export function updateWealthAccount(accountId: number, payload: WealthAccountUpdatePayload) {
  return apiPatchJson<WealthAccount>(`/api/wealth/accounts/${accountId}`, payload).then((result) => {
    invalidateHistoricalData()
    return result
  })
}

export function deleteWealthAccount(accountId: number) {
  return apiDelete(`/api/wealth/accounts/${accountId}`).then((result) => {
    invalidateHistoricalData()
    return result
  })
}

export function listWealthSnapshots(filters: WealthSnapshotFilters = {}) {
  return apiGet<WealthSnapshot[]>(`/api/wealth/snapshots${buildQuery(filters)}`)
}

export function createWealthSnapshot(payload: WealthSnapshotCreatePayload) {
  return apiPostJson<WealthSnapshot>('/api/wealth/snapshots', payload).then((result) => {
    invalidateHistoricalData()
    return result
  })
}

export function updateWealthSnapshot(snapshotId: number, payload: WealthSnapshotUpdatePayload) {
  return apiPatchJson<WealthSnapshot>(`/api/wealth/snapshots/${snapshotId}`, payload).then((result) => {
    invalidateHistoricalData()
    return result
  })
}

export function deleteWealthSnapshot(snapshotId: number) {
  return apiDelete(`/api/wealth/snapshots/${snapshotId}`).then((result) => {
    invalidateHistoricalData()
    return result
  })
}

export function getWealthSummary() {
  return apiGet<WealthSummary>('/api/wealth/summary')
}

export function listWealthMonthlyTotals() {
  return apiGet<WealthMonthlyTotal[]>('/api/wealth/monthly')
}
