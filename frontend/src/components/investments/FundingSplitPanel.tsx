import { formatMoney } from '../../utils/format'
import type { MonthlyFundingFormState } from '../../utils/investmentsPageUtils'
import { Button } from '../ui'

/**
 * The "Funding split" card on `InvestmentsPage`. Split out (which was
 * approaching the project's 900-line soft limit) — purely
 * presentational, all state lives in the parent page.
 */
export function FundingSplitPanel({
  monthlyFundingForm,
  monthlyFundingTotal,
  onUpdateField,
  onSubmit,
}: {
  monthlyFundingForm: MonthlyFundingFormState
  monthlyFundingTotal: number
  onUpdateField: (field: keyof MonthlyFundingFormState, value: string) => void
  onSubmit: () => void
}) {
  return (
    <section className="content-card panel-card investment-funding-card">
      <div className="section-header">
        <div>
          <h2>Funding split</h2>
          <p className="muted small">
            Manual money vs cashback, rounding, and residual broker cash.
          </p>
        </div>
      </div>

      <p className="investment-funding-mobile-summary">
        {formatMoney(String(monthlyFundingTotal))}
      </p>

      <details className="investment-funding-details">
        <summary>Edit funding split</summary>

        <div className="form-grid">
          <label>
            Month
            <input
              type="month"
              value={monthlyFundingForm.month}
              onChange={(event) => onUpdateField('month', event.target.value)}
            />
          </label>

          <label>
            Source
            <input
              value={monthlyFundingForm.source}
              onChange={(event) => onUpdateField('source', event.target.value)}
            />
          </label>

          <label>
            Manual investment
            <input
              min="0"
              step="0.01"
              type="number"
              value={monthlyFundingForm.manualAmount}
              onChange={(event) => onUpdateField('manualAmount', event.target.value)}
            />
          </label>

          <label>
            Cashback / rounding / residual cash
            <input
              min="0"
              step="0.01"
              type="number"
              value={monthlyFundingForm.cashbackRoundingAmount}
              onChange={(event) => onUpdateField('cashbackRoundingAmount', event.target.value)}
            />
          </label>
        </div>

        <label>
          Notes
          <textarea
            rows={2}
            value={monthlyFundingForm.notes}
            onChange={(event) => onUpdateField('notes', event.target.value)}
          />
        </label>

        <div className="section-header">
          <p className="muted small">
            Current split: {formatMoney(monthlyFundingForm.manualAmount)} manual +{' '}
            {formatMoney(monthlyFundingForm.cashbackRoundingAmount)} extra
            = {formatMoney(String(monthlyFundingTotal))}.
          </p>

          <Button type="button" variant="primary" onClick={onSubmit}>
            Save split
          </Button>
        </div>
      </details>
    </section>
  )
}
