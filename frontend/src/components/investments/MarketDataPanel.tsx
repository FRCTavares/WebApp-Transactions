import type { InvestmentPosition, MarketPrice } from '../../types/api'
import { MarketPriceForm, type MarketPriceFormState } from './MarketPriceForm'
import { MarketPricesTable } from './MarketPricesTable'

export type MarketDataFetchLatestFormState = {
  symbol: string
  ticker: string
  isin: string
  currency: string
}

export type MarketDataFetchHistoryFormState = {
  symbol: string
  ticker: string
  isin: string
  currency: string
  dateFrom: string
  dateTo: string
}

type MarketDataPanelProps = {
  positions: InvestmentPosition[]
  latestForm: MarketDataFetchLatestFormState
  historyForm: MarketDataFetchHistoryFormState
  manualForm: MarketPriceFormState
  isEditingManualPrice: boolean
  marketPrices: MarketPrice[]
  onLatestFormChange: (form: MarketDataFetchLatestFormState) => void
  onHistoryFormChange: (form: MarketDataFetchHistoryFormState) => void
  onManualFormChange: (form: MarketPriceFormState) => void
  onFetchLatest: () => void
  onFetchHistory: () => void
  onSubmitManualPrice: () => void
  onCancelManualEdit: () => void
  onEditManualPrice: (marketPrice: MarketPrice) => void
  onDeleteManualPrice: (marketPrice: MarketPrice) => void
}

function getPositionKey(position: InvestmentPosition) {
  return `${position.ticker ?? ''}|${position.isin ?? ''}|${position.instrument_name ?? ''}`
}

function getPositionCurrency(position: InvestmentPosition) {
  return position.market_price_currency ?? position.costs[0]?.currency ?? ''
}

function getDefaultYahooSymbol(position: InvestmentPosition) {
  const ticker = position.ticker?.toUpperCase()

  if (ticker === 'VWCE') {
    return 'VWCE.DE'
  }

  if (ticker === 'CSPX') {
    return 'CSPX.L'
  }

  return position.ticker ?? ''
}

function getPositionLabel(position: InvestmentPosition) {
  const ticker = position.ticker ?? 'No ticker'
  const name = position.instrument_name ?? 'Unnamed holding'
  const isin = position.isin ?? 'No ISIN'

  return `${ticker} - ${name} - ${isin}`
}

function getSelectedPositionKey(
  positions: InvestmentPosition[],
  ticker: string,
  isin: string,
) {
  const selectedPosition = positions.find((position) => {
    const matchesTicker = ticker && position.ticker === ticker
    const matchesIsin = isin && position.isin === isin

    return matchesTicker || matchesIsin
  })

  return selectedPosition ? getPositionKey(selectedPosition) : ''
}

