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
  onWarning: (message: string | null) => void
  onBeforeLoad: () => void
}

export function useInvestmentData({
  chartMonths,
  onBeforeLoad,
  onError,
  onWarning,
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
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true)
  const [monthlySeriesError, setMonthlySeriesError] = useState<string | null>(null)
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
      setMonthlySeriesError(null)
      setIsMonthlySeriesLoading(false)
      return Promise.resolve(cachedSeries)
    }

    if (monthlySeries.length === 0) {
      setIsMonthlySeriesLoading(true)
    }

    setMonthlySeriesError(null)

    return loadHistoricalData(
      monthlySeriesCacheKey,
      () => listInvestmentMonthlySeries(chartMonths),
      { force },
    )
      .then((loadedSeries) => {
        setMonthlySeries(loadedSeries)
        return loadedSeries
      })
      .catch((caughtError: unknown) => {
        setMonthlySeriesError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Failed to load investment trend',
        )
        return monthlySeries
      })
      .finally(() => {
        setIsMonthlySeriesLoading(false)
      })
  }, [
    chartMonths,
    monthlySeries,
    monthlySeriesCacheKey,
  ])

  async function loadEvents() {
    onBeforeLoad()
    onWarning(null)

    const monthDateRange = getMonthDateRange(month)
    const [
      eventsResult,
      positionsResult,
      marketPricesResult,
      fundingMonthsResult,
    ] = await Promise.allSettled([
      listAllInvestmentEvents({
        source: source || undefined,
        event_type: eventType || undefined,
        date_from: dateFrom || monthDateRange.dateFrom || undefined,
        date_to: dateTo || monthDateRange.dateTo || undefined,
      }),
      listInvestmentPositions(source || undefined),
      listMarketPrices(),
      listInvestmentFundingMonths({
        month: month || undefined,
        source: source || undefined,
      }),
    ])

    const requiredErrors: string[] = []
    const optionalErrors: string[] = []

    if (eventsResult.status === 'fulfilled') {
      setEvents(eventsResult.value)
      onEventsReloaded()
    } else {
      requiredErrors.push(
        eventsResult.reason instanceof Error
          ? eventsResult.reason.message
          : 'Failed to load investment events',
      )
    }

    if (positionsResult.status === 'fulfilled') {
      setPositions(positionsResult.value)
    } else {
      requiredErrors.push(
        positionsResult.reason instanceof Error
          ? positionsResult.reason.message
          : 'Failed to load investment positions',
      )
    }

    if (marketPricesResult.status === 'fulfilled') {
      setMarketPrices(marketPricesResult.value)
    } else {
      optionalErrors.push('Market prices could not be refreshed.')
    }

    if (fundingMonthsResult.status === 'fulfilled') {
      setFundingMonths(fundingMonthsResult.value)
      onFundingMonthsLoaded(fundingMonthsResult.value)
    } else {
      optionalErrors.push('Funding breakdown could not be refreshed.')
    }

    if (requiredErrors.length > 0) {
      onError(requiredErrors.join(' '))
    }

    if (optionalErrors.length > 0) {
      onWarning(optionalErrors.join(' '))
    }

    setIsInitialDataLoading(false)
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

    onBeforeLoad()
    onWarning(null)

    void Promise.allSettled([
      listAllInvestmentEvents(),
      listInvestmentPositions(),
      listMarketPrices(),
      listInvestmentFundingMonths(),
    ]).then(([
      eventsResult,
      positionsResult,
      marketPricesResult,
      fundingMonthsResult,
    ]) => {
      const requiredErrors: string[] = []
      const optionalErrors: string[] = []

      if (eventsResult.status === 'fulfilled') {
        setEvents(eventsResult.value)
        onEventsReloaded()
      } else {
        requiredErrors.push(
          eventsResult.reason instanceof Error
            ? eventsResult.reason.message
            : 'Failed to load investment events',
        )
      }

      if (positionsResult.status === 'fulfilled') {
        setPositions(positionsResult.value)
      } else {
        requiredErrors.push(
          positionsResult.reason instanceof Error
            ? positionsResult.reason.message
            : 'Failed to load investment positions',
        )
      }

      if (marketPricesResult.status === 'fulfilled') {
        setMarketPrices(marketPricesResult.value)
      } else {
        optionalErrors.push('Market prices could not be refreshed.')
      }

      if (fundingMonthsResult.status === 'fulfilled') {
        setFundingMonths(fundingMonthsResult.value)
        onFundingMonthsLoaded(fundingMonthsResult.value)
      } else {
        optionalErrors.push('Funding breakdown could not be refreshed.')
      }

      if (requiredErrors.length > 0) {
        onError(requiredErrors.join(' '))
      }

      if (optionalErrors.length > 0) {
        onWarning(optionalErrors.join(' '))
      }
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
    isInitialDataLoading,
    isMonthlySeriesLoading,
    loadEvents,
    marketPrices,
    month,
    monthlySeries,
    monthlySeriesError,
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
