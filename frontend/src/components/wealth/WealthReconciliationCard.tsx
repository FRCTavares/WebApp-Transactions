import type {
  WealthReconciliation,
  WealthReconciliationItem,
  WealthReconciliationStatus,
} from '../../types/api'
import { formatMoney } from '../../utils/format'

type WealthReconciliationCardProps = {
  reconciliation: WealthReconciliation | null
}

const statusLabels: Record<WealthReconciliationStatus, string> = {
  matched: 'Matched',
  minor_difference: 'Minor difference',
  review_needed: 'Review needed',
  manual_only: 'Manual only',
  derived_only: 'Derived only',
  not_supported: 'Not supported',
}

const sourceLabels: Record<WealthReconciliationItem['source'], string> = {
  bank_account: 'Bank account',
  brokerage: 'Brokerage',
  cash: 'Cash',
  owed: 'Owed',
  other: 'Other',
}

function getStatusClass(status: WealthReconciliationStatus) {
  if (status === 'matched') {
    return 'wealth-check-status-matched'
  }

  if (status === 'minor_difference') {
    return 'wealth-check-status-minor'
  }

  if (status === 'review_needed') {
    return 'wealth-check-status-review'
  }

  return 'wealth-check-status-neutral'
}

function formatOptionalMoney(value: string | null) {
  if (value === null) {
    return '-'
  }

  return formatMoney(value)
}

export function WealthReconciliationCard({
  reconciliation,
}: WealthReconciliationCardProps) {
  if (reconciliation === null) {
    return (
      <section className="panel-card wealth-check-card">
        <div className="section-header">
          <div>
            <h2>Wealth Check</h2>
            <p className="muted small">
              Loading manual snapshots and derived checks.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="panel-card wealth-check-card">
      <div className="section-header">
        <div>
          <h2>Wealth Check</h2>
          <p className="muted small">
            Compares manual snapshots with values derived from investments and owed items.
          </p>
        </div>

        <span className={`wealth-check-status ${getStatusClass(reconciliation.status)}`}>
          {statusLabels[reconciliation.status]}
        </span>
      </div>

      <div className="wealth-check-summary">
        <article>
          <span>Manual snapshot</span>
          <strong>{formatMoney(reconciliation.manual_total_eur)}</strong>
        </article>

        <article>
          <span>Derived check</span>
          <strong>{formatMoney(reconciliation.derived_total_eur)}</strong>
        </article>

        <article>
          <span>Difference</span>
          <strong>{formatMoney(reconciliation.difference_eur)}</strong>
        </article>
      </div>

      <div className="wealth-check-note">
        Derived/checkable total is not your full real wealth. Manual-only rows are excluded from
        derived checks until the app has enough data to calculate them safely.
      </div>

      <div className="table-wrap wealth-check-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Type</th>
              <th className="right">Manual snapshot</th>
              <th className="right">Derived check</th>
              <th>Status</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {reconciliation.items.map((item) => (
              <tr key={`${item.source}-${item.name}-${item.status}`}>
                <td>
                  <strong>{item.name}</strong>
                </td>
                <td>{sourceLabels[item.source]}</td>
                <td className="right">{formatOptionalMoney(item.manual_value_eur)}</td>
                <td className="right">{formatOptionalMoney(item.derived_value_eur)}</td>
                <td>
                  <span className={`wealth-check-status ${getStatusClass(item.status)}`}>
                    {statusLabels[item.status]}
                  </span>
                </td>
                <td className="wealth-check-notes">{item.notes ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="wealth-check-mobile-list">
        {reconciliation.items.map((item) => (
          <article key={`${item.source}-${item.name}-${item.status}`} className="wealth-check-mobile-item">
            <div>
              <strong>{item.name}</strong>
              <span>{sourceLabels[item.source]}</span>
            </div>

            <dl>
              <div>
                <dt>Manual snapshot</dt>
                <dd>{formatOptionalMoney(item.manual_value_eur)}</dd>
              </div>
              <div>
                <dt>Derived check</dt>
                <dd>{formatOptionalMoney(item.derived_value_eur)}</dd>
              </div>
            </dl>

            <span className={`wealth-check-status ${getStatusClass(item.status)}`}>
              {statusLabels[item.status]}
            </span>

            {item.notes ? <p>{item.notes}</p> : null}
          </article>
        ))}
      </div>
    </section>
  )
}
