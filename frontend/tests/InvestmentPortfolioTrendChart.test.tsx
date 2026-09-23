import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { InvestmentPortfolioTrendChart } from '../src/components/investments/InvestmentPortfolioTrendChart'

describe('InvestmentPortfolioTrendChart states', () => {
  it('reserves the trend plot while loading', () => {
    render(
      <InvestmentPortfolioTrendChart
        months={24}
        series={[]}
        isLoading
        onMonthsChange={vi.fn()}
      />,
    )

    expect(
      screen.getByLabelText('Loading portfolio trend'),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('renders an explicit empty state', () => {
    render(
      <InvestmentPortfolioTrendChart
        months={24}
        series={[]}
        onMonthsChange={vi.fn()}
      />,
    )

    expect(screen.getByText('No portfolio trend yet')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Add investment events and valuation prices to show the portfolio trend.',
      ),
    ).toBeInTheDocument()
  })

  it('renders an explicit error state', () => {
    render(
      <InvestmentPortfolioTrendChart
        months={24}
        series={[]}
        error="Historical valuation data unavailable"
        onMonthsChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Historical valuation data unavailable',
    )
  })

  it('keeps portfolio and allocated capital visually distinct', () => {
    const { container } = render(
      <InvestmentPortfolioTrendChart
        months={24}
        series={[{
          month: '2026-02', allocated_eur: '1000.00', market_value_eur: '1200.00',
          gain_eur: '200.00', is_estimated: false,
        }]}
        onMonthsChange={vi.fn()}
      />,
    )

    expect(container.querySelector('.investment-trend-value-line')).toBeInTheDocument()
    expect(container.querySelector('.investment-trend-allocated-line')).toBeInTheDocument()
    expect(container.querySelector('.investment-trend-allocated-point')).toBeInTheDocument()
  })
})
