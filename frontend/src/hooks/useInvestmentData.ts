import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'
import {
  listInvestmentEvents,
  listInvestmentMonthlySeries,
  listInvestmentPositions,
  listInvestmentRealisedGains,
} from '../api/investmentEvents'
import {
  buildHistoricalCacheKey,
  invalidateHistoricalData,
  loadHistoricalData,
  readHistoricalData,
} from '../utils/historicalDataCache'
import type {
  InvestmentEvent,
  InvestmentMonthlySeriesPoint,
  InvestmentPosition,
  InvestmentRealisedGain,
} from '../types/api'

const INVESTMENT_EVENTS_FETCH_LIMIT = 500

async function listAllInvestmentEvents() {
  const allEvents: InvestmentEvent[] = []
  let offset = 0

  while (true) {
    const batch = await listInvestmentEvents({
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
  onError: (message: string) => void
  onWarning: (message: string | null) => void
  onBeforeLoad: () => void
}

export function useInvestmentData({
  chartMonths,
  onBeforeLoad,
  onError,
  onWarning,
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
  const [realisedGains, setRealisedGains] = useState<InvestmentRealisedGain[]>([])
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
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true)
  const [monthlySeriesError, setMonthlySeriesError] = useState<string | null>(null)

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

  async function loadInvestmentData() {
    onBeforeLoad()
    onWarning(null)

    const [
      eventsResult,
      positionsResult,
      realisedGainsResult,
    ] = await Promise.allSettled([
      listAllInvestmentEvents(),
      listInvestmentPositions(),
      listInvestmentRealisedGains(),
    ])

    const requiredErrors: string[] = []
    const optionalErrors: string[] = []

    if (eventsResult.status === 'fulfilled') {
      setEvents(eventsResult.value)
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

    if (realisedGainsResult.status === 'fulfilled') {
      setRealisedGains(realisedGainsResult.value)
    } else {
      optionalErrors.push('Realised gains could not be refreshed.')
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
      loadInvestmentData()
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

  function reloadAfterMutation() {
    invalidateHistoricalData()
    loadInvestmentData()
    void loadMonthlySeries(true)
  }

  return {
    events,
    isInitialDataLoading,
    isMonthlySeriesLoading,
    monthlySeries,
    monthlySeriesError,
    positions,
    realisedGains,
    reloadAfterMutation,
  }
}
