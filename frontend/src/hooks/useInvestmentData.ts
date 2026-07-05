import { useEffect, useState } from 'react'
import {
  listInvestmentEvents,
  listInvestmentMonthlySeries,
  listInvestmentPositions,
} from '../api/investmentEvents'
import { listInvestmentFundingMonths } from '../api/investmentFundingMonths'
import { listMarketPrices } from '../api/marketPrices'
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
  const [events, setEvents] = useState<InvestmentEvent[]>([])
  const [positions, setPositions] = useState<InvestmentPosition[]>([])
  const [monthlySeries, setMonthlySeries] = useState<InvestmentMonthlySeriesPoint[]>([])
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([])
  const [fundingMonths, setFundingMonths] = useState<InvestmentFundingMonth[]>([])
  const [eventType, setEventType] = useState('')
  const [source, setSource] = useState('')
  const [month, setMonth] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  function loadMonthlySeries() {
    listInvestmentMonthlySeries(chartMonths)
      .then(setMonthlySeries)
      .catch(() => {
        setMonthlySeries([])
      })
  }

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

    loadMonthlySeries()
  }

  useEffect(() => {
    loadEvents()
    // The callback dependencies are intentionally supplied by the page and are stable
    // enough for this local page workflow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartMonths])

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

    loadMonthlySeries()
  }

  return {
    clearFilters,
    dateFrom,
    dateTo,
    eventType,
    events,
    fundingMonths,
    loadEvents,
    marketPrices,
    month,
    monthlySeries,
    positions,
    setDateFrom,
    setDateTo,
    setEventType,
    setFundingMonths,
    setMonth,
    setSource,
    source,
  }
}
