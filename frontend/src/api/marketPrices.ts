import { apiDelete, apiGet, apiPatchJson, apiPostJson, buildQuery } from './client'
import type {
  MarketPrice,
  MarketPriceCreatePayload,
  MarketPriceFetchHistoryPayload,
  MarketPriceFetchLatestPayload,
  MarketPriceHistory,
  MarketPriceHistoryFilters,
  MarketPriceUpdatePayload,
} from '../types/api'

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

export function fetchLatestMarketPrice(payload: MarketPriceFetchLatestPayload) {
  return apiPostJson<MarketPrice>('/api/market-prices/fetch/latest', payload)
}

export function fetchMarketPriceHistory(payload: MarketPriceFetchHistoryPayload) {
  return apiPostJson<MarketPriceHistory[]>('/api/market-prices/fetch/history', payload)
}

export function listMarketPriceHistory(filters: MarketPriceHistoryFilters = {}) {
  return apiGet<MarketPriceHistory[]>(`/api/market-prices/history${buildQuery(filters)}`)
}
