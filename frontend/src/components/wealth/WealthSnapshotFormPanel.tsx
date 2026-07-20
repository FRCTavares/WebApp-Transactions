import { getAccountLabel, type SnapshotFormState } from '../../utils/wealthPageUtils'
import type { WealthAccount } from '../../types/api'

/**
 * The add/edit wealth snapshot form. Split out of `WealthPage.tsx` (which
 * was approaching the project's 900-line soft limit) — purely
 * presentational, all state lives in the parent page.
 */
export function WealthSnapshotFormPanel({
  snapshotForm,
  isEditing,
  accounts,
  onUpdateField,
  onAccountChange,
  onSubmit,
  onCancel,
}: {
  snapshotForm: SnapshotFormState
  isEditing: boolean
  accounts: WealthAccount[]
  onUpdateField: (field: keyof SnapshotFormState, value: string) => void
  onAccountChange: (accountId: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <section className="content-card panel-card">
      <div className="section-header">
        <div>
          <h2>{isEditing ? 'Edit wealth snapshot' : 'Add wealth snapshot'}</h2>
          <p className="muted small">
            Enter the manual balance shown by the account at the start or end of a month.
          </p>
        </div>
      </div>

      <div className="form-row">
        <label>
          Snapshot date
          <input
            type="date"
            value={snapshotForm.snapshotDate}
            onChange={(event) => onUpdateField('snapshotDate', event.target.value)}
          />
        </label>

        <label>
          Account
          <select
            value={snapshotForm.accountId}
            onChange={(event) => onAccountChange(event.target.value)}
          >
            <option value="">Choose account</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {getAccountLabel(account)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Balance
          <input
            type="number"
            min="0"
            step="0.01"
            value={snapshotForm.balance}
            onChange={(event) => onUpdateField('balance', event.target.value)}
            placeholder="2150.00"
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Currency
          <input
            value={snapshotForm.currency}
            onChange={(event) => onUpdateField('currency', event.target.value)}
            placeholder="EUR"
          />
        </label>

        <label>
          FX rate to EUR
          <input
            type="number"
            min="0"
            step="0.00000001"
            value={snapshotForm.fxRateToEur}
            onChange={(event) => onUpdateField('fxRateToEur', event.target.value)}
            placeholder="Only needed outside EUR"
          />
        </label>

        <label>
          Interest earned
          <input
            type="number"
            min="0"
            step="0.01"
            value={snapshotForm.interestEarned}
            onChange={(event) => onUpdateField('interestEarned', event.target.value)}
            placeholder="3.40"
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Notes
          <input
            value={snapshotForm.notes}
            onChange={(event) => onUpdateField('notes', event.target.value)}
            placeholder="Monthly update"
          />
        </label>
      </div>

      <div className="action-group">
        <button type="button" className="primary-button" onClick={onSubmit}>
          {isEditing ? 'Save snapshot' : 'Create snapshot'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}
