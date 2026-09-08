import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
  available_net: '800.00',
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

describe('MonthlyCashflowPanel', () => {
  it('breaks income into spent, invested and available-net segments', () => {
    render(
      <MonthlyCashflowPanel
        summary={SUMMARY}
        monthLabel="July 2026"
        investmentChange={CHANGE}
      />,
    )

    const bar = screen.getByRole('img')
    // 2400 spent + 800 invested + 800 left = 4000 in → three segments.
    expect(bar.querySelectorAll('span')).toHaveLength(3)
    expect(bar).toHaveAccessibleName(
      'Of €4,000.00 in, €2,400.00 spent, €800.00 invested, €800.00 left.',
    )

    expect(screen.getByText('€2,400.00')).toBeInTheDocument()
    expect(screen.getByText('60% of money in')).toBeInTheDocument()
  })

  it('leads with available net and keeps performance labelled as excluded', () => {
    const { container } = render(
      <MonthlyCashflowPanel
        summary={SUMMARY}
        monthLabel="July 2026"
        investmentChange={CHANGE}
      />,
    )

    const headline = container.querySelector('.cashflow-headline') as HTMLElement
    expect(within(headline).getByText('Available net')).toBeInTheDocument()
    expect(within(headline).getByText('€800.00')).toBeInTheDocument()
    expect(screen.getByText('+€500.00')).toBeInTheDocument()
    expect(
      screen.getByText('unrealised market/FX — not part of cash flow'),
    ).toBeInTheDocument()
  })

  it('shows the goal shortfall and progress', () => {
    render(
      <MonthlyCashflowPanel
        summary={SUMMARY}
        monthLabel="July 2026"
        investmentChange={CHANGE}
      />,
    )

    expect(screen.getByText('€200.00 to go')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '800')
  })

  it('drops the invested and net segments when investment cash flow is unavailable', () => {
    render(
      <MonthlyCashflowPanel
        summary={{
          ...SUMMARY,
          net_invested_cash: null,
          available_net: null,
          investment_reconciliation_status: 'partial',
          investment_goal_status: 'unavailable',
        }}
        monthLabel="July 2026"
        investmentChange={null}
      />,
    )

    expect(screen.getByRole('img').querySelectorAll('span')).toHaveLength(1)
    expect(
      screen.getByText('Some investment funding is not fully reconciled.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Cash flow unavailable')).toBeInTheDocument()
  })
})
