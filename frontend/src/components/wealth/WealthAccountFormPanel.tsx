import {
  accountTypeOptions,
  type AccountFormState,
} from '../../utils/wealthPageUtils'
import type { WealthAccountType } from '../../types/api'

/**
 * The add/edit wealth account form. Split out of `WealthPage.tsx` (which
 * was approaching the project's 900-line soft limit) — purely
 * presentational, all state lives in the parent page.
 */
export function WealthAccountFormPanel({
  accountForm,
  isEditing,
  onUpdateField,
  onSubmit,
  onCancel,
}: {
  accountForm: AccountFormState
  isEditing: boolean
  onUpdateField: (field: keyof AccountFormState, value: string) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <section className="content-card panel-card">
      <div className="section-header">
        <div>
          <h2>{isEditing ? 'Edit wealth account' : 'Add wealth account'}</h2>
          <p className="muted small">
            Create manual balance accounts for banks, cash, savings, and other non-investment balances.
          </p>
        </div>
      </div>

      <div className="form-row">
        <label>
          Name
          <input
            value={accountForm.name}
            onChange={(event) => onUpdateField('name', event.target.value)}
            placeholder="ActivoBank Savings"
          />
        </label>

        <label>
          Type
          <select
            value={accountForm.accountType}
            onChange={(event) => onUpdateField('accountType', event.target.value as WealthAccountType)}
          >
            {accountTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Currency
          <input
            value={accountForm.currency}
            onChange={(event) => onUpdateField('currency', event.target.value)}
            placeholder="EUR"
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Value source
          <select
            value={accountForm.valueSource}
            onChange={(event) => onUpdateField('valueSource', event.target.value)}
          >
            <option value="manual">Manual snapshots</option>
            <option value="investment">Derived investment value</option>
            <option value="owed">Derived money owed</option>
          </select>
        </label>

        {accountForm.valueSource === 'investment' && (
          <label>
            Investment ticker or reference
            <input
              value={accountForm.valueReference}
              onChange={(event) => onUpdateField('valueReference', event.target.value)}
              placeholder="CSPX"
              required
            />
          </label>
        )}

        <label>
          Institution
          <input
            value={accountForm.institution}
            onChange={(event) => onUpdateField('institution', event.target.value)}
            placeholder="ActivoBank"
          />
        </label>

        <label>
          Notes
          <input
            value={accountForm.notes}
            onChange={(event) => onUpdateField('notes', event.target.value)}
            placeholder="Emergency fund, broker, cash, etc."
          />
        </label>
      </div>

      <div className="action-group">
        <button type="button" className="primary-button" onClick={onSubmit}>
          {isEditing ? 'Save account' : 'Create account'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}
