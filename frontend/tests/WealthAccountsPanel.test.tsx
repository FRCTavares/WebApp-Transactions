import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WealthAccountsPanel } from '../src/components/wealth/WealthAccountsPanel'
import type { WealthAccountGroup } from '../src/utils/wealthPageUtils'

function buildAccount(id: number, name: string) {
  return {
    id,
    name,
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
}

const GROUP: WealthAccountGroup = {
  key: 'savings',
  label: 'Savings',
  accounts: [buildAccount(1, 'Savings Main'), buildAccount(2, 'Savings Bonus')],
}

function renderPanel() {
  return render(
    <WealthAccountsPanel
      accountGroups={[GROUP]}
      latestByAccount={new Map()}
      investmentPositions={[]}
      showInactiveAccounts={false}
      onShowInactiveAccountsChange={vi.fn()}
      onStartAccountEdit={vi.fn()}
      onToggleAccountActive={vi.fn()}
      onRemoveAccount={vi.fn()}
      renderAccountBalanceCell={() => <strong>€0.00</strong>}
    />,
  )
}

describe('WealthAccountDetailsModal keyboard behavior', () => {
  it('opens the group details dialog and closes it on Escape', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: /Savings.*Show details/s }))

    const dialog = await screen.findByRole('dialog', { name: 'Savings' })
    expect(screen.getByText('Main')).toBeInTheDocument()
    expect(screen.getByText('Bonus')).toBeInTheDocument()

    await user.keyboard('{Escape}')

    expect(dialog).not.toBeInTheDocument()
  })

  it('closes the dialog via its own Close button', async () => {
    const user = userEvent.setup()
    renderPanel()

    await user.click(screen.getByRole('button', { name: /Savings.*Show details/s }))
    const dialog = await screen.findByRole('dialog', { name: 'Savings' })

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(dialog).not.toBeInTheDocument()
  })
})
