import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { WealthMonthlyChart } from '../src/components/wealth/WealthMonthlyChart'

describe('WealthMonthlyChart states', () => {
  it('reserves the chart surface while loading', () => {
    render(
      <WealthMonthlyChart
        monthlyTotals={[]}
        isLoading
      />,
    )

    expect(
      screen.getByLabelText('Loading wealth history'),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('renders an explicit empty state', () => {
    render(<WealthMonthlyChart monthlyTotals={[]} />)

    expect(screen.getByText('No wealth history yet')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Add account snapshots to start building your monthly wealth trend.',
      ),
    ).toBeInTheDocument()
  })

  it('renders an explicit error state', () => {
    render(
      <WealthMonthlyChart
        monthlyTotals={[]}
        error="Monthly wealth totals could not be loaded"
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Monthly wealth totals could not be loaded',
    )
  })

  it('keeps the exact current value in the header and tooltip, without a duplicate plot label', () => {
    const { container } = render(
      <WealthMonthlyChart monthlyTotals={[
        { month: '2026-01', total_wealth_eur: '1000.00', investment_value_eur: '0.00' },
        { month: '2026-02', total_wealth_eur: '1200.00', investment_value_eur: '0.00' },
      ]} />,
    )

    expect(screen.getByText('€1,200.00')).toBeInTheDocument()
    expect(screen.getByRole('img')).toHaveAccessibleName(/Net worth €1,200.00/)
    expect(container.querySelector('.wealth-chart-value-label')).not.toBeInTheDocument()
  })
})
