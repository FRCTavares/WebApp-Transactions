import { apiGet, apiPostJson } from './client'
import type { AccessStatusResponse, PendingSignup } from '../types/api'


export function getAccessStatus() {
  return apiGet<AccessStatusResponse>('/api/me/access-status')
}

export function listPendingSignups() {
  return apiGet<PendingSignup[]>('/api/admin/pending-signups')
}

export function approvePendingSignup(id: number) {
  return apiPostJson<PendingSignup>(
    `/api/admin/pending-signups/${id}/approve`,
    {},
  )
}

export function denyPendingSignup(id: number) {
  return apiPostJson<PendingSignup>(
    `/api/admin/pending-signups/${id}/deny`,
    {},
  )
}
