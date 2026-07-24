import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SettingsPage } from '../src/pages/SettingsPage'
import type { PresentationPreferences } from '../src/utils/format'

const PREFERENCES: PresentationPreferences = {
  locale: 'en-GB',
  currency: 'EUR',
  time_zone: 'Europe/Lisbon',
  date_format: 'medium',
  language: 'en',
  monthly_investment_goal_eur: '100.00',
}

function renderSettings(
  overrides: Partial<{
    preferences: PresentationPreferences
    onSavePreferences: (
      preferences: PresentationPreferences,
    ) => Promise<PresentationPreferences>
  }> = {},
) {
  const onSavePreferences =
    overrides.onSavePreferences
    ?? vi.fn(async (preferences: PresentationPreferences) => preferences)

  render(
    <SettingsPage
      isAuthEnabled={false}
      displayName="Francisco"
      accountEmail=""
      onOpenImport={vi.fn()}
      onOpenExport={vi.fn()}
      onOpenCategories={vi.fn()}
      onSignOut={vi.fn()}
      preferences={overrides.preferences ?? PREFERENCES}
      preferencesError={null}
      preferencesLoading={false}
      onSavePreferences={onSavePreferences}
      onDeleteAccount={vi.fn()}
    />,
  )

  return { onSavePreferences }
}

describe('SettingsPage monthly investment goal', () => {
  it('renders the stored monthly investment goal and its explanation', () => {
    renderSettings()

    const input = screen.getByRole('spinbutton', {
      name: /monthly investment goal/i,
    })

    expect(input).toHaveValue(100)
    expect(input).toHaveAttribute('type', 'number')
    expect(input).toHaveAttribute('min', '0.01')
    expect(input).toHaveAttribute('step', '0.01')
    expect(input).toHaveAccessibleDescription(
      'Used to track monthly investment progress on the Dashboard.',
    )
  })

  it('saves the complete preference payload with a changed goal', async () => {
    const user = userEvent.setup()
    const onSavePreferences = vi.fn(
      async (preferences: PresentationPreferences) => preferences,
    )

    renderSettings({ onSavePreferences })

    const input = screen.getByRole('spinbutton', {
      name: /monthly investment goal/i,
    })

    await user.clear(input)
    await user.type(input, '250.50')
    await user.click(
      screen.getByRole('button', { name: 'Save preferences' }),
    )

    expect(onSavePreferences).toHaveBeenCalledWith({
      ...PREFERENCES,
      monthly_investment_goal_eur: '250.5',
    })
    expect(
      await screen.findByText('Preferences saved.'),
    ).toBeInTheDocument()
  })

  it.each(['', '0', '-1'])(
    'prevents saving an invalid goal value of %j',
    async (value) => {
      const user = userEvent.setup()
      const onSavePreferences = vi.fn(
        async (preferences: PresentationPreferences) => preferences,
      )

      renderSettings({ onSavePreferences })

      const input = screen.getByRole('spinbutton', {
      name: /monthly investment goal/i,
    })

      await user.clear(input)

      if (value) {
        await user.type(input, value)
      }

      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAccessibleDescription(
        'Enter an amount greater than zero.',
      )
      expect(
        screen.getByRole('button', { name: 'Save preferences' }),
      ).toBeDisabled()
      expect(onSavePreferences).not.toHaveBeenCalled()
    },
  )

  it('shows a save failure returned by the preference API', async () => {
    const user = userEvent.setup()
    const onSavePreferences = vi.fn(
      async () => {
        throw new Error('Preference service unavailable')
      },
    )

    renderSettings({ onSavePreferences })

    await user.click(
      screen.getByRole('button', { name: 'Save preferences' }),
    )

    expect(
      await screen.findByText('Preference service unavailable'),
    ).toBeInTheDocument()
  })

  it('uses Portuguese copy when Portuguese is selected', () => {
    renderSettings({
      preferences: {
        ...PREFERENCES,
        language: 'pt',
        locale: 'pt-PT',
      },
    })

    expect(
      screen.getByRole('spinbutton', {
        name: /objetivo mensal de investimento/i,
      }),
    ).toHaveValue(100)
    expect(
      screen.getByText(
        'Utilizado para acompanhar o progresso mensal de investimento no Dashboard.',
      ),
    ).toBeInTheDocument()
  })
})
