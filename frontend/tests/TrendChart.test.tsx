import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrendChart } from '../src/components/charts'

const months = ['2026-01', '2026-02', '2026-03', '2026-04']

function renderChart(overrides: Partial<Parameters<typeof TrendChart>[0]> = {}) {
  return render(
    <TrendChart
      points={months}
      series={[
        {
          key: 'value',
          label: 'Portfolio',
          values: [42_000, 47_500, 45_100, 52_800],
          lineClassName: 'value-line',
          endPointClassName: 'value-point',
        },
      ]}
      formatValue={(value) => `€${value.toFixed(2)}`}
      formatAxisValue={(value) => `€${Math.round(value / 1000)}K`}
      formatPointLabel={(key) => key}
      ariaLabelPrefix="Trend."
      xLabelClassName="x-label"
      baselineClassName="baseline"
      {...overrides}
    />,
  )
}

describe('TrendChart', () => {
  it('draws a line and end marker for each series', () => {
    const { container } = renderChart()

    expect(container.querySelector('path.value-line')).toBeInTheDocument()
    expect(container.querySelector('circle.value-point')).toBeInTheDocument()
  })

  it('labels the y-axis with the compact formatter, inside the plot', () => {
    const { container } = renderChart()

    const axisLabels = [...container.querySelectorAll('.trend-chart-axis-label')]
    expect(axisLabels.length).toBeGreaterThan(0)

    for (const label of axisLabels) {
      expect(label.textContent).toMatch(/^€\d+K$/)
      // Anchored inside the left gutter, never at a negative coordinate.
      expect(Number(label.getAttribute('x'))).toBeGreaterThan(0)
    }
  })

  it('clips its own overflow so labels cannot spill past the plot', () => {
    const { container } = renderChart()

    expect(container.querySelector('svg.trend-chart-svg')).toBeInTheDocument()
  })

  it('keeps every plotted coordinate inside the drawing area', () => {
    const { container } = renderChart({
      series: [
        {
          key: 'value',
          label: 'Portfolio',
          // A deliberately flat-then-spiky series that used to pin the line
          // to the top and bottom edges of the plot.
          values: [50_000, 50_100, 49_900, 88_000],
          lineClassName: 'value-line',
          areaClassName: 'value-area',
        },
      ],
    })

    const svg = container.querySelector('svg') as SVGSVGElement
    const width = Number(svg.getAttribute('width'))
    const height = Number(svg.getAttribute('height'))

    for (const path of container.querySelectorAll('path')) {
      const numbers = (path.getAttribute('d') ?? '').match(/-?\d+(\.\d+)?/g) ?? []

      numbers.forEach((raw, index) => {
        const value = Number(raw)
        const limit = index % 2 === 0 ? width : height
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(limit)
      })
    }
  })

  it('reveals a tooltip with every series value on focus and moves with the keyboard', () => {
    renderChart()

    const svg = screen.getByRole('img')
    fireEvent.focus(svg)

    // Focus selects the latest point.
    expect(svg).toHaveAccessibleName(/2026-04: Portfolio €52800\.00/)

    fireEvent.keyDown(svg, { key: 'ArrowLeft' })
    expect(svg).toHaveAccessibleName(/2026-03: Portfolio €45100\.00/)
  })

  it('renders a note against an annotated point', () => {
    renderChart({ pointNote: (key) => (key === '2026-04' ? 'estimated' : null) })

    const svg = screen.getByRole('img')
    fireEvent.focus(svg)

    expect(svg).toHaveAccessibleName(/2026-04 · estimated/)
  })
})
