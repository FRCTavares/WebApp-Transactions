import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardPage } from '../src/pages/DashboardPage'

const mocks = vi.hoisted(() => ({
  getInvestmentMonthlyChange: vi.fn(),
  listTransactions: vi.fn(),
  getCategorySummary: vi.fn(),
  getMonthlySummary: vi.fn(),
  useAuth: vi.fn(),
  usePeriod: vi.fn(),
}))

vi.mock('../src/api/investmentEvents', () => ({
  getInvestmentMonthlyChange: mocks.getInvestmentMonthlyChange,
}))

vi.mock('../src/api/transactions', () => ({
  listTransactions: mocks.listTransactions,
}))

vi.mock('../src/api/summary', () => ({
  getCategorySummary: mocks.getCategorySummary,
  getMonthlySummary: mocks.getMonthlySummary,
}))

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: mocks.useAuth,
}))

vi.mock('../src/hooks/usePeriod', () => ({
  usePeriod: mocks.usePeriod,
}))

const MONTHLY_SUMMARY = {
  month: '2026-07',
  gross_money_in: '1000.00',
  money_in: '1000.00',
  money_out: '400.00',
  owed_expense_amount: '0.00',
  personal_money_out: '400.00',
  reimbursement_received_amount: '0.00',
  owed_payment_extra_income: '0.00',
  net: '600.00',
  personal_net: '600.00',
  net_invested_cash: '100.00',
  available_net: '500.00',
  investment_cashflow_status: 'available',
  investment_reconciliation_status: 'complete',
  investment_goal_eur: '100.00',
  investment_goal_remaining: '0.00',
  investment_goal_over: '0.00',
  investment_goal_status: 'reached',
  open_owed_amount: '0.00',
  top_expense_categories: [],
}

function makeExpense(id: number, description: string, overrides = {}) {
  return {
    id,
    date: `2026-07-${String(30 - id).padStart(2, '0')}`,
    description,
    raw_description: description,
    amount: '20.00',
    direction: 'out',
    category: 'Other',
    notes: null,
    is_owed: false,
    owed_amount_total: null,
    ...overrides,
  }
}

