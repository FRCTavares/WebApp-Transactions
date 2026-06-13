import type { MarketPrice } from '../../types/api'
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

export function MarketDataPanel({
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
  return (
    <section className="panel-card">
      <div className="section-header">
        <div>
          <h2>Market data</h2>
          <p className="muted small">
            Fetch prices manually, cache them locally, and use manual prices only as a fallback.
          </p>
        </div>
      </div>

      <details open>
        <summary>Fetch latest price</summary>

        <div className="form-row">
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
