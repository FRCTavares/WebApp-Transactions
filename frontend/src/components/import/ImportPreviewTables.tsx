import type {
  ImportInvalidRow,
  ImportPreviewInvestmentEvent,
  ImportPreviewTransaction,
  InvestmentEvent,
} from '../../types/api'
import { formatDate, formatMoney } from '../../utils/format'
import { formatFxStatus } from '../../utils/importPreview'

/**
 * Read-only preview/history tables used by `ImportPage`. Split out of
 * `ImportPage.tsx` (which was approaching the project's 1,000-line hard
 * limit) — these are pure presentational components with no state of
 * their own.
 */

export function PreviewTransactionsTable({
  title,
  transactions,
}: {
  title: string
  transactions: ImportPreviewTransaction[]
}) {
  if (transactions.length === 0) {
    return null
  }

  return (
    <section className="import-preview-section">
      <div className="import-preview-section-header">
        <h2>{title}</h2>
        <span>{transactions.length} rows</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Row</th>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Direction</th>
              <th>FX</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.slice(0, 50).map((transaction) => (
              <tr key={`${transaction.row_number}-${transaction.dedupe_hash}`}>
                <td>{transaction.row_number}</td>
                <td>{transaction.date}</td>
                <td>
                  <div>{transaction.description}</div>
                  <div className="muted small">{transaction.raw_description}</div>
                </td>
                <td>
                  {transaction.category ? (
                    <span className="badge badge-neutral">{transaction.category}</span>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  <span className={`badge badge-direction-${transaction.direction}`}>
                    {transaction.direction}
                  </span>
                </td>
                <td>
                  {transaction.fx_rate_source === 'pending' ? (
                    <span className="badge badge-status-failed">Pending</span>
                  ) : (
                    <span className="muted small">{formatFxStatus(transaction)}</span>
                  )}
                </td>
                <td className="right">
                  {formatMoney(transaction.amount, transaction.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function PreviewInvestmentEventsTable({
  title,
  events,
}: {
  title: string
  events: ImportPreviewInvestmentEvent[]
}) {
  if (events.length === 0) {
    return null
  }

  return (
    <section className="import-preview-section">
      <div className="import-preview-section-header">
        <h2>{title}</h2>
        <span>{events.length} rows</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Row</th>
              <th>Date</th>
              <th>Event</th>
              <th>Description</th>
              <th>FX</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {events.slice(0, 50).map((event) => (
              <tr key={`${event.row_number}-${event.dedupe_hash}`}>
                <td>{event.row_number}</td>
                <td>{event.date}</td>
                <td>
                  <span className="badge badge-neutral">{event.event_type}</span>
                </td>
                <td>
                  <div>{event.description}</div>
                  <div className="muted small">{event.raw_description}</div>
                </td>
                <td>
                  {event.fx_rate_source === 'pending' ? (
                    <span className="badge badge-status-failed">Pending</span>
                  ) : (
                    <span className="muted small">{formatFxStatus(event)}</span>
                  )}
                </td>
                <td className="right">
                  {formatMoney(event.amount, event.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {events.length > 50 && (
        <p className="muted small">Showing first 50 of {events.length} investment events.</p>
      )}
    </section>
  )
}

export function InvalidRowsTable({ rows }: { rows: ImportInvalidRow[] }) {
  if (rows.length === 0) {
    return null
  }

  return (
    <section className="import-preview-section import-invalid-section">
      <div className="import-preview-section-header">
        <h2>Invalid rows</h2>
        <span>{rows.length} rows</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Row</th>
              <th>Error</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 50).map((row) => (
              <tr key={`${row.row_number}-${row.error}`}>
                <td>{row.row_number}</td>
                <td>{row.error}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > 50 && (
        <p className="muted small">Showing first 50 of {rows.length} invalid rows.</p>
      )}
    </section>
  )
}

export function BatchInvestmentEventsTable({ events }: { events: InvestmentEvent[] }) {
  if (events.length === 0) {
    return null
  }

  return (
    <section className="import-preview-section">
      <div className="import-preview-section-header">
        <h2>Investment events</h2>
        <span>{events.length} rows</span>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Description</th>
              <th>Instrument</th>
              <th>Funding</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{formatDate(event.date)}</td>
                <td>
                  <span className="badge badge-neutral">{event.event_type}</span>
                </td>
                <td>
                  <div>{event.description}</div>
                  <div className="muted small">{event.raw_description}</div>
                </td>
                <td>
                  {event.instrument_name || event.ticker || event.isin ? (
                    <div>
                      <div>{event.instrument_name || event.ticker || event.isin}</div>
                      <div className="muted small">
                        {[event.ticker, event.isin].filter(Boolean).join(' · ') || '-'}
                      </div>
                    </div>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td>
                  {event.funding_match_status ? (
                    <span className="badge badge-neutral">
                      {event.funding_source ?? 'funding'} · {event.funding_match_status}
                    </span>
                  ) : (
                    <span className="muted">-</span>
                  )}
                </td>
                <td className="right">
                  {formatMoney(event.amount, event.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
