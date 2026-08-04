import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  ManualInvestmentEventForm,
  type ManualInvestmentEventFormState,
} from '../src/components/investments/ManualInvestmentEventForm'

function buildForm(
  overrides: Partial<ManualInvestmentEventFormState> = {},
): ManualInvestmentEventFormState {
  return {
    date: '2026-08-01',
    eventType: 'market_buy',
    instrumentName: 'Bitcoin',
    ticker: 'BTC',
    quantity: '0.002',
    amount: '150.00',
    currency: 'EUR',
    account: 'Manual',
    ...overrides,
  }
}

describe('ManualInvestmentEventForm', () => {
  it('renders the current form values', () => {
    render(
      <ManualInvestmentEventForm
        form={buildForm()}
        isSubmitting={false}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByDisplayValue('Bitcoin')).toBeInTheDocument()
    expect(screen.getByDisplayValue('BTC')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0.002')).toBeInTheDocument()
    expect(screen.getByDisplayValue('150.00')).toBeInTheDocument()
  })

  it('reports field edits via onChange without mutating the caller-owned state', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <ManualInvestmentEventForm
        form={buildForm({ ticker: '' })}
        isSubmitting={false}
        onChange={onChange}
        onSubmit={vi.fn()}
      />,
    )

    await user.type(screen.getByPlaceholderText('BTC'), 'B')

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: 'B' }),
    )
  })

  it('calls onSubmit when the save button is clicked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()

    render(
      <ManualInvestmentEventForm
        form={buildForm()}
        isSubmitting={false}
        onChange={vi.fn()}
        onSubmit={onSubmit}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Save position' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('disables the save button while submitting', () => {
    render(
      <ManualInvestmentEventForm
        form={buildForm()}
        isSubmitting
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Save position' })).toBeDisabled()
  })
})
