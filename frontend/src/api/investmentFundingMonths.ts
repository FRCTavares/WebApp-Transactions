import { apiGet, apiPostJson, buildQuery } from './client'
import type {
  InvestmentFundingMonth,
  InvestmentFundingMonthPayload,
  InvestmentFundingMonthFilters,
} from '../types/api'

export function listInvestmentFundingMonths(filters: InvestmentFundingMonthFilters = {}) {
  return apiGet<InvestmentFundingMonth[]>(
    `/api/investment-funding-months${buildQuery(filters)}`,
  )
}

export function upsertInvestmentFundingMonth(payload: InvestmentFundingMonthPayload) {
  return apiPostJson<InvestmentFundingMonth>(
    '/api/investment-funding-months',
    payload,
  )
}
