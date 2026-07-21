import { TrendingUp } from 'lucide-react'
import type { InvestmentPosition } from '../../types/api'
import { formatMoney } from '../../utils/format'
import { EmptyState } from '../ui'
import { formatFxSource, getFxSourceHint } from '../../utils/fxSourceLabels'

type InvestmentHoldingsOverviewProps = {
  positions: InvestmentPosition[]
}

function toNumber(value: string | null | undefined) {
  const number = Number(value ?? 0)

  return Number.isNaN(number) ? 0 : number
}

function getPositionLabel(position: InvestmentPosition) {
  return position.ticker ?? position.isin ?? position.instrument_name ?? 'Unknown'
}

function getPositionName(position: InvestmentPosition) {
  return position.instrument_name ?? position.isin ?? position.ticker ?? 'Unnamed holding'
}

function getGainClassName(value: string | null) {
  const numericValue = toNumber(value)

  if (numericValue > 0) {
    return 'investment-gain-positive'
  }

  if (numericValue < 0) {
    return 'investment-gain-negative'
  }

  return 'investment-gain-neutral'
}

function getAllocationPercentage(position: InvestmentPosition, totalValue: number) {
  if (totalValue <= 0) {
    return 0
  }

  return (toNumber(position.market_value) / totalValue) * 100
}

export function InvestmentHoldingsOverview({ positions }: InvestmentHoldingsOverviewProps) {
  const sortedPositions = [...positions].sort((left, right) => {
    return toNumber(right.market_value) - toNumber(left.market_value)
  })

  const totalMarketValue = sortedPositions.reduce(
    (total, position) => total + toNumber(position.market_value),
    0,
  )

  return (
    <section className="content-card panel-card investment-holdings-card">
      <div className="section-header">
        <div>
          <h2>Holdings</h2>
          <p className="muted small">
            Current open positions by market value and unrealised gain/loss.
          </p>
        </div>
      </div>

      <div className="investment-holdings-grid">
        {sortedPositions.map((position, index) => {
          const allocationPercentage = getAllocationPercentage(position, totalMarketValue)

          return (
            <article
              className={index === 0 ? 'investment-holding-card investment-holding-card-primary' : 'investment-holding-card'}
              key={`${position.source}-${position.account}-${position.ticker}-${position.isin}`}
            >
              <div className="investment-holding-header">
                <div>
                  <span className="investment-holding-ticker">{getPositionLabel(position)}</span>
                  <h3>{getPositionName(position)}</h3>
                </div>

                <strong>
                  {position.market_value && position.market_value_currency
                    ? formatMoney(position.market_value, position.market_value_currency)
                    : '-'}
                </strong>
              </div>

              <div className="investment-holding-meta">
                <span>{allocationPercentage.toFixed(0)}% of portfolio</span>
                <span className={getGainClassName(position.unrealised_gain)}>
                  {position.unrealised_gain && position.market_value_currency
                    ? formatMoney(position.unrealised_gain, position.market_value_currency)
                    : '-'}
                </span>
              </div>

              <div className="investment-holding-track">
                <span style={{ width: `${Math.max(allocationPercentage, 3)}%` }} />
              </div>

              <dl className="investment-holding-details">
                <div>
                  <dt>Quantity</dt>
                  <dd>{position.quantity}</dd>
                </div>
                <div>
                  <dt>Price</dt>
                  <dd>
                    {position.market_price && position.market_price_currency
                      ? formatMoney(position.market_price, position.market_price_currency)
                      : '-'}
                  </dd>
                  <small className="muted">
                    {position.market_price_source ?? 'No valuation source'}
                    {position.market_price_fetched_at
                      ? ` · ${new Date(position.market_price_fetched_at).toLocaleDateString()}`
                      : ''}
                  </small>
                </div>
                <div>
                  <dt>Cost</dt>
                  <dd>
                    {position.costs.map((cost) => (
                      <span key={cost.currency}>
                        {formatMoney(cost.total_cost, cost.currency)}
                      </span>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt>FX source</dt>
                  <dd title={getFxSourceHint(position.market_fx_rate_source)}>
                    {formatFxSource(position.market_fx_rate_source)}
                  </dd>
                </div>
              </dl>
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
    </section>
  )
}
