import { TrendingUp } from 'lucide-react'
import type { InvestmentPosition, MarketPrice } from '../../types/api'
import { formatMoney } from '../../utils/format'
import { MarketPriceForm, type MarketPriceFormState } from './MarketPriceForm'
import { MarketPricesTable } from './MarketPricesTable'
import { Badge, Button, EmptyState } from '../ui'

type MarketDataPanelProps = {
  positions: InvestmentPosition[]
  manualForm: MarketPriceFormState
  isEditingManualPrice: boolean
  marketPrices: MarketPrice[]
  isFetchingMarketData: boolean
  onFetchAllLatest: () => void
  onManualFormChange: (form: MarketPriceFormState) => void
  onSubmitManualPrice: () => void
  onCancelManualEdit: () => void
  onEditManualPrice: (marketPrice: MarketPrice) => void
  onDeleteManualPrice: (marketPrice: MarketPrice) => void
}

function getDefaultYahooSymbol(position: InvestmentPosition) {
  const ticker = position.ticker?.toUpperCase()

  if (ticker === 'VWCE') {
    return 'VWCE.DE'
  }

  if (ticker === 'CSPX') {
    return 'CSPX.L'
  }

  if (ticker === 'BTC') {
    return 'BTC-EUR'
  }

  return position.ticker ?? ''
}

function getCachedMarketPrice(position: InvestmentPosition, marketPrices: MarketPrice[]) {
  return marketPrices.find((marketPrice) => {
    const matchesTicker = position.ticker && marketPrice.ticker === position.ticker
    const matchesIsin = position.isin && marketPrice.isin === position.isin

    return matchesTicker || matchesIsin
  })
}

export function MarketDataPanel({
  positions,
  manualForm,
  isEditingManualPrice,
  marketPrices,
  isFetchingMarketData,
  onFetchAllLatest,
  onManualFormChange,
  onSubmitManualPrice,
  onCancelManualEdit,
  onEditManualPrice,
  onDeleteManualPrice,
}: MarketDataPanelProps) {
  const pricedPositions = positions.filter((position) =>
    getCachedMarketPrice(position, marketPrices),
  ).length

  return (
    <section className="content-card panel-card market-data-panel">
      <div className="market-data-mobile-simple">
        <div>
          <h2>Market prices</h2>
          <p className="muted small">
            {pricedPositions} of {positions.length} updated.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          disabled={isFetchingMarketData || positions.length === 0}
          onClick={onFetchAllLatest}
        >
          {isFetchingMarketData ? 'Updating...' : 'Update prices'}
        </Button>
      </div>

      <details className="market-data-details">
        <summary>Market data</summary>

        <div className="market-data-refresh-card">
        <div>
          <strong>Refresh current prices</strong>
          <p className="muted small">
            {pricedPositions} of {positions.length} positions have a cached market price.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          disabled={isFetchingMarketData || positions.length === 0}
          onClick={onFetchAllLatest}
        >
          {isFetchingMarketData ? 'Updating...' : 'Update all prices'}
        </Button>
      </div>

      <div className="market-data-holdings-grid">
        {positions.map((position) => {
          const cachedPrice = getCachedMarketPrice(position, marketPrices)

          return (
            <article
              key={`${position.source}-${position.account}-${position.ticker}-${position.isin}`}
              className="market-data-holding-card"
            >
              <div>
                <strong>{position.ticker ?? '-'}</strong>
                <p className="muted small">{position.instrument_name ?? 'Unnamed holding'}</p>
              </div>

              <div className="market-data-holding-meta">
                <Badge tone="neutral" size="sm">
                  {getDefaultYahooSymbol(position) || 'No symbol'}
                </Badge>
                <span>
                  {cachedPrice
                    ? formatMoney(cachedPrice.price, cachedPrice.currency)
                    : 'No price'}
                </span>
              </div>
            </article>
          )
        })}

        {positions.length === 0 && (
          <div className="empty-state">
            <EmptyState
              size="sm"
              icon={TrendingUp}
              title="No open positions found."
              description="Positions appear here once you import buy events."
            />
          </div>
        )}
      </div>

      <details className="market-data-advanced">
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
      </details>
    </section>
  )
}
