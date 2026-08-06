import { apiGet, apiPostJson, buildQuery } from './client'
import { invalidateHistoricalData } from '../utils/historicalDataCache'
import type {
  MarketPrice,
  MarketPriceFetchHistoryPayload,
  MarketPriceFetchLatestPayload,
  MarketPriceHistory,
  MarketPriceHistoryFilters,
} from '../types/api'

export function getLatestMarketPrice(filters: { ticker?: string; isin?: string }) {
  return apiGet<MarketPrice>(`/api/market-prices/latest${buildQuery(filters)}`)
}

export function fetchLatestMarketPrice(payload: MarketPriceFetchLatestPayload) {
  return apiPostJson<MarketPrice>('/api/market-prices/fetch/latest', payload)
    .then((result) => {
      invalidateHistoricalData()
      return result
    })
}

export function fetchMarketPriceHistory(payload: MarketPriceFetchHistoryPayload) {
  return apiPostJson<MarketPriceHistory[]>('/api/market-prices/fetch/history', payload)
    .then((result) => {
      invalidateHistoricalData()
      return result
    })
}

export function listMarketPriceHistory(filters: MarketPriceHistoryFilters = {}) {
  return apiGet<MarketPriceHistory[]>(`/api/market-prices/history${buildQuery(filters)}`)
}
