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
})
