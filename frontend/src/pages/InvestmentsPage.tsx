import { useState } from 'react'
import {
  previewPendingFx,
  resolveManualFunding,
  resolvePendingFx,
} from '../api/investmentEvents'
import { upsertInvestmentFundingMonth } from '../api/investmentFundingMonths'
import {
  createOrUpdateMarketPrice,
  deleteMarketPrice,
  fetchLatestMarketPrice,
  fetchMarketPriceHistory,
  updateMarketPrice,
} from '../api/marketPrices'
import { StatusMessage } from '../components/StatusMessage'
import { InvestmentAllocationCharts } from '../components/investments/InvestmentAllocationCharts'
import { InvestmentEventsPanel } from '../components/investments/InvestmentEventsPanel'
import { InvestmentFiltersPanel } from '../components/investments/InvestmentFiltersPanel'
import { InvestmentHoldingsOverview } from '../components/investments/InvestmentHoldingsOverview'
import { InvestmentPortfolioTrendChart } from '../components/investments/InvestmentPortfolioTrendChart'
import { InvestmentPositionsTable } from '../components/investments/InvestmentPositionsTable'
import { InvestmentSummaryCards } from '../components/investments/InvestmentSummaryCards'
import { FundingSplitPanel } from '../components/investments/FundingSplitPanel'
import { MarketDataPanel } from '../components/investments/MarketDataPanel'
import type { MarketPriceFormState } from '../components/investments/MarketPriceForm'
import type { InvestmentEvent, InvestmentFundingMonth, MarketPrice } from '../types/api'
import { useInvestmentData } from '../hooks/useInvestmentData'
import { formatMoney } from '../utils/format'
import {
  createDefaultFundingForm,
  createDefaultMonthlyFundingForm,
  getActiveFilterCount,
  getDefaultYahooSymbol,
  getEventCount,
  getInvestmentTotals,
  getMarketDataLabel,
  getMonthlyFundingTotal,
  getPositionCurrency,
  getSortedInvestmentEvents,
  INVESTMENT_EVENTS_PAGE_SIZE,
  type InvestmentEventSort,
  type ManualFundingFormState,
  type MonthlyFundingFormState,
} from '../utils/investmentsPageUtils'
import { Button, PageHeader } from '../components/ui'

