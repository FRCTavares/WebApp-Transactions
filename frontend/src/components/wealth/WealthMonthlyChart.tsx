import type { WealthMonthlyTotal } from '../../types/api'
import { formatMoney } from '../../utils/format'

type WealthMonthlyChartProps = {
  monthlyTotals: WealthMonthlyTotal[]
}

const chartWidth = 900
const chartHeight = 190
const paddingLeft = 18
const paddingRight = 18
const paddingTop = 24
const paddingBottom = 34

const monthNames = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

function formatMonthLabel(month: string) {
  const [year, monthNumber] = month.split('-')
  const monthIndex = Number(monthNumber) - 1

  if (!year || monthIndex < 0 || monthIndex >= monthNames.length) {
    return month
  }

  return `${monthNames[monthIndex]} ${year}`
}

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

function buildLinePath(points: ReturnType<typeof getChartPoints>) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')
}

function buildAreaPath(points: ReturnType<typeof getChartPoints>) {
  const baseline = chartHeight - paddingBottom
  const linePath = buildLinePath(points)
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]

  return `${linePath} L ${lastPoint.x.toFixed(2)} ${baseline} L ${firstPoint.x.toFixed(2)} ${baseline} Z`
}

export function WealthMonthlyChart({ monthlyTotals }: WealthMonthlyChartProps) {
  if (monthlyTotals.length === 0) {
    return null
  }

  const points = getChartPoints(monthlyTotals)
  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  const change = lastPoint.value - firstPoint.value
  const changePercent = firstPoint.value > 0 ? (change / firstPoint.value) * 100 : 0
  const isPositiveChange = change >= 0

  const pathData = buildLinePath(points)
  const areaPathData = buildAreaPath(points)
  const latestMonth = formatMonthLabel(lastPoint.month)

  const labelPoints = [
    points[0],
    points[Math.floor(points.length / 2)],
    points[points.length - 1],
  ].filter((point, index, array) => {
    return array.findIndex((item) => item.month === point.month) === index
  })

  return (
    <div className="wealth-chart-card">
      <div className="wealth-chart-header">
        <div>
          <h3>Wealth trend</h3>
          <p className="muted small">
            Latest monthly net worth.
          </p>
        </div>

        <div className="wealth-chart-stat">
          <span>Current</span>
          <strong>{formatMoney(lastPoint.value.toFixed(2))}</strong>
          <small className={isPositiveChange ? 'positive' : 'negative'}>
            {isPositiveChange ? '+' : ''}
            {formatMoney(change.toFixed(2))} · {changePercent.toFixed(1)}%
          </small>
        </div>
      </div>

      <div className="wealth-chart-wrap">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Monthly wealth trend">
          <path d={areaPathData} className="wealth-chart-area" />

          <line
            x1={paddingLeft}
            y1={chartHeight - paddingBottom}
            x2={chartWidth - paddingRight}
            y2={chartHeight - paddingBottom}
            className="wealth-chart-baseline"
          />

          <path d={pathData} className="wealth-chart-line" />

          <circle
            cx={firstPoint.x}
            cy={firstPoint.y}
            r="3.5"
            className="wealth-chart-edge-point"
          >
            <title>{`${formatMonthLabel(firstPoint.month)}: ${formatMoney(firstPoint.value.toFixed(2))}`}</title>
          </circle>

          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="5.75"
            className="wealth-chart-current-point"
          >
            <title>{`${latestMonth}: ${formatMoney(lastPoint.value.toFixed(2))}`}</title>
          </circle>

          <text
            x={firstPoint.x}
            y={Math.max(firstPoint.y - 10, 14)}
            textAnchor="start"
            className="wealth-chart-value-label"
          >
            {formatMoney(firstPoint.value.toFixed(0))}
          </text>

          <text
            x={lastPoint.x}
            y={Math.max(lastPoint.y - 12, 14)}
            textAnchor="end"
            className="wealth-chart-value-label wealth-chart-value-label-current"
          >
            {formatMoney(lastPoint.value.toFixed(0))}
          </text>

          {labelPoints.map((point) => (
            <text
              key={point.month}
              x={point.x}
              y={chartHeight - 12}
              textAnchor={point.month === firstPoint.month ? 'start' : point.month === lastPoint.month ? 'end' : 'middle'}
              className="wealth-chart-label"
            >
              {formatMonthLabel(point.month)}
            </text>
          ))}
        </svg>
      </div>
    </div>
  )
}
