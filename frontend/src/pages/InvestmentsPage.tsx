import { useEffect, useState } from 'react'
import { listInvestmentEvents, listInvestmentPositions, resolveManualFunding } from '../api/investmentEvents'
import {
  createOrUpdateMarketPrice,
  deleteMarketPrice,
  fetchLatestMarketPrice,
  fetchMarketPriceHistory,
  listMarketPrices,
  updateMarketPrice,
} from '../api/marketPrices'
import { StatusMessage } from '../components/StatusMessage'
import { InvestmentEventsTable } from '../components/investments/InvestmentEventsTable'
import { InvestmentFiltersPanel } from '../components/investments/InvestmentFiltersPanel'
import { InvestmentPositionsTable } from '../components/investments/InvestmentPositionsTable'
import { InvestmentSummaryCards, type InvestmentCurrencyTotal } from '../components/investments/InvestmentSummaryCards'
import {
  MarketDataPanel,
  type MarketDataFetchHistoryFormState,
  type MarketDataFetchLatestFormState,
} from '../components/investments/MarketDataPanel'
import type { MarketPriceFormState } from '../components/investments/MarketPriceForm'
import type { InvestmentEvent, InvestmentPosition, MarketPrice } from '../types/api'
import { formatMoney } from '../utils/format'

export type ManualFundingFormState = {
  eurAmount: string
  date: string
  description: string
  notes: string
}

function addCurrencyTotal(
  totals: Map<string, number>,
  currency: string | null,
  amount: string | null,
) {
  if (!currency || !amount) {
    return
  }

  const numericAmount = Number(amount)

  if (Number.isNaN(numericAmount)) {
    return
  }

  totals.set(currency, (totals.get(currency) ?? 0) + numericAmount)
}

function toCurrencyTotals(totals: Map<string, number>): InvestmentCurrencyTotal[] {
  return [...totals.entries()]
    .map(([currency, amount]) => ({
      currency,
      amount,
    }))
    .sort((left, right) => left.currency.localeCompare(right.currency))
}

function getInvestmentTotals(positions: InvestmentPosition[]) {
  const costTotals = new Map<string, number>()
  const marketValueTotals = new Map<string, number>()
  const unrealisedGainTotals = new Map<string, number>()

  for (const position of positions) {
    for (const cost of position.costs) {
      addCurrencyTotal(costTotals, cost.currency, cost.total_cost)
    }

    addCurrencyTotal(
      marketValueTotals,
      position.market_price_currency,
      position.market_value,
    )

    addCurrencyTotal(
      unrealisedGainTotals,
      position.market_price_currency,
      position.unrealised_gain,
    )
  }

  return {
    costTotals: toCurrencyTotals(costTotals),
    marketValueTotals: toCurrencyTotals(marketValueTotals),
    unrealisedGainTotals: toCurrencyTotals(unrealisedGainTotals),
  }
}

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

function getActiveFilterCount(values: string[]) {
  return values.filter(Boolean).length
}

function getEventCount(events: InvestmentEvent[], eventType: string) {
  return events.filter((event) => event.event_type === eventType).length
}

function createDefaultFundingForm(event: InvestmentEvent): ManualFundingFormState {
  return {
    eurAmount: '',
    date: event.date,
    description: 'Trading 212 deposit funding',
    notes: `Manual EUR funding resolution for ${event.amount} ${event.currency} deposit`,
  }
}

