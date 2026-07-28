import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChartGrid } from '../src/components/charts'

describe('ChartGrid', () => {
  it('renders grid rows with optional formatted labels', () => {
    const { container } = render(
      <svg>
        <ChartGrid
          x1={30}
          x2={870}
          labelX={22}
          rows={[
            { label: '€1,000.00', y: 40 },
            { label: '€500.00', y: 80 },
            { y: 120 },
          ]}
        />
      </svg>,
    )

    expect(container.querySelectorAll('line')).toHaveLength(3)
    expect(screen.getByText('€1,000.00')).toBeInTheDocument()
    expect(screen.getByText('€500.00')).toBeInTheDocument()
    expect(container.querySelectorAll('.trend-chart-axis-label')).toHaveLength(2)
  })
})
