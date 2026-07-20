import { getAccountName } from '../../utils/wealthPageUtils'
import type { WealthAccount, WealthSnapshot } from '../../types/api'
import { formatDate, formatMoney } from '../../utils/format'

/**
 * The manual snapshots history table. Split out of `WealthPage.tsx`
 * (which was approaching the project's 900-line soft limit) — purely
 * presentational, all state lives in the parent page.
 */
export function WealthSnapshotsTablePanel({
  sortedSnapshots,
  accounts,
  isOpen,
  onToggleOpen,
  onStartEdit,
  onRemove,
}: {
  sortedSnapshots: WealthSnapshot[]
  accounts: WealthAccount[]
  isOpen: boolean
  onToggleOpen: () => void
  onStartEdit: (snapshot: WealthSnapshot) => void
  onRemove: (snapshot: WealthSnapshot) => void
}) {
  return (
    <section className="content-card panel-card wealth-snapshots-panel">
      <div className="section-header">
        <div>
          <h2>Snapshots</h2>
          <p className="muted small">
            Manual bank, cash, savings, and other account balances, newest first. Derived owed and investment values are not entered here.
          </p>
        </div>

        <button
          type="button"
          className="small-button"
          onClick={onToggleOpen}
        >
          {isOpen ? 'Hide snapshots' : 'Show snapshots'}
        </button>
      </div>

      {isOpen ? (
        <div className="table-wrap wealth-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Account</th>
              <th className="right">Balance</th>
              <th>Currency</th>
              <th className="right">Balance EUR</th>
              <th>FX rate</th>
              <th className="right">Interest</th>
              <th>Notes</th>
              <th className="actions-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedSnapshots.map((snapshot) => (
              <tr key={snapshot.id}>
                <td>{formatDate(snapshot.snapshot_date)}</td>
                <td>{getAccountName(accounts, snapshot.account_id)}</td>
                <td className="right">{formatMoney(snapshot.balance, snapshot.currency)}</td>
                <td>{snapshot.currency}</td>
                <td className="right">{formatMoney(snapshot.balance_eur)}</td>
                <td>{snapshot.fx_rate_to_eur}</td>
                <td className="right">
                  {snapshot.interest_earned ? formatMoney(snapshot.interest_earned) : '-'}
                </td>
                <td>{snapshot.notes ?? '-'}</td>
                <td>
                  <div className="table-action-group">
                    <button type="button" className="small-button" onClick={() => onStartEdit(snapshot)}>
                      Edit
                    </button>
                    <button type="button" className="small-button danger-button" onClick={() => onRemove(snapshot)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {sortedSnapshots.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <div className="wealth-empty-state">
                    <strong>No snapshots yet.</strong>
                    <p className="muted small">Add your first manual month-start or month-end balance snapshot.</p>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      ) : null}
    </section>
  )
}
