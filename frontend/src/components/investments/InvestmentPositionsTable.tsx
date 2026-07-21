import { TrendingUp } from 'lucide-react'
import type { InvestmentPosition } from '../../types/api'
import { formatMoney } from '../../utils/format'
import { Badge, EmptyState } from '../ui'

type InvestmentPositionsTableProps = {
  positions: InvestmentPosition[]
}

function getGainClassName(value: string | null) {
  if (value === null) {
    return 'investment-gain-neutral'
  }

  const numericValue = Number(value)

  if (Number.isNaN(numericValue)) {
    return 'investment-gain-neutral'
  }

  if (numericValue > 0) {
    return 'investment-gain-positive'
  }

  if (numericValue < 0) {
    return 'investment-gain-negative'
  }

  return 'investment-gain-neutral'
}

export function InvestmentPositionsTable({ positions }: InvestmentPositionsTableProps) {
  return (
    <section className="content-card panel-card investment-positions-card">
      <div className="section-header">
        <div>
          <h2>Positions</h2>
          <p className="muted small">
            Holdings calculated from imported market buy and sell events. Current values use cached market prices.
          </p>
        </div>
      </div>

      <div className="investment-position-mobile-list">
        {positions.map((position) => (
          <article
            className="investment-position-mobile-card"
            key={`${position.source}-${position.account}-${position.ticker}-${position.isin}-mobile`}
          >
            <div className="investment-position-mobile-header">
              <div>
                <strong>{position.ticker ?? '-'}</strong>
                <p className="muted small">{position.instrument_name ?? 'Unnamed holding'}</p>
              </div>
              <Badge tone="neutral" size="sm">{position.isin ?? '-'}</Badge>
            </div>

            <dl className="investment-position-mobile-details">
              <div>
                <dt>Quantity</dt>
                <dd>{position.quantity}</dd>
              </div>
              <div>
                <dt>Cost basis</dt>
                <dd>
                  {position.costs.map((cost) => (
                    <span key={cost.currency}>
                      {formatMoney(cost.total_cost, cost.currency)}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Current price</dt>
                <dd>
                  {position.market_price && position.market_price_currency
                    ? formatMoney(position.market_price, position.market_price_currency)
                    : '-'}
                </dd>
              </div>
              <div>
                <dt>Current value</dt>
                <dd>
                  {position.market_value && position.market_value_currency
                    ? formatMoney(position.market_value, position.market_value_currency)
                    : '-'}
                </dd>
              </div>
              <div>
                <dt>Gain/Loss</dt>
                <dd>
                  <span className={getGainClassName(position.unrealised_gain)}>
                    {position.unrealised_gain && position.market_value_currency
                      ? formatMoney(position.unrealised_gain, position.market_value_currency)
                      : '-'}
                  </span>
                </dd>
              </div>
            </dl>
          </article>
        ))}

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

      <div className="table-wrap investment-position-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Name</th>
              <th>ISIN</th>
              <th className="right">Quantity</th>
              <th className="right">Cost basis</th>
              <th className="right">Current price</th>
              <th className="right">Current value</th>
              <th className="right">Gain/Loss</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <tr key={`${position.source}-${position.account}-${position.ticker}-${position.isin}`}>
                <td>
                  <strong>{position.ticker ?? '-'}</strong>
                </td>
                <td>{position.instrument_name ?? '-'}</td>
                <td>{position.isin ?? '-'}</td>
                <td className="right">{position.quantity}</td>
                <td className="right">
                  {position.costs.map((cost) => (
                    <span className="table-subtext" key={cost.currency}>
                      {formatMoney(cost.total_cost, cost.currency)}
                    </span>
                  ))}
                </td>
                <td className="right">
                  {position.market_price && position.market_price_currency
                    ? formatMoney(position.market_price, position.market_price_currency)
                    : '-'}
                </td>
                <td className="right">
                  {position.market_value && position.market_value_currency
                    ? (
                      <>
                        {formatMoney(position.market_value, position.market_value_currency)}
                        <span className="table-subtext muted">
                          Valuation: {position.market_price_source ?? 'unknown'}
                        </span>
                        {position.market_fx_rate_to_eur && position.market_price_currency !== position.market_value_currency && (
                          <span className="table-subtext muted">
                            FX {position.market_price_currency}/EUR {position.market_fx_rate_to_eur} · {position.market_fx_rate_source ?? 'unknown source'}
                          </span>
                        )}
                      </>
                    )
                    : '-'}
                </td>
                <td className="right">
                  <span className={getGainClassName(position.unrealised_gain)}>
                    {position.unrealised_gain && position.market_value_currency
                      ? formatMoney(position.unrealised_gain, position.market_value_currency)
                      : '-'}
                  </span>
                </td>
              </tr>
            ))}

            {positions.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-state">
                  <EmptyState
                    size="sm"
                    icon={TrendingUp}
                    title="No open positions found."
                    description="Positions appear here once you import buy events."
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
