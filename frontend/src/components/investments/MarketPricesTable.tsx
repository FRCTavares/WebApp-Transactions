import type { MarketPrice } from '../../types/api'
import { formatDate, formatMoney } from '../../utils/format'

type MarketPricesTableProps = {
  marketPrices: MarketPrice[]
}

export function MarketPricesTable({ marketPrices }: MarketPricesTableProps) {
  return (
    <section className="panel-card">
      <div className="section-header">
        <div>
          <h2>Cached market prices</h2>
          <p className="muted small">
            Latest saved prices used by the positions table.
          </p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>ISIN</th>
              <th className="right">Price</th>
              <th>Source</th>
              <th>Fetched at</th>
            </tr>
          </thead>
          <tbody>
            {marketPrices.map((marketPrice) => (
              <tr key={marketPrice.id}>
                <td>
                  <strong>{marketPrice.ticker ?? '-'}</strong>
                </td>
                <td>{marketPrice.isin ?? '-'}</td>
                <td className="right">
                  {formatMoney(marketPrice.price, marketPrice.currency)} {marketPrice.currency}
                </td>
                <td>
                  <span className="badge badge-source">{marketPrice.source}</span>
                </td>
                <td>{formatDate(marketPrice.fetched_at)}</td>
              </tr>
            ))}

            {marketPrices.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  No cached market prices found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
