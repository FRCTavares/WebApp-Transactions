import { apiGet, apiPostJson, buildQuery } from './client'
import type {
  InvestmentEvent,
  InvestmentEventFilters,
  InvestmentMonthlyChange,
  InvestmentPosition,
  ManualFundingResolutionPayload,
  ManualFundingResolutionResponse,
} from '../types/api'

export function listInvestmentEvents(filters: InvestmentEventFilters = {}) {
  return apiGet<InvestmentEvent[]>(`/api/investment-events${buildQuery(filters)}`)
}

export function getInvestmentEvent(eventId: number) {
  return apiGet<InvestmentEvent>(`/api/investment-events/${eventId}`)
}

export function listInvestmentPositions(source?: string) {
  return apiGet<InvestmentPosition[]>(
    `/api/investment-events/positions${buildQuery({ source })}`,
  )
}

export function getInvestmentMonthlyChange(year: number, month: number) {
  return apiGet<InvestmentMonthlyChange>(
    `/api/investment-events/monthly-change${buildQuery({ year, month })}`,
  )
}

export function resolveManualFunding(
  eventId: number,
  payload: ManualFundingResolutionPayload,
) {
  return apiPostJson<ManualFundingResolutionResponse>(
    `/api/investment-events/${eventId}/resolve-manual-funding`,
    payload,
  )
}
