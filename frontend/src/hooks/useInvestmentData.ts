import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import {
  listInvestmentEvents,
  listInvestmentMonthlySeries,
  listInvestmentPositions,
} from '../api/investmentEvents'
import { listInvestmentFundingMonths } from '../api/investmentFundingMonths'
import { listMarketPrices } from '../api/marketPrices'
import {
  buildHistoricalCacheKey,
  invalidateHistoricalData,
  loadHistoricalData,
  readHistoricalData,
} from '../utils/historicalDataCache'
import type {
  InvestmentEvent,
  InvestmentFundingMonth,
  InvestmentMonthlySeriesPoint,
  InvestmentPosition,
  MarketPrice,
} from '../types/api'

const INVESTMENT_EVENTS_FETCH_LIMIT = 500

function getMonthDateRange(month: string) {
  if (!month) {
    return {
      dateFrom: '',
      dateTo: '',
    }
  }

  const [year, monthNumber] = month.split('-').map(Number)
  const monthText = String(monthNumber).padStart(2, '0')
  const lastDay = new Date(year, monthNumber, 0).getDate()

  return {
    dateFrom: `${year}-${monthText}-01`,
    dateTo: `${year}-${monthText}-${String(lastDay).padStart(2, '0')}`,
  }
}

async function listAllInvestmentEvents(
  filters: Parameters<typeof listInvestmentEvents>[0] = {},
) {
  const allEvents: InvestmentEvent[] = []
  let offset = 0

  while (true) {
    const batch = await listInvestmentEvents({
      ...filters,
      limit: INVESTMENT_EVENTS_FETCH_LIMIT,
      offset,
    })

    allEvents.push(...batch)

    if (batch.length < INVESTMENT_EVENTS_FETCH_LIMIT) {
      break
    }

    offset += INVESTMENT_EVENTS_FETCH_LIMIT
  }

  return allEvents
}

type UseInvestmentDataOptions = {
  chartMonths: number
  onFundingMonthsLoaded: (fundingMonths: InvestmentFundingMonth[]) => void
  onEventsReloaded: () => void
  onError: (message: string) => void
  onBeforeLoad: () => void
}

export function useInvestmentData({
  chartMonths,
  onBeforeLoad,
  onError,
  onEventsReloaded,
  onFundingMonthsLoaded,
}: UseInvestmentDataOptions) {
  const { user } = useAuth()
  const cacheUserId = user?.id ?? 'local-default-user'
  const monthlySeriesCacheKey = buildHistoricalCacheKey(
    'investment-monthly-series',
    cacheUserId,
    String(chartMonths),
  )

  const [events, setEvents] = useState<InvestmentEvent[]>([])
  const [positions, setPositions] = useState<InvestmentPosition[]>([])
  const [monthlySeries, setMonthlySeries] = useState<InvestmentMonthlySeriesPoint[]>(
    () => (
      readHistoricalData<InvestmentMonthlySeriesPoint[]>(
        monthlySeriesCacheKey,
      ) ?? []
    ),
  )
  const [isMonthlySeriesLoading, setIsMonthlySeriesLoading] = useState(
    () => (
      readHistoricalData<InvestmentMonthlySeriesPoint[]>(
        monthlySeriesCacheKey,
      ) === undefined
    ),
  )
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([])
  const [fundingMonths, setFundingMonths] = useState<InvestmentFundingMonth[]>([])
  const [eventType, setEventType] = useState('')
  const [source, setSource] = useState('')
  const [month, setMonth] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const loadMonthlySeries = useCallback((force = false) => {
    const cachedSeries = readHistoricalData<InvestmentMonthlySeriesPoint[]>(
      monthlySeriesCacheKey,
    )

    if (cachedSeries !== undefined && !force) {
      setMonthlySeries(cachedSeries)
      setIsMonthlySeriesLoading(false)
      return Promise.resolve(cachedSeries)
    }

    if (monthlySeries.length === 0) {
      setIsMonthlySeriesLoading(true)
    }

    return loadHistoricalData(
      monthlySeriesCacheKey,
      () => listInvestmentMonthlySeries(chartMonths),
      { force },
    )
      .then((loadedSeries) => {
        setMonthlySeries(loadedSeries)
        return loadedSeries
      })
      .catch(() => monthlySeries)
      .finally(() => {
        setIsMonthlySeriesLoading(false)
      })
  }, [
    chartMonths,
    monthlySeries,
    monthlySeriesCacheKey,
  ])

  function loadEvents() {
    onBeforeLoad()

    const monthDateRange = getMonthDateRange(month)

    Promise.all([
      listAllInvestmentEvents({
        source: source || undefined,
        event_type: eventType || undefined,
        date_from: dateFrom || monthDateRange.dateFrom || undefined,
        date_to: dateTo || monthDateRange.dateTo || undefined,
      }),
      listInvestmentPositions(source || undefined),
      listMarketPrices(),
      listInvestmentFundingMonths({
        month: month || '2026-06',
        source: source || 'trading212',
      }),
    ])
      .then(([loadedEvents, loadedPositions, loadedMarketPrices, loadedFundingMonths]) => {
        setEvents(loadedEvents)
        setPositions(loadedPositions)
        setMarketPrices(loadedMarketPrices)
        setFundingMonths(loadedFundingMonths)
        onEventsReloaded()
        onFundingMonthsLoaded(loadedFundingMonths)
      })
      .catch((caughtError: unknown) => {
        onError(caughtError instanceof Error ? caughtError.message : 'Failed to load investment data')
      })

  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadEvents()
    }, 0)

    return () => window.clearTimeout(timeoutId)
    // The page callbacks intentionally control this one-time initial load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadMonthlySeries()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadMonthlySeries])

  function clearFilters() {
    setEventType('')
    setSource('')
    setMonth('')
    setDateFrom('')
    setDateTo('')

    Promise.all([
      listAllInvestmentEvents(),
      listInvestmentPositions(),
      listMarketPrices(),
      listInvestmentFundingMonths({
        month: '2026-06',
        source: 'trading212',
      }),
    ])
      .then(([loadedEvents, loadedPositions, loadedMarketPrices, loadedFundingMonths]) => {
        setEvents(loadedEvents)
        setPositions(loadedPositions)
        setMarketPrices(loadedMarketPrices)
        setFundingMonths(loadedFundingMonths)
        onFundingMonthsLoaded(loadedFundingMonths)
      })
      .catch((caughtError: unknown) => {
        onError(caughtError instanceof Error ? caughtError.message : 'Failed to load investment data')
      })

  }

  function reloadAfterMutation() {
    invalidateHistoricalData()
    loadEvents()
    void loadMonthlySeries(true)
  }

  return {
    clearFilters,
    dateFrom,
    dateTo,
    eventType,
    events,
    fundingMonths,
    isMonthlySeriesLoading,
    loadEvents,
    marketPrices,
    month,
    monthlySeries,
    positions,
    reloadAfterMutation,
    setDateFrom,
    setDateTo,
    setEventType,
    setFundingMonths,
    setMonth,
    setSource,
    source,
  }
}