export function MarketDataPanel({
  positions,
  latestForm,
  historyForm,
  manualForm,
  isEditingManualPrice,
  marketPrices,
  onLatestFormChange,
  onHistoryFormChange,
  onManualFormChange,
  onFetchLatest,
  onFetchHistory,
  onSubmitManualPrice,
  onCancelManualEdit,
  onEditManualPrice,
  onDeleteManualPrice,
}: MarketDataPanelProps) {
  function selectLatestPosition(positionKey: string) {
    const selectedPosition = positions.find((position) => getPositionKey(position) === positionKey)

    if (!selectedPosition) {
      return
    }

    onLatestFormChange({
      symbol: getDefaultYahooSymbol(selectedPosition),
      ticker: selectedPosition.ticker ?? '',
      isin: selectedPosition.isin ?? '',
      currency: getPositionCurrency(selectedPosition),
    })
  }

  function selectHistoryPosition(positionKey: string) {
    const selectedPosition = positions.find((position) => getPositionKey(position) === positionKey)

    if (!selectedPosition) {
      return
    }

    onHistoryFormChange({
      ...historyForm,
      symbol: getDefaultYahooSymbol(selectedPosition),
      ticker: selectedPosition.ticker ?? '',
      isin: selectedPosition.isin ?? '',
      currency: getPositionCurrency(selectedPosition),
    })
  }

  return (
    <section className="panel-card market-data-panel">
      <div className="section-header">
        <div>
          <h2>Market data</h2>
          <p className="muted small">
            Select a holding, fetch prices manually, cache them locally, and use manual prices only as a fallback.
          </p>
        </div>
      </div>

      <details>
        <summary>Fetch latest price</summary>

        <div className="form-row">
          <label>
            Holding
            <select
              value={getSelectedPositionKey(positions, latestForm.ticker, latestForm.isin)}
              onChange={(event) => selectLatestPosition(event.target.value)}
            >
              <option value="">Select holding</option>
              {positions.map((position) => (
                <option key={getPositionKey(position)} value={getPositionKey(position)}>
                  {getPositionLabel(position)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Yahoo symbol
            <input
              value={latestForm.symbol}
              placeholder="VWCE.DE"
              onChange={(event) => onLatestFormChange({
                ...latestForm,
                symbol: event.target.value,
              })}
            />
          </label>

          <label>
            App ticker
            <input
              value={latestForm.ticker}
              placeholder="VWCE"
              onChange={(event) => onLatestFormChange({
                ...latestForm,
                ticker: event.target.value,
              })}
            />
          </label>

          <label>
            ISIN
            <input
              value={latestForm.isin}
              placeholder="IE00BK5BQT80"
              onChange={(event) => onLatestFormChange({
                ...latestForm,
                isin: event.target.value,
              })}
            />
          </label>

          <label>
            Currency override
            <input
              value={latestForm.currency}
              placeholder="EUR"
              onChange={(event) => onLatestFormChange({
                ...latestForm,
                currency: event.target.value.toUpperCase(),
              })}
            />
          </label>
        </div>

        <div className="action-group">
          <button type="button" onClick={onFetchLatest}>
            Fetch latest price
          </button>
        </div>
      </details>

      <details>
        <summary>Fetch historical prices</summary>

        <div className="form-row">
          <label>
            Holding
            <select
              value={getSelectedPositionKey(positions, historyForm.ticker, historyForm.isin)}
              onChange={(event) => selectHistoryPosition(event.target.value)}
            >
              <option value="">Select holding</option>
              {positions.map((position) => (
                <option key={getPositionKey(position)} value={getPositionKey(position)}>
                  {getPositionLabel(position)}
                </option>
              ))}
            </select>
          </label>

          <label>
            Yahoo symbol
            <input
              value={historyForm.symbol}
              placeholder="VWCE.DE"
              onChange={(event) => onHistoryFormChange({
                ...historyForm,
                symbol: event.target.value,
              })}
            />
          </label>

          <label>
            App ticker
            <input
              value={historyForm.ticker}
              placeholder="VWCE"
              onChange={(event) => onHistoryFormChange({
                ...historyForm,
                ticker: event.target.value,
              })}
            />
          </label>

          <label>
            ISIN
            <input
              value={historyForm.isin}
              placeholder="IE00BK5BQT80"
              onChange={(event) => onHistoryFormChange({
                ...historyForm,
                isin: event.target.value,
              })}
            />
          </label>

          <label>
            Currency override
            <input
              value={historyForm.currency}
              placeholder="EUR"
              onChange={(event) => onHistoryFormChange({
                ...historyForm,
                currency: event.target.value.toUpperCase(),
              })}
            />
          </label>

          <label>
            Date from
            <input
              type="date"
              value={historyForm.dateFrom}
              onChange={(event) => onHistoryFormChange({
                ...historyForm,
                dateFrom: event.target.value,
              })}
            />
          </label>

          <label>
            Date to
            <input
              type="date"
              value={historyForm.dateTo}
              onChange={(event) => onHistoryFormChange({
                ...historyForm,
                dateTo: event.target.value,
              })}
            />
          </label>
        </div>

        <div className="action-group">
          <button type="button" onClick={onFetchHistory}>
            Fetch historical prices
          </button>
        </div>
      </details>

      <details>
        <summary>Manual fallback price</summary>

        <MarketPriceForm
          form={manualForm}
          isEditing={isEditingManualPrice}
          onChange={onManualFormChange}
          onSubmit={onSubmitManualPrice}
          onCancelEdit={onCancelManualEdit}
        />
      </details>

      <MarketPricesTable
        marketPrices={marketPrices}
        onEdit={onEditManualPrice}
        onDelete={onDeleteManualPrice}
      />
    </section>
  )
}
