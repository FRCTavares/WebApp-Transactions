import { apiGet, apiPutJson, buildQuery } from './client'
import type {
  CategorySummaryResponse,
  Direction,
  MonthlySummary,
  TripSavingsAllocation,
} from '../types/api'

export function getMonthlySummary(year?: number, month?: number) {
  return apiGet<MonthlySummary>('/api/summary' + buildQuery({ year, month }))
}

export function getCategorySummary(
  direction?: Direction,
  year?: number,
  month?: number,
) {
  return apiGet<CategorySummaryResponse>(
    '/api/summary/categories' + buildQuery({ direction, year, month }),
  )
}


export function updateTripSavingsAllocation(
  year: number,
  month: number,
  amountEur: string | null,
) {
  return apiPutJson<TripSavingsAllocation>(
    '/api/summary/trip-savings' + buildQuery({ year, month }),
    { amount_eur: amountEur },
  )
}
