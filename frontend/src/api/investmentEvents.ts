import { apiGet, apiPostJson, buildQuery } from './client'
import { invalidateHistoricalData } from '../utils/historicalDataCache'
import type {
  InvestmentEvent,
  InvestmentEventFilters,
  InvestmentMonthlyChange,
  InvestmentMonthlySeriesPoint,
  InvestmentPosition,
  InvestmentRealisedGain,
  ManualFundingResolutionPayload,
  ManualFundingResolutionResponse,
  PendingFxSummary,
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

export function listInvestmentRealisedGains(source?: string) {
  return apiGet<InvestmentRealisedGain[]>(
    `/api/investment-events/realised-gains${buildQuery({ source })}`,
  )
}

export function getInvestmentMonthlyChange(year: number, month: number) {
  return apiGet<InvestmentMonthlyChange>(
    `/api/investment-events/monthly-change${buildQuery({ year, month })}`,
  )
}

export function listInvestmentMonthlySeries(months = 24) {
  return apiGet<InvestmentMonthlySeriesPoint[]>(
    `/api/investment-events/monthly-series${buildQuery({ months })}`,
  )
}

export function resolveManualFunding(
  eventId: number,
  payload: ManualFundingResolutionPayload,
) {
  return apiPostJson<ManualFundingResolutionResponse>(
    `/api/investment-events/${eventId}/resolve-manual-funding`,
    payload,
  ).then((result) => {
    invalidateHistoricalData()
    return result
  })
}

export function previewPendingFx() {
  return apiGet<PendingFxSummary>('/api/investment-events/pending-fx')
}

export function resolvePendingFx() {
  return apiPostJson<PendingFxSummary>(
    '/api/investment-events/pending-fx/resolve',
    {},
  ).then((result) => {
    invalidateHistoricalData()
    return result
  })
}