describe('dashboard page loading, empty, error, and partial-data states', () => {
  beforeEach(() => {
    mocks.getInvestmentMonthlyChange.mockReset()
    mocks.listTransactions.mockReset()
    mocks.getCategorySummary.mockReset()
    mocks.getMonthlySummary.mockReset()
    mocks.useAuth.mockReset().mockReturnValue({
      accessToken: 'token',
      isAuthEnabled: true,
      isLoading: false,
    })
    mocks.usePeriod.mockReset().mockReturnValue({ year: 2026, month: 7 })
  })

  it('shows a loading state before data arrives', async () => {
    mocks.getMonthlySummary.mockReturnValue(new Promise(() => {}))
    mocks.getInvestmentMonthlyChange.mockReturnValue(new Promise(() => {}))
    mocks.getCategorySummary.mockReturnValue(new Promise(() => {}))
    mocks.listTransactions.mockReturnValue(new Promise(() => {}))

    render(<DashboardPage greeting="Good morning" displayName="Francisco" />)

    expect(await screen.findByText('Preparing dashboard')).toBeInTheDocument()
  })

  it('shows an empty state when there is no recent spending', async () => {
    mocks.getMonthlySummary.mockResolvedValue(MONTHLY_SUMMARY)
    mocks.getInvestmentMonthlyChange.mockResolvedValue({
      unrealised_monthly_change: '10.00',
      is_estimated: false,
    })
    mocks.getCategorySummary.mockResolvedValue({ items: [] })
    mocks.listTransactions.mockResolvedValue([])

    render(<DashboardPage greeting="Good morning" displayName="Francisco" />)

    expect(
      await screen.findByText('No recent spending found for this month.'),
    ).toBeInTheDocument()
  })

  it('excludes fully owed expenses and caps the recent list at six', async () => {
    mocks.getMonthlySummary.mockResolvedValue(MONTHLY_SUMMARY)
    mocks.getInvestmentMonthlyChange.mockResolvedValue({
      unrealised_monthly_change: '10.00',
      is_estimated: false,
    })
    mocks.getCategorySummary.mockResolvedValue({ items: [] })
    mocks.listTransactions.mockResolvedValue([
      makeExpense(1, 'Fully owed expense', {
        is_owed: true,
        owed_amount_total: '20.00',
      }),
      makeExpense(2, 'Partially owed expense', {
        is_owed: true,
        owed_amount_total: '5.00',
      }),
      makeExpense(3, 'Personal expense one'),
      makeExpense(4, 'Personal expense two'),
      makeExpense(5, 'Personal expense three'),
      makeExpense(6, 'Personal expense four'),
      makeExpense(7, 'Personal expense five'),
      makeExpense(8, 'Seventh eligible expense'),
    ])

    render(<DashboardPage greeting="Good morning" displayName="Francisco" />)

    expect(await screen.findByText('Partially owed expense')).toBeInTheDocument()
    expect(screen.getByText('Personal expense five')).toBeInTheDocument()
    expect(screen.queryByText('Fully owed expense')).not.toBeInTheDocument()
    expect(screen.queryByText('Seventh eligible expense')).not.toBeInTheDocument()

    expect(mocks.listTransactions).toHaveBeenCalledWith({
      direction: 'out',
      date_from: '2026-07-01',
      date_to: '2026-07-31',
      limit: 500,
    })
  })

  it('leads with authoritative Available Net and keeps unrealised performance separate', async () => {
    mocks.getMonthlySummary.mockResolvedValue({
      ...MONTHLY_SUMMARY,
      available_net: '500.00',
    })
    mocks.getInvestmentMonthlyChange.mockResolvedValue({
      unrealised_monthly_change: '999.00',
      is_estimated: false,
    })
    mocks.getCategorySummary.mockResolvedValue({ items: [] })
    mocks.listTransactions.mockResolvedValue([])

    render(<DashboardPage greeting="Good morning" displayName="Francisco" />)

    expect((await screen.findAllByText('Available net')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('€500.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Investment performance')).toBeInTheDocument()
    expect(screen.getByText('+€999.00')).toBeInTheDocument()
    expect(
      screen.getByText('unrealised market/FX — not part of cash flow'),
    ).toBeInTheDocument()
  })

  it.each([
    {
      status: 'in_progress',
      invested: '60.00',
      remaining: '40.00',
      over: '0.00',
      expected: '€40.00 to go',
    },
    {
      status: 'reached',
      invested: '100.00',
      remaining: '0.00',
      over: '0.00',
      expected: 'Goal reached',
    },
    {
      status: 'exceeded',
      invested: '130.00',
      remaining: '0.00',
      over: '30.00',
      expected: 'Over by €30.00',
    },
  ])('shows the $status monthly investment goal state', async ({
    status,
    invested,
    remaining,
    over,
    expected,
  }) => {
    mocks.getMonthlySummary.mockResolvedValue({
      ...MONTHLY_SUMMARY,
      net_invested_cash: invested,
      investment_goal_remaining: remaining,
      investment_goal_over: over,
      investment_goal_status: status,
    })
    mocks.getInvestmentMonthlyChange.mockResolvedValue({
      unrealised_monthly_change: '10.00',
      is_estimated: false,
    })
    mocks.getCategorySummary.mockResolvedValue({ items: [] })
    mocks.listTransactions.mockResolvedValue([])

    render(<DashboardPage greeting="Good morning" displayName="Francisco" />)

    expect(await screen.findByText(expected)).toBeInTheDocument()
  })

  it('shows unavailable investment cash flow without inventing Available Net', async () => {
    mocks.getMonthlySummary.mockResolvedValue({
      ...MONTHLY_SUMMARY,
      net_invested_cash: null,
      available_net: null,
      investment_cashflow_status: 'unavailable',
      investment_reconciliation_status: 'partial',
      investment_goal_remaining: null,
      investment_goal_over: null,
      investment_goal_status: 'unavailable',
    })
    mocks.getInvestmentMonthlyChange.mockResolvedValue({
      unrealised_monthly_change: '-20.00',
      is_estimated: false,
    })
    mocks.getCategorySummary.mockResolvedValue({ items: [] })
    mocks.listTransactions.mockResolvedValue([])

    render(<DashboardPage greeting="Good morning" displayName="Francisco" />)

    expect(await screen.findByText('Cash flow unavailable')).toBeInTheDocument()
    expect(
      screen.getByText('Some investment funding is not fully reconciled.'),
    ).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows a full error when required data fails to load', async () => {
    mocks.getMonthlySummary.mockRejectedValue(new Error('Summary unavailable'))
    mocks.getInvestmentMonthlyChange.mockResolvedValue({
      unrealised_monthly_change: '10.00',
      is_estimated: false,
    })
    mocks.getCategorySummary.mockResolvedValue({ items: [] })
    mocks.listTransactions.mockResolvedValue([])

    render(<DashboardPage greeting="Good morning" displayName="Francisco" />)

    expect(await screen.findByText('Summary unavailable')).toBeInTheDocument()
  })

  it('shows a partial-failure warning while still rendering the rest of the dashboard', async () => {
    mocks.getMonthlySummary.mockResolvedValue(MONTHLY_SUMMARY)
    mocks.getInvestmentMonthlyChange.mockRejectedValue(new Error('Market data down'))
    mocks.getCategorySummary.mockResolvedValue({ items: [] })
    mocks.listTransactions.mockResolvedValue([])

    render(<DashboardPage greeting="Good morning" displayName="Francisco" />)

    expect(
      await screen.findByText(
        'Investment monthly change could not be loaded. Other dashboard data remains available.',
      ),
    ).toBeInTheDocument()

    expect(await screen.findByText('Money in')).toBeInTheDocument()
    expect(screen.getAllByText('€1,000.00').length).toBeGreaterThan(0)
  })
})
