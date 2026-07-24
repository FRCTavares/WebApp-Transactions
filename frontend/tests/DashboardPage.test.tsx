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

  it('excludes fully owed expenses and fills the five recent slots', async () => {
    mocks.getMonthlySummary.mockResolvedValue(MONTHLY_SUMMARY)
    mocks.getInvestmentMonthlyChange.mockResolvedValue({
      unrealised_monthly_change: '10.00',
      is_estimated: false,
    })
    mocks.getCategorySummary.mockResolvedValue({ items: [] })
    mocks.listTransactions.mockResolvedValue([
      {
        id: 1,
        date: '2026-07-20',
        description: 'Fully owed expense',
        raw_description: 'Fully owed expense',
        amount: '40.00',
        direction: 'out',
        category: 'Other',
        notes: null,
        is_owed: true,
        owed_amount_total: '40.00',
      },
      {
        id: 2,
        date: '2026-07-19',
        description: 'Personal expense one',
        raw_description: 'Personal expense one',
        amount: '20.00',
        direction: 'out',
        category: 'Other',
        notes: null,
        is_owed: false,
        owed_amount_total: null,
      },
      {
        id: 3,
        date: '2026-07-18',
        description: 'Partially owed expense',
        raw_description: 'Partially owed expense',
        amount: '30.00',
        direction: 'out',
        category: 'Other',
        notes: null,
        is_owed: true,
        owed_amount_total: '10.00',
      },
      {
        id: 4,
        date: '2026-07-17',
        description: 'Personal expense two',
        raw_description: 'Personal expense two',
        amount: '12.00',
        direction: 'out',
        category: 'Other',
        notes: null,
        is_owed: false,
        owed_amount_total: null,
      },
      {
        id: 5,
        date: '2026-07-16',
        description: 'Personal expense three',
        raw_description: 'Personal expense three',
        amount: '13.00',
        direction: 'out',
        category: 'Other',
        notes: null,
        is_owed: false,
        owed_amount_total: null,
      },
      {
        id: 6,
        date: '2026-07-15',
        description: 'Personal expense four',
        raw_description: 'Personal expense four',
        amount: '14.00',
        direction: 'out',
        category: 'Other',
        notes: null,
        is_owed: false,
        owed_amount_total: null,
      },
      {
        id: 7,
        date: '2026-07-14',
        description: 'Sixth eligible expense',
        raw_description: 'Sixth eligible expense',
        amount: '15.00',
        direction: 'out',
        category: 'Other',
        notes: null,
        is_owed: false,
        owed_amount_total: null,
      },
    ])

    render(<DashboardPage greeting="Good morning" displayName="Francisco" />)

    expect(await screen.findByText('Personal expense one')).toBeInTheDocument()
    expect(screen.getByText('Partially owed expense')).toBeInTheDocument()
    expect(screen.getByText('Personal expense four')).toBeInTheDocument()
    expect(screen.queryByText('Fully owed expense')).not.toBeInTheDocument()
    expect(screen.queryByText('Sixth eligible expense')).not.toBeInTheDocument()

    expect(mocks.listTransactions).toHaveBeenCalledWith({
      direction: 'out',
      date_from: '2026-07-01',
      date_to: '2026-07-31',
      limit: 500,
    })
  })

  it('uses authoritative Available Net and excludes unrealised performance', async () => {
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

    expect(
      (await screen.findAllByText('Available Net')).length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText('€500.00').length).toBeGreaterThan(0)
    expect(screen.getByText('Investment performance')).toBeInTheDocument()
    expect(screen.getByText('€999.00')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Unrealised market/FX gain or loss; excluded from Available Net',
      ),
    ).toBeInTheDocument()
  })

  it.each([
    {
      status: 'in_progress',
      invested: '60.00',
      remaining: '40.00',
      over: '0.00',
      expected: '€40.00 remaining',
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
      expected: 'Goal exceeded by €30.00',
    },
  ])(
    'shows the $status monthly investment goal state',
    async ({
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

      render(
        <DashboardPage
          greeting="Good morning"
          displayName="Francisco"
        />,
      )

      expect(await screen.findByText(expected)).toBeInTheDocument()
    },
  )

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

    expect(
      await screen.findByText('Investment cash flow unavailable'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Some investment funding is not fully reconciled.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(/Available net: unavailable/i),
    ).toBeInTheDocument()
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

    expect(await screen.findByText('Money In')).toBeInTheDocument()
    expect(screen.getAllByText('€1,000.00').length).toBeGreaterThan(0)
  })
})
