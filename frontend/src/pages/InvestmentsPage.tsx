import { useState } from 'react'
import { CircleCheck, History, RefreshCw } from 'lucide-react'
import {
  createInvestmentEvent,
  previewPendingFx,
  resolvePendingFx,
} from '../api/investmentEvents'
import {
  fetchLatestMarketPrice,
  fetchMarketPriceHistory,
} from '../api/marketPrices'
import { StatusMessage } from '../components/StatusMessage'
import { InvestmentHoldingsOverview } from '../components/investments/InvestmentHoldingsOverview'
import { InvestmentPortfolioTrendChart } from '../components/investments/InvestmentPortfolioTrendChart'
import { InvestmentSummaryCards } from '../components/investments/InvestmentSummaryCards'
import { ManualInvestmentEventForm } from '../components/investments/ManualInvestmentEventForm'
import type { ManualInvestmentEventFormState } from '../components/investments/ManualInvestmentEventForm'
import type { InvestmentPosition } from '../types/api'
import { useInvestmentData } from '../hooks/useInvestmentData'
import {
  getDefaultYahooSymbol,
  getEventCount,
  getInvestmentTotals,
  getMarketDataLabel,
  getPositionCurrency,
} from '../utils/investmentsPageUtils'
import { Button, Modal, PageHeader } from '../components/ui'