export function InvestmentsPage() {
  const [events, setEvents] = useState<InvestmentEvent[]>([])
  const [positions, setPositions] = useState<InvestmentPosition[]>([])
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([])
  const [eventType, setEventType] = useState('')
  const [source, setSource] = useState('')
  const [month, setMonth] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [resolvingEventId, setResolvingEventId] = useState<number | null>(null)
  const [fundingForm, setFundingForm] = useState<ManualFundingFormState>({
    eurAmount: '',
    date: '',
    description: '',
    notes: '',
  })
  const [editingMarketPriceId, setEditingMarketPriceId] = useState<number | null>(null)
  const [marketPriceForm, setMarketPriceForm] = useState<MarketPriceFormState>({
    ticker: '',
    isin: '',
    price: '',
    currency: 'EUR',
    source: 'manual',
  })
  const [latestMarketDataForm, setLatestMarketDataForm] = useState<MarketDataFetchLatestFormState>({
    symbol: '',
    ticker: '',
    isin: '',
    currency: '',
  })
  const [historyMarketDataForm, setHistoryMarketDataForm] = useState<MarketDataFetchHistoryFormState>({
    symbol: '',
    ticker: '',
    isin: '',
    currency: '',
    dateFrom: '',
    dateTo: '',
  })
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function loadEvents() {
    setError(null)
    setMessage(null)

    const monthDateRange = getMonthDateRange(month)

    Promise.all([
      listInvestmentEvents({
        source: source || undefined,
        event_type: eventType || undefined,
        date_from: dateFrom || monthDateRange.dateFrom || undefined,
        date_to: dateTo || monthDateRange.dateTo || undefined,
        limit: 100,
      }),
      listInvestmentPositions(source || undefined),
      listMarketPrices(),
    ])
      .then(([loadedEvents, loadedPositions, loadedMarketPrices]) => {
        setEvents(loadedEvents)
        setPositions(loadedPositions)
        setMarketPrices(loadedMarketPrices)
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load investment data')
      })
  }

  useEffect(() => {
    loadEvents()
  }, [])

  function clearFilters() {
    setEventType('')
    setSource('')
    setMonth('')
    setDateFrom('')
    setDateTo('')

    Promise.all([
      listInvestmentEvents({ limit: 100 }),
      listInvestmentPositions(),
      listMarketPrices(),
    ])
      .then(([loadedEvents, loadedPositions, loadedMarketPrices]) => {
        setEvents(loadedEvents)
        setPositions(loadedPositions)
        setMarketPrices(loadedMarketPrices)
      })
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : 'Failed to load investment data')
      })
  }

  function startManualResolution(event: InvestmentEvent) {
    setResolvingEventId(event.id)
    setFundingForm(createDefaultFundingForm(event))
    setError(null)
    setMessage(null)
  }

  function cancelManualResolution() {
    setResolvingEventId(null)
    setFundingForm({
      eurAmount: '',
      date: '',
      description: '',
      notes: '',
    })
  }

  async function submitManualResolution(event: InvestmentEvent) {
    setError(null)
    setMessage(null)

    if (!fundingForm.eurAmount || Number(fundingForm.eurAmount) <= 0) {
      setError('Enter a positive EUR amount.')
      return
    }

    if (!fundingForm.date) {
      setError('Enter a funding date.')
      return
    }

    if (!fundingForm.description.trim()) {
      setError('Enter a description.')
      return
    }

    const confirmed = window.confirm(
      `This will create a real Money Out investment transaction for ${formatMoney(
        fundingForm.eurAmount,
      )}. Continue?`,
    )

    if (!confirmed) {
      return
    }

    try {
      await resolveManualFunding(event.id, {
        eur_amount: fundingForm.eurAmount,
        date: fundingForm.date,
        description: fundingForm.description,
        notes: fundingForm.notes || null,
      })

      setMessage('Manual funding resolution saved.')
      cancelManualResolution()
      loadEvents()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to resolve manual funding')
    }
  }

  async function fetchLatestMarketData() {
    setError(null)
    setMessage(null)

    if (!latestMarketDataForm.symbol.trim()) {
      setError('Enter a Yahoo symbol, for example VWCE.DE.')
      return
    }

    try {
      const fetchedPrice = await fetchLatestMarketPrice({
        symbol: latestMarketDataForm.symbol.trim(),
        ticker: latestMarketDataForm.ticker.trim() || null,
        isin: latestMarketDataForm.isin.trim() || null,
        currency: latestMarketDataForm.currency.trim().toUpperCase() || null,
      })

      setMessage(`Fetched latest price for ${fetchedPrice.ticker ?? fetchedPrice.isin ?? latestMarketDataForm.symbol}.`)
      loadEvents()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to fetch latest market price')
    }
  }

  async function fetchHistoricalMarketData() {
    setError(null)
    setMessage(null)

    if (!historyMarketDataForm.symbol.trim()) {
      setError('Enter a Yahoo symbol, for example VWCE.DE.')
      return
    }

    if (!historyMarketDataForm.dateFrom || !historyMarketDataForm.dateTo) {
      setError('Enter a start date and end date.')
      return
    }

    try {
      const history = await fetchMarketPriceHistory({
        symbol: historyMarketDataForm.symbol.trim(),
        ticker: historyMarketDataForm.ticker.trim() || null,
        isin: historyMarketDataForm.isin.trim() || null,
        currency: historyMarketDataForm.currency.trim().toUpperCase() || null,
        date_from: historyMarketDataForm.dateFrom,
        date_to: historyMarketDataForm.dateTo,
      })

      setMessage(`Fetched ${history.length} historical price rows.`)
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to fetch historical market prices')
    }
  }

  async function submitMarketPrice() {
    setError(null)
    setMessage(null)

    if (!marketPriceForm.ticker.trim() && !marketPriceForm.isin.trim()) {
      setError('Enter a ticker or ISIN.')
      return
    }

    if (!marketPriceForm.price || Number(marketPriceForm.price) <= 0) {
      setError('Enter a positive market price.')
      return
    }

    if (!marketPriceForm.currency.trim()) {
      setError('Enter a currency.')
      return
    }

    try {
      const payload = {
        ticker: marketPriceForm.ticker.trim() || null,
        isin: marketPriceForm.isin.trim() || null,
        price: marketPriceForm.price,
        currency: marketPriceForm.currency.trim().toUpperCase(),
        source: marketPriceForm.source.trim() || 'manual',
      }

      if (editingMarketPriceId === null) {
        await createOrUpdateMarketPrice(payload)
        setMessage('Market price saved.')
      } else {
        await updateMarketPrice(editingMarketPriceId, payload)
        setMessage('Market price updated.')
      }
      setEditingMarketPriceId(null)
      setMarketPriceForm({
        ticker: '',
        isin: '',
        price: '',
        currency: 'EUR',
        source: 'manual',
      })
      loadEvents()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save market price')
    }
  }

  function startMarketPriceEdit(marketPrice: MarketPrice) {
    setEditingMarketPriceId(marketPrice.id)
    setMarketPriceForm({
      ticker: marketPrice.ticker ?? '',
      isin: marketPrice.isin ?? '',
      price: marketPrice.price,
      currency: marketPrice.currency,
      source: marketPrice.source,
    })
    setError(null)
    setMessage(null)
  }

  function cancelMarketPriceEdit() {
    setEditingMarketPriceId(null)
    setMarketPriceForm({
      ticker: '',
      isin: '',
      price: '',
      currency: 'EUR',
      source: 'manual',
    })
  }

  async function removeMarketPrice(marketPrice: MarketPrice) {
    const label = marketPrice.ticker ?? marketPrice.isin ?? `#${marketPrice.id}`
    const confirmed = window.confirm(`Delete cached market price for ${label}?`)

    if (!confirmed) {
      return
    }

    try {
      setError(null)
      setMessage(null)

      await deleteMarketPrice(marketPrice.id)

      setMessage('Market price deleted.')

      if (editingMarketPriceId === marketPrice.id) {
        cancelMarketPriceEdit()
      }

      loadEvents()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to delete market price')
    }
  }

  const activeFilterCount = getActiveFilterCount([eventType, source, month, dateFrom, dateTo])
  const depositCount = getEventCount(events, 'deposit')
  const marketBuyCount = getEventCount(events, 'market_buy')
  const unmatchedDepositCount = events.filter(
    (event) => event.event_type === 'deposit' && event.funding_match_status === 'unmatched',
  ).length
  const investmentTotals = getInvestmentTotals(positions)

  return (
    <section>
      <div className="page-header">
        <div>
          <h1>Investments</h1>
          <p className="muted small">
            {events.length} investment events loaded from broker imports.
          </p>
        </div>

        <div className="action-group">
          <button type="button" onClick={loadEvents}>
            Refresh
          </button>
        </div>
      </div>

      <StatusMessage error={error} message={message} />

      <InvestmentSummaryCards
        eventCount={events.length}
        depositCount={depositCount}
        marketBuyCount={marketBuyCount}
        unmatchedDepositCount={unmatchedDepositCount}
        openPositionCount={positions.length}
        costTotals={investmentTotals.costTotals}
        marketValueTotals={investmentTotals.marketValueTotals}
        unrealisedGainTotals={investmentTotals.unrealisedGainTotals}
      />

      <InvestmentPositionsTable positions={positions} />

      <MarketDataPanel
        latestForm={latestMarketDataForm}
        historyForm={historyMarketDataForm}
        manualForm={marketPriceForm}
        isEditingManualPrice={editingMarketPriceId !== null}
        marketPrices={marketPrices}
        onLatestFormChange={setLatestMarketDataForm}
        onHistoryFormChange={setHistoryMarketDataForm}
        onManualFormChange={setMarketPriceForm}
        onFetchLatest={fetchLatestMarketData}
        onFetchHistory={fetchHistoricalMarketData}
        onSubmitManualPrice={submitMarketPrice}
        onCancelManualEdit={cancelMarketPriceEdit}
        onEditManualPrice={startMarketPriceEdit}
        onDeleteManualPrice={removeMarketPrice}
      />

      <InvestmentFiltersPanel
        activeFilterCount={activeFilterCount}
        eventType={eventType}
        source={source}
        month={month}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onEventTypeChange={setEventType}
        onSourceChange={setSource}
        onMonthChange={setMonth}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onApplyFilters={loadEvents}
        onClearFilters={clearFilters}
      />

      <p className="muted">
        Investment events are broker ledger entries. They do not affect Money In or Money Out unless a separate bank transaction exists.
      </p>

      <InvestmentEventsTable
        events={events}
        resolvingEventId={resolvingEventId}
        fundingForm={fundingForm}
        onFundingFormChange={setFundingForm}
        onSubmitManualResolution={submitManualResolution}
        onCancelManualResolution={cancelManualResolution}
        onStartManualResolution={startManualResolution}
      />
    </section>
  )
}
