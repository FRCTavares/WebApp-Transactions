import { apiGet, apiPostJson, buildQuery } from './client'
import type {
  InvestmentEvent,
  InvestmentEventFilters,
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

export function resolveManualFunding(
  eventId: number,
  payload: ManualFundingResolutionPayload,
) {
  return apiPostJson<ManualFundingResolutionResponse>(
    `/api/investment-events/${eventId}/resolve-manual-funding`,
    payload,
  )
}
