import type { WealthMonthlyTotal } from '../../types/api'
import { formatMoney } from '../../utils/format'

type WealthMonthlyChartProps = {
  monthlyTotals: WealthMonthlyTotal[]
}

const chartWidth = 900
const chartHeight = 260
const paddingLeft = 72
const paddingRight = 24
const paddingTop = 24
const paddingBottom = 48

function getChartPoints(monthlyTotals: WealthMonthlyTotal[]) {
  const values = monthlyTotals.map((row) => Number(row.total_wealth_eur))
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const valueRange = Math.max(maxValue - minValue, 1)

  const usableWidth = chartWidth - paddingLeft - paddingRight
  const usableHeight = chartHeight - paddingTop - paddingBottom

  return monthlyTotals.map((row, index) => {
    const x = paddingLeft + (index / Math.max(monthlyTotals.length - 1, 1)) * usableWidth
    const y = paddingTop + ((maxValue - Number(row.total_wealth_eur)) / valueRange) * usableHeight

    return {
      month: row.month,
      value: Number(row.total_wealth_eur),
      x,
      y,
    }
  })
}

export function WealthMonthlyChart({ monthlyTotals }: WealthMonthlyChartProps) {
  if (monthlyTotals.length === 0) {
    return null
  }

  const points = getChartPoints(monthlyTotals)
  const pathData = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  const change = lastPoint.value - firstPoint.value
  const changePercent = firstPoint.value > 0 ? (change / firstPoint.value) * 100 : 0

  const visibleLabels = points.filter((_, index) => {
    return index === 0 || index === points.length - 1 || index % 3 === 0
  })

  return (
    <div className="wealth-chart-card">
      <div className="wealth-chart-header">
        <div>
          <h3>Wealth over time</h3>
          <p className="muted small">
            Monthly net worth using the latest snapshot carried forward per account.
          </p>
        </div>

        <div className="wealth-chart-stat">
          <span>Change</span>
          <strong>{formatMoney(change.toFixed(2))}</strong>
          <small>{changePercent.toFixed(1)}%</small>
        </div>
      </div>

      <div className="wealth-chart-wrap">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Monthly wealth chart">
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={chartHeight - paddingBottom}
            className="wealth-chart-axis"
          />
          <line
            x1={paddingLeft}
            y1={chartHeight - paddingBottom}
            x2={chartWidth - paddingRight}
            y2={chartHeight - paddingBottom}
            className="wealth-chart-axis"
          />

          <path d={pathData} className="wealth-chart-line" />

          {points.map((point) => (
            <circle
              key={point.month}
              cx={point.x}
              cy={point.y}
              r="4"
              className="wealth-chart-point"
            >
              <title>{`${point.month}: ${formatMoney(point.value.toFixed(2))}`}</title>
            </circle>
          ))}

          {visibleLabels.map((point) => (
            <text
              key={point.month}
              x={point.x}
              y={chartHeight - 18}
              textAnchor="middle"
              className="wealth-chart-label"
            >
              {point.month}
            </text>
          ))}

          <text
            x={paddingLeft - 10}
            y={paddingTop + 4}
            textAnchor="end"
            className="wealth-chart-label"
          >
            {formatMoney(Math.max(...points.map((point) => point.value)).toFixed(0))}
          </text>

          <text
            x={paddingLeft - 10}
            y={chartHeight - paddingBottom + 4}
            textAnchor="end"
            className="wealth-chart-label"
          >
            {formatMoney(Math.min(...points.map((point) => point.value)).toFixed(0))}
          </text>
        </svg>
      </div>
    </div>
  )
}
