import { apiDelete, apiGet, apiPatchJson, apiPostJson, buildQuery } from './client'
import type { MarketPrice, MarketPriceCreatePayload, MarketPriceUpdatePayload } from '../types/api'

export function listMarketPrices() {
  return apiGet<MarketPrice[]>('/api/market-prices')
}

export function getLatestMarketPrice(filters: { ticker?: string; isin?: string }) {
  return apiGet<MarketPrice>(`/api/market-prices/latest${buildQuery(filters)}`)
}

export function createOrUpdateMarketPrice(payload: MarketPriceCreatePayload) {
  return apiPostJson<MarketPrice>('/api/market-prices', payload)
}


export function updateMarketPrice(priceId: number, payload: MarketPriceUpdatePayload) {
  return apiPatchJson<MarketPrice>(`/api/market-prices/${priceId}`, payload)
}

export function deleteMarketPrice(priceId: number) {
  return apiDelete(`/api/market-prices/${priceId}`)
}
