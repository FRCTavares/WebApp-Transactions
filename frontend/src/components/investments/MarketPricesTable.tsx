import { TrendingUp } from 'lucide-react'
import type { MarketPrice } from '../../types/api'
import { formatDate, formatMoney } from '../../utils/format'
import { Badge, Button, EmptyState } from '../ui'

type MarketPricesTableProps = {
  marketPrices: MarketPrice[]
  onEdit: (marketPrice: MarketPrice) => void
  onDelete: (marketPrice: MarketPrice) => void
}

export function MarketPricesTable({
  marketPrices,
  onEdit,
  onDelete,
}: MarketPricesTableProps) {
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
              <th className="actions-cell">Actions</th>
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
                  <Badge tone="neutral" size="sm">{marketPrice.source}</Badge>
                </td>
                <td>{formatDate(marketPrice.fetched_at)}</td>
                <td className="actions-cell">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onEdit(marketPrice)}
                    aria-label={`Edit cached price for ${marketPrice.ticker}`}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => onDelete(marketPrice)}
                    aria-label={`Delete cached price for ${marketPrice.ticker}`}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}

            {marketPrices.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-state">
                  <EmptyState
                    size="sm"
                    icon={TrendingUp}
                    title="No cached market prices found."
                    description="Prices are cached here after a refresh."
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
