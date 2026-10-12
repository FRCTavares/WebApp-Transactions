import { useState } from 'react'
import { getAccountName } from '../../utils/wealthPageUtils'
import type { WealthAccount, WealthSnapshot } from '../../types/api'
import { formatDate, formatMoney } from '../../utils/format'
import { Button, EmptyState, IconButton } from '../ui'
import { CalendarClock, Pencil, Trash2 } from 'lucide-react'

/**
 * The manual snapshots history table. Split out of `WealthPage.tsx`
 * (which was approaching the project's 900-line soft limit) — purely
 * presentational, all state lives in the parent page.
 */
const SNAPSHOT_PAGE = 12

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
  const [accountId, setAccountId] = useState('')
  const [visible, setVisible] = useState(SNAPSHOT_PAGE)
  const filtered = accountId
    ? sortedSnapshots.filter((snapshot) => String(snapshot.account_id) === accountId)
    : sortedSnapshots
  const shown = filtered.slice(0, visible)

  return (
    <section className="content-card panel-card wealth-snapshots-panel">
      <div className="section-header">
        <div>
          <h2>Snapshots</h2>
          <p className="muted small">
            Manual bank, cash, savings, and other account balances, newest first. Derived owed and investment values are not entered here.
          </p>
        </div>

        <Button type="button" size="sm" onClick={onToggleOpen}>
          {isOpen ? 'Hide snapshots' : 'Show snapshots'}
        </Button>
      </div>

      {isOpen && accounts.length > 1 ? (
        <label className="wealth-snapshots-filter">
          <span>Account</span>
          <select
            value={accountId}
            onChange={(event) => {
              setAccountId(event.target.value)
              setVisible(SNAPSHOT_PAGE)
            }}
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

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
            {shown.map((snapshot) => (
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
                    <IconButton
                      icon={Pencil}
                      size="md"
                      label={`Edit snapshot ${formatDate(snapshot.snapshot_date)}`}
                      onClick={() => onStartEdit(snapshot)}
                    />
                    <IconButton
                      icon={Trash2}
                      size="md"
                      variant="danger"
                      label={`Delete snapshot ${formatDate(snapshot.snapshot_date)}`}
                      onClick={() => onRemove(snapshot)}
                    />
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9}>
                  <EmptyState
                    icon={CalendarClock}
                    title="No snapshots yet"
                    description="Add your first manual month-start or month-end balance snapshot."
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        </div>
      ) : null}

      {isOpen && filtered.length > visible ? (
        <div className="wealth-snapshots-more">
          <span className="muted small">
            Showing {shown.length} of {filtered.length}
          </span>
          <Button type="button" size="sm" onClick={() => setVisible((count) => count + SNAPSHOT_PAGE)}>
            Show {Math.min(SNAPSHOT_PAGE, filtered.length - visible)} more
          </Button>
        </div>
      ) : null}
    </section>
  )
}