export function InvestmentsPage() {
  const [chartMonths, setChartMonths] = useState(24)
  const [resolvingEventId, setResolvingEventId] = useState<number | null>(null)
  const [fundingForm, setFundingForm] = useState<ManualFundingFormState>({
    eurAmount: '',
    date: '',
    description: '',
    notes: '',
  })
  const [monthlyFundingForm, setMonthlyFundingForm] = useState<MonthlyFundingFormState>(
    createDefaultMonthlyFundingForm(),
  )
  const [editingMarketPriceId, setEditingMarketPriceId] = useState<number | null>(null)
  const [marketPriceForm, setMarketPriceForm] = useState<MarketPriceFormState>({
    ticker: '',
    isin: '',
    price: '',
    currency: 'EUR',
    source: 'manual',
  })
  const [isFetchingMarketData, setIsFetchingMarketData] = useState(false)
  const [isBackfillingHistory, setIsBackfillingHistory] = useState(false)
  const [isResolvingFx, setIsResolvingFx] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dataWarning, setDataWarning] = useState<string | null>(null)
  const [isEventsOpen, setIsEventsOpen] = useState(false)
  const [eventSort, setEventSort] = useState<InvestmentEventSort>('date_desc')
  const [eventPage, setEventPage] = useState(1)

  function handleFundingMonthsLoaded(loadedFundingMonths: InvestmentFundingMonth[]) {
    if (loadedFundingMonths[0]) {
      setMonthlyFundingForm({
        month: loadedFundingMonths[0].month,
        source: loadedFundingMonths[0].source,
        manualAmount: loadedFundingMonths[0].manual_amount,
        cashbackRoundingAmount: loadedFundingMonths[0].cashback_rounding_amount,
        currency: loadedFundingMonths[0].currency,
        notes: loadedFundingMonths[0].notes ?? '',
      })
    }
  }

  const {
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
    realisedGains,
    reloadAfterMutation,
    setDateFrom,
    setDateTo,
    setEventType,
    setFundingMonths,
    setMonth,
    setSource,
    source,
  } = useInvestmentData({
    chartMonths,
    onBeforeLoad: () => {
      setError(null)
      setMessage(null)
    },
    onError: setError,
    onWarning: setDataWarning,
    onEventsReloaded: () => {
      setEventPage(1)
    },
    onFundingMonthsLoaded: handleFundingMonthsLoaded,
  })

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

  async function submitMonthlyFundingBreakdown() {
    setError(null)
    setMessage(null)

    if (!monthlyFundingForm.month.match(/^\d{4}-\d{2}$/)) {
      setError('Enter a month in YYYY-MM format.')
      return
    }

    if (!monthlyFundingForm.source.trim()) {
      setError('Enter an investment source.')
      return
    }

    if (Number(monthlyFundingForm.manualAmount) < 0) {
      setError('Manual amount cannot be negative.')
      return
    }

    if (Number(monthlyFundingForm.cashbackRoundingAmount) < 0) {
      setError('Cashback / rounding amount cannot be negative.')
      return
    }

    try {
      const savedFundingMonth = await upsertInvestmentFundingMonth({
        month: monthlyFundingForm.month,
        source: monthlyFundingForm.source.trim(),
        manual_amount: monthlyFundingForm.manualAmount || '0.00',
        cashback_rounding_amount: monthlyFundingForm.cashbackRoundingAmount || '0.00',
        currency: monthlyFundingForm.currency.trim().toUpperCase() || 'EUR',
        notes: monthlyFundingForm.notes || null,
      })

      setFundingMonths([savedFundingMonth])
      setMessage('Investment funding breakdown saved.')
      reloadAfterMutation()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save funding breakdown')
    }
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
      reloadAfterMutation()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to resolve manual funding')
    }
  }

  async function refreshAllMarketData() {
    setError(null)
    setMessage(null)

    if (positions.length === 0) {
      setError('No open positions to refresh.')
      return
    }

    const requests = positions
      .map((position) => ({
        position,
        symbol: getDefaultYahooSymbol(position),
      }))
      .filter((request) => request.symbol.trim())

    if (requests.length === 0) {
      setError('No Yahoo symbols could be inferred for the current positions.')
      return
    }

    setIsFetchingMarketData(true)

    try {
      const results = await Promise.allSettled(
        requests.map((request) =>
          fetchLatestMarketPrice({
            symbol: request.symbol,
            ticker: request.position.ticker ?? null,
            isin: request.position.isin ?? null,
            currency: getPositionCurrency(request.position) || null,
          }),
        ),
      )

      const failedLabels = results
        .map((result, index) => ({
          result,
          label: getMarketDataLabel(requests[index].position),
        }))
        .filter(({ result }) => result.status === 'rejected')
        .map(({ label }) => label)

      const successCount = results.length - failedLabels.length

      if (failedLabels.length > 0) {
        setMessage(`Updated ${successCount} of ${results.length} market prices.`)
        setError(`Failed to update: ${failedLabels.join(', ')}`)
      } else {
        setMessage(`Updated ${successCount} market prices.`)
      }

      reloadAfterMutation()
    } catch (caughtError: unknown) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to refresh market data')
    } finally {
      setIsFetchingMarketData(false)
    }
  }

  /**
   * Backfills daily closes for every open position over the charted window.
   *
   * The portfolio trend already returns a point for every month, but a month
   * with no stored price is valued by carrying the last known price forward,
   * so the line reports the cost basis rather than real market movement. The
   * backend already exposes per-symbol history fetching and the valuation
   * layer already prefers stored history over carried-forward prices - this
   * just fills the gap for every held symbol at once.
   */
  async function backfillMarketHistory() {
    setError(null)
    setMessage(null)

    if (positions.length === 0) {
      setError('No open positions to backfill.')
      return
    }

    const requests = positions
      .map((position) => ({
        position,
        symbol: getDefaultYahooSymbol(position),
      }))
      .filter((request) => request.symbol.trim())

    if (requests.length === 0) {
      setError('No Yahoo symbols could be inferred for the current positions.')
      return
    }

    const today = new Date()
    const start = new Date(today)
    start.setMonth(start.getMonth() - (chartMonths - 1))
    start.setDate(1)
    const toIsoDate = (value: Date) => value.toISOString().slice(0, 10)

    setIsBackfillingHistory(true)

    try {
      const results = await Promise.allSettled(
        requests.map((request) =>
          fetchMarketPriceHistory({
            symbol: request.symbol,
            ticker: request.position.ticker ?? null,
            isin: request.position.isin ?? null,
            currency: getPositionCurrency(request.position) || null,
            date_from: toIsoDate(start),
            date_to: toIsoDate(today),
          }),
        ),
      )

      const failedLabels = results
        .map((result, index) => ({
          result,
          label: getMarketDataLabel(requests[index].position),
        }))
        .filter(({ result }) => result.status === 'rejected')
        .map(({ label }) => label)

      const storedCount = results.reduce(
        (total, result) =>
          result.status === 'fulfilled' ? total + result.value.length : total,
        0,
      )
      const successCount = results.length - failedLabels.length

      if (failedLabels.length > 0) {
        setMessage(
          `Backfilled ${storedCount} daily prices for ${successCount} of ${results.length} positions.`,
        )
        setError(`Failed to backfill: ${failedLabels.join(', ')}`)
      } else {
        setMessage(
          `Backfilled ${storedCount} daily prices across ${successCount} positions.`,
        )
      }

      reloadAfterMutation()
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to backfill market price history',
      )
    } finally {
      setIsBackfillingHistory(false)
    }
  }

  /**
   * Resolves FX rates left pending on stored investment events.
   *
   * Historical valuation converts every holding to EUR using a rate carried on
   * an event, so a single unresolved non-EUR event makes every month from that
   * date onward unvaluable - which silently truncated the portfolio trend.
   *
   * Previews first and asks for confirmation, matching the import workflow:
   * this writes to financial records, so it should never happen implicitly.
   */
  async function resolvePendingFxRates() {
    setError(null)
    setMessage(null)
    setIsResolvingFx(true)

    try {
      const preview = await previewPendingFx()

      if (preview.pending_count === 0) {
        setMessage('No pending FX rates to resolve.')
        return
      }

      const span =
        preview.earliest_date && preview.latest_date
          ? ` between ${preview.earliest_date} and ${preview.latest_date}`
          : ''
      const confirmed = window.confirm(
        `${preview.pending_count} event(s) in `
          + `${preview.currencies.join(', ')}${span} have no FX rate.\n\n`
          + `${preview.resolvable_count} can be resolved from historical rates; `
          + `${preview.unresolvable_count} cannot and will stay pending.\n\n`
          + 'Apply the resolvable rates?',
      )

      if (!confirmed) {
        setMessage('FX resolution cancelled. Nothing was changed.')
        return
      }

      const result = await resolvePendingFx()

      if (result.unresolvable_count > 0) {
        setMessage(
          `Resolved ${result.resolvable_count} FX rate(s). `
            + `${result.unresolvable_count} still pending - no historical rate was available.`,
        )
      } else {
        setMessage(`Resolved ${result.resolvable_count} FX rate(s).`)
      }

      reloadAfterMutation()
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to resolve pending FX rates',
      )
    } finally {
      setIsResolvingFx(false)
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
      reloadAfterMutation()
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

      reloadAfterMutation()
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
  const activeFundingMonth = fundingMonths[0]
  const monthlyFundingTotal = activeFundingMonth
    ? getMonthlyFundingTotal(activeFundingMonth)
    : getMonthlyFundingTotal(monthlyFundingForm)
  const sortedEvents = getSortedInvestmentEvents(events, eventSort)
  const eventPageCount = Math.max(
    1,
    Math.ceil(sortedEvents.length / INVESTMENT_EVENTS_PAGE_SIZE),
  )
  const currentEventPage = Math.min(eventPage, eventPageCount)
  const firstEventIndex = (currentEventPage - 1) * INVESTMENT_EVENTS_PAGE_SIZE
  const paginatedEvents = sortedEvents.slice(
    firstEventIndex,
    firstEventIndex + INVESTMENT_EVENTS_PAGE_SIZE,
  )
  const shownFirstEvent = sortedEvents.length === 0 ? 0 : firstEventIndex + 1
  const shownLastEvent = Math.min(
    firstEventIndex + INVESTMENT_EVENTS_PAGE_SIZE,
    sortedEvents.length,
  )

  return (
    <section className="app-page investments-page">
      <PageHeader
        title="Investments"
        actions={(
          <>
            <Button
              type="button"
              size="sm"
              loading={isResolvingFx}
              onClick={resolvePendingFxRates}
              title="Resolve FX rates left pending on stored events, which block historical valuation"
            >
              {isResolvingFx ? 'Resolving…' : 'Resolve FX'}
            </Button>
            <Button
              type="button"
              size="sm"
              loading={isBackfillingHistory}
              onClick={backfillMarketHistory}
              title="Fetch daily closing prices for the charted window so the portfolio trend reflects real market movement"
            >
              {isBackfillingHistory ? 'Backfilling…' : 'Backfill'}
            </Button>
            <Button
              type="button"
              size="sm"
              loading={isFetchingMarketData}
              onClick={refreshAllMarketData}
            >
              {isFetchingMarketData ? 'Refreshing…' : 'Refresh prices'}
            </Button>
          </>
        )}
      />

      <StatusMessage error={error} message={message} />

      {dataWarning && (
        <p className="status status-info" role="status">
          {dataWarning}
        </p>
      )}

      {monthlySeriesError && (
        <p className="status status-info" role="status">
          Investment trend could not be refreshed: {monthlySeriesError}
        </p>
      )}

      {isInitialDataLoading && events.length === 0 && positions.length === 0 && (
        <p className="status status-info" role="status" aria-live="polite">
          Loading investment data...
        </p>
      )}

      <InvestmentPortfolioTrendChart
        months={chartMonths}
        series={monthlySeries}
        isLoading={isMonthlySeriesLoading}
        onMonthsChange={setChartMonths}
      />

      <InvestmentSummaryCards
        eventCount={events.length}
        depositCount={depositCount}
        marketBuyCount={marketBuyCount}
        unmatchedDepositCount={unmatchedDepositCount}
        openPositionCount={positions.length}
        costTotals={investmentTotals.costTotals}
        marketValueTotals={investmentTotals.marketValueTotals}
        unrealisedGainTotals={investmentTotals.unrealisedGainTotals}
        realisedGainTotals={realisedGains.map((gain) => ({
          currency: gain.currency,
          amount: Number(gain.amount),
        }))}
      />

      <InvestmentHoldingsOverview positions={positions} />

      <InvestmentAllocationCharts positions={positions} />

      <details className="content-card panel-card investment-detailed-positions-card">
        <summary>
          <span>
            <strong>Detailed positions</strong>
            <small>Quantity, ISIN, cost basis, prices, and FX details.</small>
          </span>
        </summary>

        <InvestmentPositionsTable positions={positions} />
      </details>

      <div className="investment-tools-grid">
      <FundingSplitPanel
        monthlyFundingForm={monthlyFundingForm}
        monthlyFundingTotal={monthlyFundingTotal}
        onUpdateField={(field, value) =>
          setMonthlyFundingForm((currentValue) => ({
            ...currentValue,
            [field]: value,
          }))
        }
        onSubmit={submitMonthlyFundingBreakdown}
      />

      <MarketDataPanel
        positions={positions}
        manualForm={marketPriceForm}
        isEditingManualPrice={editingMarketPriceId !== null}
        marketPrices={marketPrices}
        isFetchingMarketData={isFetchingMarketData}
        onFetchAllLatest={refreshAllMarketData}
        onManualFormChange={setMarketPriceForm}
        onSubmitManualPrice={submitMarketPrice}
        onCancelManualEdit={cancelMarketPriceEdit}
        onEditManualPrice={startMarketPriceEdit}
        onDeleteManualPrice={removeMarketPrice}
      />
      </div>

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

      <InvestmentEventsPanel
        isOpen={isEventsOpen}
        onToggleOpen={() => setIsEventsOpen((currentValue) => !currentValue)}
        eventSort={eventSort}
        onEventSortChange={(sort) => {
          setEventSort(sort)
          setEventPage(1)
        }}
        totalEventCount={sortedEvents.length}
        paginatedEvents={paginatedEvents}
        shownFirstEvent={shownFirstEvent}
        shownLastEvent={shownLastEvent}
        currentEventPage={currentEventPage}
        eventPageCount={eventPageCount}
        onPreviousPage={() => setEventPage((currentValue) => Math.max(1, currentValue - 1))}
        onNextPage={() => setEventPage((currentValue) => Math.min(eventPageCount, currentValue + 1))}
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
