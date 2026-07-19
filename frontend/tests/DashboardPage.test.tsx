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
  money_in: '1000.00',
  personal_money_out: '400.00',
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
