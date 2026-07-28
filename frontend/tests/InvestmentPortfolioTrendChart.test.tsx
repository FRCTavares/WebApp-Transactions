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
})
