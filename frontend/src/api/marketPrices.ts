import { apiGet, apiPostJson, buildQuery } from './client'
import type { MarketPrice, MarketPriceCreatePayload } from '../types/api'

export function listMarketPrices() {
  return apiGet<MarketPrice[]>('/api/market-prices')
}

export function getLatestMarketPrice(filters: { ticker?: string; isin?: string }) {
  return apiGet<MarketPrice>(`/api/market-prices/latest${buildQuery(filters)}`)
}

export function createOrUpdateMarketPrice(payload: MarketPriceCreatePayload) {
  return apiPostJson<MarketPrice>('/api/market-prices', payload)
}
