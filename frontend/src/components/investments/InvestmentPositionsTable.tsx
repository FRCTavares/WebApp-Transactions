import type { InvestmentPosition } from '../../types/api'
import { formatMoney } from '../../utils/format'

type InvestmentPositionsTableProps = {
  positions: InvestmentPosition[]
}

export function InvestmentPositionsTable({ positions }: InvestmentPositionsTableProps) {
  return (
    <section className="panel-card">
      <div className="section-header">
        <div>
          <h2>Positions</h2>
          <p className="muted small">
            Holdings calculated from imported market buy and sell events. Current values use cached market prices.
          </p>
        </div>
      </div>

      <div className="table-wrap">
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
                      {formatMoney(cost.total_cost, cost.currency)} {cost.currency}
                    </span>
                  ))}
                </td>
                <td className="right">
                  {position.market_price && position.market_price_currency
                    ? formatMoney(position.market_price, position.market_price_currency)
                    : '-'}
                </td>
                <td className="right">
                  {position.market_value && position.market_price_currency
                    ? formatMoney(position.market_value, position.market_price_currency)
                    : '-'}
                </td>
                <td className="right">
                  {position.unrealised_gain && position.market_price_currency
                    ? formatMoney(position.unrealised_gain, position.market_price_currency)
                    : '-'}
                </td>
              </tr>
            ))}

            {positions.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-state">
                  No open positions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
