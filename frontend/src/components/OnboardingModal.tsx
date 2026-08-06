import { useState } from 'react'
import { Button, Field, Modal } from './ui'
import type { PresentationPreferences } from '../utils/format'

type OnboardingModalProps = {
  preferences: PresentationPreferences
  onSave: (next: PresentationPreferences) => Promise<PresentationPreferences>
}

export function OnboardingModal({ preferences, onSave }: OnboardingModalProps) {
  const [step, setStep] = useState<'welcome' | 'setup'>('welcome')
  const [currency, setCurrency] = useState(preferences.currency)
  const [goal, setGoal] = useState(preferences.monthly_investment_goal_eur)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const goalValue = Number(goal)
  const goalError = goal.trim() === ''
    ? 'Enter a monthly investment goal.'
    : Number.isNaN(goalValue) || goalValue <= 0
      ? 'Enter an amount greater than zero.'
      : null

  async function finish(overrides: Partial<PresentationPreferences> = {}) {
    setIsSaving(true)
    setError(null)

    try {
      await onSave({
        ...preferences,
        currency: currency.trim().toUpperCase() || preferences.currency,
        monthly_investment_goal_eur: goal.trim() || preferences.monthly_investment_goal_eur,
        has_completed_onboarding: true,
        ...overrides,
      })
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Could not save your preferences. Try again.',
      )
      setIsSaving(false)
    }
  }

  if (step === 'welcome') {
    return (
      <Modal title="Welcome to F - Transactions" onClose={() => finish()} isCloseDisabled={isSaving}>
        <p>
          This is your personal finance tracker: transactions, investments, and net worth in one
          place. It takes a minute to set up your defaults - you can change any of this later in
          Settings.
        </p>

        <div className="action-group">
          <Button type="button" onClick={() => finish()} disabled={isSaving}>
            Skip for now
          </Button>
          <Button type="button" variant="primary" onClick={() => setStep('setup')} disabled={isSaving}>
            Let's go
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="Set your defaults"
      onClose={() => finish()}
      isCloseDisabled={isSaving}
      footer={
        <>
          <Button type="button" onClick={() => setStep('welcome')} disabled={isSaving}>
            Back
          </Button>
          <Button
            type="button"
            variant="primary"
            loading={isSaving}
            disabled={Boolean(goalError)}
            onClick={() => void finish()}
          >
            Get started
          </Button>
        </>
      }
    >
      {error && <p className="status status-error" role="alert">{error}</p>}

      <p className="muted small">
        Categories are already set up with sensible defaults - customize them anytime from
        Settings.
      </p>

      <div className="form-row">
        <Field label="Default currency">
          {(controlProps) => (
            <input
              {...controlProps}
              value={currency}
              maxLength={3}
              onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            />
          )}
        </Field>

        <Field
          label="Monthly investment goal"
          hint="Used to track your monthly investing progress on the Dashboard."
          error={goalError}
          required
        >
          {(controlProps) => (
            <input
              {...controlProps}
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
            />
          )}
        </Field>
      </div>
    </Modal>
  )
}