export function InvestmentsPage() {
  const [chartMonths, setChartMonths] = useState(24)
  const [isFetchingMarketData, setIsFetchingMarketData] = useState(false)
  const [manualEventForm, setManualEventForm] = useState<ManualInvestmentEventFormState>({
    date: '',
    eventType: 'market_buy',
    instrumentName: '',
    ticker: '',
    quantity: '',
    amount: '',
    currency: 'EUR',
    account: 'Manual',
  })
  const [isSavingManualEvent, setIsSavingManualEvent] = useState(false)
  const [isManualEventModalOpen, setIsManualEventModalOpen] = useState(false)
  const [isBackfillingHistory, setIsBackfillingHistory] = useState(false)
  const [isResolvingFx, setIsResolvingFx] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dataWarning, setDataWarning] = useState<string | null>(null)

  const {
    events,
    isInitialDataLoading,
    isMonthlySeriesLoading,
    monthlySeries,
    monthlySeriesError,
    positions,
    realisedGains,
    reloadAfterMutation,
  } = useInvestmentData({
    chartMonths,
    onBeforeLoad: () => {
      setError(null)
      setMessage(null)
    },
    onError: setError,
    onWarning: setDataWarning,
  })

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

  function openManualEventForm(position?: InvestmentPosition) {
    setError(null)
    setMessage(null)
    setManualEventForm({
      date: '',
      eventType: 'market_buy',
      instrumentName: position?.instrument_name ?? '',
      ticker: position?.ticker ?? '',
      quantity: '',
      amount: '',
      currency: position?.market_value_currency ?? position?.market_price_currency ?? 'EUR',
      account: 'Manual',
    })
    setIsManualEventModalOpen(true)
  }

  function closeManualEventModal() {
    setIsManualEventModalOpen(false)
  }

  async function submitManualInvestmentEvent() {
    setError(null)
    setMessage(null)

    const quantity = Number(manualEventForm.quantity)
    const amount = Number(manualEventForm.amount)

    if (!manualEventForm.date) {
      setError('Enter a date.')
      return
    }

    if (!manualEventForm.instrumentName.trim() && !manualEventForm.ticker.trim()) {
      setError('Enter an instrument name or ticker.')
      return
    }

    if (!manualEventForm.quantity || !Number.isFinite(quantity) || quantity <= 0) {
      setError('Enter a positive quantity.')
      return
    }

    if (!manualEventForm.amount || !Number.isFinite(amount) || amount <= 0) {
      setError('Enter a positive amount.')
      return
    }

    if (!manualEventForm.currency.trim()) {
      setError('Enter a currency.')
      return
    }

    const label = manualEventForm.instrumentName.trim() || manualEventForm.ticker.trim()
    const actionLabel = manualEventForm.eventType === 'market_buy' ? 'Manual buy' : 'Manual sell'
    const description = `${actionLabel}: ${label}`
    const price = (amount / quantity).toFixed(8)

    setIsSavingManualEvent(true)

    try {
      await createInvestmentEvent({
        date: manualEventForm.date,
        source: 'manual',
        account: manualEventForm.account.trim() || 'Manual',
        event_type: manualEventForm.eventType,
        description,
        raw_description: description,
        instrument_name: manualEventForm.instrumentName.trim() || null,
        ticker: manualEventForm.ticker.trim() || null,
        quantity: manualEventForm.quantity,
        price,
        amount: amount.toFixed(2),
        currency: manualEventForm.currency.trim().toUpperCase(),
      })

      setMessage('Manual position saved.')
      setManualEventForm({
        date: '',
        eventType: 'market_buy',
        instrumentName: '',
        ticker: '',
        quantity: '',
        amount: '',
        currency: 'EUR',
        account: 'Manual',
      })
      setIsManualEventModalOpen(false)
      reloadAfterMutation()
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to save manual position',
      )
    } finally {
      setIsSavingManualEvent(false)
    }
  }

  const depositCount = getEventCount(events, 'deposit')
  const marketBuyCount = getEventCount(events, 'market_buy')
  const unmatchedDepositCount = events.filter(
    (event) => event.event_type === 'deposit' && event.funding_match_status === 'unmatched',
  ).length
  const investmentTotals = getInvestmentTotals(positions)

  return (
    <section className="app-page investments-page">
      <PageHeader
        title="Investments"
        actions={(
          <>
            <Button
              type="button"
              size="sm"
              iconLeft={CircleCheck}
              loading={isResolvingFx}
              onClick={resolvePendingFxRates}
              title="Resolve FX rates left pending on stored events, which block historical valuation"
            >
              {isResolvingFx ? 'Resolving…' : 'Resolve FX'}
            </Button>
            <Button
              type="button"
              size="sm"
              iconLeft={History}
              loading={isBackfillingHistory}
              onClick={backfillMarketHistory}
              title="Fetch daily closing prices for the charted window so the portfolio trend reflects real market movement"
            >
              {isBackfillingHistory ? 'Backfilling…' : 'Backfill'}
            </Button>
            <Button
              type="button"
              size="sm"
              iconLeft={RefreshCw}
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

      {isInitialDataLoading && events.length === 0 && positions.length === 0 && (
        <p className="status status-info" role="status" aria-live="polite">
          Loading investment data...
        </p>
      )}

      <InvestmentPortfolioTrendChart
        months={chartMonths}
        series={monthlySeries}
        error={monthlySeriesError}
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

      <InvestmentHoldingsOverview positions={positions} onAddTrade={openManualEventForm} />

      {isManualEventModalOpen && (
        <Modal
          title={
            manualEventForm.instrumentName || manualEventForm.ticker
              ? `Add trade: ${manualEventForm.instrumentName || manualEventForm.ticker}`
              : 'Add manual position'
          }
          onClose={closeManualEventModal}
          isCloseDisabled={isSavingManualEvent}
          footer={
            <>
              <Button type="button" onClick={closeManualEventModal} disabled={isSavingManualEvent}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                loading={isSavingManualEvent}
                onClick={() => void submitManualInvestmentEvent()}
              >
                Save position
              </Button>
            </>
          }
        >
          <p className="muted small">
            For assets with no importer (e.g. Bitcoin held outside Trading
            212). Creates a real buy/sell event, so it counts toward
            holdings, valuation, and the monthly investment goal like any
            imported trade.
          </p>
          {error && <p className="status status-error" role="alert">{error}</p>}
          <ManualInvestmentEventForm
            form={manualEventForm}
            onChange={setManualEventForm}
          />
        </Modal>
      )}
    </section>
  )
}
