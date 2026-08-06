import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { WealthMobileAccounts } from '../src/components/wealth/WealthMobileAccounts'

const SAVINGS_ACCOUNT = {
  id: 1,
  name: 'Emergency fund',
  account_type: 'savings_account' as const,
  currency: 'EUR',
  institution: 'Bank',
  is_active: true,
  value_source: 'manual' as const,
  value_reference: null,
  notes: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('disclosure chevrons', () => {
  it('toggles a Wealth mobile account group with a decorative chevron', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <WealthMobileAccounts
        accountGroups={[
          {
            key: 'savings',
            label: 'Savings',
            accounts: [SAVINGS_ACCOUNT],
          },
        ]}
        latestByAccount={new Map()}
        investmentPositions={[]}
      />,
    )

    const summary = screen.getByText('Savings').closest('summary')
    const details = summary?.closest('details')
    const chevron = container.querySelector(
      '.wealth-mobile-account-group-header .disclosure-chevron',
    )

    expect(summary).not.toBeNull()
    expect(details).not.toBeNull()
    expect(details).not.toHaveAttribute('open')
    expect(chevron).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Emergency fund')).toBeInTheDocument()

    await user.click(summary!)

    expect(details).toHaveAttribute('open')

    await user.click(summary!)

    expect(details).not.toHaveAttribute('open')
  })
})
