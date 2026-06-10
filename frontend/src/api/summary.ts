import { apiGet, buildQuery } from './client'
import type { CategorySummaryResponse, Direction, MonthlySummary } from '../types/api'

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
