import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MonthlyCashflowPanel } from '../src/components/dashboard/MonthlyCashflowPanel'
import type { InvestmentMonthlyChange, MonthlySummary } from '../src/types/api'

const SUMMARY: MonthlySummary = {
  month: '2026-07',
  gross_money_in: '4000.00',
  money_in: '4000.00',
  money_out: '2600.00',
  owed_expense_amount: '0.00',
  personal_money_out: '2400.00',
  reimbursement_received_amount: '0.00',
  owed_payment_extra_income: '0.00',
  net: '1400.00',
  personal_net: '1600.00',
  net_invested_cash: '800.00',
  available_net: '750.00',
  trip_savings_goal_eur: '50.00',
  trip_savings_allocated_eur: '50.00',
  trip_savings_allocation_source: 'default',
  trip_savings_goal_status: 'reached',
  investment_cashflow_status: 'available',
  investment_reconciliation_status: 'complete',
  investment_goal_eur: '1000.00',
  investment_goal_remaining: '200.00',
  investment_goal_over: null,
  investment_goal_status: 'in_progress',
  open_owed_amount: '0.00',
  top_expense_categories: [],
}

const CHANGE: InvestmentMonthlyChange = {
  month: '2026-07',
  start_value: '10000.00',
  end_value: '10500.00',
  net_invested: '800.00',
  unrealised_monthly_change: '500.00',
  is_estimated: false,
}

function renderPanel(
  overrides: Partial<{
    summary: MonthlySummary
    onSaveTripSavings: (amountEur: string | null) => Promise<void>
  }> = {},
) {
  const onSaveTripSavings =
    overrides.onSaveTripSavings ?? vi.fn(async () => undefined)

  render(
    <MonthlyCashflowPanel
      summary={overrides.summary ?? SUMMARY}
      monthLabel="July 2026"
      investmentChange={CHANGE}
      onSaveTripSavings={onSaveTripSavings}
    />,
  )

  return { onSaveTripSavings }
}

describe('MonthlyCashflowPanel', () => {
  it('shows the five monthly cash-flow figures in the required order', () => {
    renderPanel()

    const bar = screen.getByRole('img')
    expect(bar.querySelectorAll('span')).toHaveLength(4)
    expect(bar).toHaveAccessibleName(
      'Of €4,000.00 in, €2,400.00 spent, €800.00 invested, €50.00 trip savings, €750.00 available.',
    )

    const labels = Array.from(
      document.querySelectorAll('.cashflow-stat > span'),
    ).map((element) => element.textContent)

    expect(labels).toEqual([
      'Income',
      'Spent',
      'Invested',
      'Trip savings',
      'Available net',
    ])
  })

  it('distinguishes the target from the actual monthly allocation', () => {
    renderPanel({
      summary: {
        ...SUMMARY,
        trip_savings_allocated_eur: '80.00',
        trip_savings_allocation_source: 'override',
        trip_savings_goal_status: 'exceeded',
        available_net: '720.00',
      },
    })

    expect(screen.getByText('€80.00')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Target €50.00 • month override • €30.00 above target',
      ),
    ).toBeInTheDocument()
  })

  it('records an explicit zero month override', async () => {
    const user = userEvent.setup()
    const onSaveTripSavings = vi.fn(async () => undefined)

    renderPanel({ onSaveTripSavings })

    await user.click(screen.getByRole('button', { name: 'Edit month' }))

    const input = screen.getByRole('spinbutton', {
      name: 'Trip savings for July 2026',
    })
    await user.clear(input)
    await user.type(input, '0')
    await user.click(screen.getByRole('button', { name: 'Save month' }))

    expect(onSaveTripSavings).toHaveBeenCalledWith('0')
  })

  it('can return the selected month to the normal default', async () => {
    const user = userEvent.setup()
    const onSaveTripSavings = vi.fn(async () => undefined)

    renderPanel({
      summary: {
        ...SUMMARY,
        trip_savings_allocated_eur: '80.00',
        trip_savings_allocation_source: 'override',
        trip_savings_goal_status: 'exceeded',
      },
      onSaveTripSavings,
    })

    await user.click(screen.getByRole('button', { name: 'Edit month' }))
    await user.click(
      screen.getByRole('button', { name: 'Use normal default' }),
    )

    expect(onSaveTripSavings).toHaveBeenCalledWith(null)
  })

  it('leads with authoritative Available Net', () => {
    const { container } = render(
      <MonthlyCashflowPanel
        summary={SUMMARY}
        monthLabel="July 2026"
        investmentChange={CHANGE}
        onSaveTripSavings={vi.fn(async () => undefined)}
      />,
    )

    const headline = container.querySelector('.cashflow-headline') as HTMLElement

    expect(within(headline).getByText('Available net')).toBeInTheDocument()
    expect(within(headline).getByText('€750.00')).toBeInTheDocument()
    expect(
      within(headline).getByText(
        'after spending, investing and trip savings',
      ),
    ).toBeInTheDocument()
  })

  it('keeps investment performance outside cash flow', () => {
    renderPanel()

    expect(screen.getByText('+€500.00')).toBeInTheDocument()
    expect(
      screen.getByText('unrealised market/FX — not part of cash flow'),
    ).toBeInTheDocument()
  })

  it('shows investment goal progress separately', () => {
    renderPanel()

    expect(screen.getByText('€200.00 to go')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '800',
    )
  })

  it('keeps trip savings known when investment cash flow is unavailable', () => {
    renderPanel({
      summary: {
        ...SUMMARY,
        net_invested_cash: null,
        available_net: null,
        investment_reconciliation_status: 'partial',
        investment_goal_status: 'unavailable',
      },
    })

    expect(screen.getByText('Trip savings')).toBeInTheDocument()
    expect(screen.getByText('€50.00')).toBeInTheDocument()
    expect(screen.getByText('Cash flow unavailable')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Some investment funding is not fully reconciled.',
      ),
    ).toBeInTheDocument()
  })
})
