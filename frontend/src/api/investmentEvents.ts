import { apiGet, buildQuery } from './client'
import type { InvestmentEvent, InvestmentEventFilters } from '../types/api'

export function listInvestmentEvents(filters: InvestmentEventFilters = {}) {
  return apiGet<InvestmentEvent[]>(`/api/investment-events${buildQuery(filters)}`)
}

export function getInvestmentEvent(eventId: number) {
  return apiGet<InvestmentEvent>(`/api/investment-events/${eventId}`)
}
